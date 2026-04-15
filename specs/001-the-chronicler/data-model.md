# Data Model: The Chronicler

**Phase**: 1 — Design
**Date**: 2026-04-15

---

## Entities

### User (via Supabase Auth)

Managed by `supabase.auth`. No custom `users` table; app uses `auth.uid()` as the foreign
key anchor for all user-owned records.

| Attribute | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, set by Supabase Auth |
| `email` | `text` | Auth credential |
| `created_at` | `timestamptz` | Set by Auth |

**Validation**: Email uniqueness enforced by Supabase Auth. No user record is created in app
tables until the first authenticated action.

---

### Book

Represents a title in the reader's personal library.

| Attribute | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | No | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | No | FK → `auth.users` |
| `title` | `text` | No | Required; 1–500 chars |
| `author` | `text` | No | Required; 1–200 chars |
| `isbn` | `text` | Yes | ISBN-10 or ISBN-13; no hyphens |
| `cover_url` | `text` | Yes | Remote image URL from Open Library |
| `total_pages` | `integer` | No | Must be ≥ 1 |
| `genre` | `text` | Yes | Free-form string |
| `created_at` | `timestamptz` | No | `now()` default |

**Validation rules**:
- `title` and `author` MUST be non-empty strings.
- `total_pages` MUST be a positive integer ≥ 1.
- `isbn` when present MUST be 10 or 13 digits (digits only, no hyphens).
- One user may own multiple books with the same ISBN (e.g., reading the same title twice in
  different editions).

**Indexes**: `(user_id)` for library listing.

---

### ReadingProgress

Tracks the reader's current position in a book. One record per (book, user) pair.

| Attribute | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | No | PK |
| `book_id` | `uuid` | No | FK → `books` |
| `user_id` | `uuid` | No | FK → `auth.users` |
| `current_page` | `integer` | No | 0 ≤ value ≤ `books.total_pages` |
| `updated_at` | `timestamptz` | No | Updated on every progress write |

**Computed (application layer)**:
```
percentage = round((current_page / book.total_pages) * 100, 2)
```

**Constraints**:
- `UNIQUE(book_id, user_id)` — enforced at DB level; use upsert on conflict.
- `current_page` MUST be ≥ 0 and ≤ `book.total_pages`. Validated at application layer before
  write; DB CHECK constraint as safety net.

**Indexes**: `(user_id)` for dashboard queries.

**Offline behavior**: Progress updates written to IndexedDB queue first; synced to Supabase
on reconnect via Background Sync. `updated_at` is set at queue-write time, not sync time.

---

### Recap

An AI-generated briefing snapshot for a book at a specific progress point.

| Attribute | Type | Nullable | Notes |
|---|---|---|---|
| `id` | `uuid` | No | PK |
| `book_id` | `uuid` | No | FK → `books` |
| `user_id` | `uuid` | No | FK → `auth.users` |
| `progress_snapshot` | `numeric(5,2)` | No | Percentage at time of generation |
| `memory_jogger` | `text` | No | Recent events tier |
| `concept_watchlist` | `text` | No | Key figures/ideas tier |
| `thematic_bridge` | `text` | No | Narrative vibe tier |
| `created_at` | `timestamptz` | No | `now()` default |

**Notes**:
- Multiple recaps per (book, user) are allowed — one per generation session.
- No deduplication by `progress_snapshot`; the user may regenerate at the same progress.
- All three text fields MUST be non-empty before persisting (validated after AI stream
  completes; do not persist partial recaps).

**Indexes**: `(book_id, user_id, created_at DESC)` for history queries.

---

## Entity Relationships

```
auth.users (1)─────────────────────────────────┐
           │                                    │
           │ 1:N                                │ 1:N
           ▼                                    ▼
         books ──(1:1 per user)── reading_progress
           │
           │ 1:N
           ▼
         recaps
```

- One user → many books.
- One book (per user) → exactly one ReadingProgress record.
- One book (per user) → many Recap records.
- Recaps are never shared across users.

---

## Row Level Security (RLS) Policies

All tables MUST have RLS enabled. The policy for every table follows the same pattern:

```
SELECT / INSERT / UPDATE / DELETE: auth.uid() = user_id
```

- Users can only see and modify their own records.
- No cross-user data access is permitted.
- The `books` table's `user_id` column is set to `auth.uid()` at insert time by the
  application; the database enforces it cannot be overridden.

---

## State Transitions

### ReadingProgress — Current Page

```
Initial (page = 0)
  │
  ▼ user updates page
Active (0 < page < total_pages)
  │
  ▼ page reaches total_pages
Completed (page = total_pages)
  │
  ▼ user edits page (e.g., re-read)
Active
```

No hard state column is needed; completion is derived from `current_page = book.total_pages`.

### Recap — Generation Lifecycle

```
Triggered (user requests recap)
  │
  ▼ AI stream begins
Streaming (partial text displayed)
  │
  ▼ stream completes + all 3 fields non-empty
Persisted (saved to DB, added to history)
  │
  ▼ (immutable — recaps are never edited after creation)
```

If the stream fails or produces empty fields: discard, show error, do not persist.
