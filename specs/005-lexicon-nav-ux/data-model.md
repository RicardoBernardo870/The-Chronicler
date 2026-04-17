# Data Model: Lexicon & Navigation UX Improvements

**Feature**: 005-lexicon-nav-ux
**Date**: 2026-04-17

> No database schema changes are needed for this feature. All changes are client-side.
> This document describes the relevant existing entities and the new client-side state shapes.

---

## Existing Entities (unchanged schema)

### LexiconEntry

| Field | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → auth.users, NOT NULL |
| `book_id` | uuid | FK → books, NOT NULL |
| `term` | text | NOT NULL |
| `definition` | text | NOT NULL |
| `entry_type` | enum('dictionary','lore') | NOT NULL |
| `context_sentence` | text | nullable |
| `page_found` | integer | nullable |
| `leitner_box` | integer | 1–5, NOT NULL |
| `next_review_at` | date | NOT NULL |
| `created_at` | timestamptz | NOT NULL |

**Integrity note**: `book_id` is already `NOT NULL` at the DB level. This feature enforces the same constraint at the client-side creation UI (previously bypassed by silent fallback). No migration needed.

### ReadingProgress (read-only dependency)

Used by Book Detail page to populate `pageFound` default when adding a word from that page. No changes.

| Field | Type | Notes |
|---|---|---|
| `current_page` | integer | Read by BookDetailPage to default `pageFound` |

---

## New Client-Side State

### Lexicon Store additions

```text
_wotdCache: { date: string, entryId: string } | null   (reactive ref, seeded from localStorage on boot)
_wotdEntry: LexiconEntry | null                        (resolved entry, computed from _wotdCache + entriesByBook)
isPreviewWotd: boolean                                 (true when no entry is due — showing next upcoming)
```

**Lifecycle**:
1. On `useLexiconStore` creation, read `wotd_<userId>` from `localStorage`. If today's date matches → populate `_wotdCache`.
2. `resolveWordOfTheDay()` action: if cache is valid, resolve entry from `entriesByBook`; else run selection algorithm, persist to cache, set `_wotdCache`.
3. `wordOfTheDay` computed: returns `_wotdEntry` (replaces current `getDueWord(all)` call).

### localStorage key

```text
key:   "bookhero_wotd_{userId}"
value: JSON { date: "YYYY-MM-DD", entryId: "uuid", isPreview: boolean }
```

---

## Validation Rules (client-side, enforced in AddWordDialog)

| Field | Rule |
|---|---|
| `bookId` | Required — must be a non-empty UUID. When dialog is opened in "context-free" mode (from Lexicon page with no filter), user must select a book before Save is enabled. |
| `term` | Required, non-empty string. |
| `definition` | Required, non-empty string. |
| `entryType` | Defaults to 'dictionary'. |
| `pageFound` | Optional integer ≥ 1. When opened from Book Detail page and user does not override: defaults to `progress.currentPage`. |
