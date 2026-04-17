# Tasks: Lexicon & Navigation UX Improvements

**Input**: Design documents from `/specs/005-lexicon-nav-ux/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-components.md, quickstart.md

**Organization**: Tasks are grouped by user story. US1 and US2 are both P1; US3 and US4 are P2. US2 depends on the AddWordDialog change in US1's foundational task.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — this feature modifies an existing Vue SPA. The "setup" is verifying the starting state of the files we'll change.

- [x] T001 Verify current state of src/components/lexicon/AddWordDialog.vue, src/pages/LexiconPage.vue, src/stores/lexicon.ts, and src/layouts/DefaultLayout.vue by reading them — no changes yet

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Modify `AddWordDialog.vue` to make `bookId` optional and add a book selector. This is foundational because both US1 (Lexicon page explicit selection) and US2 (BookDetail in-context capture) consume the updated component.

**⚠️ CRITICAL**: US1 and US2 cannot be completed until this phase is done.

- [x] T002 Modify src/components/lexicon/AddWordDialog.vue: (1) change `bookId` prop from `required: String` to optional (`bookId?: string`), (2) add `defaultPageFound?: number` prop, (3) add `selectedBookId` internal ref (used when bookId prop is absent), (4) import `useBooksStore` and add `bookOptions` computed listing all books, (5) add a `<Select>` field "Book *" visible only when `!props.bookId` using PrimeVue Select with `bookOptions`, (6) add `effectiveBookId` computed = `props.bookId ?? selectedBookId.value`, (7) add book validation: `if (!effectiveBookId.value) errors.value.book = 'Please select a book'`, (8) use `effectiveBookId` in `lexiconStore.addEntry()` call, (9) initialize `pageFound` from `props.defaultPageFound ?? null`, (10) change `emit('saved')` to emit the created LexiconEntry returned by `addEntry()`

**Checkpoint**: AddWordDialog now works in two modes — "context-free" (no bookId prop → shows book selector) and "context-bound" (bookId prop present → book selector hidden).

---

## Phase 3: User Story 1 — Explicit book selection in Lexicon page (Priority: P1) 🎯 MVP

**Goal**: Eliminate the silent `activeBookId` fallback in LexiconPage so every word added from the Lexicon page has an explicitly chosen book.

**Independent Test**: With 2+ books in library, open `/lexicon` with "All Books" filter. Click Add Word. Confirm dialog shows required Book selector with no default. Save without selecting a book → validation error. Select book B → save → word appears under book B filter only.

- [x] T003 [US1] Modify src/pages/LexiconPage.vue: (1) delete the `activeBookId` computed (the one that fallbacks to `booksStore.books[0]?.id ?? ''`), (2) change the `<AddWordDialog>` binding from `:book-id="activeBookId"` to `:book-id="selectedBookId ?? undefined"` — when filter is "All Books" (selectedBookId is null), undefined is passed, triggering the dialog's built-in book selector; when a book is filtered, that book is passed as pre-selected context

**Checkpoint**: User Story 1 complete. Every word added from the Lexicon page now requires an explicit book selection. Verify with quickstart Scenarios 1 & 2.

---

## Phase 4: User Story 2 — In-context Add Word on Book Detail page (Priority: P1)

**Goal**: Add an "Add Word" button to BookDetailPage. Book is locked by context; `pageFound` defaults to current progress page.

**Independent Test**: Navigate to a book detail page. Find and click "Add Word". Dialog opens with no book selector (book locked). `pageFound` is pre-filled with current page. Save → entry appears in Lexicon filtered to this book. Word count badge updates.

- [x] T004 [US2] Modify src/pages/BookDetailPage.vue: (1) add imports `import AddWordDialog from '@/components/lexicon/AddWordDialog.vue'` and `import { useLexiconStore } from '@/stores/lexicon'`, (2) add `const lexiconStore = useLexiconStore()`, (3) add `const addWordVisible = ref(false)`, (4) add `const lexiconCount = computed(() => lexiconStore.entriesByBook[bookId.value]?.length ?? 0)`, (5) in `onMounted` add `await lexiconStore.fetchEntriesForBook(bookId.value)` after existing fetches, (6) in the progress section (below the VelocityBadge, above the recap section), add a `<div class="book-detail__vocab-row">` containing a small outlined Button "Add Word" with `pi-plus` icon that sets `addWordVisible = true`, and a `<RouterLink>` showing `{{ lexiconCount }} word(s) saved` visible when `lexiconCount > 0` linking to `{ name: 'lexicon', query: { bookId: bookId } }`, (7) add `<AddWordDialog>` at bottom of template (outside the main sections) with `:visible="addWordVisible"`, `:book-id="bookId"`, `:default-page-found="progress?.currentPage"`, `@update:visible="addWordVisible = $event"`, `@saved="addWordVisible = false"`, (8) add CSS for `.book-detail__vocab-row` (flex row, align-items center, gap 0.75rem) and `.book-detail__vocab-count` (small font, opacity 0.65, text-decoration none, color inherit)

**Checkpoint**: User Story 2 complete. Add Word from BookDetailPage pre-fills book and page. Verify with quickstart Scenario 3.

---

## Phase 5: User Story 3 — Trustworthy Word of the Day (Priority: P2)

**Goal**: Make Word of the Day deterministic per calendar day, add graceful fallback when nothing is due, and ensure "from: <book>" is accurate.

**Independent Test**: Seed ≥2 entries (some due, some future). Visit dashboard multiple times — same word shown each time today. Mark it reviewed → next due word appears immediately. Set all entries to future-dated → card still shows a word (marked "Coming up"). Source book line is accurate.

- [x] T005 [US3] Modify src/stores/lexicon.ts — add `fetchEntriesForAllBooks()` action: query `supabase.from('lexicon_entries').select('*').eq('user_id', authStore.user.id).order('created_at', { ascending: false })`, group results by `book_id` into `entriesByBook.value` (replacing per-book entries, not merging, to avoid stale data)

- [x] T006 [US3] Modify src/stores/lexicon.ts — add per-day Word of the Day caching: (1) add `const _wotdEntryId = ref<string | null>(null)` and `const _wotdIsPreview = ref(false)`, (2) add `resolveWordOfTheDay(userId: string)` action: read `localStorage.getItem('bookhero_wotd_' + userId)`, parse JSON, if `cache.date === today` set `_wotdEntryId.value = cache.entryId` and `_wotdIsPreview.value = cache.isPreview ?? false` and return; else call `getDueWord(all)` from `useLeitner()`, if null take the entry with soonest `nextReviewAt` and set `isPreview = true`, persist `{ date: today, entryId: pick.id, isPreview }` to localStorage, set refs, (3) replace current `wordOfTheDay` computed from `useLeitner().getDueWord(all)` to `Object.values(entriesByBook.value).flat().find(e => e.id === _wotdEntryId.value) ?? null`, (4) add `isWordOfTheDayPreview` computed returning `_wotdIsPreview.value`, (5) after `updateLeitner('advance')` succeeds, clear the localStorage cache for today (`localStorage.removeItem('bookhero_wotd_' + authStore.user!.id)`) and call `resolveWordOfTheDay(authStore.user!.id)` to immediately re-pick, (6) export `isWordOfTheDayPreview` and `resolveWordOfTheDay` from the store's return

- [x] T007 [P] [US3] Modify src/components/dashboard/WordOfTheDay.vue: (1) import `useAuthStore` and `useLexiconStore`, (2) add `const authStore = useAuthStore()`, (3) add `const isPreview = computed(() => lexiconStore.isWordOfTheDayPreview)`, (4) update `bookTitle` computed to return `booksStore.bookById(entry.value?.bookId)?.title ?? '(removed book)'` (safe fallback for deleted books), (5) add a `<span v-if="isPreview" class="wotd__preview-badge">Coming up</span>` pill in the card footer, (6) style `.wotd__preview-badge` as a small badge (font-size 0.68rem, uppercase, letter-spacing 0.05em, color var(--p-amber-300), background rgba(amber, 0.15), border-radius 999px, padding 0.1rem 0.45rem)

- [x] T008 [P] [US3] Modify src/pages/DashboardPage.vue: (1) import `useAuthStore`, (2) add `const authStore = useAuthStore()`, (3) in `onMounted`, replace the N+1 forEach `booksStore.books.forEach(b => lexiconStore.fetchEntriesForBook(b.id))` with `await lexiconStore.fetchEntriesForAllBooks()`, then call `lexiconStore.resolveWordOfTheDay(authStore.user!.id)` immediately after so the wotd is seeded before the component renders

**Checkpoint**: User Story 3 complete. Word of the Day is stable per day, graceful on no-due-entries, immediate re-pick after advance. Verify with quickstart Scenarios 4–7.

---

## Phase 6: User Story 4 — Bottom floating navigation (Priority: P2)

**Goal**: Replace the top `AppHeader` with a modern floating bottom nav bar (Home / Library / Lexicon / More). Preserve all actions (theme toggle, add book, sign out) in the "More" sheet.

**Independent Test**: Open app on mobile viewport. No top header visible. Bottom nav with 4 icons visible. Each icon routes correctly. Active icon is highlighted. More sheet opens and all 3 actions work. Scrolling on Library page — content fully visible, not clipped by nav.

- [x] T009 [US4] Create src/components/shared/AppBottomNav.vue — new component: (1) script: import `useRoute`, `useRouter`, `useColorMode` from vueuse, `useAuthStore`, (2) define `route`, `router`, `authStore`, `colorMode`, `isDark`, `moreVisible = ref(false)`, (3) active state computeds: `isHome = computed(() => route.path === '/')`, `isLibrary = computed(() => route.path.startsWith('/library'))`, `isLexicon = computed(() => route.path.startsWith('/lexicon'))`, (4) `toggleMode()` and `handleSignOut()` (same as AppHeader), (5) template: outer `<nav class="app-bottom-nav glass-surface">` with 4 children: RouterLink `/` with `pi-home` icon + "Home" label, RouterLink `/library` with `pi-th-large` icon + "Library" label, RouterLink `/lexicon` with `pi-language` icon + "Lexicon" label, `<button>` with `pi-ellipsis-h` icon + "More" label that sets `moreVisible = true`, (6) "More" sheet: `<Transition name="sheet"><div v-if="moreVisible" class="app-bottom-nav__sheet glass-surface">` with an overlay backdrop, 3 action rows (Add Book RouterLink to `/books/add`, theme toggle button, sign out button) and a close button, (7) close sheet on outside click via `@click.self` on backdrop, (8) CSS: nav is `position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem); left: 0.75rem; right: 0.75rem; height: 4rem; border-radius: 18px; z-index: 200; display: flex; align-items: stretch;` — each item `flex: 1; min-height: 44px; min-width: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; opacity: 0.5; transition: opacity 0.15s; border: none; background: transparent; color: inherit; cursor: pointer; text-decoration: none; border-radius: 14px; font-size: 0.68rem; font-weight: 500;` — active item `opacity: 1; color: var(--p-indigo-400);` — sheet: `position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 5.5rem); left: 0.75rem; right: 0.75rem; border-radius: 16px; padding: 0.5rem; z-index: 201; display: flex; flex-direction: column; gap: 0.25rem;` — sheet items: `display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 12px; font-size: 0.9rem; border: none; background: transparent; color: inherit; cursor: pointer; text-decoration: none; width: 100%; transition: background 0.15s;` with hover `background: rgba(255,255,255,0.08)`

- [x] T010 [US4] Modify src/layouts/DefaultLayout.vue: (1) remove `import AppHeader from '@/components/shared/AppHeader.vue'` and remove `<AppHeader />` from template, (2) add `import AppBottomNav from '@/components/shared/AppBottomNav.vue'`, (3) add `import { useAuthStore } from '@/stores/auth'`, (4) add `const authStore = useAuthStore()` in script setup, (5) add `<AppBottomNav v-if="authStore.user" />` after the `<main>` tag (inside `.default-layout` div), (6) restore `padding-top: 1.5rem` on `.default-layout__main` (was correct before, no change needed if already there), (7) in `.default-layout` style, add a comment noting that page padding-bottom is handled per-page via CSS variable

- [x] T011 [P] [US4] Add CSS variable to src/assets/styles/main.css: add `:root { --app-nav-bottom-clearance: 5.5rem; }` near the top of the file (or alongside existing :root declarations)

- [x] T012 [P] [US4] Update padding-bottom in src/pages/DashboardPage.vue: find the root page element's CSS rule with `padding: 1.5rem 1rem 4rem` and change the bottom value to `var(--app-nav-bottom-clearance)` — e.g. `padding: 1.5rem 1rem var(--app-nav-bottom-clearance)`

- [x] T013 [P] [US4] Update padding-bottom in src/pages/LexiconPage.vue: same as T012, change `padding: 1.5rem 1rem 4rem` to `padding: 1.5rem 1rem var(--app-nav-bottom-clearance)` in the `.lexicon` root CSS rule

- [x] T014 [P] [US4] Update padding-bottom in src/pages/BookDetailPage.vue: change `padding: 1.5rem 1rem 4rem` to `padding: 1.5rem 1rem var(--app-nav-bottom-clearance)` in the `.book-detail` CSS rule

- [x] T015 [P] [US4] Update padding-bottom in src/pages/LibraryPage.vue: change `padding: 1.5rem 1rem 4rem` to `padding: 1.5rem 1rem var(--app-nav-bottom-clearance)` in the page root CSS rule

**Checkpoint**: User Story 4 complete. No top header, bottom nav visible on all authenticated pages. More sheet has all 3 preserved actions. Verify with quickstart Scenarios 8–10.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remaining page padding updates, cleanup of unused AppHeader, and final validation pass.

- [x] T016 [P] Update padding-bottom in src/pages/RecapHistoryPage.vue: change `padding: 1rem 1rem 4rem` to `padding: 1rem 1rem var(--app-nav-bottom-clearance)`

- [x] T017 [P] Update padding-bottom in src/pages/AddBookPage.vue: change `padding: 1rem 1rem 4rem` to `padding: 1rem 1rem var(--app-nav-bottom-clearance)`

- [x] T018 [P] Update padding-bottom in src/pages/BookPassportPage.vue: change root page element's `padding: 1.5rem 1rem 5rem` to `padding: 1.5rem 1rem var(--app-nav-bottom-clearance)`

- [x] T019 Delete src/components/shared/AppHeader.vue — the component is no longer referenced anywhere after T010. Remove the file entirely.

- [x] T020 Run quickstart.md manual verification pass: test Scenarios 1–11 to confirm all acceptance criteria pass. Fix any regressions found.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — read files only
- **Foundational (Phase 2 — T002)**: Depends on Phase 1 — blocks US1 and US2
- **US1 (Phase 3 — T003)**: Depends on T002
- **US2 (Phase 4 — T004)**: Depends on T002
- **US3 (Phase 5 — T005–T008)**: Independent of US1/US2; T006 depends on T005; T007 and T008 are parallel after T006
- **US4 (Phase 6 — T009–T015)**: Independent of US1/US2/US3; T010–T015 depend on T009 (AppBottomNav must exist before layout references it); T011–T015 can run in parallel after T009
- **Polish (Phase 7)**: Depends on Phase 6 for CSS variable (T011) to exist; T016–T018 are parallel

### User Story Dependencies

- **US1**: Depends on Foundational (T002)
- **US2**: Depends on Foundational (T002). Does NOT depend on US1 completing.
- **US3**: Independent — can start after Phase 1. Does NOT depend on US1 or US2.
- **US4**: Independent — can start after Phase 1. Does NOT depend on US1, US2, or US3.

### Within Each User Story

- US1: T002 → T003
- US2: T002 → T004
- US3: T005 → T006 → T007 (parallel) + T008 (parallel)
- US4: T009 → T010 → (T011, T012, T013, T014, T015 all parallel)

---

## Parallel Execution Examples

### US3 — Word of the Day
```
After T006 completes:
  [parallel] T007: Update WordOfTheDay.vue
  [parallel] T008: Update DashboardPage.vue
```

### US4 — Bottom Nav
```
After T009 (AppBottomNav.vue created):
  [sequential] T010: Update DefaultLayout.vue
After T010 and T011:
  [parallel] T012: DashboardPage padding
  [parallel] T013: LexiconPage padding
  [parallel] T014: BookDetailPage padding
  [parallel] T015: LibraryPage padding
```

### Polish Phase
```
After T011 CSS variable exists:
  [parallel] T016: RecapHistoryPage padding
  [parallel] T017: AddBookPage padding
  [parallel] T018: BookPassportPage padding
  [parallel] T019: Delete AppHeader.vue
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002) — **CRITICAL**
3. Phase 3: US1 (T003)
4. Phase 4: US2 (T004)
5. **STOP and VALIDATE**: Every new word has a correctly-associated book. Scenarios 1–3 pass.
6. Ship US1 + US2 independently.

### Incremental Delivery

1. Complete T001–T004 → Lexicon data integrity fixed ✓
2. Complete T005–T008 → Word of the Day deterministic ✓
3. Complete T009–T015 → Bottom nav replaces top header ✓
4. Complete T016–T020 → All pages padded, cleanup done ✓

---

## Notes

- `[P]` tasks touch different files and have no inter-task file conflicts — safe to run together
- T002 is the single most impactful task — all other lexicon UI tasks flow from it
- T019 (delete AppHeader.vue) must be last to avoid breaking the layout before T010 completes
- After T006, `useLeitner()` is still called inside `resolveWordOfTheDay` action (not inside a computed) — this is intentional and correct; the action runs once per day, not on every render
- CSS variable `--app-nav-bottom-clearance` must be defined (T011) before T016–T018 can reference it in page styles
