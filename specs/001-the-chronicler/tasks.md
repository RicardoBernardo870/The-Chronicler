---
description: "Task list for The Chronicler — AI Reading Companion PWA"
---

# Tasks: The Chronicler — AI Reading Companion PWA

**Input**: Design documents from `specs/001-the-chronicler/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Tests**: Not requested — test tasks omitted.

**Organization**: Tasks grouped by user story for independent implementation and delivery.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths relative to repository root

---

## Phase 1: Setup

**Purpose**: Project initialization and tooling configuration

- [x] T001 Initialize Vue 3 + TypeScript project with Vite 6 using `pnpm create vite@latest . -- --template vue-ts` at repository root
- [x] T002 Install all dependencies: `pnpm add @supabase/supabase-js pinia vue-router@4 @primevue/core @primeuix/themes @primeuix/styles primeicons @ericblade/quagga2 @vueuse/core` and `pnpm add -D vite-plugin-pwa vitest @vue/test-utils`
- [x] T003 [P] Configure `vite.config.ts` with vite-plugin-pwa: register service worker, set `registerType: 'autoUpdate'`, configure Workbox offline caching for app shell and book covers
- [x] T004 [P] Configure PrimeVue 4 in `src/main.ts`: register plugin with custom liquid glass preset, dark mode default via `useColorMode`
- [x] T005 [P] Create `src/assets/styles/preset.ts` — custom `definePreset` extending Lara with semi-transparent surface tokens and glass CSS variables
- [x] T006 [P] Create `public/manifest.webmanifest` with app name "The Chronicler", `display: standalone`, theme/background colors, icon entries, and shortcuts
- [x] T007 [P] Create `.env.example` with all required keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_BOOKS_API_KEY` (optional)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, auth, routing, and shared infrastructure — MUST complete before any user story

**⚠️ CRITICAL**: No user story work begins until this phase is complete

- [x] T008 Apply Supabase database migration to project `zlndhygpqacygceivuvk` — `books`, `reading_progress`, `recaps` tables + RLS policies + `set_updated_at` trigger applied via MCP
- [x] T009 [P] Create `src/types/index.ts` — domain types + DB row types + mappers
- [x] T010 [P] Create `src/services/supabase.ts` — Supabase JS v2 client singleton
- [x] T011 [P] `src/assets/styles/glass.css` — glass-surface, glass-elevated, glass-subtle, shimmer (done in Phase 1)
- [x] T012 [P] `src/assets/styles/main.css` — global styles, dark-mode-first background (done in Phase 1)
- [x] T013 [P] Create `src/components/shared/LoadingSpinner.vue` + `EmptyState.vue`
- [x] T014 Implement `src/stores/auth.ts` (`useAuthStore`) — signIn, signUp, signOut, sendMagicLink, initialize
- [x] T015 Create `src/pages/AuthPage.vue` — sign in / sign up / magic link; glass-surface card
- [x] T016 Create `src/components/shared/AppHeader.vue` — sticky glass header with nav, dark mode toggle, sign-out
- [x] T017 Create `src/layouts/DefaultLayout.vue` — AppHeader + router-view + page transitions
- [x] T018 Create `src/router/index.ts` — all routes + auth navigation guard
- [x] T019 Create `src/App.vue` — calls authStore.initialize() on mount; stub pages for all routes created

**Checkpoint**: Auth, routing, shared components, and database schema are all in place

---

## Phase 3: User Story 1 — Get a Spoiler-Free Recap (Priority: P1) 🎯 MVP

**Goal**: A reader can request and receive a three-part spoiler-free AI briefing for their current book

**Independent Test**: Select any book with recorded progress > 0 → tap "Get Recap" → all three sections (Memory Jogger, Concept Watchlist, Thematic Bridge) stream in within 3 seconds with no spoiler content beyond the reader's percentage

- [x] T020 [US1] Create `supabase/functions/generate-recap/index.ts` — Supabase Edge Function: verify Supabase JWT from Authorization header; extract `book_id` + `title` + `author` + `percentage` + `currentPage` + `totalPages` from request body; call Claude API (`claude-haiku-4-5-20251001`) with cached system prompt (see `contracts/claude-recap-api.md`); stream JSON response back to client
- [x] T021 [P] [US1] Create `src/services/recapService.ts` — calls the `generate-recap` Edge Function URL with user's JWT; handles streaming response; progressively emits parsed JSON fields (`memory_jogger`, `concept_watchlist`, `thematic_bridge`) as they arrive
- [x] T022 [P] [US1] Implement `src/stores/recaps.ts` (`useRecapsStore`) — Pinia store with `recapsByBook`, `generationStatus` (`idle|streaming|complete|error`), `streamingContent`, `error` state; actions: `fetchRecapsForBook` (loads from Supabase), `generateRecap` (calls recapService, updates streamingContent on each token, persists to `recaps` table on completion)
- [x] T023 [US1] Create `src/components/recap/RecapStream.vue` — displays the live streaming recap: three labeled sections with a shimmer/skeleton placeholder while streaming; applies `.glass-surface` card per section; shows error state with retry button
- [x] T024 [US1] Create `src/components/recap/RecapCard.vue` — read-only display of a completed `Recap` object: shows all three sections, progress snapshot badge, and formatted date
- [x] T025 [US1] Create `src/components/recap/RecapHistory.vue` — scrollable list of `RecapCard` components sorted by `created_at` DESC; shows empty state when no recaps exist
- [x] T026 [US1] Create `src/pages/BookDetailPage.vue` — route `/books/:id`; loads book + progress from stores; shows title, author, cover, current progress percentage; "Get Recap" button triggers `recapsStore.generateRecap`; mounts `<RecapStream>` while streaming; links to recap history
- [x] T027 [US1] Create `src/pages/RecapHistoryPage.vue` — route `/books/:id/recaps`; loads and displays `<RecapHistory>` for the book; back-link to BookDetailPage

**Checkpoint**: Core value proposition is fully functional — readers can generate and view spoiler-free recaps

---

## Phase 4: User Story 2 — Update Reading Progress (Priority: P2)

**Goal**: Reader logs their current page; progress persists across sessions and devices with offline support

**Independent Test**: Update page number on one device → go offline → update again → restore network → open a second device — both progress values are correct

- [x] T028 [P] [US2] Create `src/composables/useOfflineSync.ts` — manages an IndexedDB store (`offline_queue`) for buffering progress update mutations; exposes `enqueue(mutation)` and `flushQueue()` (sends pending mutations to Supabase); registers for `online` event to auto-flush
- [x] T029 [P] [US2] Implement `src/stores/progress.ts` (`useProgressStore`) — Pinia store with `progress` (Record keyed by bookId), `pendingSync` flag; `updateProgress(bookId, currentPage)` writes to IndexedDB queue first (via `useOfflineSync`), applies optimistic local update, then upserts to Supabase `reading_progress` table; `fetchProgress()` hydrates store from Supabase on load
- [x] T030 [US2] Configure Background Sync in vite-plugin-pwa Workbox config in `vite.config.ts` — register a sync handler named `progress-sync` that calls `useOfflineSync.flushQueue()` when the browser regains connectivity; ensures sync survives tab closure
- [x] T031 [US2] Add progress update form to `src/pages/BookDetailPage.vue` — PrimeVue InputNumber for current page entry (validates 0 ≤ input ≤ totalPages), save button wires to `progressStore.updateProgress`; shows computed percentage and a PrimeVue ProgressBar; displays offline sync pending indicator when `pendingSync` is true
- [x] T032 [US2] Create `src/pages/DashboardPage.vue` — route `/`; shows "current read" card for the most recently updated book (from `progressStore`); displays title, cover, progress bar, and quick-action buttons: "Update Progress" (inline input) and "Get Recap" (navigates to BookDetailPage); empty state with "Add your first book" CTA; applies `.glass-surface` card styling

**Checkpoint**: Progress tracking with offline support is complete — all devices stay in sync

---

## Phase 5: User Story 3 — Add a Book via ISBN Scan (Priority: P3)

**Goal**: Reader scans a physical book's ISBN barcode; app auto-fills metadata; book appears in library

**Independent Test**: Open "Add Book" → scan any ISBN barcode → metadata (title, author, cover, pages) pre-fills → save → book visible in library

- [x] T033 [P] [US3] Create `src/composables/useIsbn.ts` — `lookup(isbn: string): Promise<BookMetadata | null>`; tries Open Library first (`https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data`); falls back to Google Books (`https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}`); maps response to `BookMetadata` interface; returns `null` on total failure
- [x] T034 [P] [US3] Create `src/composables/useScanner.ts` — Quagga2 (`@ericblade/quagga2`) wrapper; exposes `startScanning(videoEl)`, `stopScanning()`, `onDetected(callback)`; detects EAN-13 / ISBN-13 barcodes from camera stream; cleans up camera on `onUnmounted`
- [x] T035 [P] [US3] Implement `src/stores/books.ts` (`useBooksStore`) — Pinia store with `books: Book[]`, `loading`, `error`; actions: `fetchLibrary()` (loads user's books from Supabase), `addBook(input)` (inserts to `books` table, sets `user_id = auth.uid()`), `updateBook(id, changes)`, `removeBook(id)`; getter `bookById(id)`
- [x] T036 [US3] Create `src/components/books/IsbnScanner.vue` — mounts a `<video>` element; uses `useScanner` composable; shows camera feed with scanning overlay (targeting reticle); on barcode detect: emits `detected(isbn)` event and auto-stops; handles camera permission denial with fallback message
- [x] T037 [US3] Create `src/components/books/BookForm.vue` — form for book metadata with PrimeVue InputText fields (title, author, total pages, genre), cover art preview if `coverUrl` present, save/cancel buttons; accepts `initial` prop (pre-filled from ISBN lookup or empty for manual entry); emits `submit(BookMetadata)` and `cancel`
- [x] T038 [US3] Create `src/pages/AddBookPage.vue` — route `/books/add`; two-step flow: Step 1 shows `<IsbnScanner>` + "Enter manually" link; on barcode detect calls `useIsbn.lookup()` and navigates to Step 2; Step 2 shows `<BookForm>` pre-filled with metadata; on form submit calls `booksStore.addBook()` and navigates to `/library`
- [x] T039 [US3] Create `src/components/books/BookCard.vue` — displays a book's cover art (fallback: colored placeholder with initials), title, author, genre chip, and progress percentage from `useProgressStore`; tappable, navigates to BookDetailPage; applies `.glass-surface`
- [x] T040 [US3] Create `src/pages/LibraryPage.vue` — route `/library`; grid of `<BookCard>` components from `booksStore.books`; FAB or header button navigates to `/books/add`; empty state prompts to add first book

**Checkpoint**: Full book management flow works — scan → add → view in library

---

## Phase 6: User Story 4 — Review Historical Recaps (Priority: P4)

**Goal**: Reader can browse all previously generated recaps for a book, ordered by date

**Independent Test**: Generate 2+ recaps for one book at different progress points → navigate to recap history → all recaps visible with correct progress snapshot and date

- [x] T041 [P] [US4] Wire `src/pages/RecapHistoryPage.vue` to `useRecapsStore.fetchRecapsForBook(bookId)` on mount — renders `<RecapHistory>` component with loaded recaps; shows loading skeleton while fetching; empty state when no history exists
- [x] T042 [US4] Add "View Recap History (N)" link/button to `src/pages/BookDetailPage.vue` — shows count of existing recaps; navigates to `/books/:id/recaps`

**Checkpoint**: Full recap lifecycle is accessible — generate, view current, browse history

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: UX refinements and production readiness across all stories

- [x] T043 Create `src/pages/NotFoundPage.vue` — 404 page with "Page not found" message and link back to dashboard; applies `.glass-surface` card
- [x] T044 [P] Audit and apply `.glass-surface` class consistently across all page-level containers and modal/dialog components; verify `backdrop-filter` renders correctly (no `overflow: hidden` on ancestor elements)
- [x] T045 [P] Implement dark mode as default in `src/main.ts` using PrimeVue `useColorMode` — set initial mode to `dark`; wire toggle in `AppHeader.vue` to switch between `dark` and `light`
- [x] T046 [P] Add PWA icons: generate and place icon files at `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable.png`; verify manifest references are correct
- [x] T047 Run quickstart.md validation flows: add a book via ISBN scan, update progress, generate recap, go offline and update progress, restore network — confirm all five flows pass end-to-end
- [x] T048 [P] Run `pnpm build && pnpm preview` and audit Lighthouse PWA score — target ≥ 90; fix any failing PWA criteria (HTTPS in prod, manifest valid, service worker registered)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; all T001–T007 can run in parallel after T001
- **Foundational (Phase 2)**: Requires Phase 1 complete; T008–T019 mostly parallel after T009/T010 complete
- **US1 (Phase 3)**: Requires Phase 2 complete — T020 (Edge Function) before T021–T022; T022 before T023–T026
- **US2 (Phase 4)**: Requires Phase 2 complete — T028/T029 parallel; T031/T032 after T029
- **US3 (Phase 5)**: Requires Phase 2 complete — T033/T034/T035 parallel; T036 after T034; T037 after T033/T035; T038 after T036/T037; T039/T040 after T035
- **US4 (Phase 6)**: Requires Phase 3 complete (recap store already exists)
- **Polish (Final)**: After all desired user stories complete

### Within Each User Story

- Models/stores before services
- Services before UI components
- UI components before pages
- Stop at each phase checkpoint to validate the story independently

### Parallel Opportunities

- T001–T007: All setup tasks parallel after T001 (project init)
- T009, T010, T011, T012, T013: Parallel after T008 (migration applied)
- T021, T022: Parallel (different files, after T020 Edge Function)
- T028, T029: Parallel (different composable/store files)
- T033, T034, T035: Parallel (three independent composables/stores)
- T044, T045, T046, T048: Parallel polish tasks

---

## Parallel Example: Phase 2 Foundational

```bash
# After T008 migration is applied, launch in parallel:
Task: T009 — src/types/index.ts
Task: T010 — src/services/supabase.ts
Task: T011 — src/assets/styles/glass.css
Task: T012 — src/assets/styles/main.css
Task: T013 — shared components (LoadingSpinner, EmptyState)
# Then:
Task: T014 — src/stores/auth.ts  (depends on T009, T010)
# Then:
Task: T015 — AuthPage.vue        (depends on T014)
Task: T016 — AppHeader.vue       (depends on T009)
# Then:
Task: T017 — DefaultLayout.vue   (depends on T016)
Task: T018 — router/index.ts     (depends on T009)
# Then:
Task: T019 — App.vue             (depends on T017, T018, T014)
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational ← **blocks everything**
3. Complete Phase 3: US1 (Recap Engine) ← **core value prop**
4. Complete Phase 4: US2 (Progress Tracking) ← **enables accurate recaps**
5. **STOP and VALIDATE**: Generate a recap for a manually-added book, update progress, go offline
6. Deploy MVP if validated

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 + US2 → Core loop working (add book manually → track progress → get recap) → **MVP**
3. US3 → ISBN scan adds physical book support → **v1.0**
4. US4 → Recap history browsable → **v1.1**
5. Polish → Production-ready → **ship**

### Parallel Team Strategy

With multiple developers, once Phase 2 is complete:
- Dev A: US1 (Recap Engine + Edge Function)
- Dev B: US2 (Progress Store + Offline Sync)
- Dev C: US3 (ISBN Scan + Books Store)

---

## Notes

- [P] = different files, no blocking dependencies — safe to parallelize
- T008 (DB migration) can be applied via Supabase MCP directly — no CLI needed
- T020 (Edge Function) must be deployed before T021 (recapService) can be tested end-to-end
- Offline sync (T028–T030) requires testing in `pnpm preview` mode (service workers inactive in dev)
- `backdrop-filter` does not work if any ancestor has `overflow: hidden` — audit this during T044
- Quagga2 camera scan works only on HTTPS or localhost — test on `localhost:5173` or `localhost:4173`
