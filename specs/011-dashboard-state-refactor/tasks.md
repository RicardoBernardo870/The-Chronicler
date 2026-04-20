# Tasks: Dashboard State Logic Refactor

**Feature**: 011-dashboard-state-refactor
**Input**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

---

## Phase 1: Setup

- [X] T001 Verify feature directory `specs/011-dashboard-state-refactor/` contains plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
- [X] T002 Confirm `.specify/feature.json` points to `specs/011-dashboard-state-refactor`

## Phase 2: Foundational (blocking prerequisites)

- [X] T003 Create `src/composables/useActiveBook.ts` scaffold with exports `activeBookId`, `activeBook`, `upNext`, `setActive`, `onBookCompleted`, `initializeIfNeeded` per `specs/011-dashboard-state-refactor/contracts/useActiveBook.md`
- [X] T004 Implement module-singleton `activeBookId = ref<string | null>(null)` in `src/composables/useActiveBook.ts`; ensure a single shared reference across calls (declare at module scope, not inside the composable body)
- [X] T005 Implement `activeBook` computed via `booksStore.bookById(activeBookId.value)` in `src/composables/useActiveBook.ts`
- [X] T006 Implement `upNext` computed: `booksStore.inProgressBooks.filter(b => b.id !== activeBookId.value)` in `src/composables/useActiveBook.ts`
- [X] T007 Implement `setActive(bookId)` with no-op guard (`if (bookId === activeBookId.value) return`) in `src/composables/useActiveBook.ts`
- [X] T008 Implement `onBookCompleted(bookId)`: if `bookId === activeBookId.value` promote first of `upNext.value` (or set `null`); else no-op. In `src/composables/useActiveBook.ts`
- [X] T009 Implement `initializeIfNeeded()`: if `activeBookId.value === null`, set to first `booksStore.inProgressBooks[0]?.id ?? null`. In `src/composables/useActiveBook.ts`
- [X] T010 Export `activeBookId` as `readonly(activeBookId)` from the composable return object in `src/composables/useActiveBook.ts`

## Phase 3: User Story 1 — Progress state leak fix (P1)

**Story goal**: Swapping the hero book (via completion or explicit swap) must reset progress bar + page counter to the new book's values with zero residual state.

**Independent test**: Complete the current hero; confirm the new hero's counter and bar reflect its own currentPage/totalPages.

- [X] T011 [US1] In `src/pages/DashboardPage.vue`, import `useActiveBook` and replace existing `currentBook` derivation with `const { activeBook, activeBookId } = useActiveBook()`
- [X] T012 [US1] In `src/pages/DashboardPage.vue`, convert progress-bar and page-counter bindings to `computed(() => progressStore.progressForBook(activeBookId.value))` so they are reactive to `activeBookId`
- [X] T013 [US1] In `src/pages/DashboardPage.vue`, add `onMounted(() => useActiveBook().initializeIfNeeded())` to seed the hero on first mount
- [X] T014 [US1] In `src/pages/DashboardPage.vue`, replace any locally-cached `currentPage`, `percentage`, or `bookId` refs seeded once at mount with `computed` derivations from `activeBookId` (no intermediate `ref`)
- [X] T015 [US1] In `src/pages/DashboardPage.vue`, add `watch(activeBookId, (_, __, onCleanup) => { const ctrl = recapAbortController.value; onCleanup(() => ctrl?.abort()) })` to abort any in-flight streaming recap when the hero changes
- [X] T016 [US1] Wire book-completion event (wherever `progressStore.markComplete` or equivalent is called) to invoke `useActiveBook().onBookCompleted(bookId)` — search for existing completion call sites and add the hook

## Phase 4: User Story 2 — Current Book swapping (P1)

**Story goal**: Up Next taps swap the hero in place (no route change). View Book remains the only navigation path. Hero is excluded from Up Next.

**Independent test**: Tap Up Next entry → hero changes, URL unchanged. Click View Book → router navigates.

- [X] T017 [US2] In `src/pages/DashboardPage.vue`, replace the Up Next data source with `const { upNext, setActive } = useActiveBook()`
- [X] T018 [US2] In `src/pages/DashboardPage.vue`, update each Up Next list-item element to bind `@click="setActive(book.id)"` and remove any `router.push(...)` or `<router-link>` wrapping
- [X] T019 [US2] In `src/pages/DashboardPage.vue`, apply `role="button"` + `tabindex="0"` + `@keydown.enter="setActive(book.id)"` to each Up Next entry for keyboard accessibility
- [X] T020 [US2] In `src/pages/DashboardPage.vue`, verify the "View Book" button inside the hero card uses `router.push({ name: 'book-details', params: { id: activeBookId.value } })` (or equivalent) and is the sole navigation trigger
- [X] T021 [US2] In `src/pages/DashboardPage.vue`, render empty-state (or hide section) when `upNext.value.length === 0`

## Phase 5: User Story 3 — VelocityBadge audit (P2)

**Story goal**: Badge never renders NaN/Infinity. Fallback shown for insufficient data.

**Independent test**: Fresh book with 0 sessions → fallback. Sub-minute session → fallback. Valid session → rounded integer pph.

- [X] T022 [P] [US3] In `src/components/pulse/VelocityBadge.vue`, guard `pph` computed: return `null` when `velocity` is `null`, `undefined`, `NaN`, or `!isFinite(velocity)`
- [X] T023 [P] [US3] In `src/components/pulse/VelocityBadge.vue`, add minimum-duration guard: if underlying session's `durationSeconds < 60` (read via `pulse.latestSession` or equivalent), return `null` from `pph`
- [X] T024 [P] [US3] In `src/components/pulse/VelocityBadge.vue`, in the template, render a fallback chip (e.g. `"—"`) when `pph === null`; never render the literal bindings `{{ velocity }}` or `{{ pph }}` unguarded
- [X] T025 [P] [US3] In `src/components/pulse/VelocityBadge.vue`, guard `prediction` computed: return `null` when `props.totalPages <= 0`, `props.currentPage > props.totalPages`, or `velocity === null`
- [X] T026 [P] [US3] In `src/components/pulse/VelocityBadge.vue`, scan template for any bindings that could stringify `NaN`/`Infinity` and replace with the guarded computeds

## Phase 6: User Story 4 — Last Session Dashboard Card (P2)

**Story goal**: New card near "Your Reading" displays recency + volume + VelocityBadge for the user's most recent library-wide session.

**Independent test**: After a real session, Last Session card is visible with correct recency phrase, pages, and badge. Zero-session user sees no card.

- [X] T027 [P] [US4] Create `src/composables/useLastSession.ts` exporting `useLastSession(): Ref<LastSession | null>` with fields `{ bookId, bookTitle, endedAt, pagesDelta, durationSeconds, velocityPph }` per `specs/011-dashboard-state-refactor/data-model.md`
- [X] T028 [US4] In `src/composables/useLastSession.ts`, source data from the existing `progress_history` fetch used by `useReadingPulse` (library-wide scope, not filtered by hero book); reuse SWR cache where possible
- [X] T029 [US4] In `src/composables/useLastSession.ts`, compute `pagesDelta` as current row's `current_page` minus the prior row for the same book (floor at 0), and `durationSeconds` from the timestamp delta
- [X] T030 [US4] In `src/composables/useLastSession.ts`, return `null` if no qualifying session exists (no rows, or latest row has no prior row AND `durationSeconds` indeterminate → still return with `velocityPph = null` but the card should render if pagesDelta ≥ 1 and endedAt valid)
- [X] T031 [P] [US4] Create `src/composables/useRelativeTime.ts` pure function `formatRelative(date: Date): string` implementing the buckets: <2min="Just now", <60min="{n} minutes ago", <24h="{n} hours ago", yesterday="Yesterday", <7d="{n} days ago", else="{n} weeks ago"
- [X] T032 [P] [US4] Create `src/components/dashboard/LastSessionCard.vue` with `<script setup lang="ts">` that calls `useLastSession()`, resolves `bookTitle` via `booksStore.bookById(lastSession.value.bookId)?.title`, and renders nothing when `lastSession.value === null`
- [X] T033 [US4] In `src/components/dashboard/LastSessionCard.vue`, render card with Chronicler-aesthetic styling (match sibling Dashboard cards: border-radius, glass backdrop, typography) — template: book title, recency phrase via `formatRelative(lastSession.endedAt)`, `"{pagesDelta} pages"`, `<VelocityBadge :bookId :totalPages :currentPage />`
- [X] T034 [US4] In `src/components/dashboard/LastSessionCard.vue`, pass the `book.totalPages` and latest `currentPage` for the session's bookId into VelocityBadge (resolve via `booksStore` + `progressStore`)
- [X] T035 [US4] In `src/pages/DashboardPage.vue`, import `LastSessionCard` and place it directly below the "Your Reading" hero section

## Phase 7: Polish & cross-cutting concerns

- [X] T036 In `src/composables/useActiveBook.ts`, add JSDoc covering: completion-vs-swap precedence rule, hero-exclusion invariant for `upNext`, and module-singleton lifetime
- [X] T037 In `src/pages/DashboardPage.vue`, audit every `watch(...)` added by this feature for cleanup — confirm either (a) default auto-disposal on unmount or (b) explicit `onCleanup` registration; remove any unused watchers
- [X] T038 Run `npx tsc --noEmit` in repo root and fix any type errors introduced by this feature
- [X] T039 Run `npm run lint` and fix new warnings in files touched by this feature (no lint script present — N/A)
- [ ] T040 Manually execute every scenario in `specs/011-dashboard-state-refactor/quickstart.md` and mark PASS/FAIL in a comment at the bottom of that file
- [ ] T041 Verify FR-012 (Chronicler aesthetic) by visual-diffing Dashboard against feature 010 reference — no unintended style regressions in hero card, Up Next list, or new Last Session card

---

## Dependencies

```
Phase 1 (Setup)
   └─► Phase 2 (Foundational: useActiveBook)
          ├─► Phase 3 (US1 — state fix)
          ├─► Phase 4 (US2 — swapping)       [parallelizable with US1 after T014]
          ├─► Phase 5 (US3 — VelocityBadge)  [independent; can start after Phase 1]
          └─► Phase 6 (US4 — Last Session)   [depends on US3 for correct badge output]
                └─► Phase 7 (Polish)
```

- **US1 ↔ US2**: Both consume `useActiveBook`. US1 must complete at least T011–T014 before US2 can rely on `activeBookId`; after that, US2 tasks can run in parallel with US1's T015–T016.
- **US3 is independent** of Phases 2/3/4 — can begin immediately after Setup.
- **US4 depends on US3** for NaN-free VelocityBadge output (blocks final visual correctness but not composable/component scaffolding).

## Parallel execution examples

- **Phase 5 [US3]**: T022, T023, T024, T025, T026 all touch only `VelocityBadge.vue` → execute in one batch of edits.
- **Phase 6 [US4]**: T027 (composable), T031 (relative-time util), T032 (component scaffold) are on distinct files → can run in parallel.
- **Across stories**: Phase 5 can run alongside Phase 3 / Phase 4 once Phase 2 is done.

## MVP scope

- **MVP = US1 only** (T001–T016): ship the bug fix first. Delivers immediate user-visible correctness.
- **MVP+1 = US1 + US2**: adds the swap UX improvement.
- **MVP+2 = + US3 + US4**: adds the Last Session card and hardens velocity output.

---

## Format validation

All 41 tasks follow the strict format: `- [ ] TNNN [P?] [StoryLabel?] Description with file path`. Story-phase tasks carry `[US1]`/`[US2]`/`[US3]`/`[US4]`. Setup, Foundational, and Polish phases carry no story label. Every task references a concrete file path.
