---
description: "Task list for 031-vocab-graduation"
---

# Tasks: Vocabulary Review Progress & Word Graduation

**Input**: Design documents from `/specs/031-vocab-graduation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Lightweight unit tests are included in Polish because the quickstart calls for them (queue filtering/ordering, due count). Not written test-first — implementation precedes tests.

**Organization**: Tasks grouped by user story. US1 + US2 (both P1) together form the MVP; US3 (P2) is an additive enhancement.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks → can run in parallel.
- File paths are exact and relative to repo root.

## Path Conventions

- Web app (Vue front end + Supabase BaaS): code under `src/`, migration under `supabase/migrations/`, unit tests under `tests/unit/`.

---

## Phase 1: Setup (Schema + Types Foundation)

**Purpose**: The `mastered` column and its type plumbing — every other phase depends on it.

- [X] T001 Create migration `supabase/migrations/20260617_lexicon_mastered.sql`: `alter table public.lexicon_entries add column if not exists mastered boolean not null default false;` (no index; existing owner RLS covers it; existing rows default non-mastered). **Migration file authored; applying it to the remote Supabase project is still pending (outward action — left for the user).**
- [X] T002 [P] In `src/types/index.ts`, add `mastered: boolean` to `LexiconEntry` and `LexiconEntryRow`, and map it in `mapLexiconEntry` (`mastered: row.mastered ?? false`). `LexiconSearchResult` inherits it automatically; `mapSearchResult` already spreads `mapLexiconEntry`.

**Checkpoint**: `mastered` exists end-to-end (DB + types).

---

## Phase 2: User Story 1 - See how many words are left to review (Priority: P1) 🎯 MVP

**Goal**: A live remaining-count on the Word of the Day card (single-word state only), and a human "X of N" position indicator in the Anki session.

**Independent Test**: With N words due, the dashboard card shows a count that decrements per advance to "All caught up" (hidden in caught-up/preview); the flashcard header reads "1 / 15" … "15 / 15".

- [X] T003 [US1] In `src/stores/lexicon.ts`, add and export a `dueTodayCount` computed = number of entries where `mastered === false` and `nextReviewAt <= today` (today = `new Date().toISOString().slice(0,10)`).
- [X] T004 [US1] In `src/components/dashboard/WordOfTheDay.vue`, render a remaining-count (e.g. `{{ dueTodayCount }} left`) next to the "Word of the Day" label **only in the normal single-word review state** — not in the "All caught up"/preview state nor the "Vocabulary Review" CTA state. (Depends on T003.)
- [X] T005 [P] [US1] In `src/pages/AnkiReviewPage.vue`, change the header position indicator from `{{ currentIndex }} / {{ dueCards.length }}` to a 1-based clamped reading `{{ Math.min(currentIndex + 1, dueCards.length) }} / {{ dueCards.length }}`.

**Checkpoint**: Progress is visible on both review surfaces (no dependency on graduation).

---

## Phase 3: User Story 2 - Words graduate so the review pool is finite (Priority: P1) 🎯 MVP

**Goal**: "Knew it" in the Anki session masters a word (any box); mastered words leave every review queue/count but stay in the Great Library with a "Mastered" badge. The Word of the Day arrow still only advances.

**Independent Test**: Answer "Knew it" on any Anki card → that word is gone from the WotD card, the Anki deck, and all due counts, and shows a "Mastered" badge in the Great Library; the WotD arrow never masters.

- [X] T006 [P] [US2] In `src/composables/useLeitner.ts`, make `getDueWord` exclude mastered words — filter `e => e.nextReviewAt <= today && !e.mastered` before sorting. `advanceBox`/`resetBox` unchanged.
- [X] T007 [US2] In `src/stores/lexicon.ts`, add and export a `masterWord(entryId)` action mirroring `updateLeitner`: locate the entry, snapshot, optimistically set `mastered = true`, `update lexicon_entries set mastered = true where id = entryId`, touch `cacheKeys.lexicon(uid, bookId)` + `cacheKeys.lexiconAll(uid)`, roll back on error, and if `_wotdEntryId === entryId` clear the daily WotD cache and call `resolveWordOfTheDay`. (Same file as T003 → run after T003.)
- [X] T008 [US2] In `src/composables/useAnkiSession.ts`, exclude mastered from `dueCards` (add `&& !e.mastered` to the filter) and change `onKnew` to call `lexiconStore.masterWord(card.id)` instead of `updateLeitner(card.id, 'advance')`. `onDidntKnow` stays `updateLeitner(card.id, 'reset')`; session known/unknown counters unchanged. (Depends on T007.)
- [X] T009 [P] [US2] In `src/components/lexicon/LexiconCard.vue`, add a "Mastered" pill (reuse the local `lc-badge` styling) shown when `entry.mastered` is true. (The advance/reset buttons were already removed.)

**Checkpoint**: Graduation works end-to-end; the review pool is now finite. MVP complete (US1 + US2).

---

## Phase 4: User Story 3 - Flashcard session surfaces mature words first (Priority: P2)

**Goal**: The Anki deck orders later-stage (higher-box) due words first, from the same shared due pool.

**Independent Test**: With due words across low and high boxes, the flashcard session presents higher-box words before lower-box ones.

- [X] T010 [US3] In `src/composables/useAnkiSession.ts`, change the `dueCards` sort from `a.leitnerBox - b.leitnerBox` (ascending) to `b.leitnerBox - a.leitnerBox` (descending, later boxes first); keep the `!e.mastered` filter and `.slice(0, 20)` cap. (Same file/computed as T008 → run after T008.)

**Checkpoint**: Deck ordering matches the spec; all three stories functional.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Tests and end-to-end validation.

- [X] T011 [P] Add `tests/unit/leitnerDue.spec.ts`: `getDueWord` returns the lowest-box earliest-due **non-mastered** word and returns null when all due words are mastered.
- [X] T012 [P] Add `tests/unit/ankiDueCards.spec.ts`: `useAnkiSession` `dueCards` excludes mastered words and orders due words highest-box first (cap 20). (Set up Pinia; pass a `computed` entries list.)
- [X] T013 [P] Add `tests/unit/dueTodayCount.spec.ts`: the lexicon store `dueTodayCount` counts only non-mastered entries with `nextReviewAt <= today`.
- [X] T014 Automated gates green: `npm test` (72 passing) and `npx vue-tsc -b` (no type errors). Manual `quickstart.md` V1–V9 walkthrough in the running app is pending (requires the T001 migration applied).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 [P] and T002 [P] are independent (different files). BLOCKS all stories.
- **US1 (Phase 2)**: needs T002. T003 → T004 (same store, then card). T005 [P] independent.
- **US2 (Phase 3)**: needs T002. T006 [P]; T007 after T003 (same file `lexicon.ts`); T008 after T007; T009 [P].
- **US3 (Phase 4)**: needs T008 (same `dueCards` computed) → T010 after T008.
- **Polish (Phase 5)**: after the stories it covers.

### User Story Dependencies

- **US1 (P1)**: independent of graduation — only needs the `mastered` field (to exclude from the count) and the Anki indicator.
- **US2 (P1)**: independent of US1 except both add to `lexicon.ts` (sequence T003 then T007).
- **US3 (P2)**: builds on US2's `dueCards` edit (ordering on top of the mastered filter).

### Parallel Opportunities

- T001 + T002 in parallel (Setup).
- Within US2: T006 (useLeitner) and T009 (LexiconCard) are different files → parallel with the store/anki chain.
- T005 (AnkiReviewPage) parallel with the US1 store/card work.
- All Polish unit tests T011–T013 in parallel.

---

## Parallel Example: User Story 2

```bash
# Different files, no incomplete deps — run together:
Task: "T006 getDueWord excludes mastered in src/composables/useLeitner.ts"
Task: "T009 Mastered badge in src/components/lexicon/LexiconCard.vue"
# (T007 → T008 run in sequence on the store/anki path)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup (migration + types).
2. Phase 2 (US1 progress) + Phase 3 (US2 graduation).
3. **STOP and VALIDATE**: quickstart V1–V6, V8–V9; confirm graduation removes words from every surface and the count counts down.

### Incremental Delivery

1. Setup → US1 (progress visible) → demo.
2. Add US2 (graduation) → the pile becomes finite → demo.
3. Add US3 (deck ordering) → mature-first recall → demo.
4. Polish: unit tests + typecheck + full quickstart.

---

## Notes

- [P] = different files, no incomplete dependencies.
- The Word of the Day arrow and the (now button-less) Great Library card only **advance**; **only** the Anki "Knew it" masters (FR-007/FR-008).
- Mastery is a pure state change — do NOT touch XP, reader level, or Book-Passport vocabulary count (FR-016).
- `mastered` migration must be applied to Supabase before V3–V9 can be validated.
- Arrow functions only (project convention); per-component PrimeVue imports.
