# Roadmap: Reading Retention Gamification

## Overall Status

- Done

## Progress

| ID | Task | Status | Notes |
|----|------|--------|-------|
| T01 | Add retention summary RPC | Done | Server-confirmed weekly sessions from `progress_history.session_start_at`. |
| T02 | Cache retention summary on the client | Done | SWR composable with browser timezone and UTC fallback. |
| T03 | Show the Reading Pulse card | Done | Fixed Dashboard surface below active book hero. |
| T04 | Refresh counts after confirmed sessions | Done | Confirmed writes revalidate; late offline sync stays quiet. |
| T05 | Add brief local celebrations and edge-state coverage | Done | Comeback and goal-met copy only; no durable badges. |

## Registered Technical Debt

- Custom goals deferred until fixed 3/week shows retention signal or users ask to tune it.
- Durable badges, social surfaces, push, and durable achievements deferred until Reading Pulse proves repeat use.
- Full retention engine/state machine deferred until more than one retention surface exists.
- Public profile integration deferred until privacy model is explicitly scoped.

## Open Decisions

- Primary reader segment emphasis: lapsed, casual, or already-active.
- Success metric threshold for proving Reading Pulse changes return behavior.
- Copy/state for weeks where 3 sessions is clearly impossible.

## Status Legend

- Not started: no implementation work begun.
- In progress: implementation underway.
- Blocked: cannot continue without decision or dependency.
- Done: merged and verified.

## Execution History

### 2026-05-05 - T01 Add retention summary RPC
**Status:** Done
**What was done:** Added a read-only `get_retention_summary(p_timezone)` RPC contract, shared `RetentionSummary` types, and SQL contract tests.
**Modified files:** `supabase/migrations/20260505_retention_summary.sql`, `src/types/index.ts`, `tests/unit/retentionSummary.test.ts`, `.council/reading-retention-gamification/ROADMAP.md`
**Verified criteria:** Authenticated-user identity is derived from `auth.uid()` with no client user ID; invalid timezone falls back to UTC; local-week boundaries use selected timezone; canonical sessions dedupe by `book_id` + `session_start_at`; response includes sessions, goal progress, active days, last session, days since last session, and nudge code.
**Complexity flags:** None.
**Notes:** Initial sandboxed test run failed with Vite `spawn EPERM`; reran with approval and `npm.cmd test -- --run tests/unit/retentionSummary.test.ts` passed.

### 2026-05-05 - T02 Cache retention summary on the client
**Status:** Done
**What was done:** Added `useRetentionSummary` with validated timezone RPC calls, SWR caching, refresh state, auth-clear compatibility, and cache key coverage.
**Modified files:** `src/composables/useRetentionSummary.ts`, `src/composables/useCache.ts`, `tests/unit/useRetentionSummary.test.ts`, `tests/unit/useCache.spec.ts`, `.council/reading-retention-gamification/ROADMAP.md`
**Verified criteria:** Authenticated Dashboard fetch returns cached retention fields; RPC receives only `p_timezone`; explicit refresh revalidates; cache clearing supports user switch; invalid browser timezone falls back to UTC.
**Complexity flags:** None.
**Notes:** Sandboxed Vitest still fails with Vite `spawn EPERM`; approved run passed with `npm.cmd test -- --run tests/unit/useRetentionSummary.test.ts tests/unit/useCache.spec.ts`.

### 2026-05-05 - T03 Show the Reading Pulse card
**Status:** Done
**What was done:** Added typed Reading Pulse rules, rendered a fixed Dashboard card below the active hero, and wired its CTA to the current book detail path.
**Modified files:** `src/domain/retention/rules.ts`, `src/components/dashboard/ReadingPulseCard.vue`, `src/pages/DashboardPage.vue`, `tests/unit/retentionRules.test.ts`, `.council/reading-retention-gamification/ROADMAP.md`
**Verified criteria:** One confirmed session maps to 1 of 3 sessions with supportive next-action copy; empty, comeback, goal-met, loading, and error states avoid guilt language; `npm run build` proves Dashboard integration compiles.
**Complexity flags:** None.
**Notes:** No manual browser pass run for Dashboard rendering.

### 2026-05-05 - T04 Refresh counts after confirmed sessions
**Status:** Done
**What was done:** Centralized Reading Pulse cache invalidation and called it after confirmed online writes and successful offline replay without emitting session-ended events for replay.
**Modified files:** `src/composables/useRetentionSummary.ts`, `src/composables/useOfflineSync.ts`, `src/stores/progress.ts`, `tests/unit/progressRetentionInvalidation.test.ts`, `.council/reading-retention-gamification/ROADMAP.md`
**Verified criteria:** Retention cache helper marks SWR entry stale; online writes invalidate after confirmed save; offline replay returns flushed count and invalidates quietly; build confirms `flushQueue` return type compatibility.
**Complexity flags:** None.
**Notes:** First T04 test assertion was too broad and matched offline invalidation before online invalidation; narrowed it to the online write section.

### 2026-05-05 - T05 Add brief local celebrations and edge-state coverage
**Status:** Done
**What was done:** Added transition-based comeback and goal-met celebrations, dismissal behavior, and delayed-sync suppression through active session context.
**Modified files:** `src/domain/retention/rules.ts`, `src/components/dashboard/ReadingPulseCard.vue`, `tests/unit/ReadingPulseCard.test.ts`, `tests/unit/retentionRules.test.ts`, `.council/reading-retention-gamification/ROADMAP.md`
**Verified criteria:** Comeback celebration appears only after an active session transition; celebration can be dismissed and remains dismissed for the same event; delayed sync without `lastSessionEnded` updates count quietly; copy avoids failure, debt, and penalty language.
**Complexity flags:** None.
**Notes:** Vue component test uses source-contract assertions because current Vitest config does not load `@vitejs/plugin-vue`; build verifies component compilation.

### 2026-05-05 - Execution complete
**Status:** Done
**What was done:** Completed all five Reading Pulse implementation slices.
**Modified files:** See task entries above.
**Verified criteria:** T01-T05 dedicated tests passed; build passed after UI and invalidation changes.
**Complexity flags:** None.
**Notes:** Manual browser QA remains recommended for Dashboard visual density.

## Next Step

- Complete - all planned tasks are done.
