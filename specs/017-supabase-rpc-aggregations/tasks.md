# Tasks: Supabase RPC Aggregations

**Input**: Design documents from `/specs/017-supabase-rpc-aggregations/`
**Branch**: `017-supabase-rpc-aggregations`
**Tests**: Not requested — no test tasks included.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Types & Cache Keys)

**Purpose**: Add the TypeScript types and cache key entries that every user story
depends on. These are pure additions — no existing code is modified yet.

- [X] T001 Add 6 new TypeScript interfaces to `src/types/index.ts`: `BookStatus` (type alias `'unread' | 'reading' | 'finished'`), `LibraryBookEntry`, `ReadingStats`, `LastSessionSummary`, `GenreDistributionItem`, `LibraryBreakdown` — exact shapes from `contracts/typescript-interfaces.md`
- [X] T002 Add 4 new entries to the `cacheKeys` object in `src/composables/useCache.ts`: `library: (uid) => \`library:${uid}\``, `readingStats: (uid) => \`readingStats:${uid}\``, `lastSession: (uid) => \`lastSession:${uid}\``, `libraryBreakdown: (uid) => \`libraryBreakdown:${uid}\``

---

## Phase 2: Foundational (SQL Functions — Blocking All Stories)

**Purpose**: Deploy the four PostgreSQL RPC functions to Supabase. All user story
frontend changes require these functions to exist in the database first.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Deploy all 4 SQL functions to Supabase by running the full contents of `specs/017-supabase-rpc-aggregations/contracts/sql-functions.sql` in the Supabase SQL editor — verify all four functions appear in Database → Functions: `get_library_with_progress`, `get_reading_stats`, `get_last_session`, `get_library_breakdown`

**Checkpoint**: Smoke-test each function in the SQL editor with a real user UUID:
```sql
SELECT get_library_with_progress('<your-user-id>');
SELECT get_reading_stats('<your-user-id>');
SELECT get_last_session('<your-user-id>');
SELECT get_library_breakdown('<your-user-id>');
```
All four must return JSON without errors before proceeding.

---

## Phase 3: User Story 1 — Library Loads in a Single Round-Trip (Priority: P1) 🎯 MVP

**Goal**: Replace the sequential `booksStore.fetchLibrary()` → `progressStore.fetchProgress()` pair with a single `get_library_with_progress` RPC call. Eliminates the race condition on Profile → Dashboard navigation.

**Independent Test**: Navigate Profile → Dashboard — the currently-reading book appears correctly on every visit. Open DevTools Network tab — only one RPC request fires for library data, not two separate table requests.

- [X] T004 [US1] Add `libraryEntries = ref<LibraryBookEntry[]>([])` reactive ref and a new `fetchLibraryWithProgress` async action to `src/stores/books.ts`:
  - Action calls `supabase.rpc('get_library_with_progress', { p_user_id: authStore.user.id })`
  - Populates `books.value` by mapping each `LibraryBookEntry` to the existing `Book` shape (id, userId, title, author, coverUrl, totalPages, genre, createdAt — set createdAt to empty string for RPC-sourced entries)
  - Also populates `libraryEntries.value` with the raw RPC result for progressStore consumption
  - Uses cache key `cacheKeys.library(authStore.user.id)` with TTL 60 000 ms
  - Follows the existing SWR pattern (`swrStatus` → `'fresh'` return / `'background'` silent run / `'loading'` await)
  - Registers revalidator: `registerRevalidator(key, () => swrRun(key, _libraryFetcher).catch(() => {}))`
  - Exports `libraryEntries` from the store return object

- [X] T005 [US1] Update `progressStore.fetchProgress` in `src/stores/progress.ts` to check `booksStore.libraryEntries.length > 0` before issuing a network call:
  - If `libraryEntries` is already populated (i.e., `fetchLibraryWithProgress` ran first), derive the `progress` map directly from `libraryEntries` (map `currentPage`, `status`, `lastReadAt` → `ReadingProgress` shape) — no `supabase.from('reading_progress')` call needed
  - If `libraryEntries` is empty (e.g., progress store accessed independently), keep the existing `reading_progress` table fetch as fallback
  - Touch `cacheKeys.progress(uid)` after hydrating from `libraryEntries` so downstream SWR checks see 'fresh'

- [X] T006 [US1] Add cache invalidations for the new keys in `src/stores/books.ts` write operations:
  - In `addBook`: add `invalidate(cacheKeys.library(uid))` and `invalidate(cacheKeys.libraryBreakdown(uid))`
  - In `updateBook`: add `invalidate(cacheKeys.library(uid))` and `invalidate(cacheKeys.libraryBreakdown(uid))`
  - In `removeBook`: add `invalidate(cacheKeys.library(uid))` and `invalidate(cacheKeys.libraryBreakdown(uid))`
  - In `progressStore.updateProgress` in `src/stores/progress.ts`: add `invalidate(cacheKeys.lastSession(uid))` and `invalidate(cacheKeys.readingStats(uid))` after the successful `syncToSupabase` call

- [X] T007 [US1] Update `src/pages/ProfilePage.vue` to remove the sequential fetch dependency:
  - Replace `await booksStore.fetchLibrary()` followed by `await Promise.all([progressStore.fetchProgress(), dnaStore.fetchDna()])` with a single `await Promise.all([booksStore.fetchLibraryWithProgress(), dnaStore.fetchDna()])`
  - Remove `progressStore.fetchProgress()` from the `onMounted` call entirely (progressStore now hydrates from `libraryEntries` via T005)
  - Verify the `useReadingProfile` import still compiles (its `booksFinished` computed reads from `progressStore.completedBooks` which is derived from the progress map hydrated in T005)

**Checkpoint**: Profile → Dashboard navigation works correctly. Library page shows all books with progress in one request.

---

## Phase 4: User Story 2 — Reading Stats Computed Server-Side (Priority: P2)

**Goal**: Replace the `useReadingProfile` composable's full `progress_history` table fetch and all JS aggregation (streak math, velocity calculation, page delta loops) with a single `get_reading_stats` RPC call.

**Independent Test**: Open Profile page → Lifetime Stats section shows pages_this_week, streak, velocity. Verify in DevTools that no request to `/rest/v1/progress_history?select=*` fires. Confirm values match manual SQL query output.

- [X] T008 [P] [US2] Rewrite `src/composables/useReadingProfile.ts` to use the `get_reading_stats` RPC:
  - Remove: `fetchAllHistory`, `allHistory` ref, `_aggregates` computed, `_localDayKey`, `_readingDays`, `currentStreak`, `longestStreak` computed internals, `diffInSeconds` import, `mapProgressHistory` import, `ProgressHistory`/`ProgressHistoryRow` imports
  - Add: `stats = ref<ReadingStats | null>(null)`, `loaded = ref(false)`
  - Add async `fetchStats()` action:
    - Calls `supabase.rpc('get_reading_stats', { p_user_id: authStore.user.id })`
    - Stores result in `stats.value`
    - Wraps with SWR using `cacheKeys.readingStats(authStore.user.id)` TTL 120 000 ms
    - Follows existing SWR pattern
  - Keep `booksFinished` and `booksInProgress` as computed refs reading from `progressStore.completedBooks.length` and `progressStore.inProgressBooks.length` (unchanged — these still come from the store)
  - Expose `totalPagesRead`, `totalReadingHours`, `allTimeVelocityPph`, `currentStreak`, `longestStreak` as computed refs derived from `stats.value` (return 0 when null)
  - Call `void fetchStats()` on composable init (same pattern as current `void fetchAllHistory()`)
  - Update return object to export `stats`, `loaded`, `fetchStats` alongside the existing computed names so downstream components (`LifetimeStatsGrid`) need no template changes

---

## Phase 5: User Story 3 — Last Session Computed Server-Side (Priority: P2)

**Goal**: Replace the `useLastSession` composable's full `progress_history` fetch and multi-function JS pipeline (`_validSessions`, `_globalAllSessionsVelocity`, `_globalRollingAvgVelocity`, `lastSession` computed) with a single `get_last_session` RPC call.

**Independent Test**: End a reading session — Last Session card on Dashboard populates with correct book, page delta, duration, and velocity. Verify DevTools shows `/rest/v1/rpc/get_last_session` not a full history table fetch.

- [X] T009 [P] [US3] Rewrite `src/composables/useLastSession.ts` to use the `get_last_session` RPC:
  - Remove: `allHistory` ref, `fetchAllHistory`, `_validSessions`, `_globalAllSessionsVelocity`, `_globalRollingAvgVelocity`, the `lastSession` computed (and all its inner logic), `mapProgressHistory` import, `ProgressHistory`/`ProgressHistoryRow` imports, `diffInSeconds` import
  - Update the `LastSession` interface export: change `endedAt: Date` → `endedAt: string` and `startedAt: Date | null` → `startedAt: string | null` to match RPC output (ISO strings); update any downstream components that call `new Date(lastSession.value.endedAt)` to construct the Date at the call site instead
  - Add: `lastSession = ref<LastSession | null>(null)`, `loaded = ref(false)`
  - Add async `fetchLastSession()` action:
    - Calls `supabase.rpc('get_last_session', { p_user_id: authStore.user.id })`
    - Casts result to `LastSession | null` (field names are identical between `LastSessionSummary` contract and the updated `LastSession` interface)
    - Wraps with SWR using `cacheKeys.lastSession(authStore.user.id)` TTL 30 000 ms
    - Follows existing SWR pattern
  - Keep the `watch(() => progressStore.lastSessionEnded, ...)` that re-triggers fetch after a session ends — replace `fetchAllHistory()` call inside the watcher with `fetchLastSession()`
  - Return `{ lastSession, fetchLastSession, loaded }` (same surface as before)

---

## Phase 6: User Story 4 — Library Breakdown Computed Server-Side (Priority: P3)

**Goal**: Replace the `useLibraryBreakdown` computed (which derives genre distribution and author count from `booksStore.books` + `progressStore.progress` already in memory) with the `get_library_breakdown` RPC call for a single authoritative source.

**Independent Test**: Open Profile page → Library Breakdown section shows genre distribution with correct percentages and author count. Verify values match manual SQL query. Confirm the composable no longer imports booksStore or progressStore.

- [X] T010 [P] [US4] Rewrite `src/composables/useLibraryBreakdown.ts` to use the `get_library_breakdown` RPC:
  - Remove: `useBooksStore` import, `useProgressStore` import, existing `breakdown` computed, `GenreCount`, `PaceRow`, `LibraryBreakdown` local interface definitions (these move to `src/types/index.ts` in T001)
  - Add: `breakdown = ref<LibraryBreakdown | null>(null)`, `loaded = ref(false)`
  - Add async `fetchBreakdown()` action:
    - Calls `supabase.rpc('get_library_breakdown', { p_user_id: authStore.user.id })`
    - Stores result in `breakdown.value`
    - Wraps with SWR using `cacheKeys.libraryBreakdown(authStore.user.id)` TTL 120 000 ms
    - Follows existing SWR pattern
  - Call `void fetchBreakdown()` on composable init
  - Return `{ breakdown, loaded, fetchBreakdown }`
  - Update `src/components/profile/LibraryBreakdownCard.vue` template references if needed: `breakdown.genres` → `breakdown.genreDistribution`, `breakdown.uniqueAuthors` → `breakdown.authorsCount`; remove `paceComparison` section if present (not in RPC output)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, cleanup, and cache wiring checks across all stories.

- [X] T011 Run the `quickstart.md` verification checklist end-to-end: confirm all 4 SQL functions exist in Supabase, library loads in single network request, Profile → Dashboard navigation is race-condition free, stats values match SQL output, no TypeScript errors (`npm run build` or `tsc --noEmit` passes clean)
- [X] T012 [P] Remove now-dead imports from any files updated in T004–T010: check `src/composables/useReadingProfile.ts` and `src/composables/useLastSession.ts` for any remaining `supabase.from('progress_history')` calls; check `src/pages/ProfilePage.vue` for any remaining `progressStore` import that is no longer used after T007
- [X] T013 [P] Update `CLAUDE.md` Recent Changes section to document feature 017: `017-supabase-rpc-aggregations: Four Supabase PostgreSQL RPC functions replace client-side JS aggregation; get_library_with_progress eliminates sequential store dependency chain; get_reading_stats/get_last_session/get_library_breakdown replace full-history fetches; four new cacheKeys; ProfilePage.vue now loads all data in parallel`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** — T001, T002: No dependencies. Start immediately.
- **Foundational (Phase 2)** — T003: Depends on Phase 1 (types must exist to validate RPC shapes). Blocks all user stories.
- **US1 (Phase 3)** — T004–T007: Depends on Phase 2. Tasks within US1 must run in order: T004 → T005 → T006 → T007.
- **US2 (Phase 4)** — T008: Depends on Phase 2. Independent of US1, US3, US4. Can run in parallel with other stories after Phase 2.
- **US3 (Phase 5)** — T009: Depends on Phase 2. Independent of US1, US2, US4.
- **US4 (Phase 6)** — T010: Depends on Phase 2. Independent of US1, US2, US3.
- **Polish (Phase 7)** — T011–T013: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — T004 → T005 → T006 → T007 (sequential within story)
- **US2 (P2)**: After Phase 2 — T008 standalone, no dependencies on US1
- **US3 (P2)**: After Phase 2 — T009 standalone, no dependencies on US1 or US2
- **US4 (P3)**: After Phase 2 — T010 standalone; depends on T001 for the `LibraryBreakdown` type

### Parallel Opportunities

After Phase 2 (T003) is complete, T008, T009, T010 can all run in parallel as they touch different files.

```
T001 → T002 → T003 → ┬─ T004 → T005 → T006 → T007 (US1)
                      ├─ T008                        (US2, parallel)
                      ├─ T009                        (US3, parallel)
                      └─ T010                        (US4, parallel)
                                                  └→ T011 → T012 → T013
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T002) — types and cache keys
2. Complete Phase 2 (T003) — SQL functions deployed
3. Complete Phase 3 (T004–T007) — library loads in single request, race condition fixed
4. **STOP and VALIDATE**: Profile → Dashboard works. DevTools shows single RPC call.

This alone eliminates the known race condition bug and reduces library load from 2 sequential requests to 1.

### Incremental Delivery

1. Setup + Foundational → SQL functions live, types added
2. US1 → Library race condition fixed (highest-impact change)
3. US2 + US3 in parallel → Stats and last session move server-side
4. US4 → Breakdown moves server-side
5. Polish → Final cleanup and documentation

---

## Notes

- All RPC functions are `STABLE` (read-only) — safe to call concurrently
- `SECURITY DEFINER` on all functions — never pass a user ID other than `authStore.user.id`
- The existing `LastSession` interface in `useLastSession.ts` uses `Date` objects; T009 must update it to use ISO strings and fix any downstream `.getTime()` / `.toLocaleDateString()` call sites
- `LibraryBreakdownCard.vue` uses `breakdown.genres` and `breakdown.uniqueAuthors` — T010 must update these to `breakdown.genreDistribution` and `breakdown.authorsCount` (RPC field names)
- `booksFinished` in `useReadingProfile` stays derived from `progressStore.completedBooks.length` — the `readingDna.ts` store reads this value to decide threshold gating; do not change the source
