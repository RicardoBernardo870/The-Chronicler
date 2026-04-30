# Quickstart: Supabase RPC Aggregations

**Feature**: 017-supabase-rpc-aggregations
**Date**: 2026-04-30

---

## Step 1 — Deploy the SQL functions

Open the **Supabase SQL editor** for your project and paste the contents of
`contracts/sql-functions.sql`. Run it. All four `CREATE OR REPLACE FUNCTION`
statements will execute. Verify in **Database → Functions** that the following
appear:

- `get_library_with_progress(p_user_id uuid)`
- `get_reading_stats(p_user_id uuid)`
- `get_last_session(p_user_id uuid)`
- `get_library_breakdown(p_user_id uuid)`

---

## Step 2 — Smoke-test functions directly in SQL editor

Replace `<your-user-id>` with a real UUID from the `auth.users` table:

```sql
-- Test 1: library with progress
SELECT get_library_with_progress('<your-user-id>');

-- Test 2: reading stats
SELECT get_reading_stats('<your-user-id>');

-- Test 3: last session (returns null if no history)
SELECT get_last_session('<your-user-id>');

-- Test 4: library breakdown
SELECT get_library_breakdown('<your-user-id>');
```

Expected: each returns a JSON object/array. No errors.

---

## Step 3 — Add TypeScript types

Add the interfaces from `contracts/typescript-interfaces.md` to
`src/types/index.ts`. Add the four new cache keys to `cacheKeys` in
`src/composables/useCache.ts`.

---

## Step 4 — Update `booksStore`

Add a new action `fetchLibraryWithProgress` that:
1. Calls `supabase.rpc('get_library_with_progress', { p_user_id })`
2. Populates `books.value` (mapping `LibraryBookEntry` back to `Book` shape)
3. Also stores the full `LibraryBookEntry[]` in a new `libraryEntries` ref so
   `progressStore` can hydrate from it without a second network call
4. Uses cache key `cacheKeys.library(uid)` with TTL 60 s
5. Invalidates `library` key in `addBook`, `updateBook`, `removeBook`

---

## Step 5 — Update `progressStore`

In `fetchProgress`, check if `booksStore.libraryEntries` is already populated
(from step 4). If yes, derive the `progress` map from those entries without a
network call. This eliminates the sequential-fetch race condition.

---

## Step 6 — Update composables

### `useLastSession.ts`
Replace the `fetchAllHistory` + `_validSessions` / `_globalAllSessionsVelocity`
/ `_globalRollingAvgVelocity` logic with:

```ts
const { data } = await supabase.rpc('get_last_session', { p_user_id: authStore.user.id })
lastSession.value = data as LastSessionSummary | null
```

Wrap in the SWR pattern using `cacheKeys.lastSession(uid)` TTL 30 s.

### `useReadingProfile.ts`
Replace `fetchAllHistory` + all computed aggregates with:

```ts
const { data } = await supabase.rpc('get_reading_stats', { p_user_id: authStore.user.id })
stats.value = data as ReadingStats
```

Wrap in the SWR pattern using `cacheKeys.readingStats(uid)` TTL 120 s.

`booksFinished` can be derived from `stats.value` or kept from `progressStore.completedBooks.length` — either is fine.

### `useLibraryBreakdown.ts`
Replace the computed derived from `booksStore.books` + `progressStore.progress` with:

```ts
const { data } = await supabase.rpc('get_library_breakdown', { p_user_id: authStore.user.id })
breakdown.value = data as LibraryBreakdown
```

Wrap in the SWR pattern using `cacheKeys.libraryBreakdown(uid)` TTL 120 s.

---

## Step 7 — Fix ProfilePage race condition

Now that `booksStore.fetchLibraryWithProgress` handles both books and progress,
`ProfilePage.vue` can simplify from:

```ts
// Before — sequential to avoid race condition
await booksStore.fetchLibrary()
await Promise.all([progressStore.fetchProgress(), dnaStore.fetchDna()])
```

To:

```ts
// After — truly parallel; no dependency between stores
await Promise.all([
  booksStore.fetchLibraryWithProgress(),
  dnaStore.fetchDna(),
])
```

---

## Step 8 — Verify in browser

1. Open Dashboard → check hero book appears with correct progress.
2. Navigate to Profile → check lifetime stats are populated.
3. Open DevTools Network tab → confirm the `/rest/v1/rpc/get_library_with_progress`
   call appears once, not two separate requests to `/books` and `/reading_progress`.
4. Navigate away and back within TTL → confirm no new network request (SWR fresh).
5. Navigate away, wait 60+ seconds, come back → confirm a background revalidation
   fires (status bar shows network activity but no loading skeleton).

---

## Verification Checklist

- [ ] All 4 SQL functions exist in Supabase Database → Functions
- [ ] Library/Dashboard loads with a single RPC call in Network tab
- [ ] Profile → Dashboard navigation shows correct hero book every time
- [ ] Profile stats match manual SQL query results
- [ ] Last session card shows correct book/pages/duration
- [ ] No TypeScript `any` casts on RPC return values
- [ ] SWR cache prevents duplicate requests within TTL window
- [ ] `updateProgress` invalidates `library`, `lastSession`, `readingStats` keys
