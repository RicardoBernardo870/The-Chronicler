# Research: Supabase RPC Aggregations

**Feature**: 017-supabase-rpc-aggregations
**Date**: 2026-04-30

---

## D1 — SQL function language: `LANGUAGE sql` vs `LANGUAGE plpgsql`

**Decision**: Use `LANGUAGE sql` for all four functions.

**Rationale**: All four functions are pure set-returning SELECT statements with no procedural branching, variable declarations, or exception blocks. `LANGUAGE sql` has lower overhead and the query planner can inline the function body when called from a wrapping query. `plpgsql` is only needed when control flow (`IF`, `LOOP`, `EXCEPTION`) is required.

**Alternatives considered**: `plpgsql` — rejected because none of the functions require procedural logic.

---

## D2 — Page delta calculation: `LAG()` window function vs self-join

**Decision**: Use `LAG(page) OVER (PARTITION BY book_id ORDER BY recorded_at)` to compute the prior page within each book.

**Rationale**: `LAG()` is evaluated in a single pass over the partitioned result set. A correlated subquery (`SELECT MAX(page) FROM progress_history WHERE book_id = ph.book_id AND recorded_at < ph.recorded_at`) would re-scan the table once per row. For users with hundreds of history rows, the window function approach is O(n log n) vs O(n²). More importantly, `PARTITION BY book_id` guarantees the prior row is always from the same book — the exact invariant needed to prevent cross-book delta contamination.

**Alternatives considered**:
- Correlated subquery — rejected for performance reasons above.
- Application-level LAG (current implementation) — this is what we're replacing; it requires fetching the entire table to the client.

---

## D3 — SECURITY DEFINER vs RLS for RPC functions

**Decision**: Use `SECURITY DEFINER` on all functions. Each function accepts `p_user_id uuid` and all WHERE clauses filter on that parameter. The calling code always passes `authStore.user.id`.

**Rationale**: Supabase RLS policies on `books`, `reading_progress`, and `progress_history` are `user_id = auth.uid()`. When a `LANGUAGE sql` function runs under the invoker's role (default), the planner evaluates RLS against `auth.uid()` which is set correctly for direct table queries but is not reliably set within function context when called via PostgREST RPC. Using `SECURITY DEFINER` + explicit `p_user_id` filter is the recommended Supabase pattern for aggregate RPC functions — the function runs as the DB owner role but is locked to the passed user ID.

**Alternatives considered**:
- Pure invoker + RLS — fragile; `auth.uid()` propagation through PostgREST RPC context is version-dependent.
- Row-level security on a view — would work but views cannot accept parameters, so each aggregation would require a separate view per metric, multiplying objects.

---

## D4 — Streak calculation: UTC vs local timezone

**Decision**: Compute streaks in the database using `AT TIME ZONE 'UTC'` day boundaries (i.e., `DATE(recorded_at)` which casts the stored UTC timestamp to a UTC date). Accept that a session recorded at 23:55 local time in UTC-5 (= 04:55 next-day UTC) counts toward the next day's streak bucket.

**Rationale**: The current JS implementation uses `toLocaleDateString('en-CA')` to bucket by local timezone. Replicating per-user timezone in SQL requires storing user timezone preference (no such column exists) or passing it as a parameter. The spec does not require timezone-aware streaks — it only requires consecutive days. The majority of BookHero users read in a single timezone and the boundary-case impact is minimal (a session at 23:55 local time near midnight). Accepting UTC bucketing eliminates a complex parameter and a prerequisite schema change.

**Alternatives considered**:
- Pass timezone as a second parameter — deferred; requires storing user timezone preference which is out of scope for this feature.
- Use `recorded_at AT TIME ZONE p_timezone` — same objection: no timezone column today.

---

## D5 — Finish prediction: rolling 3-session average

**Decision**: Compute rolling 3-session average velocity in SQL using the last 3 valid sessions across all books (same definition as `_globalRollingAvgVelocity` in `useLastSession.ts`). Multiply by this session's duration to estimate pages per session, then divide remaining pages.

**Rationale**: This exactly replicates the existing frontend algorithm, ensuring numerical parity between the old composable and the new RPC during any transition period. The `WITH last_session AS (...)` + `WITH valid_sessions AS (...)` CTE pattern keeps the SQL readable and allows the planner to materialise the intermediate result once.

**Alternatives considered**:
- Simple all-time velocity × fixed session length estimate — less accurate; ignores recent pace changes.
- Moving average over more sessions — more smoothing but departs from the existing algorithm without a spec change.

---

## D6 — Frontend: unified store vs updated separate stores

**Decision**: Update the existing `booksStore` and `progressStore` independently rather than merging them into a single `libraryStore`. The `get_library_with_progress` RPC is called from `booksStore` as a new `fetchLibraryWithProgress` action. `progressStore._fetcher` is updated to read from the data already in `booksStore` when available and falls back to the RPC result.

**Rationale**: Merging two stores touches every component that imports either store — a large blast radius for a refactor that is primarily about data fetching, not state shape. The simpler path is to have `booksStore` gain ownership of the joined RPC call, populate `books` as before, and also emit the progress map so `progressStore` can be hydrated without its own fetch. This preserves all existing component prop contracts.

**Alternatives considered**:
- Single `libraryStore` replacing both — cleaner long-term but too large a surface change for this feature's scope.
- Keep both stores fetching independently, add RPC only for aggregates — partially solves the race condition but doesn't eliminate the over-fetch on `progress_history`.

---

## D7 — New cache keys for RPC-derived data

**Decision**: Add four new keys to `cacheKeys`: `library` (replaces `books` + `progress`), `readingStats`, `lastSession`, `libraryBreakdown`. The old `books` and `progress` keys are retained for mutation paths (addBook, updateProgress, etc.) but their TTL-based fetch is superseded by the `library` key.

**Rationale**: The SWR primitive in `useCache.ts` is key-based. Introducing new keys for the RPC responses avoids mutating the existing key semantics, which would break cached data shapes that components already depend on. The old keys are kept alive so that write operations (`addBook`, `updateProgress`) can still call `swrTouch` / `invalidate` on them, and the new `library` key listens for those invalidations to trigger revalidation.

**Alternatives considered**:
- Reuse existing `books` and `progress` keys — would require all components to adapt to new data shapes simultaneously.
- No SWR for RPC data — rejected; the spec requires preserving SWR caching behaviour (FR-015).
