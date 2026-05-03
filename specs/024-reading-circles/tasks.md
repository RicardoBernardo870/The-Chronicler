# Tasks: Reading Circles

**Input**: Design documents from `specs/024-reading-circles/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Full TDD was not requested. This task list includes required SQL smoke/advisor and build validation tasks because the feature has server-side privacy, RLS, and spoiler-safety acceptance criteria.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks
- **[Story]**: Maps to a user story from [spec.md](./spec.md)
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare feature files and shared frontend/backend extension points.

- [x] T001 Create the additive Reading Circles migration file in `supabase/migrations/20260503_reading_circles.sql`
- [x] T002 [P] Add Reading Circles domain and RPC response TypeScript types in `src/types/index.ts`
- [x] T003 [P] Add Reading Circles cache key helpers to `src/composables/useCache.ts`
- [x] T004 [P] Export planned Reading Circles community components from `src/components/community/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the database foundation that all user stories depend on.

**Critical**: No user story work can begin until this phase is complete.

- [x] T005 Define idempotent enum types, `reading_circles`, `circle_invitations`, `circle_members`, and `circle_reactions` tables in `supabase/migrations/20260503_reading_circles.sql`
- [x] T006 Add constraints for circle names, invitation statuses, member roles, reaction page ranges, normalized locations, and 280-character content in `supabase/migrations/20260503_reading_circles.sql`
- [x] T007 Add FK, composite, partial, and unique indexes for circles, invitations, members, reactions, existing progress, and book matching paths in `supabase/migrations/20260503_reading_circles.sql`
- [x] T008 Add RLS enablement and table policies for circle metadata, invitations, memberships, and reaction access boundaries in `supabase/migrations/20260503_reading_circles.sql`
- [x] T009 Add security-definer helper functions for member checks, owner checks, member counts, viewer progress location, work matching, block checks, and timestamp touching in `supabase/migrations/20260503_reading_circles.sql`
- [x] T010 Add triggers for `updated_at`, max accepted member count, owner consistency, and blocked member insertion prevention in `supabase/migrations/20260503_reading_circles.sql`
- [x] T011 Revoke public/anon execute on internal helpers and grant only stable public RPCs to authenticated users in `supabase/migrations/20260503_reading_circles.sql`

**Checkpoint**: Schema, RLS, helpers, grants, and indexes are ready for story RPCs and UI.

---

## Phase 3: User Story 1 - Create A Private Circle (Priority: P1) MVP

**Goal**: A reader can create a private circle, invite eligible followed readers, and invited readers become members only after accepting.

**Independent Test**: Create a circle for a book, invite followed readers, accept an invitation, confirm pending invitations do not grant reaction/detail access, and confirm the 10-member cap is enforced on acceptance.

### Implementation for User Story 1

- [x] T012 [US1] Implement `create_reading_circle`, `invite_reading_circle_members`, and `respond_to_reading_circle_invitation` RPCs in `supabase/migrations/20260503_reading_circles.sql`
- [x] T013 [US1] Implement `list_my_reading_circles` and `get_reading_circle_detail` RPCs for accepted members and pending invitations in `supabase/migrations/20260503_reading_circles.sql`
- [x] T014 [US1] Add SQL smoke cases for circle creation, invite eligibility, invitation acceptance, pending access denial, and max-member rejection in `specs/024-reading-circles/quickstart.md`
- [x] T015 [P] [US1] Implement the Pinia Reading Circles store actions for create, invite, respond, list, and detail RPCs in `src/stores/readingCircles.ts`
- [x] T016 [P] [US1] Implement `useReadingCircles` orchestration for book-scoped circle loading and non-blocking error state in `src/composables/useReadingCircles.ts`
- [x] T017 [P] [US1] Create the compact Book Detail Reading Circles panel shell in `src/components/community/ReadingCirclesPanel.vue`
- [x] T018 [P] [US1] Create the circle create/invite dialog with PrimeVue controls in `src/components/community/ReadingCircleInviteDialog.vue`
- [x] T019 [P] [US1] Create the circle detail dialog shell with member and pending invitation sections in `src/components/community/ReadingCircleDialog.vue`
- [x] T020 [US1] Mount the Reading Circles panel in the Book Detail page without delaying core book detail rendering in `src/pages/BookDetailPage.vue`
- [x] T021 [US1] Wire create, invite, accept, decline, list, and detail store calls through the panel and dialogs in `src/components/community/ReadingCirclesPanel.vue`

**Checkpoint**: User Story 1 is functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Add Page-Specific Reactions (Priority: P1)

**Goal**: Accepted members can add short reactions at valid pages at or behind their own current progress.

**Independent Test**: Add a valid reaction at the current page, then confirm over-length content, page 0, beyond-total-pages, and ahead-of-progress reactions are rejected.

### Implementation for User Story 2

- [x] T022 [US2] Implement `add_circle_reaction` RPC with accepted-member, book ownership, work match, total pages, page range, content length, and author-progress checks in `supabase/migrations/20260503_reading_circles.sql`
- [x] T023 [US2] Add SQL smoke cases for valid reaction creation and invalid content/page/ahead-of-progress rejection in `specs/024-reading-circles/quickstart.md`
- [x] T024 [P] [US2] Add reaction creation state and `addReaction` action in `src/stores/readingCircles.ts`
- [x] T025 [P] [US2] Create the reaction composer with page input, 280-character validation, and progress-aware disabled states in `src/components/community/CircleReactionComposer.vue`
- [x] T026 [US2] Mount the reaction composer inside circle detail and refetch visible reactions after successful submit in `src/components/community/ReadingCircleDialog.vue`

**Checkpoint**: User Story 2 works independently for accepted members with server-side validation.

---

## Phase 5: User Story 3 - Protect Spoilers Across Progress And Editions (Priority: P1)

**Goal**: Members only read reactions at or behind their own normalized progress, including across editions with different page counts.

**Independent Test**: Create reactions at normalized locations ahead of and behind a viewer using different total-page editions, then confirm backend direct access only returns eligible reactions and updates when the viewer progresses.

### Implementation for User Story 3

- [x] T027 [US3] Implement `get_visible_circle_reactions` RPC with viewer progress lookup, normalized range clamping, blocked-author exclusion, soft-delete exclusion, pagination, and viewer-equivalent page derivation in `supabase/migrations/20260503_reading_circles.sql`
- [x] T028 [US3] Harden direct table RLS so private reaction content cannot be read outside the visibility-safe RPC in `supabase/migrations/20260503_reading_circles.sql`
- [x] T029 [US3] Add SQL smoke cases for edition mismatch, behind-progress denial, progress-forward reveal, and progress-backward hide in `specs/024-reading-circles/quickstart.md`
- [x] T030 [P] [US3] Add visible reaction list state, pagination, and range loading actions in `src/stores/readingCircles.ts`
- [x] T031 [P] [US3] Create the visible reaction list component with author profile summaries and viewer-equivalent page labels in `src/components/community/CircleReactionList.vue`
- [x] T032 [US3] Render visible reactions from the safe RPC only in `src/components/community/ReadingCircleDialog.vue`
- [x] T033 [US3] Add invalid progress and missing total-pages messaging for gated reaction reads in `src/components/community/ReadingCircleDialog.vue`

**Checkpoint**: User Story 3 preserves spoiler safety through UI and direct backend access.

---

## Phase 6: User Story 4 - Manage Membership And Blocking (Priority: P2)

**Goal**: Members can leave, owners can remove members, owner departure is deterministic, and blocked users cannot remain mutually visible.

**Independent Test**: Leave as a member, remove a member as owner, transfer ownership when owner leaves, close last-member circles, and confirm either-direction blocks remove or hide unsafe access.

### Implementation for User Story 4

- [x] T034 [US4] Implement `leave_reading_circle` and `remove_reading_circle_member` RPCs with owner transfer, last-member closure, member removal, and invitation revocation in `supabase/migrations/20260503_reading_circles.sql`
- [x] T035 [US4] Extend block cleanup or circle read/write guards so either-direction blocks prevent shared membership visibility and reaction access in `supabase/migrations/20260503_reading_circles.sql`
- [x] T036 [US4] Add SQL smoke cases for leave, owner removal, owner transfer, last-member closure, pending invite revocation, and block cleanup in `specs/024-reading-circles/quickstart.md`
- [x] T037 [P] [US4] Add leave, remove member, revoke invitation, and refresh actions in `src/stores/readingCircles.ts`
- [x] T038 [US4] Add owner/member management controls to the circle detail dialog in `src/components/community/ReadingCircleDialog.vue`
- [x] T039 [US4] Refresh Reading Circles state after block/unblock graph changes in `src/stores/communityGraph.ts`

**Checkpoint**: User Story 4 keeps membership safe and consistent with the community graph.

---

## Phase 7: User Story 5 - Receive Safe Live Reaction Updates (Priority: P3)

**Goal**: Eligible visible reactions appear live or after safe refetch within 2 seconds without leaking ahead-of-progress content.

**Independent Test**: Open a circle detail view, add an eligible reaction from another member, confirm visible refresh within 2 seconds, then add an ahead-of-progress reaction and confirm no readable content is delivered.

### Implementation for User Story 5

- [x] T040 [US5] Add safe realtime invalidation metadata, publication configuration, or documented refetch-only strategy for circle reaction changes in `supabase/migrations/20260503_reading_circles.sql`
- [x] T041 [US5] Add subscribe, unsubscribe, and 2-second safe refetch handling for open circle detail views in `src/stores/readingCircles.ts`
- [x] T042 [US5] Wire circle detail realtime lifecycle to open and close events in `src/components/community/ReadingCircleDialog.vue`
- [x] T043 [US5] Add current-page visible reaction indicator state to the store in `src/stores/readingCircles.ts`
- [x] T044 [US5] Render the subtle current-page reaction indicator in `src/components/community/ReadingCirclesPanel.vue`
- [x] T045 [US5] Add manual quickstart checks for eligible realtime refresh and ahead-of-progress realtime non-leakage in `specs/024-reading-circles/quickstart.md`

**Checkpoint**: User Story 5 provides safe live or near-live reaction awareness.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation, hardening, documentation, and final integration across all stories.

- [x] T046 Run `npm.cmd test` and record the result in `specs/024-reading-circles/quickstart.md`
- [x] T047 Run `npm.cmd run build` and record the result in `specs/024-reading-circles/quickstart.md`
- [x] T048 Apply the Supabase migration through MCP and record the migration outcome in `specs/024-reading-circles/quickstart.md`
- [x] T049 Run Supabase security advisors and address or document findings in `specs/024-reading-circles/quickstart.md`
- [x] T050 Run Supabase performance advisors and address or document findings in `specs/024-reading-circles/quickstart.md`
- [ ] T051 Validate all quickstart acceptance flows and update pass/fail notes in `specs/024-reading-circles/quickstart.md`
- [x] T052 [P] Review component accessibility, focus handling, mobile layout, and PrimeVue-first usage in `src/components/community/ReadingCircleDialog.vue`
- [x] T053 [P] Review component accessibility, loading states, and non-blocking Book Detail behavior in `src/components/community/ReadingCirclesPanel.vue`
- [x] T054 [P] Review SQL for fixed `search_path`, `(select auth.uid())`, least-privilege grants, FK indexes, duplicate indexes, and server-side spoiler gates in `supabase/migrations/20260503_reading_circles.sql`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers MVP circle creation and invitation acceptance.
- **US2 (Phase 4)**: Depends on Foundational and accepted membership from US1.
- **US3 (Phase 5)**: Depends on Foundational and reaction writes from US2.
- **US4 (Phase 6)**: Depends on Foundational and membership model from US1.
- **US5 (Phase 7)**: Depends on visible reaction reads from US3.
- **Polish (Phase 8)**: Depends on all desired user stories.

### User Story Dependencies

- **US1 Create A Private Circle (P1)**: First MVP story; required for all other stories.
- **US2 Add Page-Specific Reactions (P1)**: Requires accepted membership from US1.
- **US3 Protect Spoilers Across Progress And Editions (P1)**: Requires reaction persistence from US2.
- **US4 Manage Membership And Blocking (P2)**: Can begin after US1 and foundational block helpers; should remain independently testable.
- **US5 Receive Safe Live Reaction Updates (P3)**: Requires US3 visible reaction RPC.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel after T001 is known.
- T015, T016, T017, T018, and T019 can run in parallel after US1 RPC shapes are stable.
- T024 and T025 can run in parallel after T022 defines `add_circle_reaction`.
- T030 and T031 can run in parallel after T027 defines visible reaction response shape.
- T037 can run in parallel with T038 after T034 defines member-management RPC responses.
- T052, T053, and T054 can run in parallel during final review.

---

## Parallel Example: User Story 1

```text
Task: "Implement the Pinia Reading Circles store actions for create, invite, respond, list, and detail RPCs in src/stores/readingCircles.ts"
Task: "Implement useReadingCircles orchestration for book-scoped circle loading and non-blocking error state in src/composables/useReadingCircles.ts"
Task: "Create the compact Book Detail Reading Circles panel shell in src/components/community/ReadingCirclesPanel.vue"
Task: "Create the circle create/invite dialog with PrimeVue controls in src/components/community/ReadingCircleInviteDialog.vue"
Task: "Create the circle detail dialog shell with member and pending invitation sections in src/components/community/ReadingCircleDialog.vue"
```

## Parallel Example: User Story 3

```text
Task: "Add visible reaction list state, pagination, and range loading actions in src/stores/readingCircles.ts"
Task: "Create the visible reaction list component with author profile summaries and viewer-equivalent page labels in src/components/community/CircleReactionList.vue"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1.
3. Validate circle creation, invitation, acceptance, pending access denial, and max-member enforcement.
4. Stop and demo the private circle shell before reaction work.

### Incremental Delivery

1. Add US1 for private circles and invitations.
2. Add US2 for reaction creation.
3. Add US3 for spoiler-safe reads across editions.
4. Add US4 for robust membership and blocking.
5. Add US5 for safe realtime or near-live refresh.
6. Run Phase 8 validation and advisor checks.

### Backend Safety Order

1. Schema, indexes, RLS, helpers, and grants first.
2. Mutating RPCs with transaction-safe validation.
3. Read RPCs that return only already-filtered JSON.
4. Frontend rendering only from stable RPC contracts.
5. Realtime only as safe invalidation/refetch unless content filtering is proven safe.

---

## Notes

- Tasks touching `supabase/migrations/20260503_reading_circles.sql` are intentionally sequential where they build on the same SQL file.
- `[P]` tasks touch separate frontend files or independent documentation and can be parallelized.
- Keep SQL idempotent where possible and avoid `ADD CONSTRAINT IF NOT EXISTS`; use safe `do $$` guards for constraints and enum creation.
- Do not expose reaction content through client-side filtering or direct table reads.
- Use Supabase/Postgres best practices for RLS, fixed `search_path`, FK indexes, composite indexes, and least-privilege grants.
