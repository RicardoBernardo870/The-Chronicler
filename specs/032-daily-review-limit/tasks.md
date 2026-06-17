---
description: "Task list for 032-daily-review-limit"
---

# Tasks: Daily Review Limit & Backlog Smoothing

**Input**: Design documents from `/specs/032-daily-review-limit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/. Builds on **031-vocab-graduation** (mastered exclusion already on this branch).

**Tests**: Lightweight unit tests are included in Polish (quickstart calls for them). Not test-first.

**Organization**: Tasks grouped by user story. US1 + US2 (both P1) together form the MVP; US3 (P2) and US4 (P3) are additive.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on incomplete tasks → can run in parallel.
- File paths are exact and relative to repo root.

## Path Conventions

- Web app (Vue front end + Supabase BaaS): code under `src/`, migration under `supabase/migrations/`, unit tests under `tests/unit/`.

---

## Phase 1: Setup (Schema + Types Foundation)

**Purpose**: The `last_reviewed_at` column and its type plumbing.

- [X] T001 Create migration `supabase/migrations/20260618_lexicon_last_reviewed.sql`: `alter table public.lexicon_entries add column if not exists last_reviewed_at timestamptz;` (nullable; no index; existing owner RLS covers it; existing rows null). **Migration file authored; applying it to the remote Supabase project is pending (outward action — left for the user).**
- [X] T002 [P] In `src/types/index.ts`, add `lastReviewedAt: string | null` to `LexiconEntry` and `last_reviewed_at: string | null` to `LexiconEntryRow`, and map it in `mapLexiconEntry` (`lastReviewedAt: row.last_reviewed_at ?? null`). `LexiconSearchResult` inherits it.

**Checkpoint**: `last_reviewed_at` exists end-to-end (DB + types).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Stamp reviews and provide the shared tally primitives every story needs.

**⚠️ CRITICAL**: No user-story phase can begin until this phase is complete.

- [X] T003 In `src/stores/lexicon.ts`, stamp `last_reviewed_at = new Date().toISOString()` on every review: add it to the `UPDATE` payload **and** the optimistic in-memory entry in both `updateLeitner` (advance/reset) and `masterWord`. Rollback already restores the snapshot. (Depends on T002.)
- [X] T004 In `src/stores/lexicon.ts`, add the shared tally primitives: export const `DAILY_REVIEW_LIMIT = 20`; computeds `reviewedTodayCount` (entries with `lastReviewedAt >= local midnight`) and `dailyRemaining` (`max(0, 20 - reviewedTodayCount)`); a `reviewMore` ref (default false) and `enableReviewMore()` action; export all. (Same file as T003 → after T003.)

**Checkpoint**: Reviews are timestamped and the day's tally/remaining are derivable.

---

## Phase 3: User Story 1 - Returning after absence is not overwhelming (Priority: P1) 🎯 MVP

**Goal**: The Word of the Day card presents at most `dailyRemaining` (≤20) words for the day, framed as an achievable target, and reaches a "caught up for today" state at the limit.

**Independent Test**: With ~100+ due, the dashboard shows a capped count (not the backlog), counts down across advances, and stops the daily set at 20 — reviewed words don't recur the same day.

- [X] T005 [US1] In `src/stores/lexicon.ts`, add `eligibleReviewWords` (entries that are due `nextReviewAt <= today` **and** `!mastered` **and** not reviewed today), `todaysReviewSet` = `eligibleReviewWords.slice(0, dailyRemaining)`, `activeReviewWords` = `reviewMore ? eligibleReviewWords : todaysReviewSet`, and `extraAvailable` = `eligibleReviewWords.length > todaysReviewSet.length`; export them. Change `resolveWordOfTheDay` to pick `activeReviewWords[0]` (instead of `getDueWord(allEntries)`) and distinguish "caught up for today" (`todaysReviewSet` empty but `extraAvailable`) from "all caught up". (`getDueWord` becomes unused — leave or remove.) (Depends on T004.)
- [X] T006 [US1] In `src/components/dashboard/WordOfTheDay.vue`, source the remaining-count from `activeReviewWords.length` (framed "X of 20 today"); add a "caught up for today" state (distinct from "all caught up") shown when `todaysReviewSet` is empty but `extraAvailable` is true. Advance behavior unchanged. (Depends on T005.)

**Checkpoint**: The dashboard never presents the raw backlog; the day caps at 20.

---

## Phase 4: User Story 2 - The flashcard session honors the same daily set (Priority: P1) 🎯 MVP

**Goal**: The Anki session draws from the same shared capped set, so both surfaces agree on what's left for today.

**Independent Test**: With >20 due, the session deck is drawn from the shared set (≤20); reviewing in the session is reflected in the dashboard's remaining-count.

- [X] T007 [US2] In `src/composables/useAnkiSession.ts`, change `dueCards` to consume `lexiconStore.activeReviewWords` (already capped + mastered/reviewed-today excluded), re-ordered highest-box-first (`b.leitnerBox - a.leitnerBox`) and `slice(0, 20)`. `onKnew` (master) / `onDidntKnow` (reset) unchanged — both now also stamp `last_reviewed_at` via the store. (Depends on T005.)

**Checkpoint**: Both surfaces share one capped today's-set (MVP complete: US1 + US2).

---

## Phase 5: User Story 3 - Most fragile words come first (Priority: P2)

**Goal**: When due words exceed the limit, the set is filled lowest-box first, ties broken by most overdue.

**Independent Test**: With low- and high-box overdue words exceeding the limit, today's set contains the lowest-box words first.

- [X] T008 [US3] In `src/stores/lexicon.ts`, sort `eligibleReviewWords` by `leitnerBox` ascending, then `nextReviewAt` ascending (lowest box → most overdue), so `todaysReviewSet` admits the most fragile words first. (Modifies the T005 computed.)

**Checkpoint**: The capped set is the *right* 20.

---

## Phase 6: User Story 4 - Power readers can keep going (Priority: P3)

**Goal**: A "review more" affordance lets the reader voluntarily review beyond the daily limit, on either surface.

**Independent Test**: After finishing today's set, "Review more" surfaces additional due words (same priority order) beyond the limit.

- [X] T009 [P] [US4] In `src/components/dashboard/WordOfTheDay.vue`, add a "Review more" action in the "caught up for today" state that calls `lexiconStore.enableReviewMore()` (then the card resumes from `activeReviewWords`). (Depends on T006, T004.)
- [X] T010 [P] [US4] In `src/pages/AnkiReviewPage.vue`, add a "Review more" action in the summary/empty state shown when the session's set is done but `lexiconStore.extraAvailable` is true; it calls `enableReviewMore()` and rebuilds the deck. (Depends on T007, T004.)

**Checkpoint**: The limit is a default target, not a hard wall; all stories functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Tests and end-to-end validation.

- [X] T011 [P] Add `tests/unit/dailyReviewLimit.spec.ts`: `reviewedTodayCount` counts entries with `lastReviewedAt` within the local day, and `dailyRemaining` = `max(0, 20 − reviewedTodayCount)`. (Set up Pinia; mock `@/services/supabase`.)
- [X] T012 [P] Add `tests/unit/todaysReviewSet.spec.ts`: `eligibleReviewWords` excludes mastered + reviewed-today and sorts lowest-box→most-overdue; `todaysReviewSet` caps at `dailyRemaining`; `activeReviewWords` ignores the cap when `reviewMore` is enabled.
- [X] T013 Automated gates green: `npm test` (76 passing) and `npx vue-tsc -b` (no type errors). Manual `quickstart.md` V1–V9 walkthrough in the running app is pending (requires both the 031 and 032 migrations applied).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 [P] and T002 [P] independent (different files). BLOCKS everything.
- **Foundational (Phase 2)**: T003 after T002; T004 after T003 (same file). BLOCKS all stories.
- **US1 (Phase 3)**: T005 after T004; T006 after T005.
- **US2 (Phase 4)**: T007 after T005 (consumes `activeReviewWords`).
- **US3 (Phase 5)**: T008 modifies T005's computed → after T005.
- **US4 (Phase 6)**: T009 after T006; T010 after T007; both need T004's `enableReviewMore`.
- **Polish (Phase 7)**: after the stories it covers.

### User Story Dependencies

- **US1 (P1)**: the capped set + dashboard. Foundation of everything.
- **US2 (P1)**: consumes US1's `activeReviewWords` for the session.
- **US3 (P2)**: refines US1's selection order (most-fragile-first).
- **US4 (P3)**: adds the escape-hatch UI on both surfaces (store flag is foundational).

### Parallel Opportunities

- T001 + T002 (Setup).
- T009 + T010 (US4) — different files (dashboard card vs Anki page).
- T011 + T012 (Polish) — different test files.

---

## Parallel Example: User Story 4

```bash
# Different files, no incomplete deps between them:
Task: "T009 Review-more action in src/components/dashboard/WordOfTheDay.vue"
Task: "T010 Review-more action in src/pages/AnkiReviewPage.vue"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1 dashboard cap) → Phase 4 (US2 shared session).
3. **STOP and VALIDATE**: quickstart V1–V4, V6 — the dashboard never shows the backlog and the day caps at 20 across both surfaces.

### Incremental Delivery

1. Setup + Foundational → US1 + US2 (MVP) → demo (no more "147").
2. Add US3 (most-fragile-first) → validate V5 → demo.
3. Add US4 (review more) → validate V7 → demo.
4. Polish: unit tests + typecheck + full quickstart.

---

## Notes

- [P] = different files, no incomplete dependencies.
- Soft cap is **non-destructive** — never change `next_review_at`; overflow rolls forward (FR-006).
- The tally is per-account and local-day (derived from `last_reviewed_at`), consistent across devices.
- Selection priority (lowest-box-first, T008) is separate from the Anki deck's presentation order (highest-box-first, from 031).
- Both migrations (031 `mastered`, 032 `last_reviewed_at`) must be applied before V1–V9.
- Arrow functions only (project convention); per-component PrimeVue imports.
