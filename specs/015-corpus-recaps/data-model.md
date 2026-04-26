# Phase 1 Data Model: Corpus-Grounded Delta Recaps

**Date**: 2026-04-26
**Status**: Complete

## Schema Changes

### New Table: `page_captures`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Internal id |
| `user_id` | `uuid` | `NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` | Owner; RLS keys off this |
| `book_id` | `uuid` | `NOT NULL REFERENCES books(id) ON DELETE CASCADE` | Cascade with book deletion |
| `page` | `integer` | `NOT NULL CHECK (page >= 0)` | Sourced from `reading_progress.current_page` at capture time. NEVER from OCR. |
| `text` | `text` | `NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 10000)` | OCR'd + user-edited text. 10K char cap (FR-008a). |
| `word_count` | `integer` | `NOT NULL CHECK (word_count >= 0)` | Stored for future analytics. Computed at insert time. |
| `confidence` | `numeric(3,2)` | `NOT NULL CHECK (confidence >= 0 AND confidence <= 1)` | Self-rated by Gemini multimodal. Used by UI to surface low-confidence warnings. |
| `captured_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Insert time |
| `source` | `text` | `NOT NULL DEFAULT 'ocr'` | Reserved for future sources (`'manual'`, `'import'`). Currently always `'ocr'`. |

**Unique constraint**: `UNIQUE (user_id, book_id, page)` — re-capturing the same page upserts. ON CONFLICT replaces all columns except `id` and `captured_at` (captured_at refreshes to the latest capture time).

**Indexes**:
- `idx_page_captures_user_book_page` on `(user_id, book_id, page)` — primary access pattern (recap delta-range fetch + UI lookup)
- The PK (`id`) is implicitly indexed.

**RLS policies** (see `contracts/page-captures-rls.sql`):
- `SELECT`: `auth.uid() = user_id`
- `INSERT`: `auth.uid() = user_id`
- `UPDATE`: `auth.uid() = user_id` (used by upsert)
- `DELETE`: `auth.uid() = user_id` (cascade-only path in v1; no UI surface)

### Extended Table: `recaps`

A single new column added to the existing `recaps` table:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `mode` | `text` | `NOT NULL DEFAULT 'inferred' CHECK (mode IN ('corpus','inferred'))` | Records which generation path produced the recap. Default `'inferred'` so historical rows get the correct value with no backfill. |

**Migration semantics**: Adding a `NOT NULL ... DEFAULT 'inferred'` column is a single-statement change. All historical recaps will be tagged `inferred`, which is correct.

**No other column changes to `recaps`.** The `progress_snapshot` column already records the page percentage at recap time and serves as the `last_recap_page` source for delta calculation.

## Entities

### `PageCapture`

**Lifecycle**:

```text
[no row]
   │
   │ user snaps + confirms verify
   ▼
[INSERT] ──┐
   │       │ user re-captures same page
   │       ▼
   │   [UPDATE via ON CONFLICT — text/word_count/confidence/captured_at refresh]
   │
   │ book deleted    OR    user deleted
   ▼
[DELETE via cascade]
```

**Validation rules** (enforced at DB + edge function level):
- `text` MUST be non-empty after the user's edit on the verify screen. Empty text is treated as Skip (no row inserted).
- `text` MUST be ≤10,000 characters. Truncation happens at the verify screen prior to commit; the DB CHECK is a defense-in-depth guard.
- `page` is sourced from the user's tracked `reading_progress.current_page` at capture time. The frontend reads it; the edge function does NOT trust a `page` field from the request body (defense against the user-clarified rule that page MUST never be OCR-detected — same defense extends to never accepting an arbitrary client-supplied page).
- `confidence` is the value returned by the OCR endpoint, persisted unmodified.

**Access patterns**:
1. **Recap delta fetch** (hottest path): `SELECT page, text FROM page_captures WHERE user_id = $1 AND book_id = $2 AND page > $3 AND page <= $4 ORDER BY page` — served by the composite index.
2. **Coverage check**: `SELECT count(*) FROM page_captures WHERE user_id = $1 AND book_id = $2 AND page > $3 AND page <= $4` — same index.
3. **Upsert on capture**: `INSERT ... ON CONFLICT (user_id, book_id, page) DO UPDATE SET ...` — uses the unique constraint.

### `Recap` (extended)

**Pre-existing entity unchanged except for the new `mode` column.**

**State for `mode`**:
- `'inferred'` — recap was generated from book metadata + estimated progress (today's path).
- `'corpus'` — recap was generated from `page_captures` text within the delta range.

**Mode is determined at generation time** by the edge function based on the coverage check; it is not user-controllable. Once persisted, the value is immutable.

## Coverage Computation

Given:
- `R_prev` = `last_recap_page` (the `progress_snapshot` of the most recent recap row for this book/user, or 0 if none exists)
- `R_curr` = `current_page` (from `reading_progress.current_page`)
- `delta_range_pages` = `R_curr - R_prev` (integer pages in the range, exclusive of `R_prev`, inclusive of `R_curr`)
- `captured_pages_in_range` = `count(page_captures WHERE page > R_prev AND page <= R_curr)`

Coverage:
```text
coverage = captured_pages_in_range / delta_range_pages   if delta_range_pages > 0
         = 0                                             otherwise
```

Mode selection:
```text
mode = 'corpus'   if coverage >= 0.30 AND captured_pages_in_range >= 1
     = 'inferred' otherwise
```

The `>= 1` guard prevents corpus mode from triggering on degenerate inputs (e.g., `delta_range_pages = 1` with 0 captures → coverage = 0; or boundary cases where rounding rules might otherwise mislead).

## Relationships

```text
auth.users (1) ──< (N) page_captures
books      (1) ──< (N) page_captures
books      (1) ──< (N) recaps                  -- existing
auth.users (1) ──< (N) recaps                  -- existing
reading_progress (1:1 user/book) ── feeds page key for page_captures
```

No new join tables; all relationships are direct foreign keys.

## Cascade Behavior

- Deleting a `book` removes all its `page_captures` and all its `recaps` (cascade — both already configured for `recaps`).
- Deleting an `auth.user` removes all their `page_captures` and all their `recaps` (cascade).
- Re-capturing the same `(user, book, page)` overwrites the prior row's content but keeps the same `id`. (Implementation note: ON CONFLICT path in `INSERT ... ON CONFLICT (...) DO UPDATE`.)

## Storage Estimate

- Average capture: ~3KB (300 words × ~10 bytes/word)
- Maximum capture: ~10KB (FR-008a cap)
- Heavy user: 50 books × 100 captures = 5,000 rows = ~15MB text data + ~500KB metadata = **~15.5MB total per heavy user**
- Casual user: 5 books × 10 captures = 50 rows = ~150KB

Storage cost is negligible at any realistic user scale.

## Out of Scope (data model)

- No `page_captures_history` audit log — re-captures overwrite cleanly without versioning.
- No image storage column or bucket — image is discarded after OCR.
- No additional indexes for full-text search — search is not a v1 feature.
- No partitioning — table size projection is well below partitioning thresholds.
