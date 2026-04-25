# Tasks: Vue Codebase Modernization

**Input**: Design documents from `/specs/014-vue-modernization/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅, contracts/ ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks follow the risk-ordered increment sequence from plan.md (lower-risk foundational work first, higher-risk decomposition last). Each task is labelled with its user story for traceability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (New Utility Modules)

**Purpose**: Install `date-fns` and create the two new utility modules that every subsequent phase depends on. Zero UI risk — pure module additions.

- [X] T001 Run `npm install date-fns` and verify `date-fns` appears in `package.json` dependencies
- [X] T002 [P] Create `src/utils/date.ts` — implement all 9 exports: `formatRelativeToNow(date)` ("Just now" < 2 min, delegates to `formatDistanceToNow` with `addSuffix: true`), `formatShortDate(isoStr)` (`format(parseISO(str), 'MMM d, yyyy')`), `formatISODate(date)` (`format(date, 'yyyy-MM-dd')`), `diffInSeconds(later, earlier)`, `diffInHours(later, earlier)`, `diffInDays(later, earlier)`, `isSameCalendarDay(a, b)`, `startOfCalendarDay(date)`, `sortDescByDate<T>(arr, key)` — all delegate to `date-fns`; accept `Date | string` inputs
- [X] T003 [P] Create `src/utils/coverFallback.ts` — export `const coverFallback = (e: Event): void => { (e.target as HTMLImageElement).style.display = 'none' }`

**Checkpoint**: `npm run build` passes. Two new utility files exist; no existing files changed.

---

## Phase 2: US3 — Date Handling: Composable Migration

**Purpose**: Replace all manual date arithmetic in composables with `src/utils/date.ts` calls. Logic-only changes — no templates touched. All four tasks touch different files and can run in parallel after Phase 1.

**Independent Test**: Run the app; verify Last Session Card relative time, streak counter, and Leitner review dates all display identically to pre-refactor values.

- [X] T004 [P] [US3] Migrate `src/composables/useRelativeTime.ts` — replace the manual bucket logic (`if diff < 120000 → "Just now"`, etc.) with a single call to `formatRelativeToNow(date)` imported from `src/utils/date.ts`; remove the `MS_PER_*` constants; preserve the exported function signature `formatRelative(date: Date | string): string`
- [X] T005 [P] [US3] Migrate `src/composables/useLastSession.ts` — replace `(new Date(a).getTime() - new Date(b).getTime()) / 1000` duration arithmetic with `diffInSeconds(recordedAt, sessionStartAt)` from `src/utils/date.ts`; replace any manual hours arithmetic with `diffInHours`; remove local `MS_PER_*` constants if present
- [X] T006 [P] [US3] Migrate `src/composables/useReadingPulse.ts` — replace `(Date.now() - new Date(last.recordedAt).getTime()) / MS_PER_DAY` with `diffInDays(new Date(), last.recordedAt)` in `continuityScore`; replace `toISOString().split('T')[0]` day-string comparisons in `streak` with `isSameCalendarDay(a, b)` and `formatISODate(date)` from `src/utils/date.ts`; remove the `MS_PER_DAY` constant
- [X] T007 [P] [US3] Migrate `src/composables/useLeitner.ts` — replace every `new Date().toISOString().split('T')[0]` (today's date as ISO string) and `new Date(date).toISOString().split('T')[0]` (normalise a date to a day string) with `formatISODate(new Date())` and `formatISODate(new Date(date))` from `src/utils/date.ts`

**Checkpoint**: `npm run build` passes. No date arithmetic using `getTime()`, `MS_PER_*`, or `.toISOString().split('T')[0]` remains in any composable.

---

## Phase 3: US3 — Date Handling: Component Migration

**Purpose**: Replace manual date formatting in components. All five files are independent — run in parallel after Phase 1.

- [X] T008 [P] [US3] Migrate `src/components/dashboard/WordOfTheDay.vue` — replace any `toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })` calls with `formatShortDate(isoStr)` and any day-difference arithmetic with `diffInDays` from `src/utils/date.ts`; preserve the displayed "Next review" date text exactly
- [X] T009 [P] [US3] Update `src/components/dashboard/LastSessionCard.vue` — if the component imports `formatRelative` directly from `useRelativeTime`, update to import `formatRelativeToNow` from `src/utils/date.ts` instead; no logic change — import path update only
- [X] T010 [P] [US3] Migrate `src/components/lore/LoreCardDetail.vue` — replace `new Date(isoStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })` with `formatShortDate(isoStr)` from `src/utils/date.ts`; verify rendered date text is identical (e.g., "Apr 24, 2026")
- [X] T011 [P] [US3] Migrate `src/components/lore/LoreCardList.vue` — replace `(a, b) => new Date(b[key]).getTime() - new Date(a[key]).getTime()` sort comparator with `sortDescByDate(arr, key)` from `src/utils/date.ts`
- [X] T012 [P] [US3] Migrate `src/components/recap/RecapCard.vue` — replace `toLocaleDateString` call with `formatShortDate(isoStr)` from `src/utils/date.ts`; verify recap card dates render identically

**Checkpoint**: `npm run build` passes. No `toLocaleDateString`, manual sort-by-date, or raw `getTime()` comparisons remain in any component file.

---

## Phase 4: US2 — PrimeVue Standardisation + US4 coverFallback

**Purpose**: Replace custom HTML badge/chip/banner elements with PrimeVue equivalents. Combine `coverFallback` import replacement in the same file edits to avoid touching the same files twice.

**Independent Test**: Open any book with a genre — verify genre renders inside `<div data-pc-name="chip">`. Check Dashboard offline indicator — verify `<div data-pc-name="tag">`. Check "it's been a while" warning — verify `<div data-pc-name="inlinemessage">`. Check a book with a broken cover URL — verify image is hidden, no console error.

- [X] T013 [P] [US2] [US4] Update `src/components/books/BookCard.vue` — replace `<span class="genre">{{ book.genre }}</span>` with `<Chip :label="book.genre" />` (import `Chip` from `primevue/chip`); replace inline `const coverFallback = (e: Event) => ...` function definition with `import { coverFallback } from '@/utils/coverFallback'`; remove the local function
- [X] T014 [P] [US2] [US4] Update `src/components/books/BookGridCard.vue` — same replacements as T013: genre span → `<Chip>`; local `coverFallback` → import from `@/utils/coverFallback`
- [ ] T015 [P] [US2] Update `src/components/lore/LoreGenerationBanner.vue` — replace custom loading-state div with `<Message severity="info">` and custom error-state div with `<Message severity="error">` (import `Message` from `primevue/message`); preserve existing slot content and condition logic
- [X] T016 [US2] [US4] Update `src/pages/DashboardPage.vue` — replace custom "Finished" badge span with `<Tag severity="success" value="Finished" />` (import `Tag` from `primevue/tag`); replace offline sync indicator div with `<Tag severity="warn" value="Progress will sync when you're back online" />`; replace continuity warning pill with `<InlineMessage severity="warn">` (import `InlineMessage` from `primevue/inlinemessage`); replace inline `coverFallback` function with import from `@/utils/coverFallback`
- [X] T017 [US2] [US4] Update `src/pages/BookDetailPage.vue` — replace genre `<span class="genre">` with `<Chip :label="book.genre" />`; replace offline sync badge with `<Tag severity="warn">`; replace inline `coverFallback` function with import from `@/utils/coverFallback`

**Checkpoint**: `npm run build` passes. Inspect DOM in browser: genre elements are `data-pc-name="chip"`, offline/status badges are `data-pc-name="tag"`, continuity warning is `data-pc-name="inlinemessage"`. No inline `coverFallback` function definitions remain in any file.

---

## Phase 5: US1 — DashboardPage Decomposition

**Purpose**: Extract four self-contained sections from `DashboardPage.vue` into focused child components. Highest-risk phase — done after all lower-risk work is stable.

**Independent Test**: Open the Dashboard; verify hero card renders with progress bar and save/session buttons; drag an "Up Next" book to reorder and confirm persistence; tap "Get Recap" and confirm the recap stream appears. No console errors.

- [X] T018 [US1] Create `src/components/dashboard/HeroBookCard.vue` — extract the hero book section from `DashboardPage.vue`; implement props: `book: Book`, `progress: ReadingProgress | null`, `saving: boolean`, `justSaved: boolean`, `saveError: string | null`, `pageInput: number`, `heroWarning: boolean`, `pendingSync: boolean`, `recapTriggered: boolean`, `recapLocked: boolean`, `pagesUntilUnlock: number`; implement emits: `update:pageInput`, `save`, `getRecap`, `viewBook`; move all hero-section template markup and scoped styles into this component
- [X] T019 [US1] Create `src/components/dashboard/InProgressSection.vue` — extract the "In Progress" books list from `DashboardPage.vue`; props: `books: Book[]`; emits: `select: [bookId: string]`, `viewBook: [bookId: string]`; move the in-progress list template and styles
- [X] T020 [US1] Create `src/components/dashboard/UpNextSection.vue` — extract the drag-to-reorder "Up Next" section from `DashboardPage.vue`; props: `books: Book[]`; emits: `update:books: [newOrder: Book[]]`, `select: [bookId: string]`; preserve all drag-and-drop event bindings
- [X] T021 [US1] Create `src/components/dashboard/CompletedSection.vue` — extract the completed books preview from `DashboardPage.vue`; props: `books: Array<{ book: Book; progress: ReadingProgress }>`, `overflow: number`; emits: `viewBook: [bookId: string]`, `viewLibrary: []`
- [X] T022 [US1] Slim `src/pages/DashboardPage.vue` to ≤300 lines — import and register all four extracted components (`HeroBookCard`, `InProgressSection`, `UpNextSection`, `CompletedSection`); wire props down and handle emitted events; DashboardPage retains only store calls, reactive state declarations, and template orchestration; delete all extracted markup from this file

**Checkpoint**: `npm run build` passes. `DashboardPage.vue` ≤300 lines. All Dashboard interactions work: save pages, start session, reorder Up Next, navigate to Book Detail.

---

## Phase 6: US1 — BookDetailPage Decomposition

**Purpose**: Extract two focused components from `BookDetailPage.vue`.

**Independent Test**: Navigate to any book detail page; verify the header renders (cover, title, genre chip, author, stats); update the page number and save; start a session, save pages, confirm the note field appears.

- [X] T023 [US1] Create `src/components/book/BookDetailHeader.vue` — extract the cover image, genre chip, title, author, ISBNs, and total-pages row from `BookDetailPage.vue`; props: `book: Book`; emits: `coverError: []`; include scoped styles for the header block
- [X] T024 [US1] Create `src/components/book/BookProgressPanel.vue` — extract the progress bar, current-page display, page input + save row, session start button, session note field, and inline error message from `BookDetailPage.vue`; props: `book: Book`, `progress: ReadingProgress | null`, `currentPageInput: number`, `progressLoading: boolean`, `progressError: string | null`, `showNoteField: boolean`, `pendingHistoryRowId: string | null`; emits: `update:currentPageInput: [value: number]`, `save: []`, `noteComplete: []`, `sessionConflict: [startedAt: Date]`
- [X] T025 [US1] Slim `src/pages/BookDetailPage.vue` to ≤250 lines — import `BookDetailHeader` and `BookProgressPanel`; wire props and handle emits; retain only store calls, reactive state, route params, and orchestration logic; delete all extracted markup

**Checkpoint**: `npm run build` passes. `BookDetailPage.vue` ≤250 lines. Full Book Detail flow works end-to-end.

---

## Phase 7: US1 — Secondary Component Decomposition (Polish)

**Purpose**: Internal refactors of three oversized non-page components. Lower risk than the page decompositions — done last.

- [ ] T026 [US1] Refactor `src/components/books/BookCard.vue` (322 lines) — extract progress bar + percentage row into `BookCardProgress.vue` sub-component (`src/components/books/BookCardProgress.vue`); extract genre chip into `BookCardLoreChip.vue` sub-component (`src/components/books/BookCardLoreChip.vue`); wire via props; reduce `BookCard.vue` template complexity
- [ ] T027 [US1] Refactor `src/components/lore/LoreChronoscopeCard.vue` (336 lines) — extract the collapsible card body into a `LoreChronoscopeBody.vue` sub-component (`src/components/lore/LoreChronoscopeBody.vue`); pass lore data via props; keep open/closed toggle state in the parent; target ≤180 lines for the parent
- [ ] T028 [US1] Refactor `src/components/recap/RecapStream.vue` (332 lines) — extract `anchorPhase` and `vibeSlot` derived computeds plus their watcher logic into a `src/composables/useRecapAnchor.ts` composable; `RecapStream.vue` calls `useRecapAnchor()` and uses the returned refs; streaming logic in `RecapStream.vue` is untouched

**Checkpoint**: `npm run build` passes. `BookCard.vue` ≤200 lines, `LoreChronoscopeCard.vue` ≤180 lines, `RecapStream.vue` ≤220 lines. Lore card expand/collapse and recap streaming work identically.

---

## Phase 8: Polish & Verification

- [X] T029 [P] Update `CLAUDE.md` — add 014 entry under Active Technologies: "TypeScript 6 (strict) + Vue 3.5 (Composition API, `<script setup>`) + Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse, **date-fns v4** (014-vue-modernization)"; add 014 one-liner to Recent Changes: "014-vue-modernization: Component decomposition (DashboardPage → 4 components, BookDetailPage → 2 components); date-fns v4 migration via src/utils/date.ts; PrimeVue Chip/Tag/InlineMessage replacements; shared coverFallback utility"
- [X] T030 [P] Run `npm run build` — confirm zero TypeScript errors and zero Vite warnings about unresolved imports; record `✓ built in ...` confirmation
- [X] T031 [P] Run `npm test` — confirm all Vitest tests pass with no failures introduced by the refactor

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 are parallel
- **Phase 2 (US3 Composables)**: Depends on T002 (date.ts must exist); all four composable tasks are parallel
- **Phase 3 (US3 Components)**: Depends on T002; all five component tasks are parallel; can run concurrently with Phase 2
- **Phase 4 (US2 PrimeVue)**: Depends on T003 (coverFallback.ts must exist); T013–T015 are parallel; T016 and T017 are sequential (different files)
- **Phase 5 (US1 Dashboard)**: Depends on Phase 4 completion (replacements in DashboardPage should be done before extraction); T018–T021 are parallel; T022 depends on all four extracted components existing
- **Phase 6 (US1 BookDetail)**: Depends on Phase 4 completion; T023 and T024 are parallel; T025 depends on both; can run concurrently with Phase 5
- **Phase 7 (US1 Secondary)**: Depends on Phases 5 and 6 completing (confidence validated); T026, T027, T028 are parallel
- **Phase 8 (Polish)**: T029 can run any time after Phase 1; T030 and T031 run after all phases complete

### User Story Coverage

| User Story | Phase(s) | Tasks |
|------------|----------|-------|
| US1 — Component Decomposition (P1) | 5, 6, 7 | T018–T028 |
| US2 — PrimeVue Standardisation (P1) | 4 | T013–T017 |
| US3 — Date Handling (P2) | 1, 2, 3 | T001–T012 |
| US4 — Code Cleanliness (P2) | 1, 4 | T003, T013, T014, T016, T017 |

### Parallel Opportunities

```bash
# Phase 1 — after T001 completes:
T002: Create src/utils/date.ts
T003: Create src/utils/coverFallback.ts

# Phase 2+3 — all parallel after T002:
T004: useRelativeTime.ts
T005: useLastSession.ts
T006: useReadingPulse.ts
T007: useLeitner.ts
T008: WordOfTheDay.vue
T009: LastSessionCard.vue (import path)
T010: LoreCardDetail.vue
T011: LoreCardList.vue
T012: RecapCard.vue

# Phase 4 — parallel after T003:
T013: BookCard.vue
T014: BookGridCard.vue
T015: LoreGenerationBanner.vue

# Phase 5+6 — after Phase 4:
T018–T021: Dashboard child components (parallel)
T023–T024: BookDetail child components (parallel, concurrent with Phase 5)

# Phase 7 — parallel after Phases 5+6:
T026: BookCard sub-components
T027: LoreChronoscopeCard sub-component
T028: RecapStream composable extract
```

---

## Implementation Strategy

### Risk-Ordered Delivery (Matches plan.md increment order)

1. **Phase 1**: Zero-risk module additions — verify build passes
2. **Phases 2–3**: Logic-only date migration — verify output parity by side-by-side comparison
3. **Phase 4**: PrimeVue + coverFallback — inspect DOM for `data-pc-name` attributes; check broken-cover scenario
4. **Phase 5**: DashboardPage decomposition — most complex; validate all interactions after T022
5. **Phase 6**: BookDetailPage decomposition — second largest; validate full session flow after T025
6. **Phase 7**: Secondary decompositions — lower impact, validate lore card and recap streaming
7. **Phase 8**: Final build + test run

### MVP Scope

Phases 1–4 deliver US2, US3, and US4 in full without touching any page structure — that alone satisfies 3 of 4 user stories and is shippable. Phases 5–7 (US1 decomposition) are the highest-value but highest-risk increment and should be validated independently.

---

## Notes

- [P] tasks touch different files — no coordination needed
- [Story] label maps each task to a specific user story for traceability
- Every phase ends with a `npm run build` checkpoint — do not proceed to the next phase if the build fails
- No Supabase calls, schema changes, or store contract changes — this is a pure frontend refactor
- `useCache.ts` `Date.now()` calls are explicitly excluded from date migration (cache TTL primitives — see research.md Decision 1)
- Glass-surface card wrappers are explicitly kept custom (see plan.md Key Design Decisions)
- `AppBottomNav`, `EmptyState`, `VelocityBadge` are explicitly kept custom — no PrimeVue equivalent
