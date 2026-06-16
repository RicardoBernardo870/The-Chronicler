---
description: "Task list for 030-book-search-add"
---

# Tasks: Book Search & Add

**Input**: Design documents from `/specs/030-book-search-add/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Lightweight unit tests are included in the Polish phase because the quickstart
explicitly calls for them (mappers, merge, duplicate helper, composable). They are NOT written
test-first — implementation precedes tests here.

**Organization**: Tasks are grouped by user story. Stories US1 + US2 (both P1) together form the
MVP; US3 (P2) and US4 (P2/P3) are additive increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1, US2, US3, US4 (maps to spec user stories)
- File paths are exact and relative to repo root.

## Path Conventions

- Web app (single Vue front end + Supabase BaaS): code under `src/`, migrations under
  `supabase/migrations/`, unit tests under `tests/unit/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema change and type foundations every later phase depends on.

- [X] T001 Create migration `supabase/migrations/20260616_book_description.sql`: `alter table public.books add column if not exists description text;` then `create or replace function ... get_library_with_progress(...)` to also return `b.description` (copy the existing definition from `supabase/migrations/20260502_rpc_performance_improvements.sql`, keep its signature, `security definer`, and `(select auth.uid())` filter; add `description` to the SELECT and RETURNS TABLE column list). No index on `description`. **Migration file authored; applying it to the remote Supabase project is still pending (outward action — left for the user to run).**
- [X] T002 In `src/types/index.ts`, add `description: string | null` to `Book`, `BookRow`, `BookMetadata`, and `LibraryBookEntry`, and map it in `mapBook` (`description: row.description`). (`AddBookInput` inherits it automatically.)
- [X] T003 In `src/types/index.ts`, add transient types `BookSearchResult`, `BookDetailDraft`, `Recommendation` (per data-model.md) plus mappers `mapOpenLibraryDoc` and `mapToDetailDraft`. (Same file as T002 → run after T002.)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, the Open Library search service, the search composable, and the route —
all shared by the user-story phases.

**⚠️ CRITICAL**: No user-story phase can begin until this phase is complete.

- [X] T004 In `src/stores/books.ts`, persist/return `description`: add `description: input.description` to the `addBook` insert payload, accept `description` in `updateBook`'s `changes` pick + update mapping, and map `e.description` onto each hydrated `Book` in `_libraryFetcher` (RPC path). Leave existing cache invalidations unchanged. (Depends on T002.)
- [X] T005 [P] Create `src/services/bookSearchService.ts` with `searchBooks(query, page, signal?)` calling Open Library `search.json` (per `contracts/open-library.md`: `q`, `page`, `limit=20`, trimmed `fields`); map docs via `mapOpenLibraryDoc`; resolve `[]` on any error (never throw). (Depends on T003.)
- [X] T006 Create `src/composables/useBookSearch.ts` as a module-singleton mirroring `useGreatLibrarySearch` (shared refs, results cache for back-nav, `watchDebounced` 300ms/maxWait 1000, skip queries < 2 non-space chars, `AbortController` cancels in-flight on new query, `loadNextPage`, `retry`, `hasMore` = last page returned 20). Exposes `query, results, loading, loadingMore, error, hasMore, hasSearched`. (Depends on T005.)
- [X] T007 [P] In `src/router/index.ts`, add a lazy route `{ path: 'books/add/details/:source/:key(.*)', name: 'add-book-details', component: () => import('@/pages/BookSearchDetailPage.vue') }` under the authenticated `DefaultLayout` children. (Path created in T014.)

**Checkpoint**: Persistence, search data layer, and routing ready.

---

## Phase 3: User Story 2 - Reorganized Add Book entry screen (Priority: P1)

**Goal**: The Add Book screen shows two primary buttons ("Scan ISBN", "Add Manually") on top and a
search section below; Scan and Manual reach their existing flows unchanged.

**Independent Test**: Open Add Book → see both labeled buttons + a search bar; Scan opens the
existing scanner; Add Manually opens the existing `BookForm`; both behave exactly as before.

- [X] T008 [US2] In `src/pages/AddBookPage.vue`, add a new default `'home'` landing step that renders two PrimeVue `Button`s labeled "Scan ISBN" and "Add Manually" plus `<BookSearchSection>`; wire "Scan ISBN" to the existing `step='scan'` view and "Add Manually" to the existing `enterManually()`/`step='form'` path. Do NOT alter the existing `scan` or `form` step markup/behavior. Update the back-navigation so `home` is the initial step.
- [X] T009 [US2] Create `src/components/books/BookSearchSection.vue` rendering a PrimeVue `InputText` (optionally wrapped in `IconField`/`InputIcon` with a search icon) two-way bound to `useBookSearch().query`, plus loading (`ProgressSpinner`), empty-state and error+retry (`Message`) regions. (Results list added in T012.)

**Checkpoint**: Entry screen restructured; all three paths reachable (search shows input + states).

---

## Phase 4: User Story 1 - Search for a book and add it (Priority: P1) 🎯 MVP

**Goal**: Type title/author/ISBN → paginated results → select → pre-filled, editable details page →
save to library.

**Independent Test**: Search a known title, select a result, confirm the details page is pre-filled,
edit a field, choose a status, save, and verify the book appears in the library.

- [X] T010 [US1] In `src/services/bookSearchService.ts`, add `getBookDetail('openlibrary', key, signal?)`: fetch the OL work/edition record (per `contracts/open-library.md`), populate `BookDetailDraft` via `mapToDetailDraft` (description, first subject → genre, page count, cover, isbn from the search context); resolve a partial draft on error. (Depends on T005.)
- [X] T011 [P] [US1] Create `src/components/books/BookSearchResultCard.vue`: props a `BookSearchResult`, renders cover (PrimeVue `Image` with cover-fallback), title, author; emits `select(result)`. Keep < 250 lines, PrimeVue-first.
- [X] T012 [US1] In `src/components/books/BookSearchSection.vue`, render the results list from `useBookSearch().results` using `BookSearchResultCard`, add a "Load more" `Button` (or `useIntersectionObserver` infinite scroll) calling `loadNextPage` while `hasMore`, and on card `select` navigate to `{ name: 'add-book-details', params: { source: 'openlibrary', key: encodeURIComponent(result.key) } }`. (Depends on T009, T011, T006.)
- [X] T013 [US1] In `src/components/books/BookForm.vue`, add an optional `description` field (PrimeVue `Textarea`): seed from `props.initial.description`, include in the `watch(initial)` repopulation, and add `description` to the emitted `submit` payload. No change to existing required-field validation.
- [X] T014 [US1] Create `src/pages/BookSearchDetailPage.vue`: read `source`/`key` from the route (decode key), call `getBookDetail` on mount with a `Skeleton`/loading state, render `<BookForm :initial="draft">`, on submit call `booksStore.addBookWithInitialStatus({ ...data, description })` and route to `/` (currentlyReading) or `/library` otherwise; show a save error inline preserving entered values. (Depends on T010, T013, T007, T004.)
- [X] T015 [US1] Add `src/utils/duplicateBook.ts` `isDuplicateBook(candidate, books)` (normalized-ISBN match, else case-insensitive title+author) and use it in `BookSearchDetailPage.vue` to show a non-blocking PrimeVue `Message` ("already in your library") without disabling Save. (Depends on T014.)

**Checkpoint**: MVP complete — full search → review/edit → save journey works (US1 + US2).

---

## Phase 5: User Story 3 - Automatically fill gaps in book data (Priority: P2)

**Goal**: Missing detail fields (cover, description, page count, genre) are filled from Google Books
when Open Library lacks them.

**Independent Test**: Select a book whose OL record lacks a cover/page count and confirm the field is
populated from Google Books, or left empty+editable when neither source has it.

- [X] T016 [US3] In `src/services/bookSearchService.ts`, extend `getBookDetail` to gap-fill from Google Books (per `contracts/google-books.md`: `q=isbn:` when ISBN present, else `q=intitle:+inauthor:`, optional `VITE_GOOGLE_BOOKS_API_KEY`). Generalize the field-by-field merge from `src/composables/useIsbn.ts` to also fill `description`; OL values win when present; skip silently on key/quota/network failure. (Depends on T010.)

**Checkpoint**: Detail drafts are richer; manual edits minimized (SC-002).

---

## Phase 6: User Story 4 - See recommendations for the selected book (Priority: P3)

**Goal**: Best-effort related titles on the details page; tapping one re-enters the search-and-add
flow for that title; the area hides when none are available.

**Independent Test**: Open a well-known book's details → see related titles; tap one → routed into the
add flow for that title; open a book with no recommendations → area hidden, page otherwise normal.

- [X] T017 [US4] In `src/services/bookSearchService.ts`, add `getRecommendations(draft, excludeKey, signal?)`: OL `search.json` by the draft's first subject (fallback author), exclude `excludeKey`, cap ~6–8, map to `Recommendation`; resolve `[]` on empty/error. (Depends on T005.)
- [X] T018 [P] [US4] Create `src/components/books/BookRecommendations.vue`: props `Recommendation[]`, renders a compact list (PrimeVue `Image`/card), emits `select(rec)`; renders nothing when the list is empty.
- [X] T019 [US4] In `src/pages/BookSearchDetailPage.vue`, fetch recommendations after the draft loads and render `<BookRecommendations>`; on `select`, navigate to `{ name: 'add-book-details', params: { source: 'openlibrary', key: encodeURIComponent(rec.key) } }` (re-fetch path already re-runs on param change). Hide on empty/error. (Depends on T014, T017, T018.)

**Checkpoint**: All user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests, regression verification, and end-to-end validation.

- [X] T020 [P] Add `tests/unit/bookSearchService.spec.ts`: `mapOpenLibraryDoc` mapping and the OL+Google Books `mapToDetailDraft` merge, including `description` gap-fill and OL-wins precedence.
- [X] T021 [P] Add `tests/unit/duplicateBook.spec.ts`: `isDuplicateBook` ISBN-match and title+author fallback cases.
- [X] T022 [P] Add `tests/unit/useBookSearch.spec.ts`: debounce triggers a search, short queries are skipped, `loadNextPage` appends + toggles `hasMore`, and a new query aborts/replaces results.
- [ ] T023 Manually verify Scan ISBN and Add Manually flows are unchanged (SC-005) — scan/manual lookup, prefill, save, routing all behave as before. *(Runtime/manual step — pending.)*
- [X] T024 Automated gates green: `npm test` (63 passing) and `vue-tsc -b` typecheck (no `lint` script in this project). Manual quickstart.md V1–V9 walkthrough pending (requires the running app + applied migration).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 [P-independent of T002/T003]; T002 → T003 (same file).
- **Foundational (Phase 2)**: needs Setup. T004←T002; T005←T003; T006←T005; T007 [P]. BLOCKS all stories.
- **US2 (Phase 3)**: needs Foundational (T006 for the bound query).
- **US1 (Phase 4)**: needs Foundational + US2's `BookSearchSection` (T009) for results wiring.
- **US3 (Phase 5)**: needs T010 (extends `getBookDetail`).
- **US4 (Phase 6)**: needs T014 (detail page host) + T005.
- **Polish (Phase 7)**: after the stories it covers.

### User Story Dependencies

- **US2 (P1)**: independent entry screen; only needs the search composable.
- **US1 (P1)**: builds on the US2 search section to render results + the detail/save journey. MVP = US2 + US1.
- **US3 (P2)**: transparently enriches US1's detail fetch; no UI change needed beyond US1.
- **US4 (P3)**: adds a recommendations block to US1's detail page; independently testable.

### Parallel Opportunities

- T005 and T007 can run in parallel after Setup.
- T011 (`BookSearchResultCard`) and T013 (`BookForm`) are different files → parallel within US1.
- T018 (`BookRecommendations`) parallel with US1/US3 work (different file).
- All Polish unit tests T020–T022 are parallel (different files).

---

## Parallel Example: User Story 1

```bash
# After T010 lands, these touch different files and can run together:
Task: "T011 Create src/components/books/BookSearchResultCard.vue"
Task: "T013 Add description field to src/components/books/BookForm.vue"
```

---

## Implementation Strategy

### MVP First (US2 + US1)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US2 entry screen) → Phase 4 (US1 search → add).
3. **STOP and VALIDATE**: quickstart V1–V3 + V6; confirm a searched book saves with its description.
4. Demo: users can now search and add books.

### Incremental Delivery

1. Foundation ready → US2 + US1 (MVP) → validate/demo.
2. Add US3 (gap-fill) → validate V5 → demo richer pre-fill.
3. Add US4 (recommendations) → validate V7 → demo discovery.
4. Polish: tests + regression (SC-005) + full quickstart.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Scan ISBN and Add Manually code paths must remain untouched (Constitution II; SC-005).
- All new UI is PrimeVue-first and single-responsibility (Constitution VI); `BookForm` is reused, not duplicated.
- External API calls are abortable and degrade gracefully — failures never block Scan/Manual (FR-015, SC-006).
- Arrow functions only (project convention); per-component PrimeVue imports.
- Commit after each task or logical group.
