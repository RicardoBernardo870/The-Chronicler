# Tasks: Library Page Overhaul

**Input**: Design documents from `/specs/019-library-page-overhaul/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/component-contracts.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Tests**: No test tasks — not requested in the specification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: No new dependencies or packages are introduced. This feature is a pure TypeScript/Vue frontend change with one SQL RPC amendment.

- [X] T001 Verify `src/components/library/` directory exists (create if absent) — this directory will hold `LibrarySectionHeader.vue` and `SwipeableBookCard.vue`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Type changes and the SQL RPC fix that all subsequent stories depend on. US1 directly requires T002–T004; US2/US3 depend on correct genre data flowing through the store.

**⚠️ CRITICAL**: US1 genre display and US2 section grouping cannot work until these are complete.

- [X] T002 Add `genre: string | null` field to `LibraryBookEntry` interface in `src/types/index.ts` (line ~109 after `progressId` field)
- [X] T003 Amend the `get_library_with_progress` Supabase SQL function to add `b.genre` to the SELECT list — use the Supabase MCP `execute_sql` tool to run: `CREATE OR REPLACE FUNCTION get_library_with_progress(p_user_id uuid) RETURNS ...` with `b.genre` added; alternatively inspect the current function definition first with `SELECT prosrc FROM pg_proc WHERE proname = 'get_library_with_progress'` then patch it
- [X] T004 Fix `_libraryFetcher` in `src/stores/books.ts` (line ~82) to map `genre: e.genre ?? null` instead of the hardcoded `genre: null` in the `books.value` mapping (depends on T002 + T003)

**Checkpoint**: Genre chips now appear on book cards after library load. `booksStore.libraryEntries` has the `genre` field populated.

---

## Phase 3: User Story 1 — Fix Book Edit & Genre Display (Priority: P1) 🎯 MVP

**Goal**: Editing a book correctly persists ISBN and genre; genre chip appears on cards without a page reload.

**Independent Test**: Edit a book's ISBN and genre → save → navigate back to Library. Genre chip is visible on the card. Reopen the edit dialog — ISBN is pre-populated.

### Implementation

- [X] T005 [US1] Add `isbn` to the `updateBook` `changes` parameter type in `src/stores/books.ts` — change `Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl'>>` to include `| 'isbn'`; add `...(changes.isbn !== undefined && { isbn: changes.isbn })` to the Supabase `.update()` payload object
- [X] T006 [US1] Fix `BookEditDialog.vue` — two changes: (1) add `isbn: book.isbn` to the `:initial` prop passed to `<BookForm>` so the field is pre-filled; (2) add `isbn: data.isbn` to the `updateBook(props.book.id, { ... })` call in `onSave` (depends on T005)

**Checkpoint**: Story 1 fully functional. Edit a book's ISBN → save → reopen edit form → ISBN field shows the saved value. Genre chip appears without page reload.

---

## Phase 4: User Story 2 — Section Headers with Counts & Collapsible Archive (Priority: P1)

**Goal**: Library page shows three distinct sections ("Currently Reading", "The Queue", "The Archives") each with a book count; Archives is collapsed by default.

**Independent Test**: Open Library with books across all three statuses. Three headers appear with correct counts. Archives is collapsed. Tapping Archives header expands the list. Navigating away and back resets Archives to collapsed.

### Implementation

- [X] T007 [US2] Create `src/components/library/LibrarySectionHeader.vue` — props: `title: string`, `count: number`, `collapsible?: boolean` (default `false`), `expanded?: boolean` (default `true`); emits `toggle`; template: `<header>` with section title, a PrimeVue `Chip` showing the count, and when `collapsible=true` a `pi pi-chevron-down` / `pi pi-chevron-up` icon (swap based on `expanded`); the whole header is a `<button>` when collapsible, emitting `toggle` on click; styled with bold title, muted count, and full-width click target
- [X] T008 [US2] Add computed section arrays to `LibraryPage.vue` — add `readingBooks`, `queuedBooks`, `archivedBooks` computed properties derived from `booksStore.libraryEntries` (filter by `status === 'reading'`, `'unread'`, `'finished'`); sort `queuedBooks` by `upNextStore.sortedBookIds()` order (same logic as existing tier-2 sort); add `const archivesExpanded = ref(false)` local state
- [X] T009 [US2] Refactor `LibraryPage.vue` template — replace the flat `<TransitionGroup>` list-view block with three `<section>` elements each containing a `<LibrarySectionHeader>` and a `<TransitionGroup>` of `BookCard` components; Archives section wraps its list in `<template v-if="archivesExpanded">`; Archives `LibrarySectionHeader` has `:collapsible="true"` `:expanded="archivesExpanded"` `@toggle="archivesExpanded = !archivesExpanded"`; keep the grid view path (`v-else-if="viewMode === 'grid'"`) unchanged, using `sortedBooks` or a combined array

**Checkpoint**: Three section headers visible with correct counts. Archives collapses/expands on tap. Navigating away resets to collapsed.

---

## Phase 5: User Story 3 — Page Count & Days-Remaining Estimate (Priority: P2)

**Goal**: In-progress book cards show "Page X of Y" below the progress bar; cards with ≥3 sessions in the past 30 days also show "~N days left" (or "Finish today!").

**Independent Test**: Open Library with an in-progress book that has reading history. "Page X of Y" appears below the progress bar. With ≥3 sessions, "~N days left" appears. With <3 sessions, only the page count shows. Finished books in Archives show neither.

### Implementation

- [X] T010 [US3] Create `src/composables/useReadingVelocity.ts` — accepts `bookIds: Ref<string[]>`; exports `velocityMap: Ref<Record<string, number | 'today' | null>>` and `fetch: () => Promise<void>`; `fetch()` performs a single Supabase SELECT on `progress_history` WHERE `book_id = ANY(bookIds)` AND `recorded_at > now() - interval '30 days'` ORDER BY `book_id, recorded_at ASC`; groups results by `book_id`; for each book, counts pairs of consecutive rows where the later row has `session_start_at != null` (explicit session boundary — one such pair = one session); requires ≥3 such sessions; computes `avgPagesPerSession = sum(endPage - startPage) / sessionCount`; `daysLeft = Math.ceil((totalPages - currentPage) / avg)`; stores `'today'` when `daysLeft <= 0`, `null` when <3 sessions or `totalPages` is 0 or book is not in the `bookIds` list; needs book `totalPages` and `currentPage` — accept a second arg `bookDetails: Ref<Array<{ id: string; totalPages: number; currentPage: number }>>` for these
- [X] T011 [US3] Add "Page X of Y" to `BookCard.vue` — add `const progress = computed(() => progressStore.progressForBook(props.book.id))`; add `const currentPage = computed(() => progress.value?.currentPage ?? 0)`; in the template, add a `<p class="book-card__page-count">` between the progress bar and the end of `.book-card__progress` div, rendered only `v-if="currentPage > 0 && book.totalPages > 0"`, content: `` `Page ${currentPage} of ${book.totalPages}` ``; style: `font-size: 0.72rem; opacity: 0.6; margin: 0`
- [X] T012 [US3] Add `daysLeft` prop to `BookCard.vue` — add `daysLeft?: number | 'today' | null` to the props type; in the template add a `<span class="book-card__days-left">` rendered `v-if="daysLeft != null && percentage < 100"`, content: `daysLeft === 'today' ? 'Finish today!' : `~${daysLeft} days left``; style: `font-size: 0.7rem; font-weight: 600; color: var(--p-indigo-300)` (depends on T011)
- [X] T013 [US3] Wire `useReadingVelocity` in `LibraryPage.vue` — import and call `useReadingVelocity`; pass `readingBookIds` (computed from `readingBooks` mapped to ids) and `readingBookDetails` (mapped from `booksStore.libraryEntries` for reading books with `{ id, totalPages, currentPage }`); call `velocity.fetch()` inside `onMounted` after the main data loads; pass `:days-left="velocity.velocityMap.value[book.id] ?? null"` to each `BookCard` in the Currently Reading section (depends on T010, T012)

**Checkpoint**: "Page X of Y" visible on in-progress cards. "~N days left" / "Finish today!" visible when velocity data is available. No days estimate for books with <3 sessions.

---

## Phase 6: User Story 4 — Swipe Left to Edit or Delete (Priority: P2)

**Goal**: On touch viewports, swiping left on any book card reveals Edit and Delete action buttons. Only one card is open at a time. Desktop users continue using the existing ⋯ menu on `BookCard`.

**Independent Test**: Enable touch emulation in browser DevTools. Swipe left on a card → Edit and Delete buttons appear. Tap Edit → `BookEditDialog` opens pre-filled. Tap Delete → confirmation dialog appears. Swipe a second card → first card snaps back automatically.

### Implementation

- [X] T014 [US4] Create `src/components/library/SwipeableBookCard.vue` — props: `book: Book`; emits: `edit` (payload: `Book`), `delete` (payload: `Book`); template: outer `<div class="swipeable-wrap">` containing action buttons absolutely positioned on the right (Edit: `pi pi-pencil` button, Delete: `pi pi-trash` button), and the `<BookCard>` with `translateX` CSS transform applied via `style`; logic: module-level `const openCardId = ref<string | null>(null)` shared across all instances; on `@touchstart` store touch start X; on `@touchmove` compute delta, apply `translateX(max(-160, delta))` while dragging; on `@touchend` if `|delta| >= 80` snap to -160px and set `openCardId = book.id` else snap back to 0; watch `openCardId` — if it changes to a different book's id, snap this card back to 0; actions visible only when `translateX === -160`; Edit button emits `edit`; Delete button emits `delete`; clicking/tapping outside (on the card itself when open) snaps back; use `@click.stop` on action buttons to prevent card navigation; only activate swipe when `window.matchMedia('(hover: none)').matches` — on non-touch viewports render `<BookCard>` directly without swipe logic
- [X] T015 [US4] Replace `<BookCard>` with `<SwipeableBookCard>` in the list-view sections of `LibraryPage.vue` (Currently Reading, The Queue, Archives `TransitionGroup` blocks); wire `@edit="openEditDialog"` and `@delete="confirmDelete"` events; add `const editTarget = ref<Book | null>(null)` and `<BookEditDialog>` bound to `editTarget`; add `confirmDelete` handler using `useConfirm().require(...)` that calls `booksStore.removeBook` on accept; keep `<BookGridCard>` in the grid view path unchanged (depends on T014)

**Checkpoint**: Swipe left on any list-view card reveals Edit and Delete. Swipe a second card — first card snaps back. Desktop hover ⋯ menu continues working.

---

## Phase 7: User Story 5 — Optimistic Drag-and-Drop Reordering (Priority: P2)

**Goal**: Dragging a book in The Queue settles in the new position immediately with no snap-back. Failure reverts the order and shows a toast.

**Independent Test**: Drag a Queue book to a new position → card stays in place instantly (no flicker). Navigate away and back → order preserved. Simulate network failure → order reverts and toast appears.

### Implementation

- [X] T016 [US5] Refactor `saveOrder` in `src/stores/upNext.ts` to be optimistic: (1) capture `const previousOrder = [...upNextOrder.value]`; (2) immediately set `upNextOrder.value = bookIds.map((bookId, index) => ({ ...existingEntry, bookId, sortPosition: index }))` (or reconstruct from existing `upNextOrder` entries); (3) run the Supabase upsert; (4) on success call `swrTouch(cacheKeys.upNext(uid))` — do NOT call `await _fetcher()` (this was causing the snap-back); (5) on failure restore `upNextOrder.value = previousOrder` and re-throw the error so the caller can handle it
- [X] T017 [US5] Add failure handling in `LibraryPage.vue` for drag-and-drop reorder: import `useToast` from `primevue/usetoast`; add `<Toast />` to the template (if not already present via app layout); wrap the existing drag-end handler's `upNextStore.saveOrder(newOrder)` call in a try-catch; on catch call `toast.add({ severity: 'error', summary: 'Reorder failed', detail: 'Could not save the new order. Reverting.', life: 3000 })`; verify the drag-and-drop handler exists in `LibraryPage.vue` (if Queue drag is handled elsewhere, locate and patch that component) (depends on T016)

**Checkpoint**: Dragging in The Queue settles immediately with no snap-back. Network error reverts order and shows a toast.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T018 [P] Clean up `LibraryPage.vue` — remove the now-unused `sortedBooks` computed property (or repurpose it for the grid view path if it's needed there); remove unused imports; ensure the grid view still renders all books via a combined array (`[...readingBooks, ...queuedBooks, ...archivedBooks].map(e => booksStore.bookById(e.id)).filter(Boolean)` or equivalent)
- [X] T019 [P] Validate the `genre` null-coalescing in `BookCard.vue` — confirm the `<Chip v-if="book.genre" :label="book.genre">` conditional already handles null/empty strings correctly (no change needed if so); also confirm `_libraryFetcher` books.value mapping now passes `genre` through so the `Book` objects used by `BookCard` in the grid view also have genres

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 (needs `LibraryBookEntry.genre` type from T002)
- **Phase 4 (US2)**: Depends on Phase 2 (needs correct genre from RPC); can proceed in parallel with Phase 3
- **Phase 5 (US3)**: Depends on Phase 4 (needs `readingBooks` computed) — or can be done in parallel with Phase 4 if T013 is deferred
- **Phase 6 (US4)**: Depends on Phase 4 (needs the section layout to exist before replacing BookCard); US4 T015 depends on T014
- **Phase 7 (US5)**: Depends on Phase 4 (The Queue section must exist); independent of US3/US4
- **Phase 8 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US1 (P1)**: Requires Foundational (T002+T003 for genre; T005 is independent of genre)
- **US2 (P1)**: Requires Foundational (T002+T003 for genre in entries)
- **US3 (P2)**: Requires US2 section layout to exist (T008+T009) before wiring velocity per section
- **US4 (P2)**: Requires US2 section layout to exist (T009) before replacing `BookCard` references
- **US5 (P2)**: Requires US2 section layout (The Queue section must render) for drag-and-drop wiring

### Parallel Opportunities

- T005 and T007 can run in parallel (different files: `books.ts` vs `LibrarySectionHeader.vue`)
- T007 and T008 can run in parallel (different files: new component vs `LibraryPage.vue` script)
- T010, T011, T012 can run in parallel (different files: composable vs `BookCard.vue`)
- T014 and T016 can run in parallel (different files: new component vs `upNext.ts`)

---

## Parallel Example: US2

```text
# These can run simultaneously:
T007 — Create LibrarySectionHeader.vue   (new file, no deps)
T008 — Add computed sections to LibraryPage.vue script   (script only, no template)

# Then sequentially:
T009 — Refactor LibraryPage.vue template (depends on T007 + T008)
```

## Parallel Example: US3

```text
# These can run simultaneously after US2 is complete:
T010 — Create useReadingVelocity.ts composable   (new file)
T011 — Add "Page X of Y" to BookCard.vue         (independent of T010)

# Then:
T012 — Add daysLeft prop to BookCard.vue   (depends on T011)
T013 — Wire velocity in LibraryPage.vue    (depends on T010 + T012)
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both P1 stories only)

1. Complete Phase 2: Foundational (T001–T004)
2. Complete Phase 3: US1 (T005–T006) — fixes data bugs
3. Complete Phase 4: US2 (T007–T009) — section headers
4. **STOP and VALIDATE** using quickstart.md Stories 1 and 2
5. Ship P1 fixes — the app is now correct and navigable

### Incremental Delivery

1. Foundational → US1 (P1) → US2 (P1) → **Deploy MVP**
2. US3 (P2) — page count + days estimate → **Deploy**
3. US4 (P2) — swipe gestures → **Deploy**
4. US5 (P2) — optimistic drag-drop fix → **Deploy**

### Full Feature (All Stories)

Complete all phases T001–T019 sequentially (single developer), using parallel opportunities within each phase.

---

## Notes

- `BookForm.vue` already handles `isbn` in both `initial` prop and `submit` emit — no changes needed there
- The existing `BookCard` ⋯ overflow menu (PrimeVue `Menu` popup) satisfies FR-005 for desktop (non-touch) viewports — `SwipeableBookCard` is additive
- `SwipeableBookCard` renders `BookCard` as a child — all existing BookCard styling, lore chips, and overflow menu functionality are preserved unchanged
- `progressStore.progressForBook(bookId)?.currentPage` is available in `BookCard` because `fetchProgress` hydrates from `libraryEntries` (per 017-supabase-rpc-aggregations)
- T003 (SQL RPC amendment) requires inspection of the existing function definition — use Supabase MCP `execute_sql` with `SELECT prosrc FROM pg_proc WHERE proname = 'get_library_with_progress'` first to see current SQL before patching
