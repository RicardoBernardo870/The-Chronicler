# Tasks: Lore Chronoscope

**Input**: Design documents from `/specs/007-lore-chronoscope/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/lore-api.md, contracts/ui-contracts.md, quickstart.md

**Tests**: Unit tests are INCLUDED per quickstart.md § Unit test targets (`masterRecap.spec.ts`, `milestoneDetect.spec.ts`). No contract/integration tests — manual smoke playbook covers that layer.

**Organization**: Tasks are grouped by user story (US1–US4) so each can be shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different file, no dependency on an incomplete task — safe to run in parallel.
- **[Story]**: US1 / US2 / US3 / US4 traceability to spec.md user stories.
- All paths are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Types, cache keys, and pure helpers that every user story depends on.

- [ ] T001 [P] Add `LoreType`, `LoreCardRow`, `LoreCard`, and `mapLoreCard` to `src/types/index.ts` (per data-model.md § TypeScript types).
- [ ] T002 [P] Extend `cacheKeys` in `src/composables/useCache.ts` with `lore(uid, bookId)` and `loreAll(uid)` builders (per lore-api.md § Cache key contract).
- [ ] T003 [P] Create pure helper `buildMasterRecap(recaps, currentPage): string` in `src/utils/masterRecap.ts` — filter `progress_snapshot > 0`, filter `page_snapshot <= currentPage`, sort ascending, format per data-model.md § MasterRecap.
- [ ] T004 [P] Create pure helper `detectCrossedMilestone(previousPercentage, newPercentage): number | null` in `src/utils/milestoneDetect.ts` — returns 10..90 multiple of 10 only when a new 10% bucket is crossed forward; null otherwise.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database table + edge function + store scaffolding. ALL user stories depend on these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T005 Create migration `supabase/migrations/20260417_lore_cards.sql`: `lore_cards` table with all columns, `UNIQUE(user_id, book_id, unlocked_at_milestone)`, index on `(user_id, book_id)`, RLS policies (SELECT/INSERT/UPDATE/DELETE gated on `auth.uid() = user_id`), FK cascades to `auth.users` and `books` (per data-model.md).
- [ ] T006 [P] Scaffold edge function directory `supabase/functions/generate-lore/` with `index.ts` (Deno entry) and `config.toml` with `verify_jwt = false` (mirrors `generate-recap` pattern).
- [ ] T007 [P] Create `src/services/loreService.ts` exporting `loreService.generate(req): Promise<LoreGenerateResponse>` — fetch wrapper with Bearer token attach, error-throw on non-2xx (per lore-api.md § Service).
- [ ] T008 Create empty Pinia store `src/stores/loreCards.ts` with state `loreByBook: Record<string, LoreCard[]>`, `useLoreCardsStore` export, and a `clearAll()` action wired into auth-signout path (FR-031). Register in any existing store-clear orchestration.
- [ ] T009 Hook `clearAll()` of loreCardsStore into the existing sign-out/user-switch flow so caches are wiped on identity change (FR-031).

**Checkpoint**: DB table live, edge function scaffold deployable, service + store skeletons ready. User stories can now begin in parallel.

---

## Phase 3: User Story 1 — Milestone Unlock (Priority: P1) 🎯 MVP

**Goal**: Crossing a 10% milestone with qualifying recaps silently generates and persists a spoiler-safe Lore Card.

**Independent Test**: Save progress on a book with prior recaps from < 10% to ≥ 10%. Within 30 s a row lands in `lore_cards` tagged with the correct milestone, containing only characters/places drawn from the existing Master Recap. Re-saving the same milestone generates no new row. (Smokes 1, 3, 4, 5, 6.)

### Tests for User Story 1 ⚠️

- [ ] T010 [P] [US1] Unit tests `tests/unit/masterRecap.spec.ts` covering: empty list, single item, multi-item sort ascending, filters out `progress_snapshot === 0`, filters out `page_snapshot > currentPage` (per quickstart.md § Unit test targets).
- [ ] T011 [P] [US1] Unit tests `tests/unit/milestoneDetect.spec.ts` covering 0→5 (null), 5→10 (10), 18→22 (20), 8→35 (30 — latest crossed), 95→100 (null, outside [10..90]), negative moves (null), same-value saves (null).

### Implementation for User Story 1

- [ ] T012 [US1] Implement `generate-lore` edge function in `supabase/functions/generate-lore/index.ts`: JWT decode (atob), body validation (reject 400 on missing fields or empty masterRecap, 400 on milestone ∉ {10..90 step 10}), call Gemini 2.5 Flash (`temperature 0.6`, `maxOutputTokens 2048`) with the Chronicler Historian system prompt from research.md § Decision 4, strip code fences, `JSON.parse`, validate shape (title/content non-empty strings; type ∈ History|Myth|Geography; linked_entities string[] ≤ 5), return validated JSON. Error table per lore-api.md § Error shapes.
- [ ] T013 [US1] Deploy edge function: `supabase functions deploy generate-lore` (requires `GEMINI_API_KEY` set in project env).
- [ ] T014 [US1] Implement `fetchLoreForBook(bookId)` action in `src/stores/loreCards.ts` using SWR (`useCache` + `cacheKeys.lore`, TTL 120_000 ms) — fetcher queries `lore_cards` filtered by `book_id`, sorts by `unlocked_at_milestone` asc, maps with `mapLoreCard`, writes to `loreByBook[bookId]`. Register revalidator for tab-focus (per lore-api.md).
- [ ] T015 [US1] Implement `maybeUnlockForMilestone(bookId, milestone, currentPage)` in `src/stores/loreCards.ts` per lore-api.md § maybeUnlockForMilestone: cost gate (check existing card), ensure recaps fetched (reuse `useRecapsStore.fetchRecapsForBook`), build Master Recap via `buildMasterRecap`, short-circuit on empty (FR-004), fetch book metadata, call `loreService.generate`, insert row, update local cache, `swrTouch` both keys, fire success toast. MUST wrap entire body in `try/catch` that only `console.error`s (FR-008).
- [ ] T016 [US1] Wire milestone detection into `src/stores/progress.ts` `updateProgress` action: after a server-confirmed save, compute `detectCrossedMilestone(prevPct, newPct)`; if non-null, fire-and-forget `loreCardsStore.maybeUnlockForMilestone(bookId, milestone, currentPage)` via Promise chain — must never await in the UI path (FR-009, FR-010).
- [ ] T017 [US1] Add `loreForBook`, `hasUnseenLore`, `randomLoreForBook`, `allLore` read helpers to `src/stores/loreCards.ts` (per lore-api.md § Read helpers).

**Checkpoint**: Milestone crossing generates a DB row end-to-end with zero UI surfaces yet. Verifiable via Supabase Studio + DevTools Network tab. Smokes 1, 3, 4, 5, 6 pass.

---

## Phase 4: User Story 2 — The Great Library (Priority: P1)

**Goal**: Rename Lexicon to Great Library and add a Lore Cards tab alongside the existing Lexicon tab, with a shared book filter.

**Independent Test**: Bottom-nav shows "Great Library"; tapping opens the two-tab view at `/lexicon`; existing Lexicon functionality is 100% unchanged in its tab; Lore Cards tab shows all unlocked lore for the filtered book with empty state when none. (Smokes 7, 8, 9.)

### Implementation for User Story 2

- [ ] T018 [P] [US2] Change the bottom-nav label in `src/components/shared/AppBottomNav.vue` line ~73 from "Lexicon" to "Great Library" (icon/path/active-detection unchanged — FR-012, FR-018).
- [ ] T019 [US2] Rename `src/pages/LexiconPage.vue` → `src/pages/GreatLibraryPage.vue`; update the route definition in `src/router/index.ts` to import the new filename while keeping `path: '/lexicon'` and `name: 'lexicon'` unchanged (URL stability — per ui-contracts.md § 2).
- [ ] T020 [US2] Refactor `GreatLibraryPage.vue` to render PrimeVue `<Tabs>` with "Lexicon" and "Lore Cards" panels; book-filter dropdown lifted above both panels; honour `?tab=lexicon|lore` query param for initial selection (default `lexicon`); preserve `?bookId` on tab switch (FR-013, FR-014).
- [ ] T021 [US2] Ensure the existing Lexicon UI is moved verbatim into the first TabPanel with zero behavioural changes (add/edit/delete/Leitner all still wired — Smoke 7 step 4).
- [ ] T022 [P] [US2] Implement `fetchLoreForAllBooks()` action in `src/stores/loreCards.ts` with SWR via `cacheKeys.loreAll`, TTL 120_000 ms, partition results into `loreByBook` by `book_id` (per lore-api.md).
- [ ] T023 [US2] Create `src/components/lore/LoreCardList.vue` with prop `{ bookId?: string }`: on mount calls `fetchLoreForBook` or `fetchLoreForAllBooks`; renders cards sorted by `createdAt` desc; each card shows title, type badge, milestone chip, 120-char excerpt; inline-expand (no modal) to show `<LoreCardDetail>`; empty-state message "Keep reading to unlock your first lore card." (FR-015, FR-016, FR-017).
- [ ] T024 [P] [US2] Create `src/components/lore/LoreCardDetail.vue` with prop `{ card: LoreCard }` — pure presentational: prominent title, colour-coded type badge (History indigo, Myth amber, Geography emerald), body with line-height 1.6 max 680px, "Mentions:" chip row, "Unlocked on {date} at {milestone}%" footer (per ui-contracts.md § 4).
- [ ] T025 [US2] Wire `<LoreCardList :book-id="selectedBookId" />` into the Lore Cards TabPanel of `GreatLibraryPage.vue`.

**Checkpoint**: Users can browse all unlocked lore via the renamed library. Smokes 7, 8, 9 pass. Lore generated in Phase 3 is now visible.

---

## Phase 5: User Story 3 — Discovery Card on Book Detail (Priority: P2)

**Goal**: A small elegant "Lore Chronoscope" card on the Book Detail Page surfaces a random unlocked lore, with refresh + deep-link into the Great Library.

**Independent Test**: Open a book detail page with ≥ 2 unlocked cards — a card renders immediately (no skeleton on return visits), refresh cycles between them, clicking the body navigates to `/lexicon?bookId=<id>&tab=lore`. (Smokes 10, 15.)

### Implementation for User Story 3

- [ ] T026 [P] [US3] Create `src/components/lore/LoreChronoscopeCard.vue` with prop `{ bookId: string }`: on mount calls `loreCardsStore.fetchLoreForBook(bookId)` (SWR — cheap on return); local `ref` holds currently displayed card seeded from `randomLoreForBook`; render skeleton only when store is `loading` AND no cache (one-time); hide entirely when no lore exists; show title + type badge + 120-char ellipsised excerpt + refresh icon (per ui-contracts.md § 1).
- [ ] T027 [US3] Refresh-icon behaviour in `LoreChronoscopeCard.vue`: disabled when exactly 1 card; `@click.stop` picks a different random card from `loreForBook(bookId)` (never the current one when >1 exist); must NOT navigate.
- [ ] T028 [US3] Card-body click handler in `LoreChronoscopeCard.vue`: navigates to `/lexicon?bookId=<bookId>&tab=lore` via `router.push` (FR-023).
- [ ] T029 [US3] Integrate `<LoreChronoscopeCard :book-id="bookId" />` in `src/pages/BookDetailPage.vue` between the Progress section and the Recap section (per ui-contracts.md § 8).
- [ ] T030 [US3] Verify return-navigation instant render (SC-005): card must mount within 100 ms when cache is fresh. Validate via DevTools perf trace during Smoke 15.

**Checkpoint**: Discovery surface is live. Smokes 10, 15 pass.

---

## Phase 6: User Story 4 — Notifications & Chip (Priority: P2)

**Goal**: Toast fires on unlock; "New Lore" chip persists on the Library book card until the user visits that book's detail page; dismissal is server-side (cross-device) and permanent for that milestone.

**Independent Test**: Cross a milestone while not on the triggering book's detail page → toast fires, chip appears on Library card. Tap chip → navigates to detail page, chip clears. Chip state survives sessions and syncs across devices. (Smokes 11, 12, 13, 14.)

### Implementation for User Story 4

- [ ] T031 [US4] Confirm toast fires inside `maybeUnlockForMilestone` (added in T015) with `{severity: 'success', summary: 'New Lore Unlocked', detail: book.title, life: 4000}` — only on successful insert, never on error/duplicate/no-recap branches (FR-025, ui-contracts.md § 6).
- [ ] T032 [US4] Implement `markBookLoreSeen(bookId)` action in `src/stores/loreCards.ts` per lore-api.md § markBookLoreSeen: short-circuit if no unseen cards; `UPDATE lore_cards SET seen = TRUE WHERE book_id = ? AND seen = FALSE` (RLS handles `user_id`); on success mutate local `c.seen = true` for those rows; `swrTouch` both keys (FR-027, FR-028).
- [ ] T033 [US4] Call `loreCardsStore.markBookLoreSeen(bookId)` inside `onMounted` of `src/pages/BookDetailPage.vue` (idempotent — safe on every mount).
- [ ] T034 [P] [US4] Add "New Lore" chip overlay to `src/components/library/BookCard.vue`: top-right sparkle chip bound to `loreCardsStore.hasUnseenLore(book.id)`; clicking chip does `stopPropagation` + navigates to Book Detail Page; disappears reactively when `markBookLoreSeen` flips state (FR-026, ui-contracts.md § 5).
- [ ] T035 [US4] Ensure `fetchLoreForAllBooks` is called on Library page mount (or reused from cache) so `hasUnseenLore` is computable for every visible book card. If not already fetched elsewhere, add a cheap SWR call on `LibraryPage.vue` mount.
- [ ] T036 [US4] Verify book-deletion cascade (FR-032): confirm the existing delete-book flow does not require changes because DB FK `ON DELETE CASCADE` handles `lore_cards` automatically. Smoke 14 validates.

**Checkpoint**: Full discovery loop complete. Smokes 11, 12, 13, 14 pass. All four user stories shipped.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T037 [P] Run `npx vitest run tests/unit/masterRecap.spec.ts tests/unit/milestoneDetect.spec.ts` — must be zero failures (quickstart.md § Unit test targets).
- [ ] T038 [P] Execute full quickstart.md smoke playbook (Smokes 1–15) and tick off in a checklist; file any regressions immediately.
- [ ] T039 [P] Verify regression checklist: feature 006 smokes still pass; `generate-recap` edge function untouched; `rg "useCache|swr\(|mutate\(|invalidate\(" src/stores/recaps.ts` confirms streaming paths unchanged.
- [ ] T040 Check bundle-size delta: `npm run build` then confirm gzipped `dist/assets/*.js` delta < 10 KB vs. baseline (constitution gate).
- [ ] T041 Run Lighthouse PWA audit — score must be ≥ 90 (constitution gate V).
- [ ] T042 [P] Grep audit for FR-009 (AI only called from edge function): `rg "gemini|generativeai" src/` must yield zero hits — AI exclusion holds.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1. Blocks Phases 3–6.
- **Phase 3 (US1)**: Depends on Phase 2. Blocks visible surfaces in US2/US3/US4 (nothing to display without generation).
- **Phase 4 (US2)**: Depends on Phase 2; fully functional once Phase 3 has generated any row.
- **Phase 5 (US3)**: Depends on Phase 2; same display dependency on Phase 3.
- **Phase 6 (US4)**: Depends on Phase 2 + T031 (toast lives inside T015).
- **Phase 7 (Polish)**: Depends on all prior phases.

### User Story Dependencies

- US1 is the engine; US2/US3/US4 are presentation layers on top. Each presentation layer can be developed in parallel after Phase 2 but only demonstrates end-to-end value once US1 is shipped.

### Within Each User Story

- Unit tests (US1) precede helper-consuming logic.
- Store actions before components that consume them.
- Components before integration into pages.

### Parallel Opportunities

- T001, T002, T003, T004 all parallel (different files).
- T006, T007 parallel with T005 start (T008/T009 need store file exists first).
- T010, T011 parallel with T012+ (tests vs. edge function).
- T018, T022, T024, T026, T034, T042 all [P] within their phases.

---

## Parallel Example: Phase 1

```bash
# All four setup tasks run simultaneously:
Task T001: Add LoreType, LoreCardRow, LoreCard, mapLoreCard to src/types/index.ts
Task T002: Extend cacheKeys in src/composables/useCache.ts
Task T003: Create src/utils/masterRecap.ts
Task T004: Create src/utils/milestoneDetect.ts
```

## Parallel Example: Phase 4 (US2) components

```bash
Task T022: fetchLoreForAllBooks action in src/stores/loreCards.ts
Task T024: src/components/lore/LoreCardDetail.vue
# T023 (LoreCardList) runs after T024 lands because it imports it.
```

---

## Implementation Strategy

### MVP (Ship US1 alone)

1. Phase 1 → Phase 2 → Phase 3.
2. Validate via Supabase Studio + DevTools Network that rows land correctly and no spoilers leak.
3. Nothing visible in the UI yet — but the engine is live and accruing cards.

### Incremental Delivery

1. Phase 1 + 2 → foundation.
2. + Phase 3 (US1) → engine live.
3. + Phase 4 (US2) → users can browse generated lore. **First shippable feature.**
4. + Phase 5 (US3) → delight on Book Detail.
5. + Phase 6 (US4) → proactive discovery loop closed.
6. + Phase 7 → ship.

### Parallel Team Strategy

After Phase 2 checkpoint:

- Dev A: Phase 3 (US1 — generation engine).
- Dev B: Phase 4 (US2 — Great Library shell) using mock lore data until US1 lands.
- Dev C: Phases 5 + 6 (US3, US4 — surfaces on existing pages) using mock data.

All three converge at Phase 7.

---

## Notes

- [P] = different file, independent — safe to fan out.
- Every user story is independently testable via the quickstart smokes.
- `maybeUnlockForMilestone` MUST never throw — verify via unit-grep for uncaught awaits inside it.
- Chip/seen state is server-authoritative (FR-028, Smoke 12).
- URL `/lexicon` is preserved intentionally — do NOT rename the route path, only the label + component file.
