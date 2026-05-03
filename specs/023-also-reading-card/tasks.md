# Tasks: Also Reading Card

**Input**: Design documents from `specs/023-also-reading-card/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: No dedicated automated test files were explicitly requested. Validation tasks use SQL smoke checks, existing app commands, and the manual quickstart flows.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently after the shared backend foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another incomplete task in the same phase
- **[Story]**: User story label from [spec.md](./spec.md)
- Every task includes an exact repository path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the current branch, feature pointer, and existing community code paths before implementation begins.

- [x] T001 Verify `.specify/feature.json` points to `specs/023-also-reading-card` before implementation
- [x] T002 Review existing follow/block helper functions and grants in `supabase/migrations/20260503_community_follows_blocks.sql`
- [x] T003 [P] Review existing public profile privacy behavior in `supabase/migrations/20260502_community_profiles.sql`
- [x] T004 [P] Review Book Detail integration point in `src/pages/BookDetailPage.vue`
- [x] T005 [P] Review existing SWR cache key and invalidation conventions in `src/composables/useCache.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the stable server-side read contract and shared frontend data layer required by every user story.

**CRITICAL**: No user story work should begin until the RPC returns only privacy-safe card-ready data.

- [x] T006 Create additive migration `supabase/migrations/<timestamp>_also_reading_card.sql` with `public.normalize_isbn(p_isbn text)` per `specs/023-also-reading-card/contracts/sql-schema.md`
- [x] T007 Add or verify active-reading and book ISBN indexes in `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T008 Implement `public.get_also_reading_for_book(p_book_id uuid, p_isbn text, p_limit int, p_cursor text)` in `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T009 Add RPC execute revokes and authenticated grant for `get_also_reading_for_book` in `supabase/migrations/<timestamp>_also_reading_card.sql`
- [ ] T010 Run local SQL smoke checks for empty, visible, hidden-progress, and blocked results using `specs/023-also-reading-card/quickstart.md`
- [x] T011 [P] Add `AlsoReadingMatchType`, `AlsoReadingRelativeStatus`, `AlsoReadingItem`, and `AlsoReadingPage` interfaces to `src/types/index.ts`
- [x] T012 [P] Add `cacheKeys.alsoReading(uid, bookId)` to `src/composables/useCache.ts`
- [x] T013 Create `src/stores/alsoReading.ts` with SWR-backed `fetchForBook` and `clearBook` actions calling `get_also_reading_for_book`
- [x] T014 Add community graph invalidation for also-reading cache entries after follow/block changes in `src/stores/communityGraph.ts`
- [x] T015 Create `src/composables/useAlsoReading.ts` wrapper for page/component consumption of `src/stores/alsoReading.ts`

**Checkpoint**: The backend contract and frontend data layer are available, privacy-safe, and reusable.

---

## Phase 3: User Story 1 - See Followed Readers On The Same Book (Priority: P1) MVP

**Goal**: A reader opening a book detail page sees a compact card when followed readers are also reading the same book or ISBN.

**Independent Test**: Use the visible followed-reader and ISBN match flows in [quickstart.md](./quickstart.md); the card appears for visible matches and hides when there are none.

### Implementation for User Story 1

- [x] T016 [P] [US1] Create compact card shell and reader-row rendering in `src/components/community/AlsoReadingCard.vue`
- [x] T017 [P] [US1] Create load-more dialog shell in `src/components/community/AlsoReadingListDialog.vue`
- [x] T018 [US1] Wire `AlsoReadingCard.vue` to `useAlsoReading` for first-page fetch, empty-result hiding, loading, and error states in `src/components/community/AlsoReadingCard.vue`
- [x] T019 [US1] Wire `AlsoReadingListDialog.vue` to `useAlsoReading` cursor pagination in `src/components/community/AlsoReadingListDialog.vue`
- [x] T020 [US1] Export `AlsoReadingCard` and `AlsoReadingListDialog` from `src/components/community/index.ts`
- [x] T021 [US1] Mount `AlsoReadingCard` after `BookProgressPanel` in `src/pages/BookDetailPage.vue`
- [x] T022 [US1] Pass `book.id`, `book.isbn`, and viewer progress percentage from `src/pages/BookDetailPage.vue` into `src/components/community/AlsoReadingCard.vue`
- [ ] T023 [US1] Validate visible same-book, same-ISBN, view-more, and no-match flows from `specs/023-also-reading-card/quickstart.md`

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Preserve Privacy And Blocking (Priority: P1)

**Goal**: Current-reading privacy, progress privacy, and either-direction blocks remove or redact card data before it reaches the client.

**Independent Test**: Use the progress privacy and blocking flows in [quickstart.md](./quickstart.md); hidden readers never appear and hidden progress fields are null.

### Implementation for User Story 2

- [x] T024 [US2] Verify current-reading visibility predicates exclude ineligible candidates inside `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T025 [US2] Verify progress visibility predicates null page, total pages, percentage, and relative status inside `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T026 [US2] Verify either-direction block predicates exclude candidates inside `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T027 [US2] Update hidden-progress display copy and layout in `src/components/community/AlsoReadingCard.vue`
- [x] T028 [US2] Mirror hidden-progress display behavior in `src/components/community/AlsoReadingListDialog.vue`
- [ ] T029 [US2] Validate current-reading nobody, progress nobody, viewer-blocks-reader, and reader-blocks-viewer flows from `specs/023-also-reading-card/quickstart.md`

**Checkpoint**: User Story 2 privacy and blocking behavior is independently verifiable.

---

## Phase 5: User Story 3 - Understand Relative Progress When Allowed (Priority: P2)

**Goal**: Readers see ahead, behind, or same-area labels only when progress is visible and comparable.

**Independent Test**: Use the relative status flow in [quickstart.md](./quickstart.md); labels match more than 10% ahead, more than 10% behind, and within 10% same-area cases.

### Implementation for User Story 3

- [x] T030 [US3] Implement 10% `same_area`, `ahead`, `behind`, and null relative status calculation inside `supabase/migrations/<timestamp>_also_reading_card.sql`
- [x] T031 [US3] Add relative status label mapping in `src/components/community/AlsoReadingCard.vue`
- [x] T032 [US3] Add relative status label mapping in `src/components/community/AlsoReadingListDialog.vue`
- [ ] T033 [US3] Validate ahead, behind, same-area, viewer-progress-missing, and progress-hidden cases from `specs/023-also-reading-card/quickstart.md`

**Checkpoint**: User Story 3 relative labels are independently verifiable.

---

## Phase 6: User Story 4 - Open A Public Reader Profile (Priority: P3)

**Goal**: A listed reader can be opened from the card or dialog using the existing public profile route.

**Independent Test**: Select a reader from the card and dialog; both navigate to `/u/:username` and the public profile applies its own privacy rules.

### Implementation for User Story 4

- [x] T034 [US4] Add accessible profile navigation actions to reader rows in `src/components/community/AlsoReadingCard.vue`
- [x] T035 [US4] Add accessible profile navigation actions to reader rows in `src/components/community/AlsoReadingListDialog.vue`
- [x] T036 [US4] Validate card-row and dialog-row navigation to the existing public profile route from `src/pages/BookDetailPage.vue`

**Checkpoint**: User Story 4 profile navigation is independently verifiable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, advisor checks, and cleanup across all stories.

- [ ] T037 [P] Run Supabase security advisor and record any required remediations in `specs/023-also-reading-card/quickstart.md`
- [ ] T038 [P] Run Supabase performance advisor and record any index or duplicate-index remediations in `specs/023-also-reading-card/quickstart.md`
- [x] T039 Run `npm.cmd test` from the repository root `C:\Users\ricar_nf02dr4\Desktop\BookHero\BookHero`
- [x] T040 Run `npm.cmd run build` from the repository root `C:\Users\ricar_nf02dr4\Desktop\BookHero\BookHero`
- [ ] T041 Validate the full acceptance checklist in `specs/023-also-reading-card/quickstart.md`
- [x] T042 Review generated implementation against `specs/023-also-reading-card/contracts/rpc-contracts.md`, `specs/023-also-reading-card/contracts/sql-schema.md`, and `specs/023-also-reading-card/contracts/ui-contracts.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion and delivers the MVP card.
- **User Story 2 (Phase 4)**: Depends on Foundational completion; can run in parallel with US1 after the RPC exists, but must be complete before release.
- **User Story 3 (Phase 5)**: Depends on Foundational completion and progress fields from US2 behavior.
- **User Story 4 (Phase 6)**: Depends on US1 UI rows.
- **Polish (Phase 7)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational; no dependency on US2-US4 for MVP display.
- **US2 (P1)**: Can start after Foundational; privacy/blocking should be validated before any public release.
- **US3 (P2)**: Can start after Foundational; label UI depends on card row rendering from US1.
- **US4 (P3)**: Can start after US1 row rendering exists.

### Within Each User Story

- Backend contract and types before store/composable work.
- Store/composable before UI data wiring.
- UI row rendering before dialog pagination and navigation refinements.
- Each story checkpoint should be validated before moving to the next priority.

## Parallel Opportunities

- T003, T004, and T005 can run in parallel during Setup.
- T011 and T012 can run in parallel with SQL migration work once the RPC contract is accepted.
- T016 and T017 can run in parallel because they create separate Vue components.
- T024, T025, and T026 are separate SQL predicate review tasks and can be split across reviewers after T008.
- T031 and T032 can run in parallel after T030.
- T034 and T035 can run in parallel after US1 row rendering exists.
- T037 and T038 can run in parallel after the migration is applied.

## Parallel Example: User Story 1

```text
Task: "Create compact card shell and reader-row rendering in src/components/community/AlsoReadingCard.vue"
Task: "Create load-more dialog shell in src/components/community/AlsoReadingListDialog.vue"
```

## Parallel Example: User Story 2

```text
Task: "Verify current-reading visibility predicates exclude ineligible candidates inside supabase/migrations/<timestamp>_also_reading_card.sql"
Task: "Verify progress visibility predicates null page, total pages, percentage, and relative status inside supabase/migrations/<timestamp>_also_reading_card.sql"
Task: "Verify either-direction block predicates exclude candidates inside supabase/migrations/<timestamp>_also_reading_card.sql"
```

## Parallel Example: User Story 3

```text
Task: "Add relative status label mapping in src/components/community/AlsoReadingCard.vue"
Task: "Add relative status label mapping in src/components/community/AlsoReadingListDialog.vue"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational RPC, indexes, types, cache key, store, and composable.
3. Complete Phase 3: User Story 1 card display and view-more behavior.
4. Stop and validate visible same-book, same-ISBN, and no-match flows from [quickstart.md](./quickstart.md).

### Production-Safe Release

1. Complete MVP.
2. Complete Phase 4 privacy/blocking validation before exposing the card to users.
3. Complete Phase 5 relative progress labels.
4. Complete Phase 6 profile navigation.
5. Complete Phase 7 advisor checks, app tests, build, and manual acceptance validation.

### Notes

- `[P]` tasks touch different files or are review/validation tasks that do not depend on each other.
- Keep SQL privacy and block enforcement server-side; do not add client-side filtering of private data.
- Use PrimeVue primitives before custom UI where a suitable component exists.
- Avoid adding Reading Circles, reactions, notes, feed events, or notifications while completing these tasks.
