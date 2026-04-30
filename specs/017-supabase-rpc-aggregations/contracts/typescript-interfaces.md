# TypeScript Interface Contracts

**Feature**: 017-supabase-rpc-aggregations

These are the TypeScript types to add to `src/types/index.ts` that represent
the shapes returned by the four new Supabase RPC functions.

---

## `LibraryBookEntry`

Returned as an array by `supabase.rpc('get_library_with_progress', { p_user_id })`.

```ts
export type BookStatus = 'unread' | 'reading' | 'finished'

export interface LibraryBookEntry {
  id: string
  title: string
  author: string
  coverUrl: string | null
  totalPages: number
  currentPage: number
  percentage: number           // 0–100
  status: BookStatus
  lastReadAt: string | null    // ISO timestamp; null if never started
}
```

---

## `ReadingStats`

Returned by `supabase.rpc('get_reading_stats', { p_user_id })`.

```ts
export interface ReadingStats {
  pagesThisWeek: number
  pagesThisMonth: number
  totalPagesRead: number
  sessionsThisMonth: number
  currentStreakDays: number
  longestStreakDays: number
  allTimeVelocityPph: number   // 0 when no valid sessions exist
}
```

---

## `LastSessionSummary`

Returned by `supabase.rpc('get_last_session', { p_user_id })`.
The entire response may be `null` when the user has no history.

```ts
export interface LastSessionSummary {
  bookId: string
  bookTitle: string
  endedAt: string
  startedAt: string | null
  pagesDelta: number
  startPage: number
  endPage: number
  durationSeconds: number | null
  velocityPph: number | null
  completionDelta: number | null
  finishPredictionSessions: number | null
  sessionNote: string | null
}
```

---

## `LibraryBreakdown`

Returned by `supabase.rpc('get_library_breakdown', { p_user_id })`.

```ts
export interface GenreDistributionItem {
  genre: string
  count: number
  percentage: number
}

export interface LibraryBreakdown {
  genreDistribution: GenreDistributionItem[]
  authorsCount: number
  booksFinished: number
  booksInProgress: number
  booksUnstarted: number
  avgCompletionPct: number
}
```

---

## Updated `cacheKeys` additions

In `src/composables/useCache.ts`, add to the `cacheKeys` object:

```ts
library:          (uid: string) => `library:${uid}`,
readingStats:     (uid: string) => `readingStats:${uid}`,
lastSession:      (uid: string) => `lastSession:${uid}`,
libraryBreakdown: (uid: string) => `libraryBreakdown:${uid}`,
```

---

## Supabase RPC call pattern

```ts
// Example: fetch reading stats
const { data, error } = await supabase.rpc('get_reading_stats', {
  p_user_id: authStore.user.id
})
// data is typed as ReadingStats via Supabase generated types
// or cast explicitly: data as ReadingStats

// Example: fetch library
const { data, error } = await supabase.rpc('get_library_with_progress', {
  p_user_id: authStore.user.id
})
// data is typed as LibraryBookEntry[]
```

---

## Files to modify

| File | Change |
|---|---|
| `src/types/index.ts` | Add `LibraryBookEntry`, `BookStatus`, `ReadingStats`, `LastSessionSummary`, `LibraryBreakdown`, `GenreDistributionItem` |
| `src/composables/useCache.ts` | Add 4 new entries to `cacheKeys` |
| `src/stores/books.ts` | Add `fetchLibraryWithProgress` action using `get_library_with_progress` RPC; invalidate `library` key on mutations |
| `src/stores/progress.ts` | Update `fetchProgress` to hydrate from `booksStore.libraryEntries` when available; add `lastSession` RPC call |
| `src/composables/useLastSession.ts` | Replace full-history fetch + JS aggregation with `get_last_session` RPC call |
| `src/composables/useReadingProfile.ts` | Replace full-history fetch + JS aggregation with `get_reading_stats` RPC call |
| `src/composables/useLibraryBreakdown.ts` | Replace derived computed from stores with `get_library_breakdown` RPC call |
| `src/pages/ProfilePage.vue` | Remove sequential fetch dependency; both stats and DNA can now load in parallel |
