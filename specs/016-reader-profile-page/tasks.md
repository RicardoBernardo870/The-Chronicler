# Tasks: Reader Profile Page with Reading DNA and Auto-Vocabulary Extraction

**Feature**: `016-reader-profile-page`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data model**: [data-model.md](./data-model.md) | **Contracts**: [contracts/](./contracts/)

**Stack**: TypeScript 6 (strict) · Vue 3.5 (`<script setup>`) · PrimeVue 4 · Pinia 3 · Vue Router 4 · Supabase JS v2 · Deno (edge functions) · Gemini 2.5 Flash

**No test tasks** — feature spec did not request TDD; verification is manual via `quickstart.md`.

---

## Phase 1: Setup

- [X] T001 Apply database migration `supabase/migrations/20260428_reader_profile.sql` containing: `reading_dna` table, `vocabulary_extractions` table, and `lexicon_entries.source` column extension (full SQL in `data-model.md` §5).
- [X] T002 [P] Add Reading DNA + Vocabulary types to `src/types/index.ts`: `BookSuggestion`, `MoodSignature`, `ReadingDna`, `ReadingDnaRow`, `mapReadingDna`, `VocabularyExtractionStatus`, `VocabularyExtraction`, `LexiconEntrySource` (per `data-model.md` §4).
- [X] T003 [P] Extend `LexiconEntry` and `LexiconEntryRow` interfaces in `src/types/index.ts` with `source: LexiconEntrySource` (camelCase + snake_case) and update `mapLexiconEntry` to pass it through.
- [X] T004 Add `/profile` lazy-loaded route in `src/router/index.ts` pointing at `() => import('@/pages/ProfilePage.vue')` with `name: 'profile'`.
- [X] T005 Add a "Profile" tab to the existing bottom navigation component (find via `grep -rn "name: 'dashboard'" src/components/`) — link to `{ name: 'profile' }` with `pi-user` icon.

---

## Phase 2: Foundational (blocking prerequisites)

- [X] T006 Create empty placeholder file `src/pages/ProfilePage.vue` with a `<script setup lang="ts">` block, a `<template>` returning a single `<section class="profile-page glass-surface">` and a heading "Profile". This unblocks the route while child components are built.
- [X] T007 [P] Create `src/components/profile/` directory with an `index.ts` barrel re-exporting all profile components as they are added (start empty; entries appended as components ship).

---

## Phase 3: User Story 1 — Profile page renders for an established reader (P1)

**Goal**: A user with reading history sees Lifetime Stats, Library Breakdown, Top Themes, and the empty/threshold-state Reading DNA & Vocabulary slots — all without any new AI calls.

**Independent Test**: User with ≥1 finished book and ≥1 logged session opens `/profile`; sees populated stats grid, library breakdown, themes; navigates back without errors. Maps to spec Acceptance Scenarios 1, 2, 4 + Edge Cases (zero-data states).

### Composables (client-side stat aggregation)

- [X] T008 [P] [US1] Create `src/composables/useReadingProfile.ts` exporting `useReadingProfile()` that returns `{ booksFinished, booksInProgress, totalPagesRead, totalReadingHours, allTimeVelocityPph, currentStreak, longestStreak }` aggregated from `useProgressStore` (`completedBooks`, `inProgressBooks`) and a fetch of `progress_history` for hours/velocity/streaks. Streaks computed by grouping `recordedAt` to local-timezone `yyyy-MM-dd` strings (per research.md Decision 7).
- [X] T009 [P] [US1] Create `src/composables/useTopThemes.ts` exporting `useTopThemes()` that returns `{ term, weight }[]` (top 30) by tokenizing `recapsStore.recaps` summary text and `loreCardsStore.cards` titles+summaries with stop-word filtering (per research.md Decision 6).
- [X] T010 [P] [US1] Create `src/composables/useLibraryBreakdown.ts` exporting `useLibraryBreakdown()` returning `{ genres: { name, count }[], uniqueAuthors: number, paceComparison: { bookId, bookTitle, paceLabel, paceNormalized }[] }` from `useBooksStore` (using `book.genre` per FR-004) and `progress_history`-derived per-book velocity.

### Presentational components (PrimeVue-only)

- [X] T011 [P] [US1] Create `src/components/profile/StatTile.vue` — accepts `{ icon, label, value }` props, renders PrimeVue `<Card>` with `<i class="pi" :class="icon">`, big number, label.
- [X] T012 [US1] Create `src/components/profile/LifetimeStatsGrid.vue` — calls `useReadingProfile()`, renders 7 `<StatTile>` instances inside a PrimeVue `<Card>` wrapper laid out via CSS grid. Empty state: when all numbers are zero, show PrimeVue `<InlineMessage>` "Start your first session to see your stats."
- [X] T013 [P] [US1] Create `src/components/profile/TopThemesCloud.vue` — calls `useTopThemes()`, renders a row of PrimeVue `<Chip>` elements with inline `style="font-size: ..."` scaled 1×–2× by weight. Empty state: PrimeVue `<InlineMessage>` "Your themes will appear after your first recap or lore card."
- [X] T014 [P] [US1] Create `src/components/profile/LibraryBreakdownCard.vue` — calls `useLibraryBreakdown()`, renders PrimeVue `<Card>` containing: row of genre `<Tag>` elements with counts, a `<Chip icon="pi pi-user">` showing "{N} authors", and a list of `<ProgressBar>` rows for pace comparison.

### Page composition

- [X] T015 [US1] Wire `src/pages/ProfilePage.vue` to render (in order): a placeholder `<section>` for DNA (US2), a placeholder `<section>` for Vocabulary Garden (US3), `<LifetimeStatsGrid />`, `<TopThemesCloud />`, `<LibraryBreakdownCard />`. Use PrimeVue `<Skeleton>` placeholders while underlying stores are loading. Ensure existing stores are fetched on mount: `booksStore.fetchLibrary()`, `progressStore.fetchProgress()`, `recapsStore.fetchAllRecaps()` (or equivalent), `loreCardsStore.fetchAllCards()` (or equivalent).
- [ ] T016 [US1] Verify `/profile` route renders end-to-end on Dashboard navigation; confirm SC-001 (< 2 s render under typical conditions) by running quickstart Scenarios A and B manually.

**Checkpoint**: User Story 1 fully shippable. Profile page renders for established and zero-data users with no AI involvement.

---

## Phase 4: User Story 2 — Reading DNA tells me who I am as a reader (P2)

**Goal**: After ≥3 finished books, the user sees a persisted Reading DNA card (personality + mood signature + 3-5 book suggestions). Threshold-gated regeneration only.

**Independent Test**: User with 3 finished books opens `/profile`; DNA generates once and persists; revisit triggers zero AI calls; crossing the +3-books or 90-day threshold triggers exactly one regeneration. Maps to spec Story 2 scenarios + SC-002, SC-005, SC-008.

### Backend (edge function)

- [X] T017 [P] [US2] Create `supabase/functions/generate-reading-dna/index.ts` per `contracts/edge-functions.md` §1: verifies JWT, reads user's recaps + lore + captures + finished books, calls Gemini 2.5 Flash with the prompt outlined in research.md Decision 8, validates JSON shape, UPSERTs into `public.reading_dna`, returns response body. Errors: 400 insufficient_corpus, 401 unauthorized, 502 ai_unavailable, 500 internal.
- [ ] T018 [US2] Deploy/verify `generate-reading-dna` function locally via `supabase functions serve` and confirm it inserts/updates a row in `reading_dna` for a test user.

### Frontend store + components

- [X] T019 [P] [US2] Create `src/stores/readingDna.ts` Pinia store: state = `dna: ReadingDna | null`, `status: 'idle' | 'loading' | 'error'`. Actions: `fetchDna()` (selects from `reading_dna` for current user), `maybeGenerateDna(booksFinishedCount)` (gate: invoke if no row AND finished ≥ 3, OR row AND (finishedSinceGen ≥ 3 OR daysSinceGen ≥ 90); per research.md Decision 3 + 12). On generation error, preserve existing `dna` (FR-014).
- [X] T020 [P] [US2] Create `src/components/profile/MoodSignature.vue` — accepts `{ tone: string, emojis: string[] }`, renders PrimeVue `<Chip>` for tone + emoji row.
- [X] T021 [P] [US2] Create `src/components/profile/BookSuggestionItem.vue` — accepts `{ title, author, reason }`, renders compact PrimeVue `<Card>` with title `<h3>`, author `<Tag severity="secondary">`, reason `<p>`.
- [X] T022 [US2] Create `src/components/profile/ReadingDnaCard.vue` — calls `useReadingDnaStore`, computes `booksFinished` from `useReadingProfile()`. Renders one of:
  - PrimeVue `<InlineMessage severity="info">` + `<ProgressBar>` showing "{n} of 3 books finished" when below threshold and no DNA exists (FR-013).
  - PrimeVue `<Skeleton>` for personality + 3 suggestion skeletons while `status === 'loading'`.
  - PrimeVue `<Card>` with personality `<p>`, `<MoodSignature>`, and 3-5 `<BookSuggestionItem>` rows when DNA exists.
  - PrimeVue `<InlineMessage severity="secondary">` "We'll try again later" only when `status === 'error'` AND no prior DNA (FR-014).

### Page integration

- [X] T023 [US2] In `src/pages/ProfilePage.vue` `onMounted`: call `readingDnaStore.fetchDna()` then `readingDnaStore.maybeGenerateDna(booksFinished)`. Replace the DNA placeholder section from T015 with `<ReadingDnaCard />` as the first child. Verify quickstart Scenarios C and D manually.

**Checkpoint**: User Story 2 ships. DNA generates once when eligible, persists, regenerates only on threshold. Story 1 still works (independence preserved).

---

## Phase 5: User Story 3 — Vocabulary grows automatically as I read (P2, parallel to US2)

**Goal**: Each capture silently extracts up to 5 in-context-defined uncommon words into the existing Lexicon (Box 1, dedup-aware). Vocabulary Garden surfaces them on the Profile page.

**Independent Test**: User captures a page with advanced vocabulary; ≤30 s later up to 5 new entries appear in `/lexicon` AND in Profile → Vocabulary Garden with source attribution. Capture latency unaffected (SC-004). Maps to spec Story 3 scenarios + SC-003, SC-006.

### Backend (edge function)

- [X] T024 [P] [US3] Create `supabase/functions/extract-vocabulary/index.ts` per `contracts/edge-functions.md` §2: idempotent INSERT into `vocabulary_extractions` keyed by `capture_id` (handles re-capture edge case), Gemini 2.5 Flash call with the prompt from research.md Decision 9, candidate filtering (case-insensitive dedup against existing `lexicon_entries.term` for `user_id`; reject capitalized non-sentence-start tokens), batch INSERT of survivors into `lexicon_entries` with `source='auto'`, `entry_type='dictionary'`, `leitner_box=1`, `book_id`, `page_found=page`, `context_sentence` (sentence containing the word from `ocrText`), `definition`. UPDATE ledger row to `succeeded` / `skipped` / `failed`. Always returns 200 (per fire-and-forget contract); 401/400 reserved for auth/missing-input.
- [ ] T025 [US3] Deploy/verify `extract-vocabulary` function locally via `supabase functions serve` and confirm both the ledger row and lexicon entries appear for a test capture.

### Frontend integration

- [X] T026 [P] [US3] Create `src/composables/useVocabularyExtraction.ts` exporting `triggerExtraction({ captureId, bookId, page, ocrText })` that calls `supabase.functions.invoke('extract-vocabulary', { body: ... })` **without awaiting** (use `void` and `.catch(err => console.warn('[vocab] extraction failed', err))`). No UI side effects.
- [X] T027 [US3] Hook `triggerExtraction` into the existing capture-save flow: find the spot in `src/stores/captures.ts` (or `src/composables/useCapture.ts`) where `page_captures` insert resolves successfully; immediately after, call `triggerExtraction(...)` with the resolved capture's `id`, `book_id`, `page`, and OCR `text`. The capture promise must resolve BEFORE this call; the call itself is non-awaited (per research.md Decision 4 + FR-020 + SC-004).
- [X] T028 [P] [US3] Update `src/stores/lexicon.ts` to surface a SWR-aware `revalidate` action so the Vocabulary Garden can refresh when the Profile page is opened (entries inserted by the edge function won't be reflected in the local store otherwise). Also ensure `mapLexiconEntry` handles the new `source` field.

### Vocabulary Garden component

- [X] T029 [US3] Create `src/components/profile/VocabularyGardenCard.vue`:
  - Calls `lexiconStore.fetchAllEntriesForUser()` (or equivalent — add the action if missing).
  - Renders PrimeVue `<Card>` with header showing "Vocabulary Garden" title + total-count `<Tag>`.
  - Body: row of 5 `<Chip>` elements (one per Leitner box) with `<Badge>` count. Below, PrimeVue `<DataView layout="list">` of the latest 5 entries; each row shows term (bold), definition, and a `<Tag severity="secondary">from {bookTitle}, p. {pageFound}</Tag>` (FR-022a).
  - Footer: PrimeVue `<Button text>` "Open Lexicon" → `router.push({ name: 'lexicon' })` (FR-024).
  - Empty state: `<InlineMessage>` "Capture your first page to begin building your vocabulary."

### Page integration

- [X] T030 [US3] In `src/pages/ProfilePage.vue`, replace the Vocabulary Garden placeholder section from T015 with `<VocabularyGardenCard />`. Verify quickstart Scenarios E, F, G manually.

**Checkpoint**: User Story 3 ships. Captures silently extract vocab; Vocabulary Garden displays totals + Leitner distribution + recents with source attribution. Stories 1 and 2 still work (independence preserved).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T031 [P] Run `npm run lint` and `tsc --noEmit` (or `npm run build`) to confirm zero type errors across all new files in `src/pages/ProfilePage.vue`, `src/components/profile/`, `src/composables/use*`, `src/stores/readingDna.ts`, `src/stores/lexicon.ts`.
- [ ] T032 [P] Run quickstart Scenario H (DNA failure preserves previous) and Scenario I (page capture redo idempotent) manually to confirm error paths.
- [ ] T033 [P] Run Lighthouse on built `/profile` route and confirm PWA score ≥ 90 (Constitution V).
- [X] T034 [P] Confirm Constitution VI compliance per quickstart.md "Verification of Constitution Principle VI compliance": every file in `src/components/profile/` ≤ 250 lines; every UI element is a PrimeVue component (no custom components introduced); `ProfilePage.vue` template contains only `<section>` + child component tags.
- [X] T035 Update `CLAUDE.md` "Active Technologies" and "Recent Changes" sections to reflect feature 016 (new tables, new edge functions, new Pinia store, new composables).

---

## Dependencies

```
Setup (T001-T005)
  └─ Foundational (T006-T007)
        ├─ User Story 1 (T008-T016)  ← MVP candidate
        ├─ User Story 2 (T017-T023)  ← depends on US1's useReadingProfile (T008)
        └─ User Story 3 (T024-T030)  ← depends only on Setup/Foundational
              └─ Polish (T031-T035)
```

- **US1 must complete before US2** because `ReadingDnaCard` reads `booksFinished` from `useReadingProfile()` (T008).
- **US2 and US3 are mutually independent** and can be developed in parallel by two contributors.
- **All Polish tasks are parallelizable** with each other.

---

## Parallel execution examples

### Within Setup
T002 and T003 can run in parallel (both edit `src/types/index.ts` — actually serialize them; treat as single-file group). T004 and T005 are independent.

### Within US1
- Composables: T008, T009, T010 — all parallel ([P]).
- Components: T011, T013, T014 — parallel after composables. T012 depends on T011 (uses `<StatTile>`).

### Within US2
- T017 (edge function) and T019, T020, T021 (frontend) — all parallel ([P]).
- T022 depends on T019, T020, T021. T023 depends on T022.

### Within US3
- T024 (edge function), T026 (composable), T028 (lexicon store update) — all parallel ([P]).
- T029 depends on T028. T030 depends on T029.

### MVP (User Story 1 only)
Tasks T001–T016 — ships a useful Profile page with no AI integration. Roughly 16 tasks, ~1–2 days for one contributor.

---

## Implementation strategy

1. **Ship MVP first** (US1, T001–T016): static stats + library + themes. Validates page architecture, navigation, and PrimeVue-first compliance with no AI risk.
2. **Add US3 (Vocabulary)** in parallel with US2 ramp-up. US3 is lower risk (existing Lexicon UX, additive write path), so it can land first.
3. **Add US2 (Reading DNA)** last among feature work — it's the most user-visible and the most AI-dependent. Threshold gating is the trickiest correctness bit and benefits from US1 already being shipped.
4. **Polish phase** (T031–T035) runs after all three stories are merged.

---

## Format validation

All tasks above conform to: `- [ ] [TaskID] [P?] [Story?] Description with file path`. Setup/Foundational/Polish tasks have no `[Story]` label per the rules. Story-phase tasks all carry `[US1]`, `[US2]`, or `[US3]`.

**Total tasks**: 35
- Setup: 5 (T001–T005)
- Foundational: 2 (T006–T007)
- US1: 9 (T008–T016)
- US2: 7 (T017–T023)
- US3: 7 (T024–T030)
- Polish: 5 (T031–T035)

**Parallel opportunities**: 19 tasks marked `[P]`.
