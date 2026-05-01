# Data Model: Library Page Overhaul (019)

## Entities Modified

### LibraryBookEntry *(extended)*

Returned by the `get_library_with_progress` Supabase RPC. One field is added.

| Field | Type | Notes |
|-------|------|-------|
| id | string | book id |
| title | string | |
| author | string | |
| coverUrl | string \| null | |
| totalPages | number | |
| currentPage | number | |
| percentage | number | 0–100 |
| status | BookStatus | `'unread' \| 'reading' \| 'finished'` |
| lastReadAt | string \| null | ISO timestamp |
| sessionStartAt | string \| null | non-null = active session |
| progressId | string \| null | `reading_progress.id` |
| **genre** | **string \| null** | **NEW — pulled from `books.genre`** |

**Change**: Add `genre: string | null` to the TypeScript interface and to the SQL SELECT list of the `get_library_with_progress` function.

---

### Book *(no change)*

Existing `Book` domain type is unchanged. `isbn` and `genre` fields already exist.

---

### UpdateBookInput *(extended)*

The `changes` parameter type of `updateBook` in `src/stores/books.ts` gains `isbn`.

| Field | Type | Notes |
|-------|------|-------|
| title | string | optional |
| author | string | optional |
| totalPages | number | optional |
| genre | string \| null | optional |
| coverUrl | string \| null | optional |
| **isbn** | **string \| null** | **NEW** |

---

## New Derived Concepts (no new DB tables)

### ReadingVelocity *(in-memory only)*

Computed from `progress_history` rows for a book in the past 30 days.

| Field | Type | Notes |
|-------|------|-------|
| bookId | string | |
| avgPagesPerSession | number | mean pages across qualifying sessions |
| qualifyingSessions | number | sessions within past 30 days; must be ≥ 3 to produce estimate |
| daysLeft | number \| null | `null` when < 3 sessions or book complete or totalPages unknown |

**Computation**:
- Fetch `progress_history` rows where `book_id` is in the current in-progress book ids and `recorded_at > now() - 30 days`.
- Group rows by book. Within each book group, derive sessions: a session is a pair of consecutive rows where the later row has a non-null `session_start_at` (explicit session boundary), or two rows on the same calendar day (implicit session).
- `pagesPerSession = (endPage − startPage)` for each session.
- `avgPagesPerSession = sum(pagesPerSession) / sessionCount`.
- `daysLeft = ceil((totalPages - currentPage) / avgPagesPerSession)`.
- If `daysLeft ≤ 0`, return the string `"Finish today!"` rather than a number.

---

## Section Grouping Logic (client-side)

Books are partitioned into three sections by their `status` field from the RPC:

| Section | BookStatus values |
|---------|------------------|
| Currently Reading | `'reading'` |
| The Queue | `'unread'` (ordered by `upNextStore.sortedBookIds()`) |
| The Archives | `'finished'` |

All three sections render even when empty (count = 0).

---

## State: Archives Collapsed/Expanded

A local `ref<boolean>` in `LibraryPage.vue` (default `false` = collapsed). Not persisted to localStorage — resets to collapsed on every page visit per the spec assumption.

---

## State: Open Swipe Card

A module-level `ref<string | null>` exported from `src/components/library/SwipeableBookCard.vue` (or a dedicated composable). Holds the `bookId` of the card whose swipe actions are currently visible, or `null`. Mutual exclusion is enforced by all `SwipeableBookCard` instances watching this ref.
