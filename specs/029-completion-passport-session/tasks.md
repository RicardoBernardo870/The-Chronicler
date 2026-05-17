# Tasks: Completion Passport Session

**Input**: Design documents from `/specs/029-completion-passport-session/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Focused Vitest coverage is included because the plan and quickstart call out regression-sensitive behavior for session start and prompt eligibility.

**Organization**: Tasks are grouped by user story so each increment can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file and has no dependency on incomplete tasks.
- **[Story]**: Maps task to a user story from `spec.md`.
- Every task includes an exact file path.

## Phase 1: Setup

**Purpose**: Confirm the existing surfaces and test seams before changing behavior.

- [X] T001 Review the current Start Session flow in `src/components/session/SessionStartButton.vue`, `src/composables/useReadingSession.ts`, and `src/stores/progress.ts`
- [X] T002 Review existing completion detection and active-book handoff in `src/pages/DashboardPage.vue`, `src/pages/BookDetailPage.vue`, and `src/composables/useActiveBook.ts`
- [X] T003 [P] Review existing PrimeVue confirmation usage in `src/App.vue`, `src/main.ts`, and `src/pages/LibraryPage.vue`

---

## Phase 2: Foundational

**Purpose**: Add small shared helpers so story work is testable and avoids duplicating completion logic.

**CRITICAL**: Complete this phase before user story implementation.

- [X] T004 [P] Create completion transition helper in `src/utils/completionPrompt.ts` for detecting below-100 to 100+ progress crossings
- [X] T005 [P] Add Vitest coverage for completion transition helper in `tests/unit/completionPassportPrompt.spec.ts`
- [X] T006 [P] Add Supabase mock helpers for progress-session tests in `tests/unit/progressSession.spec.ts`

**Checkpoint**: Shared helper and test scaffolding are ready.

---

## Phase 3: User Story 1 - Start a Session After Selecting a New Book (Priority: P1) MVP

**Goal**: A reader can complete one book, select an eligible replacement, and press Start Session immediately without saving a page first.

**Independent Test**: Complete or simulate completion of one book, select an unread/queued book with no `reading_progress` row, press Start Session, and confirm the active session starts at page 0 without creating a progress-history row.

### Tests for User Story 1

- [X] T007 [P] [US1] Add failing test for starting a session with no existing progress row in `tests/unit/progressSession.spec.ts`
- [X] T008 [P] [US1] Add failing test that starting a session preserves an existing current page in `tests/unit/progressSession.spec.ts`
- [X] T009 [P] [US1] Add failing test that starting a session does not emit session-ended or capture-trigger state in `tests/unit/progressSession.spec.ts`

### Implementation for User Story 1

- [X] T010 [US1] Update `startSession` in `src/stores/progress.ts` to upsert `reading_progress` with `current_page: 0` and `session_start_at` when no row exists
- [X] T011 [US1] Update local progress and `booksStore.applyProgressSnapshot` handling in `src/stores/progress.ts` after the session-start upsert returns the confirmed row
- [X] T012 [US1] Preserve existing online-only and error behavior in `src/composables/useReadingSession.ts` while allowing the new page-0 progress row path
- [X] T013 [US1] Ensure `SessionStartButton` in `src/components/session/SessionStartButton.vue` displays the active session state after the new upsert path
- [X] T014 [US1] Verify Dashboard selected-book Start Session flow uses the updated store behavior without requiring a prior save in `src/pages/DashboardPage.vue`
- [X] T015 [US1] Verify Book Detail Start Session flow uses the updated store behavior without requiring a prior save in `src/pages/BookDetailPage.vue`

**Checkpoint**: User Story 1 is functional and independently testable.

---

## Phase 4: User Story 2 - Discover the Book Passport After Completion (Priority: P1)

**Goal**: A reader who newly completes a book sees a celebratory, dismissible prompt with one action to open the Book Passport.

**Independent Test**: Save progress that completes a book and confirm the completion prompt appears once, routes to `book-passport` when accepted, and leaves completion state intact when dismissed.

### Tests for User Story 2

- [X] T016 [P] [US2] Add failing test for completion prompt eligibility on below-100 to 100+ transition in `tests/unit/completionPassportPrompt.spec.ts`
- [X] T017 [P] [US2] Add failing test that already-completed refresh state does not qualify for a new prompt in `tests/unit/completionPassportPrompt.spec.ts`

### Implementation for User Story 2

- [X] T018 [US2] Add completion prompt state and `showCompletionPassportPrompt` handler in `src/pages/DashboardPage.vue`
- [X] T019 [US2] Route the Dashboard prompt primary action to `{ name: "book-passport", params: { id: completedBookId } }` in `src/pages/DashboardPage.vue`
- [X] T020 [US2] Wire Dashboard completion detection to the helper from `src/utils/completionPrompt.ts` in `src/pages/DashboardPage.vue`
- [X] T021 [US2] Add matching completion prompt behavior for Book Detail progress saves in `src/pages/BookDetailPage.vue`
- [X] T022 [US2] Ensure the prompt is dismissible and does not block session capture, recap, lore, or passport generation side effects in `src/pages/DashboardPage.vue` and `src/pages/BookDetailPage.vue`
- [X] T023 [US2] Keep completed-book journey access visible after dismissal through `src/components/book/BookProgressPanel.vue`

**Checkpoint**: User Story 2 is functional and independently testable.

---

## Phase 5: User Story 3 - Preserve Completion and Selection State (Priority: P2)

**Goal**: Completed book state, active replacement state, and prompt deduplication remain consistent after refresh and background revalidation.

**Independent Test**: Complete a book, select a replacement, refresh the app, and confirm the completed book stays completed, the replacement remains eligible for Start Session, and the completion prompt does not reappear from hydration alone.

### Tests for User Story 3

- [X] T024 [P] [US3] Add active-book handoff regression test for completed hero and replacement selection in `tests/unit/activeBookCompletion.spec.ts`
- [X] T025 [P] [US3] Add prompt deduplication regression test for repeated completion-state evaluation in `tests/unit/completionPassportPrompt.spec.ts`

### Implementation for User Story 3

- [X] T026 [US3] Harden `initializeIfNeeded` and explicit selection behavior for page-0 active books in `src/composables/useActiveBook.ts`
- [X] T027 [US3] Ensure completed hero handoff still calls `onBookCompleted` after progress saves in `src/pages/DashboardPage.vue`
- [X] T028 [US3] Ensure refresh-derived progress at page 0 with `sessionStartAt` remains eligible as active reading state in `src/composables/useActiveBook.ts`
- [X] T029 [US3] Confirm completed-only and no-active-book empty states still render correctly in `src/composables/useDashboardOnboardingState.ts`

**Checkpoint**: User Story 3 is functional and independently testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete flow and tighten user-facing details.

- [X] T030 [P] Polish completion prompt copy and mobile button labels in `src/pages/DashboardPage.vue` and `src/pages/BookDetailPage.vue`
- [X] T031 [P] Verify Book Passport pending/empty states remain graceful in `src/pages/BookPassportPage.vue`
- [X] T032 Run `npm test` from repository root
- [X] T033 Run `npm run build` from repository root
- [ ] T034 Execute quickstart validation flows from `specs/029-completion-passport-session/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; recommended MVP because it fixes the blocking reading-flow bug.
- **US2 (Phase 4)**: Depends on Foundational; can be implemented after or alongside US1, but final verification benefits from US1.
- **US3 (Phase 5)**: Depends on US1 and US2 because it verifies their combined state transitions.
- **Polish (Phase 6)**: Depends on selected user stories being complete.

### User Story Dependencies

- **US1 Start Session After Selecting a New Book**: No dependency on other stories after Foundational.
- **US2 Discover the Book Passport After Completion**: No dependency on US1 after Foundational, but shares completion detection surfaces.
- **US3 Preserve Completion and Selection State**: Depends on US1 and US2 behavior being present.

### Within Each User Story

- Write failing tests first.
- Implement store/composable behavior before UI verification.
- Complete each checkpoint before moving to later dependent phases.

---

## Parallel Opportunities

- T003, T004, T005, and T006 touch separate concerns and can run in parallel after initial review.
- T007, T008, and T009 can be written in parallel in the same test file only if coordinated; otherwise run sequentially.
- T016 and T017 can be written in parallel with US1 implementation because they target the completion helper.
- T024 and T025 can be written in parallel after US1 and US2 behavior exists.
- T030 and T031 can run in parallel during polish.

## Parallel Example: User Story 1

```text
Task: "Add failing test for starting a session with no existing progress row in tests/unit/progressSession.spec.ts"
Task: "Add failing test that starting a session preserves an existing current page in tests/unit/progressSession.spec.ts"
Task: "Add failing test that starting a session does not emit session-ended or capture-trigger state in tests/unit/progressSession.spec.ts"
```

## Parallel Example: User Story 2

```text
Task: "Add failing test for completion prompt eligibility on below-100 to 100+ transition in tests/unit/completionPassportPrompt.spec.ts"
Task: "Add failing test that already-completed refresh state does not qualify for a new prompt in tests/unit/completionPassportPrompt.spec.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 fully.
3. Validate that Start Session works for a newly selected book with no prior progress.
4. Then add US2 completion prompt.
5. Finish US3 state preservation after both primary flows exist.

### Incremental Delivery

1. Deliver Start Session fix.
2. Deliver completion passport prompt.
3. Deliver refresh/deduplication hardening.
4. Run the full quickstart and automated checks.

### Notes

- Keep Start Session online-only.
- Do not create `progress_history` on session start.
- Do not set page 1 automatically for unread books.
- Keep the completion prompt tied to newly completed progress transitions only.
