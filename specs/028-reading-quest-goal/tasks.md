# Tasks: Reading Quest Goal

**Input**: Design documents from `/specs/028-reading-quest-goal/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include focused Vitest unit tests for deterministic XP/level math, status classification, and store mapping; validate end-to-end behavior with quickstart scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared types, cache keys, and Supabase migration shell used by all stories.

- [X] T001 Create additive migration file `supabase/migrations/20260512_reading_quest_goal.sql` with section headers for `reading_goals`, RLS, indexes, and `get_reading_quest_summary`
- [X] T002 [P] Add Reading Quest domain types (`ReadingGoal`, `ReadingQuestSummary`, `ReaderXpSummary`, `ReadingQuestResponse`) to `src/types/index.ts`
- [X] T003 [P] Add `readingQuest` cache key to `src/composables/useCache.ts`
- [X] T004 [P] Create empty `src/stores/readingQuest.ts` Pinia store scaffold exporting state slots for summary, loading, saving, and error
- [X] T005 [P] Create unit test file scaffold `tests/unit/readingQuest.spec.ts` for pure quest/level calculations and store mapping

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement schema, RLS, aggregate RPC, and pure helpers that all user stories depend on.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Implement `reading_goals` table in `supabase/migrations/20260512_reading_quest_goal.sql` with `id`, `user_id`, `year`, `target_books`, `created_at`, `updated_at`, `target_books >= 1`, and unique `(user_id, year)`
- [X] T007 Add Supabase RLS policies to `supabase/migrations/20260512_reading_quest_goal.sql` for own-row select/insert/update/delete using optimized `(select auth.uid()) = user_id`
- [X] T008 Add `reading_goals_user_year_idx` unique index/constraint and any required aggregate indexes to `supabase/migrations/20260512_reading_quest_goal.sql`
- [X] T009 Implement `get_reading_quest_summary(p_user_id uuid, p_year int)` RPC in `supabase/migrations/20260512_reading_quest_goal.sql` returning goal, quest, level, and source-count JSON per `specs/028-reading-quest-goal/contracts/reading-quest-rpc.md`
- [X] T010 Grant authenticated execute access for `get_reading_quest_summary(uuid, int)` in `supabase/migrations/20260512_reading_quest_goal.sql`
- [X] T011 [P] Implement pure status classification helper in `src/stores/readingQuest.ts` or extracted local helper for `no_goal`, `no_projection`, `ahead`, `on_track`, `behind`, `comeback`, and `complete`
- [X] T012 [P] Implement pure level/XP helper in `src/stores/readingQuest.ts` or extracted local helper for deterministic titles, thresholds, total XP, current-level XP, and next-level progress
- [X] T013 [P] Add unit tests for status classification and XP level helper behavior in `tests/unit/readingQuest.spec.ts`

**Checkpoint**: Database contract and pure calculations are ready; user story implementation can proceed.

---

## Phase 3: User Story 1 - Set a Yearly Reading Goal (Priority: P1) MVP

**Goal**: Users can create and edit one current-year book goal from the Profile page and see it persist.

**Independent Test**: Open Profile with no current-year goal, set a valid target, refresh, and confirm the goal remains; edit it and confirm the card updates.

### Implementation for User Story 1

- [X] T014 [US1] Implement `fetchQuestSummary(year?: number)` action in `src/stores/readingQuest.ts` calling `get_reading_quest_summary` and mapping the response into typed state
- [X] T015 [US1] Implement `saveGoal(targetBooks: number, year?: number)` action in `src/stores/readingQuest.ts` using atomic Supabase upsert on `reading_goals` and invalidating `cacheKeys.readingQuest`
- [X] T016 [US1] Add goal validation and user-friendly save error state to `src/stores/readingQuest.ts`
- [X] T017 [P] [US1] Create `src/components/profile/ReadingGoalDialog.vue` using PrimeVue Dialog, InputNumber, Button, and Message/InlineMessage for set/edit goal flow
- [X] T018 [P] [US1] Add store mapping and goal validation tests in `tests/unit/readingQuest.spec.ts`
- [X] T019 [US1] Create initial `src/components/profile/ReadingQuestCard.vue` no-goal and goal-set UI states with set/edit action wired to `ReadingGoalDialog`
- [X] T020 [US1] Wire `ReadingQuestCard` into `src/pages/ProfilePage.vue` after `ReadingDnaCard` and call `readingQuestStore.fetchQuestSummary()` during profile load

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Track Reading Quest Progress (Priority: P1)

**Goal**: Readers with a yearly goal see completed count, percent progress, required/current pace, projected books, and friendly status.

**Independent Test**: Use an account with a current-year goal and completed books; Profile shows progress, pace comparison, projection, and correct friendly status.

### Implementation for User Story 2

- [X] T021 [US2] Extend `get_reading_quest_summary` in `supabase/migrations/20260512_reading_quest_goal.sql` to count current-year completed books using best available completion/progress timestamp
- [X] T022 [US2] Extend `get_reading_quest_summary` in `supabase/migrations/20260512_reading_quest_goal.sql` to compute required monthly pace, current monthly pace, projected books, `hasProjection`, and status labels
- [X] T023 [US2] Update `src/stores/readingQuest.ts` response mapping for quest progress, pace, projection, and status fields
- [X] T024 [P] [US2] Add quest projection and progress mapping tests in `tests/unit/readingQuest.spec.ts`
- [X] T025 [US2] Expand `src/components/profile/ReadingQuestCard.vue` to render completed/target count, percent, PrimeVue ProgressBar, required/current pace, projection, and status Tag
- [X] T026 [US2] Add no-history and goal-achieved UI states to `src/components/profile/ReadingQuestCard.vue`

**Checkpoint**: User Stories 1 and 2 both work independently.

---

## Phase 5: User Story 3 - See Reader Level Progress (Priority: P2)

**Goal**: Readers see deterministic XP, level title, next-level progress, and XP remaining based on existing saved activity.

**Independent Test**: Use representative activity data and confirm total XP, level title, and next-level progress are stable across repeated Profile loads.

### Implementation for User Story 3

- [X] T027 [US3] Extend `get_reading_quest_summary` in `supabase/migrations/20260512_reading_quest_goal.sql` to compute XP sources from pages read, completed books, progress sessions, captures, recaps, and lore cards
- [X] T028 [US3] Extend `get_reading_quest_summary` in `supabase/migrations/20260512_reading_quest_goal.sql` to return level number, title, total XP, current-level XP, next-level XP, XP to next level, and progress percent
- [X] T029 [US3] Update `src/stores/readingQuest.ts` response mapping for `ReaderXpSummary` and XP source counts
- [X] T030 [P] [US3] Add XP source and level threshold unit tests in `tests/unit/readingQuest.spec.ts`
- [X] T031 [P] [US3] Create `src/components/profile/ReaderLevelStrip.vue` showing level title, total XP, PrimeVue ProgressBar, and next-level prompt
- [X] T032 [US3] Integrate `ReaderLevelStrip` into `src/components/profile/ReadingQuestCard.vue` or directly below it per `specs/028-reading-quest-goal/contracts/profile-ui.md`

**Checkpoint**: User Stories 1, 2, and 3 are functional and independently testable.

---

## Phase 6: User Story 4 - Preserve Existing Profile Experience (Priority: P3)

**Goal**: New gamified elements fit into Profile without breaking Reading DNA, Lifetime Stats, or Library Breakdown.

**Independent Test**: Load Profile with no goal, active goal, achieved goal, and representative XP activity; all existing cards remain visible and readable.

### Implementation for User Story 4

- [X] T033 [US4] Adjust Profile page load orchestration in `src/pages/ProfilePage.vue` so `ReadingQuestCard` loading/error state does not block existing cards
- [X] T034 [US4] Add responsive Profile layout and spacing polish for `src/components/profile/ReadingQuestCard.vue`
- [X] T035 [US4] Add responsive compact styling for `src/components/profile/ReaderLevelStrip.vue`
- [X] T036 [US4] Ensure goal dialog keyboard focus, labels, aria text, and validation copy in `src/components/profile/ReadingGoalDialog.vue`
- [X] T037 [US4] Add cache invalidation for reading quest data after progress saves, book edits/removals, recap creation, capture save, and lore unlocks in `src/stores/progress.ts`, `src/stores/books.ts`, `src/stores/recaps.ts`, `src/stores/captures.ts`, and `src/stores/loreCards.ts`

**Checkpoint**: Full Profile experience remains intact with Reading Quest enabled.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate contracts, quickstart scenarios, performance, and documentation.

- [X] T038 [P] Verify `supabase/migrations/20260512_reading_quest_goal.sql` follows Supabase best practices for RLS, user/year indexes, composite aggregate indexes, and atomic upsert support
- [X] T039 [P] Scan `src/components/profile/ReadingQuestCard.vue`, `ReadingGoalDialog.vue`, and `ReaderLevelStrip.vue` for hard-coded colors that should use PrimeVue/theme tokens
- [X] T040 Run `npm.cmd test` and fix failures in `tests/unit/readingQuest.spec.ts` or affected existing tests
- [X] T041 Run `npm.cmd run build` and fix TypeScript or production build issues
- [X] T042 Execute quickstart scenarios in `specs/028-reading-quest-goal/quickstart.md` and record pass/fail notes in `specs/028-reading-quest-goal/quickstart.md`
- [X] T043 Update `AGENTS.md` and `CLAUDE.md` recent changes if implementation details differ from the current plan reference

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational and benefits from US1 UI/store shell.
- **User Story 3 (Phase 5)**: Depends on Foundational; can proceed in parallel with US2 after the RPC shell exists.
- **User Story 4 (Phase 6)**: Depends on desired Profile UI stories being complete.
- **Polish (Phase 7)**: Depends on all implemented stories.

### User Story Dependencies

- **US1 Set a Yearly Reading Goal**: MVP; no dependency on other user stories after Foundation.
- **US2 Track Reading Quest Progress**: Requires goal summary contract from Foundation; uses US1 card/store surfaces for display.
- **US3 See Reader Level Progress**: Requires aggregate RPC and type/store surfaces; can be built largely independently of US2.
- **US4 Preserve Existing Profile Experience**: Integrates and polishes the completed Profile experience.

### Parallel Opportunities

- T002, T003, T004, and T005 can run in parallel.
- T011, T012, and T013 can run in parallel after RPC/table shape is known.
- T017 and T018 can run in parallel with T014-T016.
- T024 can run in parallel with T025-T026 once response fields are defined.
- T030 and T031 can run in parallel with T027-T029 once XP fields are defined.
- T038 and T039 can run in parallel during polish.

---

## Parallel Example: User Story 1

```text
Task: "Create src/components/profile/ReadingGoalDialog.vue using PrimeVue Dialog, InputNumber, Button, and Message/InlineMessage for set/edit goal flow"
Task: "Add store mapping and goal validation tests in tests/unit/readingQuest.spec.ts"
```

## Parallel Example: User Story 3

```text
Task: "Add XP source and level threshold unit tests in tests/unit/readingQuest.spec.ts"
Task: "Create src/components/profile/ReaderLevelStrip.vue showing level title, total XP, PrimeVue ProgressBar, and next-level prompt"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundation.
3. Complete Phase 3 User Story 1.
4. Stop and validate: set, edit, refresh, and re-open current-year goal.

### Incremental Delivery

1. Foundation -> goal persistence and aggregate shell ready.
2. US1 -> yearly goal create/edit MVP.
3. US2 -> Reading Quest progress, pace, projection, status.
4. US3 -> XP and level strip.
5. US4 -> Profile integration polish and cache invalidation.

### Validation Gates

1. After US1: quickstart scenarios 1-3 pass.
2. After US2: quickstart scenarios 4-6 pass.
3. After US3: quickstart scenario 7 passes.
4. After US4/polish: quickstart scenario 8, `npm.cmd test`, and `npm.cmd run build` pass.

## Notes

- Use RPC aggregation for quest/XP summary wherever possible; avoid client fan-out across activity tables.
- Keep XP derived from existing persisted activity; do not add an XP ledger in v1.
- Preserve friendly, non-punitive copy for all behind/low-history states.
- PrimeVue-first applies to dialog, input, button, progress, message, and status display controls.
