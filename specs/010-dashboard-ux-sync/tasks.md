# Tasks: Dashboard UX & Lore Sync

**Input**: Design documents from `specs/010-dashboard-ux-sync/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- No test tasks (not requested in spec)

---

## Phase 1: Setup

**Purpose**: No new dependencies or project initialisation required. Existing Vue SPA + Pinia stores are the target. This phase confirms pre-conditions before foundational work begins.

- [X] T001 Confirm src/components/lore/LoreChronoscopeCard.vue exists and renders correctly in dev server (no broken imports)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared composable and service changes that all user stories depend on. MUST complete before any user story work begins.

**⚠️ CRITICAL**: US1, US2, US3, and US4 all depend on this phase completing first.

- [X] T002 [P] Create src/composables/useRecapLock.ts — exports `useRecapLock(bookId: Ref<string> | string)` returning `{ recapLocked, recapLockedByPages, pagesUntilUnlock, daysSinceLastSession }` as `ComputedRef` values. Lock formula: `lastRecapPct = latestRecap?.progressSnapshot ?? 0`, `unlockPage = Math.ceil((lastRecapPct + 5) / 100 * totalPages)`, `recapLockedByPages = lastRecapPct > 0 && currentPage < unlockPage`, `recapLocked = recapLockedByPages && daysSince < 3`. Use `useProgressStore` and `useRecapsStore` internally. Accept both `Ref<string>` and plain `string` via `toValue()` / `isRef` pattern.
- [X] T003 [P] Update src/services/recapService.ts — add `export type StreamRecapResult = StreamingRecap & { aborted: boolean }`. Add optional `signal?: AbortSignal` third parameter to `streamRecap`. Pass `{ signal }` to the `fetch` call. In the read loop, after each `reader.read()`, check `if (signal?.aborted)` and return `{ ...emptyResult, aborted: true }` without throwing. Wrap `reader.read()` in try/catch for `AbortError` (name === 'AbortError') and return the same aborted result. Change return type from `StreamingRecap` to `StreamRecapResult`.
- [X] T004 Update src/stores/recaps.ts — change `generateRecap(bookId: string)` signature to `generateRecap(bookId: string, signal?: AbortSignal)`. Pass `signal` as third arg to `streamRecap(...)`. After `streamRecap` resolves, add: `if (result.aborted) { generationStatus.value = 'idle'; streamingText.value = ''; return }` BEFORE the Supabase insert block. Update the import from recapService to include `StreamRecapResult`. (Depends on T003)
- [X] T005 [P] Verify src/stores/loreCards.ts — confirm the `useToast` import and `toast.add(...)` success call after lore insert are REMOVED. If present, remove the import line, the `const toast = useToast()` line, and the `toast.add({ severity: 'success', ... })` call. Replace with the comment: `// FR-010: success toast removed — dashboard inline card handles arrival display.`

**Checkpoint**: `useRecapLock` composable exists, `recapService` supports AbortSignal, `recaps` store passes signal, toast removed from loreCards.

---

## Phase 3: User Story 1 — View Book Navigation (Priority: P1) 🎯 MVP

**Goal**: "View Library" button becomes "View Book" and navigates directly to Book Details.

**Independent Test**: Tap the button on Dashboard — lands on `/books/:id` (Book Details) for the active book, not the Library list. (quickstart.md Smoke Test 1)

- [X] T006 [US1] Update the "View Library" Button in src/pages/DashboardPage.vue — change `label="View Library"` to `label="View Book"`, change `icon="pi pi-th-large"` to `icon="pi pi-book"`, change the `@click` handler from `router.push('/library')` to `router.push({ name: 'book-detail', params: { id: currentBook!.id } })`.

**Checkpoint**: "View Book" button navigates to Book Details for the active book.

---

## Phase 4: User Story 2 — Inline Recap Streaming on Dashboard (Priority: P1)

**Goal**: "Get Recap" streams inline below the hero card with lock-gate parity. Completed recaps are persisted. Mid-stream dismiss aborts without saving. Navigation clears session state.

**Independent Test**: Tap "Get Recap" — stream appears inline (no navigation). Complete stream appears in history. Dismiss mid-stream → no history entry. Navigate away → stream panel gone. (quickstart.md Smoke Tests 2–6)

- [X] T007 [US2] Add script setup changes in src/pages/DashboardPage.vue — add these imports: `watch, onUnmounted` to the vue import; `useRecapsStore` import from `@/stores/recaps`; `RecapStream` from `@/components/recap/RecapStream.vue`; `useRecapLock` from `@/composables/useRecapLock`. Add to script setup: `const recapsStore = useRecapsStore()`, session refs `const recapTriggered = ref<boolean>(false)` and `const recapAbortController = ref<AbortController | null>(null)`. Add `const { recapLocked, pagesUntilUnlock } = useRecapLock(computed(() => currentBook.value?.id ?? ''))`. Add `handleGetRecap` arrow function: creates `new AbortController()`, stores in `recapAbortController.value`, sets `recapTriggered.value = true`, calls `recapsStore.resetStatus()`, awaits `recapsStore.generateRecap(currentBook.value!.id, abort.signal)`. Add `handleRecapDismiss` arrow function: calls `recapAbortController.value?.abort()`, sets `recapAbortController.value = null`, `recapTriggered.value = false`, `recapsStore.resetStatus()`.
- [X] T008 [US2] Add lifecycle hooks in src/pages/DashboardPage.vue — inside the existing `onMounted` block, after `loreStore.fetchLoreForAllBooks()`, add: `if (currentBook.value) recapsStore.fetchRecapsForBook(currentBook.value.id).catch(() => {})`. Add `onUnmounted(() => { if (recapTriggered.value) handleRecapDismiss() })`.
- [X] T009 [US2] Update recap button in src/pages/DashboardPage.vue template — replace the existing `<Button label="Get Recap" ...>` with two conditional buttons inside the `dashboard__actions` div: (1) `<Button v-if="!recapTriggered && recapLocked" :label="\`🔒 \${pagesUntilUnlock} more pages\`" disabled class="dashboard__action-btn dashboard__action-btn--locked" v-tooltip.top="'You unlock a new recap every 5% of progress, or after 3 days away'" />` and (2) `<Button v-else :label="recapTriggered ? 'Recap open ↓' : 'Get Recap'" icon="pi pi-sparkles" class="dashboard__action-btn" :disabled="recapTriggered" @click="handleGetRecap" />`.
- [X] T010 [US2] Add inline recap panel in src/pages/DashboardPage.vue template — after the closing `</article>` tag of the hero card (`dashboard__current`), add: `<div v-if="recapTriggered" class="dashboard__inline-panel glass-surface"><div class="dashboard__inline-panel-header"><span class="dashboard__inline-panel-title">AI Recap</span><button class="dashboard__inline-dismiss" aria-label="Dismiss recap" @click="handleRecapDismiss"><i class="pi pi-times" /></button></div><RecapStream :bookId="currentBook!.id" /></div>`. Add CSS for `.dashboard__inline-panel`, `.dashboard__inline-panel-header`, `.dashboard__inline-panel-title`, `.dashboard__inline-dismiss`, and `.dashboard__action-btn--locked` (opacity: 0.55, cursor: not-allowed) in the scoped `<style>` block.

**Checkpoint**: Get Recap streams inline, lock gate works, completed recaps in history, dismiss aborts cleanly, navigation clears state.

---

## Phase 5: User Story 3 — Collapsible Lore Card on Book Details (Priority: P2)

**Goal**: Lore card on Book Details is collapsible (expand/collapse inline), cycle button preserved, and new lore arrivals appear reactively without page refresh.

**Independent Test**: Open Book Details with lore → card is clickable to expand/collapse. Trigger background lore generation → card updates without navigation. (quickstart.md Smoke Tests 7–8)

- [X] T011 [US3] Audit and fix src/components/lore/LoreChronoscopeCard.vue — confirm ALL of the following are present; fix any that are missing: (a) `currentCardIndex = ref<number>(0)`, (b) `cards = computed(() => loreStore.loreForBook(props.bookId))`, (c) `currentCard = computed<LoreCard | null>(...)` using `Math.min/max` clamp on `currentCardIndex`, (d) `watch(() => cards.value.length, (newLen, oldLen) => { if (newLen > (oldLen ?? 0)) currentCardIndex.value = newLen - 1 })` for reactive arrival, (e) collapsible template with `.lore-card` div using `@click="toggleExpand"`, chevron icon, `LoreCardDetail` for expanded state, excerpt for collapsed state, (f) cycle button with `@click.stop="onRefresh"` that sets `isExpanded.value = true`.
- [X] T012 [US3] Refactor recap lock logic in src/pages/BookDetailPage.vue to use the shared composable — replace the inline `lastRecapPct`, `unlockPage`, `recapLockedByPages`, `daysSinceLastSession`, `recapLocked`, `pagesUntilUnlock` computed declarations with `const { recapLocked, recapLockedByPages, pagesUntilUnlock, daysSinceLastSession } = useRecapLock(bookId)`. Add `useRecapLock` to the imports from `@/composables/useRecapLock`. Remove the `RECAP_TIME_UNLOCK_DAYS` constant and the 6 computed declarations it powered.
- [X] T013 [US3] Confirm src/pages/BookDetailPage.vue has `<LoreChronoscopeCard :book-id="bookId" :collapsible="true" :initial-collapsed="false" />` in the template between the Progress section and the Recap section. If missing or using wrong props, add/update it. Confirm `LoreChronoscopeCard` is imported at the top of the script setup.

**Checkpoint**: Lore card on Book Details expands/collapses inline, cycles cards, reacts to new arrivals without refresh.

---

## Phase 6: User Story 4 — Global "New Lore" Indicator Sync (Priority: P2)

**Goal**: "New Lore" chip clears automatically when the user visits Book Details (markBookLoreSeen fires on mount). Dashboard shows the LoreChronoscopeCard inline when unseen lore exists, so user can read lore without navigating to Book Details.

**Independent Test**: Generate new lore → chip visible on Dashboard → tap "View Book" → return to Dashboard → chip gone. (quickstart.md Smoke Test 9)

- [X] T014 [US4] Add LoreChronoscopeCard to src/pages/DashboardPage.vue — add import `LoreChronoscopeCard` from `@/components/lore/LoreChronoscopeCard.vue`. In the template, after the inline recap panel (`v-if="recapTriggered"` div) and before `<WordOfTheDay />`, add: `<LoreChronoscopeCard v-if="currentBook && loreStore.hasUnseenLore(currentBook.id)" :book-id="currentBook.id" :collapsible="true" />`. This renders the collapsible lore card on the Dashboard when unseen lore exists; `hasUnseenLore` is reactive and clears automatically when `markBookLoreSeen` runs on Book Details mount.
- [X] T015 [US4] Confirm src/pages/BookDetailPage.vue calls `loreStore.markBookLoreSeen(bookId.value)` in `onMounted` — this clears the seen flags, making `hasUnseenLore` reactive across all components. If missing, add `await loreStore.markBookLoreSeen(bookId.value)` to the `onMounted` block after `lexiconStore.fetchEntriesForBook`.

**Checkpoint**: "New Lore" chip on Dashboard disappears after visiting Book Details. Lore card is visible inline on Dashboard when unseen lore exists.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T016 Run TypeScript check with `npx tsc --noEmit` from the project root and fix any type errors introduced by T001–T015 (pay special attention to `useRecapLock` generic bookId type, `StreamRecapResult` import in recaps store, and `AbortController` refs in DashboardPage)
- [X] T017 [P] Execute quickstart.md Smoke Tests 1–9 in the running dev server and confirm all pass
- [X] T018 [P] Execute quickstart.md Regression Checks 1–2 (BookDetailPage recap unchanged, no success toast)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2; independent of US2/US3/US4
- **US2 (Phase 4)**: Depends on Phase 2 and Phase 3 (same file, US1 change must land first)
- **US3 (Phase 5)**: Depends on Phase 2; independent of US1/US2/US4
- **US4 (Phase 6)**: Depends on Phase 2, Phase 3, and Phase 4 (all DashboardPage changes must be applied before adding lore card)
- **Polish (Phase 7)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational — no story dependencies
- **US2 (P1)**: Starts after US1 lands (same file — apply in order)
- **US3 (P2)**: Can start after Foundational — independent of US1/US2 (different files: LoreChronoscopeCard.vue, BookDetailPage.vue)
- **US4 (P2)**: Starts after US2 lands (same DashboardPage.vue file)

### Within Each Phase

- T002, T003, T005 are parallel (different files)
- T004 depends on T003
- T007, T008, T009, T010 are sequential (same file, logical order: script → lifecycle → template button → template panel)
- T011, T012, T013 can run in parallel (different files: LoreChronoscopeCard.vue, BookDetailPage.vue x2)
- T014, T015 can run in parallel (different files: DashboardPage.vue, BookDetailPage.vue)

### Parallel Opportunities

```text
Phase 2: T002 ║ T003 ║ T005  (then T004 after T003)
Phase 5: T011 ║ T012 ║ T013
Phase 6: T014 ║ T015
Phase 7: T017 ║ T018
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1 Setup
2. Complete Phase 2 Foundational (T002–T005)
3. Complete Phase 3 US1 (T006) — "View Book" button
4. Complete Phase 4 US2 (T007–T010) — inline recap streaming
5. **Validate**: Smoke Tests 2–6 from quickstart.md
6. Merge if US1 + US2 are production-ready

### Incremental Delivery

1. Foundation → US1 (T001–T006) — 1-tap navigation MVP
2. Add US2 (T007–T010) — inline streaming
3. Add US3 (T011–T013) — lore collapsible
4. Add US4 (T014–T015) — global seen sync
5. Polish (T016–T018)

### Files Changed Summary

| File | Phase | Change Type |
|------|-------|-------------|
| `src/composables/useRecapLock.ts` | 2 | NEW |
| `src/services/recapService.ts` | 2 | MODIFY |
| `src/stores/recaps.ts` | 2 | MODIFY |
| `src/stores/loreCards.ts` | 2 | MODIFY (verify) |
| `src/pages/DashboardPage.vue` | 3, 4, 6 | MODIFY (major) |
| `src/components/lore/LoreChronoscopeCard.vue` | 5 | VERIFY/FIX |
| `src/pages/BookDetailPage.vue` | 5, 6 | MODIFY (minor) |

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps task to specific user story for traceability
- DashboardPage.vue tasks (T006–T010, T014) must be applied in order — sequential in the same file
- T011 (LoreChronoscopeCard) may already be complete from prior session — audit first, fix only what's missing
- T015 (BookDetailPage markBookLoreSeen) — already exists per code review; verify it's in onMounted
- Run `npx tsc --noEmit` after EVERY foundational change to catch type drift early
