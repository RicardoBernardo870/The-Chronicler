# Tasks: Reading Suite v3

**Input**: Design documents from `specs/003-reading-suite-v3/`
**Branch**: `003-reading-suite-v3`
**Stack**: TypeScript 6 + Vue 3.5+ + PrimeVue 4 + Pinia 3 + Supabase JS v2

**Organization**: Grouped by user story (P1→P6) to enable independent implementation and testing.

---

## Phase 1: Setup (Supabase Migrations & Types)

**Purpose**: Apply all DB schema changes and extend TypeScript types before any story work begins.

- [ ] T001 Apply Supabase migration — `ALTER TABLE recaps ADD COLUMN page_snapshot integer` (nullable, no default — old rows keep NULL)
- [ ] T002 Apply Supabase migration — create `up_next_order` table with RLS policy per `contracts/supabase-schema.sql`
- [ ] T003 Apply Supabase migration — create `progress_history` table with index per `contracts/supabase-schema.sql`
- [ ] T004 Apply Supabase migration — create `lexicon_entries` table with both indexes per `contracts/supabase-schema.sql`
- [ ] T005 Apply Supabase migration — create `recap_fragments` table with index per `contracts/supabase-schema.sql`
- [ ] T006 Apply Supabase migration — create `book_passports` table per `contracts/supabase-schema.sql`
- [ ] T007 Extend `src/types/index.ts` — add `pageSnapshot: number | null` to `Recap` interface and `RecapRow`; update `mapRecap()` to map `row.page_snapshot`
- [ ] T008 [P] Extend `src/types/index.ts` — add `LexiconEntry`, `LexiconEntryType`, `LexiconEntryRow` interfaces and `mapLexiconEntry()` mapper
- [ ] T009 [P] Extend `src/types/index.ts` — add `ProgressHistoryRow`, `UpNextOrder`, `RecapFragment`, `RecapFragmentRow`, `BookPassport`, `BookPassportRow` interfaces and their mappers

**Checkpoint**: All migrations applied, all new TypeScript types defined. Zero compile errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure changes that multiple stories depend on. Must complete before Phase 3+.

- [ ] T010 Update `src/stores/progress.ts` — every call to `updateProgress()` MUST also insert a row into `progress_history` (bookId, userId, page, recorded_at = now). Fire-and-forget (don't block the UI on this insert).
- [ ] T011 Update `src/stores/recaps.ts` — pass `currentPage` as `page_snapshot` on every recap insert; update the `generateRecap()` function's Supabase insert call.
- [ ] T012 Update `src/router/index.ts` — add routes for `/lexicon` (LexiconPage, lazy), `/books/:id/passport` (BookPassportPage, lazy).

**Checkpoint**: Progress updates log history, recaps store page number, new routes exist. Core data pipeline ready.

---

## Phase 3: User Story 1 — Library & Dashboard UX (Priority: P1) 🎯 MVP

**Goal**: Library sorted with active book on top, grid view toggle, edit/delete from library, Up Next section on dashboard with drag reorder, iOS gradient fix, recap history shows page number.

**Independent Test**: Open Library → verify sort → toggle grid → edit a book → delete a book → check Dashboard Up Next → open on iPhone and verify gradient fills status bar area → open Recap History and verify page number shown.

### iOS Gradient Fix

- [ ] T013 [US1] Fix `index.html` — add `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` and dual `<meta name="theme-color">` tags (dark: `#0a0a14`, light: `#f0f4ff`) per `research.md` Decision 5.
- [ ] T014 [US1] Fix `src/assets/styles/main.css` — add `padding-top: env(safe-area-inset-top)` to `html` selector so content clears the notch without cutting the gradient.

### Library Sort & Grid Toggle

- [ ] T015 [US1] Modify `src/pages/LibraryPage.vue` — replace current `sortedBooks` computed with new 4-tier sort: (1) most-recently-updated in-progress book first, (2) other in-progress ascending % , (3) 0%-progress books in up-next order, (4) completed books. Persist `viewMode` to `localStorage['library-view-mode']` (default `'list'`).
- [ ] T016 [US1] Create `src/components/books/BookGridCard.vue` — cover image (aspect 2:3, object-fit cover), frosted scrim at bottom, 2-line clamped title, muted author line, 3px progress bar at bottom edge, indigo-initial placeholder when no cover. Tap → router push to BookDetailPage.
- [ ] T017 [US1] Modify `src/pages/LibraryPage.vue` — add grid/list toggle buttons (PrimeVue Button, `pi-list` / `pi-th-large` icons); render `BookGridCard` grid (`auto-fill minmax(140px,1fr)`) when `viewMode === 'grid'`, existing list when `'list'`.

### Edit & Delete from Library

- [ ] T018 [US1] Create `src/components/books/BookEditDialog.vue` — PrimeVue `Dialog` wrapping `BookForm` pre-filled with the book prop; on save calls `booksStore.updateBook(id, changes)` then emits `close`.
- [ ] T019 [US1] Modify `src/components/books/BookCard.vue` — add `⋮` PrimeVue `Menu` overflow button; "Edit book" item → opens `BookEditDialog`; "Remove book" item → PrimeVue `ConfirmDialog` ("Remove this book and all its data? This cannot be undone.") → on confirm calls `booksStore.removeBook(id)`.

### Up Next Dashboard Section

- [ ] T020 [US1] Create `src/stores/upNext.ts` — Pinia store; `upNextOrder: UpNextOrder[]`; `fetchOrder()` loads from `up_next_order` Supabase table ordered by `sort_position`; `saveOrder(bookIds: string[])` upserts all rows with new positions.
- [ ] T021 [US1] Modify `src/pages/DashboardPage.vue` — add `upNextBooks` computed (books where `progressStore.percentageForBook(id) === 0`, sorted by `upNextStore.upNextOrder`); add "Up Next" section below Completed (hidden when `upNextBooks.length === 0`); each row shows cover thumb, title, author; install and use `vuedraggable` for drag reorder; on drag end call `upNextStore.saveOrder(newIds)`.

### Recap History Page Number

- [ ] T022 [US1] Modify `src/components/recap/RecapCard.vue` — add `pageSnapshot` display next to `progressSnapshot`; format: "page {{recap.pageSnapshot ?? '—'}} · {{recap.progressSnapshot}}%".
- [ ] T023 [US1] Modify `src/pages/RecapHistoryPage.vue` (or `src/components/recap/RecapHistory.vue`) — verify page number column is visible in the history list; no layout change needed beyond the RecapCard update.

**Checkpoint**: Full US1 independently functional and testable.

---

## Phase 4: User Story 2 — ISBN Field-by-Field Merge (Priority: P2)

**Goal**: When primary ISBN source (Open Library) returns a result with missing fields, automatically fill gaps from Google Books. Neither source's present fields overwrite each other.

**Independent Test**: Scan an ISBN known to have no cover in Open Library. Verify cover appears (from Google Books). Verify title/author from Open Library are preserved unchanged.

- [ ] T024 [US2] Modify `src/composables/useIsbn.ts` — replace the current full-fallback logic with field-by-field merge: run Open Library first; if result has all 4 fields (coverUrl, totalPages, genre, author) return immediately; otherwise identify missing fields, run Google Books, and merge only the missing fields from Google Books into the Open Library result. If Open Library returns null entirely, fall back to Google Books as before.

**Checkpoint**: ISBN lookup returns the best data from both sources for any book.

---

## Phase 5: User Story 3 — The Lexicon (Priority: P3)

**Goal**: Full vocabulary vault per book — dictionary lookups, lore entries, flip cards, spaced repetition, Word of the Day on dashboard.

**Independent Test**: Add a dictionary word with context sentence → verify flip card works → add a lore entry → verify book filter → Word of the Day appears on Dashboard → mark as known → verify Leitner box advances.

### Lexicon Service & Store

- [ ] T025 [P] [US3] Create `src/composables/useLexicon.ts` — `lookupWord(term: string)` fetches `https://api.dictionaryapi.dev/api/v2/entries/en/{term}`, returns `{ definition: string, phonetic: string | null }` from `meanings[0].definitions[0].definition`; returns null on error (no throws).
- [ ] T026 [P] [US3] Create `src/composables/useLeitner.ts` — pure TypeScript; `INTERVALS = [1, 2, 4, 8, 16]` days per box 1–5; `advanceBox(entry)` returns updated `{ leitnerBox, nextReviewAt }`; `resetBox(entry)` returns box 1 + nextReviewAt = today; `getDueWord(entries)` returns entry with lowest box from those where `nextReviewAt <= today`, ties broken by earliest `nextReviewAt`.
- [ ] T027 [US3] Create `src/stores/lexicon.ts` — Pinia store; `entriesByBook: Record<string, LexiconEntry[]>`; `fetchEntriesForBook(bookId)`, `addEntry(input)`, `updateLeitner(entryId, action: 'advance'|'reset')`; `wordOfTheDay` computed using `useLeitner.getDueWord` across all entries.

### Lexicon Components

- [ ] T028 [P] [US3] Create `src/components/lexicon/LexiconCard.vue` — glassmorphism flip card; front: term, type badge (DICTIONARY teal / LORE amber), page number; back: definition, context sentence, "✓ I know this" and "✗ Review again" buttons; CSS `transform: rotateY(180deg)` transition 0.5s; flipped state via local `ref<boolean>`.
- [ ] T029 [P] [US3] Create `src/components/lexicon/AddWordDialog.vue` — PrimeVue `Dialog`; word input auto-fetches definition on blur via `useLexicon.lookupWord`; type toggle (Dictionary / Lore); if Lore: definition field editable; context sentence (optional, textarea); page number (optional, InputNumber); Save calls `lexiconStore.addEntry()`.

### Lexicon Page & Navigation

- [ ] T030 [US3] Create `src/pages/LexiconPage.vue` — book filter dropdown (All Books + each book the user has entries for); filtered list of `LexiconCard` per entry; "+ Add Word" button opens `AddWordDialog`; empty state when no words saved; "I know this"/"Review again" actions call `lexiconStore.updateLeitner()`.
- [ ] T031 [US3] Modify `src/layouts/DefaultLayout.vue` — add Lexicon nav item to bottom nav bar: `pi-book` icon, label "Lexicon", route `/lexicon`.

### Word of the Day Widget

- [ ] T032 [US3] Create `src/components/dashboard/WordOfTheDay.vue` — glassmorphism card; shows term, phonetic if available, short definition, book name + page; "→" button marks as reviewed (`updateLeitner 'advance'`); tap card navigates to LexiconPage; hidden via `v-if="lexiconStore.wordOfTheDay !== null"`.
- [ ] T033 [US3] Modify `src/pages/DashboardPage.vue` — add `WordOfTheDay` component above the In Progress section; load `lexiconStore.wordOfTheDay` on mount (call `lexiconStore.fetchEntriesForBook` for all books in library).

**Checkpoint**: Full Lexicon feature works end-to-end. Word of the Day visible on Dashboard when words exist.

---

## Phase 6: User Story 4 — The Reading Pulse (Priority: P4)

**Goal**: Reading velocity (PPH) + Finish Line prediction on BookDetailPage; Continuity Score warning on hero card; reading streak per book in Library.

**Independent Test**: Log 2+ progress updates → BookDetailPage shows PPH and finish prediction → simulate 3-day gap → hero card turns amber with jogger prompt → Library shows streak number.

### Reading Pulse Composable

- [ ] T034 [US4] Create `src/composables/useReadingPulse.ts` — accepts `bookId`; `fetchHistory()` loads `progress_history` rows for this book from Supabase; `velocity` computed: group rows into sessions (gap > 2h = new session), calculate PPH per session, average last 3 sessions, exclude outliers (< 1 PPH or > 200 PPH), return null if < 2 sessions; `finishPrediction(totalPages, currentPage)` returns human-readable string ("~2h 14m to finish") or null; `continuityScore` computed: `Math.max(0, 100 - daysSinceLastUpdate * 15)`; `streak` computed: count consecutive calendar days with at least one progress_history row ending today.

### UI Integration

- [ ] T035 [P] [US4] Create `src/components/pulse/VelocityBadge.vue` — props `bookId: string, totalPages: number, currentPage: number`; shows "📈 Xpg/hr · ~Xh Xm to finish" using `useReadingPulse`; hidden with `v-if` when velocity is null; glassmorphism badge style.
- [ ] T036 [US4] Modify `src/pages/BookDetailPage.vue` — import and render `VelocityBadge` below the progress section; only renders when book has progress.
- [ ] T037 [US4] Modify `src/pages/DashboardPage.vue` — hero card: import `useReadingPulse` for the hero book; when `continuityScore < 40`, apply amber warning CSS class to hero card and show inline text "⚠ It's been a while — time for a Memory Jogger?"; class removed when score ≥ 40.
- [ ] T038 [US4] Modify `src/components/books/BookCard.vue` — add streak indicator below progress bar: "🔥 X-day streak" using `useReadingPulse(book.id).streak`; hidden when streak is 0.

**Checkpoint**: Velocity visible on BookDetailPage, amber hero card triggers after 2.7+ days, streak shows in Library.

---

## Phase 7: User Story 5 — Milestone-Based Recapping (Priority: P5)

**Goal**: Recap button locked until 10% progress since last recap; background fragment extraction at milestones; fragment-aware recap assembly.

**Independent Test**: Generate recap at 50% → advance < 10% → button shows lock with page countdown → advance past 10% → button unlocks → generate recap → confirm it succeeds.

### Fragment Store & Milestone Detection

- [ ] T039 [US5] Create `src/stores/recapFragments.ts` — Pinia store; `fetchFragmentsForBook(bookId)`, `saveFragment(bookId, page, percentage, json)` inserts to `recap_fragments`; `fragmentsForBook(bookId)` getter returns sorted array.
- [ ] T040 [US5] Modify `src/stores/progress.ts` — after a successful `updateProgress()`, check if the new percentage has crossed a 10% milestone since last recap (`Math.floor(newPct/10) > Math.floor(lastRecapPct/10)`); if so, fire-and-forget background call to `triggerFragmentExtraction(bookId, page, pct)` (defined in `recapFragmentsStore` or a helper in `recapService.ts`).
- [ ] T041 [US5] Add `extractFragment(request: RecapRequest)` to `src/services/recapService.ts` — calls the same `generate-recap` edge function with an added `mode: 'extract_only'` flag; stores the Pass-1 JSON result to Supabase via `recapFragmentsStore.saveFragment()`; returns void (fire-and-forget safe).

### Recap Button Lock State

- [ ] T042 [US5] Modify `src/pages/BookDetailPage.vue` — compute `pagesUntilUnlock`: `lastRecapPercentage` from `recapsStore.latestRecapForBook(bookId)?.progressSnapshot ?? 0`; unlock threshold page = `Math.ceil((lastRecapPercentage + 10) / 100 * totalPages)`; locked = `currentPage < unlockPage && lastRecapPercentage > 0`; render locked button state ("🔒 Read X more pages to unlock") when locked, normal button otherwise. First recap (no prior recap) is always unlocked.

### Edge Function Fragment Support

- [ ] T043 [US5] Modify `supabase/functions/generate-recap/index.ts` — add support for `mode` field in request body: `'extract_only'` runs only Pass 1 and returns the raw extraction JSON without streaming; `'full_summary'` skips spoiler constraint (used by Odyssey); default (undefined) runs the existing two-pass stream. If fragments are passed in the request body (`fragments: RecapFragment[]`), Pass 2 uses the merged fragment content instead of running Pass 1. Deploy updated function.

**Checkpoint**: Recap button locks/unlocks correctly, background fragments stored, recap assembly uses fragments when available.

---

## Phase 8: User Story 6 — The Reading Odyssey (Priority: P6)

**Goal**: Auto-generate Book Passport when progress hits 100%; shows total days, peak day, vocab count, and AI full-book summary; accessible from BookDetailPage.

**Independent Test**: Mark a book as 100% complete → verify BookPassport auto-generates → navigate to passport → verify all stats shown and AI summary streamed.

### Passport Store & Trigger

- [ ] T044 [US6] Create `src/stores/bookPassport.ts` — Pinia store; `passportByBook: Record<string, BookPassport>`; `fetchPassport(bookId)` loads from `book_passports`; `generatePassport(bookId)` — computes stats client-side from `progress_history` (total days, peak day/pages), reads `lexiconStore.entriesByBook[bookId]?.length ?? 0` for vocab count, calls `generate-recap` edge function with `mode: 'full_summary'`, streams AI summary, inserts completed passport to Supabase.
- [ ] T045 [US6] Modify `src/stores/progress.ts` — in `updateProgress()`, after progress saved, if `newPercentage >= 100` and no existing passport for this book, call `bookPassportStore.generatePassport(bookId)` (fire-and-forget).

### Passport Page & Navigation

- [ ] T046 [P] [US6] Create `src/pages/BookPassportPage.vue` — celebratory full-page layout (different gradient: `radial-gradient` with emerald/amber tones); header "✦ Reading Journey: {title} ✦"; stat cards: 📅 total days, ⚡ peak day + pages, 📖 vocab count; Divider; streaming AI summary section (reuses `RecapStream` loading/streaming states); "Share Journey" button using Web Share API (`navigator.share`); falls back to clipboard copy if Web Share unavailable.
- [ ] T047 [US6] Modify `src/pages/BookDetailPage.vue` — when `book` is complete (progress = 100%), show "✦ View Reading Journey" PrimeVue Button that navigates to `/books/:id/passport`; call `bookPassportStore.fetchPassport(bookId)` on mount to check if one already exists.

**Checkpoint**: Full Reading Odyssey works end-to-end. Passport auto-triggers, all stats correct, shareable.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T048 [P] Update `CLAUDE.md` — add Lexicon (Free Dictionary API), Leitner System, Reading Pulse, Milestone Recap fragments, and Book Passport to Recent Changes section for the `003-reading-suite-v3` branch.
- [ ] T049 Run all 10 quickstart scenarios from `specs/003-reading-suite-v3/quickstart.md` manually and fix any issues found.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Migrations + Types)**: No dependencies — start immediately; T001–T006 (migrations) can all run in parallel; T007–T009 (types) can all run in parallel.
- **Phase 2 (Foundational)**: Depends on Phase 1 completion — BLOCKS all user stories.
- **Phase 3 (US1)**: Depends on Phase 2. T013–T014 (iOS fix) are fully independent and can start right after Phase 1.
- **Phase 4 (US2)**: Depends on Phase 1 only (types) — can run alongside Phase 3.
- **Phase 5 (US3)**: Depends on Phase 2 (needs `lexicon_entries` table + types). T025, T026, T028, T029 can all run in parallel.
- **Phase 6 (US4)**: Depends on Phase 2 (needs `progress_history` table + T010). T035 can run in parallel with T034.
- **Phase 7 (US5)**: Depends on Phase 2 + Phase 3 recap store change (T011). T039–T041 can run in parallel.
- **Phase 8 (US6)**: Depends on Phase 5 (Lexicon vocab count) and Phase 7 (edge function `mode` flag). T046 can run in parallel with T044–T045.
- **Phase 9 (Polish)**: Depends on all desired stories being complete.

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|-------|-----------|---------------------|
| US1 (P1) | Phase 2 | US2, US3 (after Phase 1) |
| US2 (P2) | Phase 1 only | US1, US3, US4 |
| US3 (P3) | Phase 2 | US2, US4 after Phase 2 |
| US4 (P4) | Phase 2 + T010 | US2, US3 |
| US5 (P5) | Phase 2 + T011 (recap page#) | US3, US4 |
| US6 (P6) | Phase 5 (vocab count) + T043 (edge fn) | — |

### Parallel Opportunities Within Stories

```
Phase 1:   T001–T006 all parallel (separate migrations)
           T007, T008, T009 all parallel (separate type blocks)

Phase 3:   T013 + T014 parallel (different files)
           T015 + T016 + T018 + T019 parallel (different files)
           T020 + T025 + T026 parallel (different stores/composables)

Phase 5:   T025 + T026 + T028 + T029 all parallel

Phase 6:   T034 + T035 parallel (composable + component)
           T036 + T037 + T038 parallel (different pages/components)

Phase 7:   T039 + T040 + T041 parallel

Phase 8:   T044 + T046 parallel
```

---

## Implementation Strategy

### MVP (US1 + US2 — Quick Wins)

1. Complete Phase 1: Migrations + Types (T001–T009)
2. Complete Phase 2: Foundational (T010–T012)
3. Complete Phase 3: US1 (T013–T023)
4. Complete Phase 4: US2 (T024)
5. **STOP and VALIDATE**: Library UX polished, iOS fixed, recap history shows pages.

### Full Feature Delivery Order

1. Phases 1–2 → Foundation ready
2. Phase 3 (US1) + Phase 4 (US2) → Library & ISBN polish ✓
3. Phase 5 (US3) → Lexicon live ✓
4. Phase 6 (US4) → Reading Pulse live ✓
5. Phase 7 (US5) → Milestone Recap live ✓
6. Phase 8 (US6) → Reading Odyssey live ✓
7. Phase 9 → Polish + QA ✓

---

## Notes

- Arrow functions only throughout — no `function` keyword (project convention)
- All new Pinia stores use setup-function syntax (not options API)
- `[P]` = safe to implement in parallel (different files, no shared state dependencies)
- `[USn]` = maps to User Story n from `spec.md`
- Each Phase checkpoint must pass before moving to the next priority story
- Migrations (T001–T006) are idempotent (`IF NOT EXISTS`) — safe to re-run
- Total tasks: **49** across 9 phases
