# Tasks: First-Run Onboarding

**Input**: Design documents from `/specs/020-first-run-onboarding/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Formal test-file tasks are not included because the specification does not explicitly request automated tests. Validation is covered through focused manual quickstart flows and `npx.cmd vue-tsc -b`.

**Organization**: Tasks are grouped by user story so each onboarding state can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel when files do not overlap and dependencies are complete
- **[Story]**: User story label (`US1`, `US2`, etc.)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add shared types and state-derivation skeletons used by Dashboard and add-book flows.

- [X] T001 Add `InitialBookStatus`, `AddBookInput`, and first-run Dashboard state types in `src/types/index.ts`
- [X] T002 [P] Create first-run Dashboard state composable skeleton in `src/composables/useDashboardOnboardingState.ts`
- [X] T003 [P] Create Dashboard first-run component placeholders in `src/components/dashboard/DashboardEmptyState.vue` and `src/components/dashboard/CompletedOnlyState.vue`
- [X] T004 [P] Add initial-status form event typing to `src/components/books/BookForm.vue`
- [X] T005 Document the no-new-table implementation decision in `specs/020-first-run-onboarding/data-model.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Centralize status-to-progress behavior and cache invalidation before user-story UI work.

**Critical**: User story work depends on these shared state rules.

- [X] T006 Add a confirmed `addBookWithInitialStatus` action that creates the book and optional progress row in `src/stores/books.ts`
- [X] T007 Add a non-session progress write helper for initial status saves in `src/stores/progress.ts`
- [X] T008 Ensure initial completed imports do not emit `lastSessionEnded` or create session-like history in `src/stores/progress.ts`
- [X] T009 Invalidate `library`, `progress`, `readingStats`, `libraryBreakdown`, and `velocity` caches after initial-status saves in `src/stores/books.ts`
- [X] T010 Add deterministic reading-state helpers for queued/currently-reading/completed derivation in `src/composables/useDashboardOnboardingState.ts`
- [X] T011 Review `src/services/recapService.ts`, `src/stores/recaps.ts`, and capture/session flows for completed-import trigger paths and document required guards in code comments where applicable

**Checkpoint**: Adding books with an initial status can safely update library/progress state without active-reading side effects.

---

## Phase 3: User Story 1 - First Active Book Becomes The Hero (Priority: P1) MVP

**Goal**: A new reader with exactly one in-progress book sees that book as the Dashboard hero automatically.

**Independent Test**: Fresh user adds one active book, navigates to Dashboard, refreshes, and sees that book as hero without manual selection.

- [X] T012 [US1] Update `initializeIfNeeded` to auto-select the only in-progress book when no active book is set in `src/composables/useActiveBook.ts`
- [X] T013 [US1] Add deterministic fallback selection for multiple in-progress books without explicit active selection in `src/composables/useActiveBook.ts`
- [X] T014 [US1] Ensure completed or queued books clear invalid active hero selection in `src/composables/useActiveBook.ts`
- [X] T015 [US1] Wire Dashboard initialization after `fetchLibraryWithProgress`, `fetchProgress`, and `fetchOrder` settle in `src/pages/DashboardPage.vue`
- [X] T016 [US1] Keep `pageInput`, recap fetching, and reading pulse initialization synchronized with auto-selected hero changes in `src/pages/DashboardPage.vue`

**Checkpoint**: User Story 1 is independently usable and fixes the discovered first-book hero bug.

---

## Phase 4: User Story 2 - Tiny Libraries Avoid Redundant Sections (Priority: P1)

**Goal**: The Dashboard hides duplicated or empty sections when the library has zero or one meaningful candidate.

**Independent Test**: Validate no books, one queued book, one active book, and one completed book Dashboard states.

- [X] T017 [US2] Implement first-run state classification in `src/composables/useDashboardOnboardingState.ts`
- [X] T018 [P] [US2] Implement compact no-book and one-queued states in `src/components/dashboard/DashboardEmptyState.vue`
- [X] T019 [P] [US2] Implement completed-only acknowledgement state in `src/components/dashboard/CompletedOnlyState.vue`
- [X] T020 [US2] Replace generic no-book Dashboard branch with `DashboardEmptyState` in `src/pages/DashboardPage.vue`
- [X] T021 [US2] Hide `InProgressSection` when it would only duplicate the hero book in `src/pages/DashboardPage.vue`
- [X] T022 [US2] Hide `UpNextSection` when it has no useful candidates or only repeats first-run guidance in `src/pages/DashboardPage.vue`
- [X] T023 [US2] Render `CompletedOnlyState` instead of an empty active-reading hero for completed-only libraries in `src/pages/DashboardPage.vue`
- [X] T024 [US2] Verify Dashboard bottom safe-area spacing still leaves the final first-run card/action visible in `src/pages/DashboardPage.vue`

**Checkpoint**: User Story 2 is independently testable across tiny-library Dashboard states.

---

## Phase 5: User Story 3 - First-Time Empty Dashboard Guides The First Book (Priority: P1)

**Goal**: A brand-new reader with no books sees one concise path into adding a first book.

**Independent Test**: Fresh user opens Dashboard with no books and reaches add-book flow from one primary action.

- [X] T025 [US3] Refine no-book copy and action hierarchy in `src/components/dashboard/DashboardEmptyState.vue`
- [X] T026 [US3] Ensure no-book Dashboard state hides Word of the Day, Last Session, In Progress, Up Next, and Completed sections in `src/pages/DashboardPage.vue`
- [X] T027 [US3] Ensure the no-book primary action routes to the add-book flow in `src/components/dashboard/DashboardEmptyState.vue`
- [X] T028 [US3] Confirm the no-book state does not depend on profile/community metadata by using only library-entry absence in `src/composables/useDashboardOnboardingState.ts`

**Checkpoint**: User Story 3 is independently testable on a fresh empty account.

---

## Phase 6: User Story 4 - Add A Book As Already Completed (Priority: P2)

**Goal**: Users can add queued, currently-reading, or already-completed books from the add-book flow.

**Independent Test**: Add one book for each initial status and verify library/Dashboard state matches the selected status.

- [X] T029 [US4] Add a PrimeVue status selector for queued/currently-reading/completed in `src/components/books/BookForm.vue`
- [X] T030 [US4] Add conditional current-page input and validation for currently-reading status in `src/components/books/BookForm.vue`
- [X] T031 [US4] Submit initial status and current page from `BookForm` to `AddBookPage` in `src/components/books/BookForm.vue`
- [X] T032 [US4] Replace direct `addBook` usage with `addBookWithInitialStatus` in `src/pages/AddBookPage.vue`
- [X] T033 [US4] Route queued and completed saves back to the appropriate Library/Dashboard state without setting an active hero in `src/pages/AddBookPage.vue`
- [X] T034 [US4] Clamp completed imports to total pages and currently-reading page values below completion in `src/stores/books.ts`

**Checkpoint**: User Story 4 is independently usable from the add-book flow.

---

## Phase 7: User Story 5 - Completed Imports Do Not Trigger Active Reading Workflows (Priority: P2)

**Goal**: Completed imports behave like historical library entries, not reading sessions.

**Independent Test**: Add a completed book and confirm no session, capture, recap, or continue-reading affordance appears due only to import.

- [X] T035 [US5] Ensure completed import progress writes bypass `updateProgress` session/history side effects in `src/stores/progress.ts`
- [X] T036 [US5] Guard Dashboard continue-reading actions from completed-only state in `src/pages/DashboardPage.vue`
- [X] T037 [US5] Ensure `SessionCaptureField` cannot appear from completed-import saves by relying only on real `lastSessionEnded` events in `src/components/session/SessionCaptureField.vue`
- [X] T038 [US5] Confirm recap generation entry points remain user-triggered for completed imports in `src/stores/recaps.ts` and `src/services/recapService.ts`
- [X] T039 [US5] Ensure lore/passport completion side effects are not triggered by completed imports unless explicitly desired and documented in `src/stores/progress.ts`

**Checkpoint**: User Story 5 prevents accidental active-reading or AI side effects for historical imports.

---

## Phase 8: User Story 6 - Completed-Only Libraries Still Feel Useful (Priority: P2)

**Goal**: Completed-only users see a meaningful Dashboard state and a clear next action.

**Independent Test**: Add one or more completed books to a new user and open Dashboard.

- [X] T040 [US6] Render completed-book count and recent completed titles in `src/components/dashboard/CompletedOnlyState.vue`
- [X] T041 [US6] Add primary action to add/start another book in `src/components/dashboard/CompletedOnlyState.vue`
- [X] T042 [US6] Wire completed-only state selection from `useDashboardOnboardingState` into `src/pages/DashboardPage.vue`
- [X] T043 [US6] Keep completed preview behavior useful when one active book plus completed books exist in `src/pages/DashboardPage.vue`

**Checkpoint**: User Story 6 is independently testable for completed-only libraries.

---

## Phase 9: User Story 7 - Established Users Keep Their Reading Choice (Priority: P3)

**Goal**: Multi-book users retain explicit reading order while automatic rules fill only missing choices.

**Independent Test**: Create two active books, set/reorder the reading choice, refresh Dashboard, and confirm the explicit choice remains.

- [X] T044 [US7] Track whether active selection was explicit or inferred in `src/composables/useActiveBook.ts`
- [X] T045 [US7] Ensure `setActive` marks explicit user choice and is never overwritten by single-book inference in `src/composables/useActiveBook.ts`
- [X] T046 [US7] Use `upNextStore.sortedBookIds()` before recent progress when choosing among multiple active books in `src/composables/useActiveBook.ts`
- [X] T047 [US7] Preserve up-next ordering when Dashboard hides redundant tiny-library sections in `src/pages/DashboardPage.vue`
- [X] T048 [US7] Verify `UpNextSection` selection still calls explicit hero selection in `src/components/dashboard/UpNextSection.vue`

**Checkpoint**: User Story 7 preserves established multi-book behavior.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full first-run matrix, update context, and keep implementation tidy.

- [X] T049 Run TypeScript validation with `npx.cmd vue-tsc -b`
- [ ] T050 Execute the manual validation matrix in `specs/020-first-run-onboarding/quickstart.md`
- [X] T051 Verify existing Library page currently-reading, queued, and archives sections do not regress in `src/pages/LibraryPage.vue`
- [X] T052 Verify existing private Profile page remains unchanged after initial completed imports in `src/pages/ProfilePage.vue`
- [X] T053 Update implementation notes for first-run onboarding in `docs/community-speckit-prompts.md` or a dedicated onboarding notes section if needed
- [X] T054 Update recent-change context for first-run onboarding in `AGENTS.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: Starts immediately.
- **Phase 2 Foundational**: Depends on shared types/skeletons and blocks all story completion.
- **US1, US2, US3 (P1)**: Depend on Phase 2. US1 and US2 touch the same Dashboard/active-book surfaces and should be integrated carefully; US3 builds on US2 empty-state components.
- **US4 (P2)**: Depends on Phase 2 initial-status action and can proceed after `BookForm` typing exists.
- **US5 (P2)**: Depends on US4 completed import flow.
- **US6 (P2)**: Depends on US2 first-run state derivation and US4 completed import flow.
- **US7 (P3)**: Depends on US1 active-book inference and should be validated after P1/P2 behavior is stable.
- **Polish**: Depends on all desired user stories.

### User Story Dependencies

- **US1 First Active Hero (P1)**: MVP bug fix; can be validated with an existing one-book active account after Phase 2.
- **US2 Tiny Libraries (P1)**: Builds on Dashboard state classification; complements US1.
- **US3 Empty Dashboard (P1)**: Uses US2 empty-state component; independently testable on an empty account.
- **US4 Initial Status (P2)**: Adds add-book flow capability; independently testable per status.
- **US5 Completed Import Safeguards (P2)**: Requires completed import path from US4.
- **US6 Completed-Only Dashboard (P2)**: Requires completed import path and Dashboard state derivation.
- **US7 Established User Choice (P3)**: Regression protection for multi-book users.

### Within Each User Story

- Shared types/composables before page integration.
- Store actions before form/page submit wiring.
- First-run components before Dashboard branch replacement.
- Side-effect guards before completed-import UX is considered complete.

---

## Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 is understood.
- T018 and T019 can run in parallel because they create separate Dashboard components.
- T029 and T040 can run in parallel once shared types are complete.
- US4 form UI tasks and US2 Dashboard component tasks can proceed in parallel after Phase 2, but final integration must be sequential in `DashboardPage.vue` and `BookForm.vue`.
- T051 and T052 can be validated in parallel during polish.

---

## Parallel Example: User Story 4

```text
Task: "Add a PrimeVue status selector in src/components/books/BookForm.vue"
Task: "Clamp completed imports to total pages in src/stores/books.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Complete Phase 1 and Phase 2.
2. Complete US1 to fix the discovered one-active-book hero issue.
3. Complete US2 and US3 to make the empty/tiny Dashboard states feel intentional.
4. Stop and validate no-book, one-queued, one-active, and refresh behavior.

### Incremental Delivery

1. Ship first-active hero inference and duplicate-section hiding.
2. Add initial-status support to the add-book flow.
3. Add completed-import safeguards and completed-only Dashboard state.
4. Finish multi-book explicit-choice regression hardening.
5. Run the full quickstart validation matrix.

### Final Validation

1. `npx.cmd vue-tsc -b`
2. `specs/020-first-run-onboarding/quickstart.md`
3. Manual regression check for Library, Book Detail, Dashboard, and Profile routes
4. Network/console spot-check that completed imports do not trigger recap/capture/session workflows

