# Plan: Reading Retention Gamification

## What & why
- Ship Reading Pulse: fixed Dashboard card showing weekly confirmed reading sessions, 3-session default goal, and a tiny next action.
- Help inconsistent readers return without guilt; weekly rhythm replaces daily streak pressure.
- Use existing `progress_history.session_start_at` semantics so counts stay server-confirmed and compatible with future clients.

## Depends on
- Existing session completion flow inserts `progress_history` rows with `session_start_at`.
- Existing Supabase RPC/migration pattern from `supabase/migrations/20260502_rpc_performance_improvements.sql`.
- Existing SWR cache/auth-clear behavior in `src/composables/useCache.ts`.

## In scope / Out of scope
**In:**
- One read-only retention summary RPC or narrow extension to existing stats RPC.
- `useRetentionSummary` composable with browser timezone input and SWR cache.
- Dashboard Reading Pulse card with weekly progress, supportive nudges, and medium-humor local celebration copy.
- Cache invalidation after confirmed progress/session completion and quiet refresh after offline sync.
- Unit coverage for retention rules and RPC-facing client states.

**Out:**
- New persistence tables; v1 avoids extra Supabase structure.
- Durable badges or badge IDs; v1 achievements are celebratory copy only.
- Goal editing UI; future goal editing belongs in Profile settings.
- Audiobook minutes; audiobooks are not supported for v1.
- Push/email/social challenges; privacy, token storage, moderation, and permissions are later surfaces.

<boundaries>
**Do not change:** `supabase/functions/`, AI prompt modules, recap/lore/passport generation semantics, public profile/social surfaces, email/payment code, existing add-book import safeguards.
**Limits:** No new npm packages; no new tables; at most one additive read-only RPC or small stats RPC extension; no client-side session count source of truth; no retroactive surprise celebration after late offline sync.
</boundaries>

## Slices

Each slice is independently testable. Mergeable on its own. Sequenced.

### T01 — Add retention summary RPC

- **Touches:** `supabase/migrations/*_retention_summary.sql`, `src/types/index.ts`
- **Change:** Add a read-only RPC that derives the user from `(select auth.uid())`, validates timezone input with UTC fallback, dedupes canonical sessions, and returns local-week session count, goal progress, active days, last session date, days since last session, and nudge code from confirmed `progress_history.session_start_at` rows.
- **Verify:** `npm test -- --run tests/unit/retentionSummary.test.ts`
- **Done when:**
  ```gherkin
  Given an authenticated user has three deduped progress_history rows with session_start_at inside a DST-tested local week
  When get_retention_summary is called without a client user ID
  Then the response reports 3 sessions, 100 percent goal progress, active days, UTC fallback for invalid timezone input, and no data for other users
  ```

### T02 — Cache retention summary on the client

- **Touches:** `src/composables/useRetentionSummary.ts`, `src/composables/useCache.ts`, `src/services/supabase.ts`, `src/types/index.ts`, `tests/unit/useRetentionSummary.test.ts`
- **Change:** Add a composable that calls the retention RPC with validated `Intl.DateTimeFormat().resolvedOptions().timeZone`, uses SWR cache, exposes loading/error/refresh state, and participates in auth-clear behavior on sign-out/user switch.
- **Verify:** `npm test -- --run tests/unit/useRetentionSummary.test.ts`
- **Done when:**
  ```gherkin
  Given an authenticated reader opens the Dashboard
  When useRetentionSummary loads successfully
  Then the composable returns cached retention fields and can revalidate without blocking existing Dashboard data
  ```

### T03 — Show the Reading Pulse card

- **Touches:** `src/components/dashboard/ReadingPulseCard.vue`, `src/pages/DashboardPage.vue`, `src/domain/retention/rules.ts`, `tests/unit/retentionRules.test.ts`
- **Change:** Render a fixed Dashboard card below the active book hero that maps typed retention rules to softened 3/week framing, weekly progress, tiny next action copy, comeback copy, and non-guilt empty/error states.
- **Verify:** `npm test -- --run tests/unit/retentionRules.test.ts && npm run build`
- **Done when:**
  ```gherkin
  Given a reader has one active book and one confirmed session this week
  When the Dashboard renders
  Then Reading Pulse shows 1 of 3 sessions, supportive next-action copy, and the existing book CTA remains primary
  ```

### T04 — Refresh counts after confirmed sessions

- **Touches:** `src/stores/progress.ts`, `src/composables/useOfflineSync.ts`, `src/composables/useRetentionSummary.ts`, `tests/unit/progressRetentionInvalidation.test.ts`
- **Change:** Centralize retention cache invalidation after successful online progress writes, offline replay, sign-out, and user switch without firing retroactive celebrations for late synced sessions.
- **Verify:** `npm test -- --run tests/unit/progressRetentionInvalidation.test.ts`
- **Done when:**
  ```gherkin
  Given a reader saves progress from an active reading session
  When the progress_history insert is confirmed
  Then Reading Pulse refreshes to include the session and queued offline sync updates counts quietly after reconnect
  ```

### T05 — Add brief local celebrations and edge-state coverage

- **Touches:** `src/components/dashboard/ReadingPulseCard.vue`, `src/domain/retention/rules.ts`, `tests/unit/ReadingPulseCard.test.ts`, `tests/unit/retentionRules.test.ts`
- **Change:** Add skippable once-per-view celebratory copy for comeback and goal-met states with one documented suppression rule for delayed writes while covering no-book, completed-only, RPC failure, and missed-goal states.
- **Verify:** `npm test -- --run tests/unit/ReadingPulseCard.test.ts tests/unit/retentionRules.test.ts`
- **Done when:**
  ```gherkin
  Given a reader returns after fourteen days and completes a confirmed session
  When the Dashboard revalidates Reading Pulse
  Then a brief comeback celebration appears once, can be dismissed, and never uses failure, debt, or penalty language
  ```

## Decisions
- Product surface is named Reading Pulse; aligns with validated product decision.
- Default goal is 3 sessions/week; goal editing waits for future Profile settings.
- One confirmed `progress_history` row with `session_start_at` counts as one session; imports, app opens, and queued writes do not count.
- RPC must derive user identity from `(select auth.uid())`; client-provided user IDs are not accepted.
- Invalid or unavailable timezone input falls back to UTC and neutral copy.
- Delayed offline replay quietly refreshes counts and never triggers a surprise celebration outside the active session context.
- Celebrations are local copy only; no durable badge IDs in v1.
- Humor is medium and supportive; copy avoids guilt, streak debt, and comparison.

## Risks
- RPC timezone bugs can miscount week boundaries; cover timezone fixtures and fallback to neutral UTC copy.
- Duplicate offline replay can inflate counts; define canonical session identity before aggregation.
- Dashboard density can crowd mobile; place card after hero and keep compact states testable in component snapshots.
- Offline sync can create confusing delayed count changes; refresh quietly and suppress late celebration.
- Goal default may feel rigid; copy frames 3/week as current rhythm while deferring editing to Profile settings.
- Dashboard copy can become hidden business logic; keep state selection in `src/domain/retention/rules.ts`.
