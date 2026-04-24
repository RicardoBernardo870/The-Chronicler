# Tasks: Last Session Card

**Input**: Design documents from `/specs/013-session-stats-card/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create stub files and migration skeleton so all subsequent tasks have a target to write into. Stubs should be minimal — empty exports are fine.

- [X] T001 Create migration file `supabase/migrations/20260424_session_stats.sql` (empty stub)
- [X] T002 [P] Create `src/composables/useReadingSession.ts` (empty stub — export placeholder)
- [X] T003 [P] Create `src/components/session/SessionStartButton.vue` (empty stub — `<script setup>` + empty template)
- [X] T004 [P] Create `src/components/session/SessionNoteField.vue` (empty stub — `<script setup>` + empty template)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema migration and TypeScript type extensions that EVERY user story depends on. Nothing in Phase 3–5 can be implemented correctly until these are done.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Write SQL migration in `supabase/migrations/20260424_session_stats.sql` — `ALTER TABLE reading_progress ADD COLUMN session_start_at TIMESTAMPTZ NULL` and `ALTER TABLE progress_history ADD COLUMN session_start_at TIMESTAMPTZ NULL, ADD COLUMN session_note TEXT NULL CHECK (char_length(session_note) <= 160)`
- [X] T006 [P] Extend TypeScript interfaces in `src/types/index.ts` — add `session_start_at: string | null` to `ReadingProgressRow`; add `session_start_at: string | null` and `session_note: string | null` to `ProgressHistoryRow`; add `sessionStartAt: string | null` to `ReadingProgress`; add `sessionStartAt: string | null` and `sessionNote: string | null` to `ProgressHistory`
- [X] T007 Update `mapProgressHistory` mapper in `src/stores/progress.ts` to map `session_start_at → sessionStartAt` and `session_note → sessionNote` from the DB row to the domain object
- [X] T008 Update `fetchProgress` query in `src/stores/progress.ts` to include `session_start_at` in the Supabase `.select()` column list for `reading_progress`

**Checkpoint**: Foundation ready — `npm run build` passes with the new types; user story implementation can now begin.

---

## Phase 3: User Story 1 — Start & End a Reading Session (Priority: P1) 🎯 MVP

**Goal**: Readers can tap "Start Session" from Dashboard or Book Detail; the start timestamp is immediately persisted to the server; saving pages atomically closes the session and records `session_start_at` on the `progress_history` row.

**Independent Test**: Start a session, wait 2 minutes, save pages, and confirm `progress_history.session_start_at` is non-null and `reading_progress.session_start_at` is null. The Last Session Card shows an elapsed time close to 2 minutes.

### Implementation for User Story 1

- [X] T009 [P] [US1] Implement `useReadingSession(bookId)` composable in `src/composables/useReadingSession.ts` — expose `ReadingSessionState { isActive, startedAt, elapsedSeconds }` derived from Pinia `progressStore`; implement `startSession()` that upserts `session_start_at = NOW()` to `reading_progress`; implement `clearSession()` that sets `session_start_at = null`; run a `setInterval` every second while `isActive` to update `elapsedSeconds`; clear interval on `clearSession()` and `onUnmounted()`
- [X] T010 [P] [US1] Implement `SessionStartButton.vue` in `src/components/session/SessionStartButton.vue` — accept `bookId: string` prop; use `useReadingSession(bookId)`; render "Start Session" button when inactive; render active elapsed-time indicator (e.g., "⏱ 0:03") when `isActive`; emit `conflict` event when `startSession()` returns a conflict warning; disable button while `startSession()` is pending
- [X] T011 [US1] Add `startSession(bookId)` action to `src/stores/progress.ts` — Supabase upsert `{ session_start_at: new Date().toISOString() }` on `reading_progress` where `book_id = bookId AND user_id = userId`; on success update local Pinia state `progress.sessionStartAt`; on failure throw error for composable to handle
- [X] T012 [US1] Update `updateProgress` action in `src/stores/progress.ts` — when inserting the `progress_history` row, include `session_start_at: currentProgress.sessionStartAt` (may be null); after successful insert, clear `reading_progress.session_start_at` to null via a second upsert; update local Pinia state to reflect the cleared field
- [X] T013 [US1] Add `sessionEnded` event emission in `src/stores/progress.ts` — after the `progress_history` row is inserted and `session_start_at` is cleared, emit `{ bookId, historyRowId, sessionStartAt }` via a Pinia event bus or reactive ref so components can react without polling
- [X] T014 [US1] Integrate `SessionStartButton` into `src/pages/DashboardPage.vue` — place button on the hero book card; pass `bookId` prop; handle `conflict` event by showing a PrimeVue `ConfirmDialog` ("You have an unfinished session started at [HH:MM]. Start a new one?") with Cancel / Confirm actions; on Confirm call `startSession()` again
- [X] T015 [US1] Integrate `SessionStartButton` into `src/pages/BookDetailPage.vue` — place button in the page-update area; pass `bookId` prop; handle `conflict` event with same ConfirmDialog pattern as Dashboard; confirm active-session indicator remains visible during the session

**Checkpoint**: User Story 1 is complete. Tapping "Start Session" from both pages sets `reading_progress.session_start_at` on the server. Saving pages writes `session_start_at` to `progress_history` and clears it from `reading_progress`. App restart mid-session still shows elapsed time.

---

## Phase 4: User Story 2 — View Session Metrics on the Last Session Card (Priority: P1)

**Goal**: After a session ends the Last Session Card shows all five metrics — distance (with page range), time, velocity, completion delta, and finish prediction — computed from the precise `session_start_at` timestamps. Legacy rows (null `session_start_at`) show "—" for time-based metrics.

**Independent Test**: After completing a timed session, the Last Session Card displays: correct page range, elapsed time within 1 s of actual, velocity within 1 pph of the mathematical result, completion delta as a percentage of total pages, and a finish prediction that reflects the rolling 3-session average.

### Implementation for User Story 2

- [X] T016 [US2] Extend the `LastSession` interface in `src/composables/useLastSession.ts` — add `startedAt: Date | null`, `startPage: number`, `endPage: number`, `completionDelta: number | null`, `finishPredictionSessions: number | null`, `sessionNote: string | null`; update `durationSeconds` to be derived from `recordedAt - sessionStartAt` when `sessionStartAt` is non-null (previously gap-based estimation)
- [X] T017 [US2] Implement precise `durationSeconds` and `velocityPph` calculations in `src/composables/useLastSession.ts` — `durationSeconds = (new Date(recordedAt) - new Date(sessionStartAt)) / 1000`; `velocityPph = Math.round(pagesDelta / (durationSeconds / 3600))`; both null when `sessionStartAt` is null or `durationSeconds < 60` for velocity; expose `startPage` and `endPage` from the two most recent `progress_history` rows
- [X] T018 [US2] Implement `completionDelta` and `finishPredictionSessions` in `src/composables/useLastSession.ts` — `completionDelta = round((pagesDelta / totalPages) * 100, 1)` (null when `totalPages` is 0 or unknown); `finishPredictionSessions = ceil(pagesRemaining / rollingAvgVelocity)` using rolling average of last ≤3 `progress_history` rows with non-null `session_start_at` for the same book; hide prediction when `pagesDelta < 1` or no velocity available
- [X] T019 [US2] Update `src/components/dashboard/LastSessionCard.vue` — render full metrics grid: Distance ("You read N pages · p. X → p. Y"), Time ("~N minutes" or "—"), Velocity ("N pages/hour" or "—"), Completion ("N% of the book" or hidden when no totalPages), Prediction ("~N more sessions at this pace" or hidden); show "—" in any cell whose value is null; render `sessionNote` below grid (hidden when null); follow existing glass-surface design language; ensure all metrics fit in a single visible area at 375px viewport width

**Checkpoint**: User Stories 1 and 2 are complete. Full end-to-end session flow works and all five metrics are visible on the card.

---

## Phase 5: User Story 3 — End-of-Session Quick Note (Priority: P2)

**Goal**: After a session ends, a short text field appears so the reader can write a one-sentence reminder of where they left off. The note is saved via a separate PATCH and displayed on the Last Session Card.

**Independent Test**: After ending a session, type a note and tap Save. Navigate away and return to the Dashboard. The Last Session Card shows the saved note below the metrics grid.

### Implementation for User Story 3

- [X] T020 [US3] Implement `SessionNoteField.vue` in `src/components/session/SessionNoteField.vue` — accept `historyRowId: string` prop; render a `<textarea>` labelled "Where did you leave off?", placeholder "e.g. Just as the group reaches the mountain pass…", `maxlength="160"`; show character counter when ≥140 chars used; "Save note" button (disabled when empty); "Skip" text link; emit `saved` and `skipped` events; call progress store `saveSessionNote` on Save
- [X] T021 [US3] Add `saveSessionNote(historyRowId, note)` action to `src/stores/progress.ts` — Supabase `UPDATE progress_history SET session_note = note WHERE id = historyRowId AND user_id = userId`; fire-and-forget (no spinner); log errors silently without surface disruption; update local Pinia `progress_history` cache entry if present
- [X] T022 [US3] Wire `SessionNoteField` into the post-save flow in `src/pages/BookDetailPage.vue` — listen for the `sessionEnded` event from the progress store; after the "Saved!" confirmation is shown, render `SessionNoteField` with `historyRowId`; on `skipped` or `saved`, dismiss the note field; do not block the save confirmation on the note field
- [X] T023 [US3] Display `sessionNote` on `src/components/dashboard/LastSessionCard.vue` — render note text below the metrics grid separator when `sessionNote` is non-null; hide the entire note row (no placeholder) when `sessionNote` is null

**Checkpoint**: All three user stories are complete. Full flow: Start Session → read → save → note prompt → note saved → card shows metrics + note.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Offline guard, conflict UX, and documentation updates that apply across multiple stories.

- [X] T024 [P] Add offline guard to `startSession()` in `src/composables/useReadingSession.ts` — check `navigator.onLine` before any server call; if offline, throw a user-friendly error ("You appear to be offline. Start Session requires a connection.") and do NOT set any optimistic local state (per FR-011 and Constitution IV)
- [X] T025 [P] Extract conflict-warning logic in `src/components/session/SessionStartButton.vue` — when `isActive` is already true and the user taps again, emit a `conflictWarning` event with `{ startedAt }` instead of calling `startSession()` directly; the parent page handles the ConfirmDialog and calls `startSession()` again on Confirm (keeps button component free of dialog dependencies)
- [X] T026 [P] Update `CLAUDE.md` — add 013 entry to Active Technologies (TypeScript 6 + Vue 3.5, Pinia 3, PrimeVue 4, Supabase JS v2, VueUse; Supabase PostgreSQL — `reading_progress` + `progress_history` modified) and add 013 one-liner to Recent Changes
- [X] T027 Apply Supabase migration `supabase/migrations/20260424_session_stats.sql` to production via `mcp__supabase__apply_migration` (adds `session_start_at` to both tables and `session_note` to `progress_history`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; all 4 tasks are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **User Story 1 (Phase 3)**: Depends on Phase 2; T009 and T010 are parallel; T011–T015 are sequential within the store (T011 before T012, T012 before T013) then T014/T015 depend on T010 and T013
- **User Story 2 (Phase 4)**: Depends on Phase 2 and Phase 3 (needs `sessionEnded` event and `sessionStartAt` on history rows); T016 → T017 → T018 are sequential; T019 depends on T018
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs `sessionEnded` event and `historyRowId`); T020 and T021 are parallel; T022 depends on both; T023 depends on T019
- **Polish (Phase 6)**: T024/T025 can run after Phase 3 tasks they augment; T026/T027 can run any time after Phase 2

### User Story Dependencies

- **US1 (P1)**: Requires Foundational complete — no dependency on US2/US3
- **US2 (P1)**: Requires Foundational + US1 (needs `session_start_at` flow working end-to-end for accurate testing)
- **US3 (P2)**: Requires US1 (needs `sessionEnded` event and `historyRowId`) — independent of US2

### Within Each User Story

- Store actions before composables that call them
- Composables before components that use them
- Components before page-level integration tasks
- Phase 2 type extensions before any file that imports the new types

### Parallel Opportunities

- All 4 Phase 1 stubs (T001–T004) in parallel
- T006 (types) runs concurrently with T005 (SQL) in Phase 2
- T009 (`useReadingSession`) and T010 (`SessionStartButton`) in parallel once T006 is done
- T024 (offline guard) and T025 (conflict extract) in parallel during Polish
- T026 (CLAUDE.md) and T027 (migration) in parallel during Polish

---

## Parallel Example: User Story 1

```bash
# After Phase 2 is done, launch simultaneously:
Task T009: "Implement useReadingSession.ts composable"
Task T010: "Implement SessionStartButton.vue component"

# Then sequentially:
Task T011: "Add startSession() to progress store"
Task T012: "Update updateProgress() to handle session_start_at"
Task T013: "Add sessionEnded event emission"

# Then in parallel:
Task T014: "Integrate SessionStartButton into DashboardPage.vue"
Task T015: "Integrate SessionStartButton into BookDetailPage.vue"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 Only)

1. Complete Phase 1: Setup (create stubs)
2. Complete Phase 2: Foundational (migration + types + mapper + query)
3. Complete Phase 3: User Story 1 (session start/end lifecycle)
4. **VALIDATE**: Confirm `session_start_at` is written/cleared correctly in DB
5. Complete Phase 4: User Story 2 (metrics card)
6. **STOP and VALIDATE**: Full end-to-end session produces correct metrics on the card
7. Ship MVP — US3 (session note) can follow as a separate increment

### Incremental Delivery

1. Setup + Foundational → Types compile, migration ready
2. User Story 1 → Session lifecycle works, server persistence confirmed (Quickstart Scenarios 1, 6, 9)
3. User Story 2 → All five metrics display correctly (Quickstart Scenarios 1–5, 7, 8, 10)
4. User Story 3 → Note capture and display (Quickstart Scenarios 3, 4)
5. Polish → Offline guard, conflict flow, docs

---

## Notes

- [P] tasks touch different files — no coordination needed between them
- [Story] label maps each task to a specific user story for traceability
- T027 (migration apply) is a deployment action — run once; idempotent `ADD COLUMN IF NOT EXISTS` is preferred
- All new `.vue` files live under `src/components/session/` — new directory, create it in T003/T004
- `useReadingSession` derives its state from Pinia (`progressStore.progressForBook(bookId).sessionStartAt`) so Dashboard and Book Detail always stay in sync without extra polling
- `saveSessionNote` is fire-and-forget per the contract in `contracts/session-note-flow.md` — do not add a loading spinner to the note save action
- Velocity is null (shows "—") when `durationSeconds < 60` OR `pagesDelta < 1` — never divide by zero
