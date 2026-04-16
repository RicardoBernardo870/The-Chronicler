# Tasks: Session Persistence & Dashboard Polish

**Input**: Design documents from `/specs/002-session-dashboard-polish/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

---

## Phase 1: Setup

**Purpose**: Confirm no new dependencies needed; Accordion is already part of PrimeVue 4 — no installs required.

- [ ] T001 Verify `Accordion`, `AccordionPanel`, `AccordionHeader`, `AccordionContent` are exported from `primevue` in `package.json` (PrimeVue 4 includes them; confirm no separate import map entry is needed)

---

## Phase 2: Foundational

**Purpose**: No blocking prerequisites exist for this feature — all four user stories operate on independent files and can be implemented in any order. Phase 2 is intentionally minimal.

- [ ] T002 Read `src/stores/auth.ts` in full to understand the current `initialize()` implementation before modifying it (blocks T003–T005)

**Checkpoint**: Foundation ready — all user story phases can begin.

---

## Phase 3: User Story 1 — Persistent Login Session (Priority: P1) 🎯 MVP

**Goal**: User stays logged in after page refresh. Supabase session is read from localStorage on boot before any router guard fires.

**Independent Test**: Log in → refresh page → confirm Dashboard loads without redirecting to `/auth`.

### Implementation

- [ ] T003 [US1] In `src/stores/auth.ts`, update `initialize()` to: (1) `await supabase.auth.getSession()` and immediately set `user` and `session` state from the result, (2) then subscribe to `supabase.auth.onAuthStateChange()` updating `user`/`session` on `SIGNED_IN`, `TOKEN_REFRESHED`, and clearing them on `SIGNED_OUT` — function must return only after the `getSession` step completes so router guards see the correct state synchronously
- [ ] T004 [US1] In `src/App.vue`, confirm `authStore.initialize()` is `await`-ed inside `onMounted` before any navigation or child component renders — if the current call is not awaited, wrap it correctly; also wire the `onAuthStateChange` unsubscribe into `onUnmounted` using the subscription handle returned by `initialize()`
- [ ] T005 [US1] In `src/router/index.ts` (or wherever the navigation guard lives), confirm the guard calls `await authStore.initialize()` OR checks `authStore.user` only after `App.vue` has awaited `initialize()` — the guard must not fire before session restore completes; if needed, add a `ready` flag to the auth store that is set to `true` after `getSession` resolves, and gate the guard on `authStore.ready`

**Checkpoint**: Page refresh keeps user logged in. Explicit sign-out clears session and redirects to `/auth`.

---

## Phase 4: User Story 2 — Dashboard Reading Overview (Priority: P2)

**Goal**: Dashboard shows all in-progress books + up to 2 completed books with overflow hint.

**Independent Test**: Add books at 0%, 50%, 100%, 100% progress → open Dashboard → verify three sections render with correct data.

### Implementation

- [ ] T006 [US2] In `src/stores/progress.ts`, add two exported computed refs: `inProgressBooks` (entries where `0 < percentage < 100`, sorted by `updatedAt` descending) and `completedBooks` (entries where `percentage === 100`, sorted by `updatedAt` descending) — each entry should be `{ book: Book; progress: Progress }` by cross-referencing `useBooksStore().books`; expose both from the store's return object
- [ ] T007 [US2] In `src/pages/DashboardPage.vue`, import `inProgressBooks` and `completedBooks` from `useProgressStore()`; add a computed `completedPreview` (first 2 items) and `completedOverflow` (count beyond 2)
- [ ] T008 [US2] In `src/pages/DashboardPage.vue` template, add an "In Progress" section below the hero card: render `inProgressBooks` as a compact list (cover thumbnail, title, author, progress bar, percentage) — hide the section entirely with `v-if="inProgressBooks.length > 0"`
- [ ] T009 [US2] In `src/pages/DashboardPage.vue` template, add a "Completed" section below the in-progress list: render `completedPreview` items; when `completedOverflow > 0` show a hint `"and {{ completedOverflow }} more — check your Library"` as a router-link to `/library`; hide section with `v-if="completedBooks.length > 0"`
- [ ] T010 [US2] In `src/pages/DashboardPage.vue`, update the hero card logic so that if the most-recently-updated book is at 100%, the hero card falls back to the most-recently-updated in-progress book instead (or shows an empty/onboarding state if none exist)
- [ ] T011 [US2] In `src/pages/DashboardPage.vue`, add scoped CSS for the in-progress list items and completed section — use `glass-subtle` for item backgrounds, consistent padding/border-radius with existing sections, and responsive layout

**Checkpoint**: Dashboard displays all three sections with correct filtering and overflow hint.

---

## Phase 5: User Story 3 — Library Sort Order (Priority: P3)

**Goal**: Library books ordered by reading progress ascending (0% first, 100% last); last-updated is the tie-breaker.

**Independent Test**: Books at 0%, 35%, 80%, 100% → Library shows them in that exact order top-to-bottom.

### Implementation

- [ ] T012 [US3] In `src/pages/LibraryPage.vue`, replace the direct `booksStore.books` reference with a `sortedBooks` computed property: join each book with its progress from `progressStore.progressForBook(book.id)`, then sort ascending by `percentage` (treat missing progress as 0%), with `updatedAt` descending as tie-breaker; use `sortedBooks` as the source for the book grid/list render

**Checkpoint**: Library renders books in correct ascending progress order.

---

## Phase 6: User Story 4 — Recap Accordion UI (Priority: P4)

**Goal**: Recap sections render as independent collapsible accordion panels; Memory Jogger open by default, the other two collapsed.

**Independent Test**: Generate a recap → verify 3 accordion panels, Memory Jogger expanded, Watchlist + Bridge collapsed; click each header to toggle independently.

### Implementation

- [ ] T013 [P] [US4] In `src/components/recap/RecapStream.vue`, replace the three `<div class="recap-section glass-subtle">` blocks in the "complete" state with a PrimeVue `<Accordion :value="['0']" multiple>` containing three `<AccordionPanel>` entries (value `"0"` = Memory Jogger, `"1"` = Concept Watchlist, `"2"` = Thematic Bridge); move the badge icon + label into each `<AccordionHeader>`; move the body content (`<p>` or chips div) into each `<AccordionContent>`; add imports for `Accordion`, `AccordionPanel`, `AccordionHeader`, `AccordionContent` from `primevue`
- [ ] T014 [P] [US4] In `src/components/recap/RecapCard.vue`, apply the identical accordion structure as T013 — same panel order, same `value="['0']"` default, same header labels and content slots; ensures historical recap cards in `RecapHistoryPage.vue` display consistently
- [ ] T015 [US4] In `src/components/recap/RecapStream.vue` and `src/components/recap/RecapCard.vue`, add scoped CSS to style the accordion headers to match the existing badge visual style (indigo for Memory Jogger, emerald for Concept Watchlist, amber for Thematic Bridge) by targeting `.p-accordionheader` and `.p-accordioncontent` — preserve the glass-subtle inner card feel and ensure the chevron/icon aligns with the design system

**Checkpoint**: All three accordion panels are independently togglable; Memory Jogger is the only panel open on initial render.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T016 [P] In `src/pages/DashboardPage.vue`, add empty-state handling: if the user has no books at all, show an onboarding prompt "Add your first book to get started" with a link to `/add-book`, replacing all three sections (per constitution: empty states MUST provide clear actionable copy)
- [ ] T017 [P] Run through all 6 scenarios in `specs/002-session-dashboard-polish/quickstart.md` manually and confirm each passes; fix any visual regressions found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (Setup): No dependencies — start immediately
- **Phase 2** (Foundational): Depends on Phase 1 — T002 must complete before T003
- **Phase 3** (US1 — Session): Depends on T002; blocks nothing else but should be done first as it is P1
- **Phase 4** (US2 — Dashboard): Depends on Phase 2; independent of US1, US3, US4
- **Phase 5** (US3 — Library): Depends on Phase 2; independent of all other stories
- **Phase 6** (US4 — Accordion): Depends on Phase 2; independent of all other stories
- **Phase 7** (Polish): Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: After T002 — no dependency on other stories
- **US2 (P2)**: After T002 — no dependency on other stories; T006 (store) before T007–T011 (component)
- **US3 (P3)**: After T002 — single task, fully independent
- **US4 (P4)**: After T002 — T013 and T014 are parallelizable; T015 depends on both

### Within Each Story

- US2: T006 (store selectors) → T007 (computed in component) → T008, T009, T010, T011 (template + CSS)
- US4: T013 ∥ T014 (both accordion rewrites are independent files) → T015 (shared CSS)

### Parallel Opportunities

- T013 and T014 (US4): different files, no shared dependency — run in parallel
- T012 (US3) and T006 (US2 store step): different files — run in parallel
- T016 and T017 (Polish): independent — run in parallel
- All of US3, US4 can be worked alongside US2 once Phase 2 is done

---

## Parallel Example: US4 Accordion

```
# Both can be done simultaneously:
Task T013: Accordion in src/components/recap/RecapStream.vue
Task T014: Accordion in src/components/recap/RecapCard.vue

# Then after both complete:
Task T015: Shared accordion CSS in both files
```

---

## Implementation Strategy

### MVP First (US1 Only — 3 tasks)

1. Complete Phase 1–2 (T001–T002)
2. Complete Phase 3: US1 (T003–T005)
3. **STOP and VALIDATE**: Refresh page → still logged in ✅
4. Ship — login persistence is the highest-impact single fix

### Incremental Delivery

1. T001–T002 → Foundation ready
2. T003–T005 (US1) → Session fix → validate → ship
3. T006–T011 (US2) → Dashboard overview → validate → ship
4. T012 (US3) → Library sort → validate → ship
5. T013–T015 (US4) → Accordion UI → validate → ship
6. T016–T017 (Polish) → Final cleanup

---

## Notes

- No new npm packages required — PrimeVue Accordion is already in the dependency tree
- No Supabase migrations required — all changes are client-side
- Arrow functions only throughout (project convention)
- `[P]` = parallelizable (different files, no blocking dependencies)
- Each story is independently shippable after its checkpoint
