# Data Model: Supabase RPC Aggregations

**Feature**: 017-supabase-rpc-aggregations
**Date**: 2026-04-30

> No new database tables are introduced. This document covers only the new
> TypeScript types that represent RPC response shapes, and the existing
> database columns each function reads from.

---

## Existing Tables Referenced

### `books`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| title | text | |
| author | text | |
| cover_url | text \| null | |
| total_pages | integer | 0 if unknown |
| genre | text \| null | May be null or empty string |
| created_at | timestamptz | |

### `reading_progress`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| book_id | uuid | FK → books |
| user_id | uuid | FK → auth.users |
| current_page | integer | |
| updated_at | timestamptz | |
| session_start_at | timestamptz \| null | Non-null = active session |

### `progress_history`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| book_id | uuid | FK → books |
| user_id | uuid | FK → auth.users |
| page | integer | Absolute page at checkpoint |
| recorded_at | timestamptz | When the checkpoint was saved |
| session_start_at | timestamptz \| null | Null for legacy rows |
| session_note | text \| null | Optional reader note |

---

## New TypeScript Types (RPC Response Shapes)

### `LibraryBookEntry`
One element of the array returned by `get_library_with_progress`.

```ts
export interface LibraryBookEntry {
  id: string
  title: string
  author: string
  coverUrl: string | null
  totalPages: number
  currentPage: number        // 0 if no progress row exists
  percentage: number         // 0–100, computed: (currentPage / totalPages) * 100
  status: 'unread' | 'reading' | 'finished'
  lastReadAt: string | null  // ISO timestamp from reading_progress.updated_at; null if unstarted
}
```

**Derivation rules**:
- `status = 'finished'` when `currentPage >= totalPages && totalPages > 0`
- `status = 'reading'` when `currentPage > 0 && currentPage < totalPages`
- `status = 'unread'` when `currentPage = 0` or no `reading_progress` row exists
- `percentage` is clamped to 100

---

### `ReadingStats`
Returned by `get_reading_stats`.

```ts
export interface ReadingStats {
  pagesThisWeek: number       // sum of page deltas in last 7 days (UTC)
  pagesThisMonth: number      // sum of page deltas in last 30 days
  totalPagesRead: number      // all-time sum of page deltas across all books
  sessionsThisMonth: number   // count of progress_history rows in last 30 days
  currentStreakDays: number   // consecutive days ending today or yesterday
  longestStreakDays: number   // historical maximum consecutive-day streak
  allTimeVelocityPph: number  // pages/hour across all valid sessions; 0 if none
}
```

**Validity rules for velocity sessions**:
- `session_start_at` is non-null
- `EXTRACT(EPOCH FROM (recorded_at - session_start_at)) >= 60`
- page delta for that book (via LAG) >= 1

---

### `LastSessionSummary`
Returned by `get_last_session`. `null` when the user has no progress history.

```ts
export interface LastSessionSummary {
  bookId: string
  bookTitle: string
  endedAt: string              // recorded_at of the last history row
  startedAt: string | null     // session_start_at; null for legacy rows
  pagesDelta: number           // pages read (clamped ≥ 0)
  startPage: number            // page at start of session (prior row's page, or 0)
  endPage: number              // page at end of session
  durationSeconds: number | null   // null for legacy rows
  velocityPph: number | null       // this-session velocity; null for legacy rows
  completionDelta: number | null   // % of book read this session; null if totalPages = 0
  finishPredictionSessions: number | null  // sessions to finish; null if velocity unavailable
  sessionNote: string | null
}
```

---

### `LibraryBreakdown`
Returned by `get_library_breakdown`.

```ts
export interface GenreDistributionItem {
  genre: string       // 'Uncategorized' when books.genre is null/empty
  count: number
  percentage: number  // rounded to 1 decimal place; items sum to 100
}

export interface LibraryBreakdown {
  genreDistribution: GenreDistributionItem[]
  authorsCount: number
  booksFinished: number
  booksInProgress: number
  booksUnstarted: number
  avgCompletionPct: number  // average % across started books; 0 if none started
}
```

---

## Cache Key Additions

New entries for `cacheKeys` in `src/composables/useCache.ts`:

```ts
library:          (uid: string) => `library:${uid}`,       // replaces books+progress fetch
readingStats:     (uid: string) => `readingStats:${uid}`,
lastSession:      (uid: string) => `lastSession:${uid}`,
libraryBreakdown: (uid: string) => `libraryBreakdown:${uid}`,
```

TTL recommendations:
- `library`: 60 s (same as current `books`)
- `readingStats`: 120 s (slower-moving aggregates)
- `lastSession`: 30 s (same as current `progress` — session state is volatile)
- `libraryBreakdown`: 120 s (changes only on book add/remove/edit)

---

## Invalidation Map

When a write operation occurs, the following cache keys must be invalidated
(in addition to their existing invalidations):

| Write operation | Keys to invalidate |
|---|---|
| `addBook` | `library:{uid}`, `libraryBreakdown:{uid}` |
| `updateBook` | `library:{uid}`, `libraryBreakdown:{uid}` |
| `removeBook` | `library:{uid}`, `libraryBreakdown:{uid}` |
| `updateProgress` | `library:{uid}`, `lastSession:{uid}`, `readingStats:{uid}` |
