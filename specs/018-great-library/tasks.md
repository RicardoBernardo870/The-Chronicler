# Tasks: The Great Library

**Input**: Design documents from `specs/018-great-library/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/query-contract.md ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify starting point — no new project scaffolding needed; existing files are the baseline.

- [X] T001 Confirm `src/pages/GreatLibraryPage.vue`, `src/components/lexicon/LexiconCard.vue`, `src/types/index.ts`, and `src/composables/` directory all exist and are readable before any edits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and composable skeleton that all three user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Add `LexiconSearchResult` interface (extends `LexiconEntry` with `bookTitle: string`) and `BookFilterOption` interface (`bookId: string`, `bookTitle: string`) to `src/types/index.ts`; also add `mapSearchResult` mapper function (uses existing `mapLexiconEntry` + `row.books?.title ?? 'Unknown Book'`)
- [X] T003 Create `src/composables/useGreatLibrarySearch.ts` with: `PAGE_SIZE = 20` constant; module-level state refs (`_entries`, `_loading`, `_loadingMore`, `_error`, `_hasMore`, `_searchQuery`, `_typeFilter`, `_bookFilter`, `_bookOptions`, `_currentPage`, `_lastFailedPage`); exported composable function that aliases those refs; stub actions `search`, `loadNextPage`, `retry`; import `useAuthStore`, `useSupabaseClient`, and the new types

**Checkpoint**: Types exist and composable shell is importable — user story implementation can begin.

---

## Phase 3: User Story 1 — Browse All Vocabulary (Priority: P1) 🎯 MVP

**Goal**: Replace the existing in-memory `lexiconStore.allEntries` list with a server-side paginated query that loads 20 entries at a time, each card showing which book it came from. Infinite scroll appends the next page when the user reaches the bottom.

**Independent Test**: Navigate to `/lexicon` (Great Library, Lexicon tab). All lexicon entries across all books appear sorted newest-first. Each card shows the term, type badge, and book title on the front face. Scrolling to the bottom loads the next page. The existing flip animation and Leitner controls (advance/reset) still work.

### Implementation for User Story 1

- [X] T004 [US1] Implement `fetchBookOptions()` private helper in `src/composables/useGreatLibrarySearch.ts` — queries `supabase.from('lexicon_entries').select('book_id, books(title)').eq('user_id', uid)`, deduplicates client-side into `BookFilterOption[]`, stores in `_bookOptions`; call once inside `search()` on page 0
- [X] T005 [US1] Implement `_fetch(page: number)` private helper in `src/composables/useGreatLibrarySearch.ts` — builds base query `supabase.from('lexicon_entries').select('*, books(title)').eq('user_id', uid).order('created_at', { ascending: false }).range(from, to)`; maps each row with `mapSearchResult`; sets `_hasMore` to `false` when result length `< PAGE_SIZE`; returns `LexiconSearchResult[]`
- [X] T006 [US1] Implement `search()` action in `src/composables/useGreatLibrarySearch.ts` — resets `_entries` to `[]`, sets `_currentPage` to 0, sets `_loading` to `true`, calls `_fetch(0)`, calls `fetchBookOptions()`, appends results, clears error; implement `loadNextPage()` — no-op if `!_hasMore || _loadingMore`, increments page, sets `_loadingMore`, appends; implement `retry()` — re-calls `_fetch(_lastFailedPage)` and appends/replaces as appropriate
- [X] T007 [P] [US1] Add optional `bookTitle` prop (`bookTitle?: string`) to `src/components/lexicon/LexiconCard.vue` — on the front face, render a small muted line (e.g. `<p v-if="bookTitle" class="lc-book-title">{{ bookTitle }}</p>`) below the term, styled similarly to `.lc-hint` (small, low opacity); no other changes to the component
- [X] T008 [US1] Refactor Lexicon tab in `src/pages/GreatLibraryPage.vue` — import `useGreatLibrarySearch` and `useIntersectionObserver` from VueUse; remove `useLexiconStore` per-book fetch and `filteredLexiconEntries` computed; call `search()` on `onMounted`; replace `loading` local ref with composable's `loading`; replace card list with `v-for="entry in entries"` passing `:entry="entry"` and `:book-title="entry.bookTitle"` to `LexiconCard`; keep `AddWordDialog`, Leitner `onAdvance`/`onReset` handlers, and tab switching logic unchanged
- [X] T009 [US1] Add `Skeleton` loading state (3 card-shaped skeletons, height `~90px`) to `src/pages/GreatLibraryPage.vue` Lexicon tab — shown when `loading` is true; replace the existing spinner
- [X] T010 [US1] Add infinite scroll sentinel `<div ref="sentinelRef">` below the entry list in `src/pages/GreatLibraryPage.vue` — use `useIntersectionObserver(sentinelRef, ([entry]) => { if (entry.isIntersecting) loadNextPage() })`; hide sentinel with `v-if="hasMore && !loading"`
- [X] T011 [US1] Add error state with retry and "all entries loaded" footer to `src/pages/GreatLibraryPage.vue` — use PrimeVue `Message` component for error (show when `error !== null`, include a "Retry" `Button` that calls `retry()`); show a small muted "All entries loaded" text below the list when `!hasMore && entries.length > 0 && !loading`

**Checkpoint**: User Story 1 fully functional — paginated browse, flip cards with book title, Leitner controls, infinite scroll, error/retry, "all loaded" footer.

---

## Phase 4: User Story 2 — Search the Collection (Priority: P1)

**Goal**: Add a debounced search input that filters by term or definition server-side. Changing the query resets to page 1 and fetches fresh filtered results. Clearing the query restores the full list.

**Independent Test**: Type a partial term into the search bar — only matching entries appear after ~300ms. Scroll to load more matching results. Clear the input — full list restores from page 1.

### Implementation for User Story 2

- [X] T012 [US2] Add `searchQuery` watcher in `src/composables/useGreatLibrarySearch.ts` — debounce 300ms using `watchDebounced` from VueUse (already a dependency); on change call `search()` which resets to page 0; add `.or(\`term.ilike.%${q}%,definition.ilike.%${q}%\`)` conditional modifier inside `_fetch()` when `_searchQuery.value` is non-empty
- [X] T013 [US2] Add `InputText` search bar to `src/pages/GreatLibraryPage.vue` Lexicon tab filter area — `v-model` bound to composable's `searchQuery`; place above the entry list, below the header; add a clear icon button (PrimeVue `InputText` with `v-if="searchQuery"` clear button or use `:icon` slot)
- [X] T014 [US2] Update empty state logic in `src/pages/GreatLibraryPage.vue` — distinguish two cases: `searchQuery` is non-empty → show "No results for '{{ searchQuery }}'" with a "Clear search" button that resets `searchQuery` to `''`; `searchQuery` is empty → show original "No words saved yet" message; both use the existing `.great-library__empty` glass-surface style

**Checkpoint**: User Stories 1 and 2 both work — search + paginated infinite scroll function together correctly.

---

## Phase 5: User Story 3 — Filter by Type and Book (Priority: P2)

**Goal**: Add a type toggle (All / Dictionary / Lore) and a book dropdown to the Lexicon tab. Each filter change resets to page 1. Both filters compose with search. The book dropdown shows only books that have lexicon entries for this user.

**Independent Test**: Toggle "Lore" — only lore entries appear. Select a book — only entries from that book appear. Combine both — intersection of both filters shows. Each change resets to page 1.

### Implementation for User Story 3

- [X] T015 [US3] Add `typeFilter` and `bookFilter` conditional query modifiers inside `_fetch()` in `src/composables/useGreatLibrarySearch.ts` — append `.eq('entry_type', _typeFilter.value)` when `_typeFilter.value !== 'all'`; append `.eq('book_id', _bookFilter.value)` when `_bookFilter.value !== null`
- [X] T016 [US3] Add `watch` for `typeFilter` and `bookFilter` in `src/composables/useGreatLibrarySearch.ts` — call `search()` immediately (no debounce) whenever either changes
- [X] T017 [US3] Replace the existing shared book `Select` dropdown and local `selectedBookId` ref in `src/pages/GreatLibraryPage.vue` Lexicon tab with the composable's `typeFilter` and `bookFilter` — add `SelectButton` component (PrimeVue) with options `[{ label: 'All', value: 'all' }, { label: 'Dictionary', value: 'dictionary' }, { label: 'Lore', value: 'lore' }]` bound to `typeFilter`; add `Select` bound to `bookFilter` populated from composable's `bookOptions` (with an "All Books" null option prepended); keep the existing Lore tab using its own separate `loreBookId` local ref passed to `LoreCardList`

**Checkpoint**: All three user stories functional — search, type toggle, and book filter all apply simultaneously and each resets to page 1.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Loading UX, edge cases, and documentation.

- [X] T018 [P] Add `loadingMore` spinner at bottom of entry list in `src/pages/GreatLibraryPage.vue` — small centred spinner shown when `loadingMore` is true; placed between the last card and the sentinel; use `<i class="pi pi-spin pi-spinner">` consistent with existing loading styles
- [X] T019 [P] Verify `LexiconCard` height measurement still works correctly after adding `bookTitle` prop in `src/components/lexicon/LexiconCard.vue` — `measureHeight` is called on mount and on flip; the new `.lc-book-title` element on the front face is part of `frontRef.scrollHeight`, so no extra measurement logic needed; confirm in browser with a long book title
- [X] T020 Update `CLAUDE.md` Recent Changes section — add entry for `018-great-library` describing: `useGreatLibrarySearch` composable (paginated server-side search with debounce + infinite scroll), `LexiconCard.vue` extended with optional `bookTitle` prop, `GreatLibraryPage.vue` Lexicon tab refactored from in-memory to server-side paginated query

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Phase 3 (composable must be wired into page first)
- **US3 (Phase 5)**: Depends on Phase 3 (composable must be wired into page first); US3 can run alongside US2
- **Polish (Phase 6)**: Depends on all story phases being complete

### User Story Dependencies

- **US1**: Can start after Phase 2 — no dependency on US2 or US3
- **US2**: Requires US1 complete (composable already wired into page)
- **US3**: Requires US1 complete (composable already wired into page); can run alongside US2

### Within Each User Story

- Composable work before page integration (T004–T006 before T008)
- `LexiconCard` prop (T007) is independent of composable work — can run in parallel with T004–T006
- Page wiring (T008) must follow composable completion (T006) and card prop (T007)

### Parallel Opportunities

- **T007** [P] can run alongside **T004–T006** (different file: `LexiconCard.vue` vs `useGreatLibrarySearch.ts`)
- **T018** and **T019** in Polish phase are independent of each other [P]
- US2 and US3 composable tasks (T012, T015–T016) can be started in parallel once US1 is complete if working as a team

---

## Parallel Example: User Story 1

```
# These two can run simultaneously (different files):
T007: Add bookTitle prop to src/components/lexicon/LexiconCard.vue
T005: Implement _fetch(page) in src/composables/useGreatLibrarySearch.ts

# These must follow T006 + T007:
T008: Refactor GreatLibraryPage.vue to use useGreatLibrarySearch
T009: Add Skeleton loading state to GreatLibraryPage.vue
T010: Add infinite scroll sentinel to GreatLibraryPage.vue
T011: Add error state + footer to GreatLibraryPage.vue
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2 only — both P1)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T003)
3. Complete Phase 3: User Story 1 (T004–T011)
4. **STOP and VALIDATE**: Paginated browse with flip cards and book titles works
5. Complete Phase 4: User Story 2 (T012–T014)
6. **STOP and VALIDATE**: Search + infinite scroll work together
7. Deploy/demo

### Full Delivery

1. MVP above
2. Complete Phase 5: User Story 3 (T015–T017) — type + book filters
3. Complete Phase 6: Polish (T018–T020)
4. Run quickstart.md verification steps (all 10 scenarios)

---

## Notes

- `[P]` tasks touch different files and have no cross-dependencies
- `[Story]` label maps each task to its user story for traceability
- No new npm packages — `useIntersectionObserver` and `watchDebounced` come from VueUse (already installed)
- No Supabase schema changes — `lexicon_entries` and `books` tables are unchanged
- `AddWordDialog` and Leitner controls (`onAdvance`/`onReset`) must remain fully functional throughout all phases
- The Lore Cards tab is untouched by this feature
