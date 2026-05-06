# Tasks: Anki Flashcard Review

**Input**: Design documents from `specs/024-anki-flashcard-review/`
**Branch**: `026-anki-flashcard-review`
**Tests**: None (not requested per feature spec)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)

---

## Phase 1: Setup

**Purpose**: Apply the new Supabase schema before any frontend work begins.

- [x] T001 Apply `specs/024-anki-flashcard-review/contracts/supabase-schema.sql` in Supabase — creates `anki_review_sessions` table with RLS and index

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Pinia store and router route must exist before any component can reference them.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create `src/stores/ankiSession.ts` — Pinia store with state `lastReviewedAt: string | null`, `totalSessions: number`, `_loaded: boolean`; action `fetchSession(userId)` selects from `anki_review_sessions` (sets defaults if no row); action `saveSession(userId, known, unknown)` upserts with `ON CONFLICT (user_id) DO UPDATE SET last_reviewed_at = now(), total_sessions = total_sessions + 1, known_count = known_count + $known, unknown_count = unknown_count + $unknown`; computed `isDueForReview` returns `lastReviewedAt === null || daysSince(lastReviewedAt) >= 3`
- [x] T003 [P] Add lazy-loaded `anki-review` route to `src/router/index.ts` inside the auth-guarded layout children array: `{ path: 'anki-review', name: 'anki-review', component: () => import('@/pages/AnkiReviewPage.vue'), meta: { requiresAuth: true } }`
- [x] T004 [P] Call `ankiSessionStore.fetchSession(user.id)` in the auth watcher / app initialisation block in `src/App.vue` (or wherever `progressStore`, `lexiconStore` etc. are hydrated on login) so `isDueForReview` is available on first render

**Checkpoint**: Store hydrates on login, route exists — user story work can now begin

---

## Phase 3: User Story 1 + 5 — Dashboard Prompt Card & WotD Restoration (Priority: P1/P2) 🎯

**Goal**: The Word of the Day card slot shows an Anki prompt card when review is due; reverts to normal WotD after the session.

**Independent Test**: Manually set `lastReviewedAt` to 4 days ago in Supabase for your user row and ensure ≥5 lexicon entries exist. Open the dashboard — the WotD slot should show the Anki prompt card. Tap it → navigates to `/anki-review`. Return to dashboard → WotD card is restored.

- [x] T005 [US1] Add `showAnkiPrompt` computed to `src/components/dashboard/WordOfTheDay.vue`: import `useAnkiSessionStore` and `useLexiconStore`; `const showAnkiPrompt = computed(() => ankiSessionStore.isDueForReview && lexiconStore.allEntries.length >= 5)`
- [x] T006 [US1] Add Anki prompt card as the first `v-if` branch inside the existing `<Transition name="wotd__switch" mode="out-in">` block in `src/components/dashboard/WordOfTheDay.vue` — key `"anki"`, class `wotd wotd--review glass-surface`, role `button`, `@click` navigates to `{ name: 'anki-review' }`, shows a `pi-play` icon, title "Ready for review", hint "Tap to start your flashcard session." — existing `v-else-if="entry && isPreview"` and `v-else-if="entry"` branches are unchanged
- [x] T007 [US1] Add `.wotd--review` CSS block to `src/components/dashboard/WordOfTheDay.vue` scoped styles — border colour `rgba(99, 102, 241, 0.3)`, icon circle background `rgba(99, 102, 241, 0.15)`, icon colour `var(--p-indigo-300)` (mirrors `.wotd--done` pattern using indigo instead of emerald)

**Checkpoint**: Dashboard shows Anki prompt card when due; tapping it navigates correctly; returning from session restores WotD (automatic via `isDueForReview` flipping false once `saveSession` fires)

---

## Phase 4: User Story 2 + 3 — Swipe Review Session & Leitner Updates (Priority: P1)

**Goal**: A full swipe-card review session with real-time drag, card flip, and immediate Leitner updates per card.

**Independent Test**: Navigate to `/anki-review` (temporarily remove the guard or use router.push in devtools). Verify cards load, tap flips the card, swipe right advances Leitner box, swipe left resets to box 1 — check `lexicon_entries` in Supabase to confirm updates.

- [x] T008 [P] [US2] Create `src/composables/useAnkiSession.ts` — accepts `entries: ComputedRef<LexiconEntry[]>` (pass `lexiconStore.allEntries`); computes `dueCards`: filter `entry.nextReviewAt <= today`, sort by `leitnerBox` ASC, slice to 20; reactive refs `currentIndex`, `sessionKnown`, `sessionUnknown`; computed `currentCard` = `dueCards[currentIndex]`, `isComplete` = `currentIndex >= dueCards.length`; action `onKnew()` calls `lexiconStore.updateLeitner(currentCard.id, 'advance')` then increments `sessionKnown` and `currentIndex`; action `onDidntKnow()` calls `lexiconStore.updateLeitner(currentCard.id, 'reset')` then increments `sessionUnknown` and `currentIndex`; action `onExit(userId)` calls `ankiSessionStore.saveSession(userId, sessionKnown, sessionUnknown)` only if `sessionKnown + sessionUnknown >= 1`
- [x] T009 [P] [US2] Create `src/components/anki/SwipeableFlashcard.vue` — props: `entry: LexiconEntry`, `bookTitle: string`; ref `isFlipped`; front face shows `entry.term` + subtle "Tap to reveal" hint; back face shows `entry.definition`, `entry.contextSentence` (if present), source line `bookTitle + page`; tap card body toggles `isFlipped` (CSS `rotateY(180deg)`, `transform-style: preserve-3d`, same pattern as `src/components/lexicon/LexiconCard.vue`); `useSwipe(cardRef, { threshold: 60 })` from VueUse — during swipe bind `transform: translateX(${distanceX}px) rotate(${distanceX * 0.04}deg)` inline style; on swipe end: if `!isFlipped` ignore; if `distanceX > 80` emit `'known'`; if `distanceX < -80` emit `'unknown'`; toggle exit CSS class that slides card off-screen then emit; two PrimeVue `<Button>` controls below card (`severity="success"` "Knew it", `severity="danger"` "Didn't know") — visible only when `isFlipped`, emit same events
- [x] T010 [US2] Create `src/pages/AnkiReviewPage.vue` — imports `useAnkiSession`, `useLexiconStore`, `useAnkiSessionStore`, `useAuthStore`; calls `useAnkiSession(lexiconStore.allEntries)`; renders `<SwipeableFlashcard>` for `currentCard` inside a `<Transition name="card-switch" mode="out-in">`; on `'known'` event calls `onKnew()`; on `'unknown'` event calls `onDidntKnow()`; back-navigation handler calls `onExit(user.id)` then `router.push({ name: 'dashboard' })`; empty state (no due cards): renders "You're all caught up!" card matching `wotd--done` visual style with a "Back to dashboard" PrimeVue `<Button>`

**Checkpoint**: Full review session functional — cards load, flip, swipe, Leitner updates persist in Supabase

---

## Phase 5: User Story 4 — Session Summary (Priority: P2)

**Goal**: After the last card is swiped, a summary screen shows session stats and returns to dashboard.

**Independent Test**: Complete a full session (swipe all due cards). Verify summary screen appears with correct known/unknown counts. Tap return → dashboard with WotD card restored.

- [x] T011 [P] [US4] Create `src/components/anki/AnkiSessionSummary.vue` — props: `total: number`, `known: number`, `unknown: number`; shows session counts in a layout matching app's glass-surface style; motivational message based on `known / total` ratio (e.g. ≥70% → "Great session!", else → "Keep practising!"); PrimeVue `<Button>` "Back to dashboard" emits `'done'`
- [x] T012 [US4] Wire `AnkiSessionSummary` into `src/pages/AnkiReviewPage.vue` — when `isComplete` is `true`, render `<AnkiSessionSummary :total="dueCards.length" :known="sessionKnown" :unknown="sessionUnknown" @done="handleDone" />`; `handleDone` calls `onExit(user.id)` then navigates to dashboard; remove the manual back-navigation handler and replace with `onExit` + navigate (same logic, now shared)

**Checkpoint**: Full end-to-end flow complete — prompt → session → summary → dashboard with WotD restored

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T013 [P] Add `card-switch` transition CSS to `src/pages/AnkiReviewPage.vue` — `enter-from`/`leave-to`: `opacity: 0; transform: translateY(12px)`; duration 180ms ease; mirrors `wotd__switch` pattern
- [x] T014 [P] Add reduced-motion media query block to `src/components/anki/SwipeableFlashcard.vue` — disables flip transform and swipe drag animation (mirrors existing `@media (prefers-reduced-motion: reduce)` block in `WordOfTheDay.vue`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — apply migration first
- **Phase 2 (Foundational)**: Depends on Phase 1 — T002, T003, T004 can all run in parallel
- **Phase 3 (US1+US5)**: Depends on Phase 2 complete (needs `ankiSessionStore.isDueForReview` + route)
- **Phase 4 (US2+US3)**: Depends on Phase 2 complete — T008 and T009 can run in parallel; T010 depends on both
- **Phase 5 (US4)**: Depends on T010 — T011 parallel with nothing, T012 depends on T011
- **Phase 6 (Polish)**: Depends on Phase 5 complete

### User Story Dependencies

- **US1 + US5** (Phase 3): Needs T002 (store) + T003 (route) + T004 (hydration)
- **US2 + US3** (Phase 4): Needs T002 (store for `saveSession`) — independent of Phase 3
- **US4** (Phase 5): Needs T010 (review page exists to wire summary into)

### Parallel Opportunities

- T002, T003, T004 — all Phase 2, all different files
- T005, T006, T007 — all Phase 3, all same file (sequential within phase)
- T008, T009 — both Phase 4, different files (run in parallel)
- T011, T013, T014 — different files (run in parallel)

---

## Parallel Example: Phase 4

```
# Launch in parallel:
Task T008: "Create src/composables/useAnkiSession.ts"
Task T009: "Create src/components/anki/SwipeableFlashcard.vue"

# Then sequentially:
Task T010: "Create src/pages/AnkiReviewPage.vue" (depends on T008 + T009)
```

---

## Implementation Strategy

### MVP (Phases 1–3 only)

1. Apply schema (T001)
2. Create store + route + hydration (T002–T004)
3. Modify WotD card (T005–T007)
4. **Validate**: Anki prompt appears on dashboard, taps navigate to an empty `/anki-review` page
5. Ship or continue to Phase 4

### Full Feature Delivery

1. MVP above
2. Add swipe session (T008–T010) → full review session works
3. Add summary screen (T011–T012) → complete flow
4. Polish (T013–T014) → production-ready
