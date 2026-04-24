# Research: Last Session Card (013-session-stats-card)

## Decision 1 — Session State Persistence Strategy

**Decision**: Store the in-progress session start time as a nullable `session_start_at` column on the existing `reading_progress` table (one row per user+book). When a page-save fires, copy the value into the new `progress_history` row and clear it from `reading_progress`.

**Rationale**:
- `reading_progress` already holds per-book mutable state; `session_start_at` fits semantically as "what is the reader doing *right now* with this book."
- Writing to `reading_progress` on "Start Session" satisfies FR-011 (server-persisted immediately) using an existing upsert path — no new table, no extra round-trip pattern.
- Clearing `session_start_at` on page-save keeps `reading_progress` clean and prevents stale session state from bleeding into future reads.
- Alternative (new `active_sessions` table): rejected — extra foreign key join on every progress read for a feature that only needs two nullable columns.
- Alternative (localStorage only): rejected — violates Constitution Principle IV (data must survive browser refresh/device switch).

## Decision 2 — `progress_history` Schema Extension

**Decision**: Add two nullable columns to `progress_history`:
- `session_start_at TIMESTAMPTZ NULL` — the moment the user tapped "Start Session" (copied from `reading_progress.session_start_at` at save time; null for legacy rows).
- `session_note TEXT NULL CHECK (char_length(session_note) <= 160)` — optional reader memo captured post-session.

**Rationale**:
- Nullable columns are fully backwards-compatible; all existing rows simply have `NULL` and the existing `mapProgressHistory` mapper continues to work without change (new fields added as optional).
- Deriving duration = `recorded_at - session_start_at` at read time is accurate and requires no stored derived fields.
- Alternative (separate `session_notes` table): rejected — the note is tightly coupled to the session row; adding a join for a single optional text field is unnecessary complexity.

## Decision 3 — Velocity & Finish Prediction Calculations

**Decision**:
- **Velocity** = `pagesDelta / (durationHours)` where `durationHours = (recorded_at - session_start_at) / 3600000`. Rounded to nearest integer. Falls back to `null` when `session_start_at` is null (legacy row) or `pagesDelta < 1`.
- **Finish prediction** = `Math.ceil(pagesRemaining / rollingAvgVelocityPph)` sessions, where `pagesRemaining = totalPages - currentPage`. Rolling average uses up to the last 3 `progress_history` rows with a non-null `session_start_at` for that book. Displayed as "~N sessions at this pace" when N is computable; hidden when N = 0 or totalPages is unknown.

**Rationale**:
- 3-session rolling average smooths short bursts (a 10-minute sprint that reads 40 pages should not permanently inflate the prediction).
- Using actual `session_start_at` instead of the old gap-between-rows proxy eliminates the systematic overcount that occurs when the user updates their page hours after finishing reading.
- Prediction unit "sessions" rather than "hours" or "days" avoids requiring the user to declare how often they read.

## Decision 4 — "Start Session" Button in Both Entry Points

**Decision**: The "Start Session" / active-session indicator is a shared component (`SessionStartButton.vue`) rendered in:
1. The Dashboard hero book card (existing `LastSessionCard.vue` area or directly on the active-book card).
2. The Book Detail page alongside the page-update control.

Both share the same `useReadingSession(bookId)` composable so tapping "Start" in one location is immediately reflected in the other (reactive Pinia state).

**Rationale**:
- Readers commonly start from the Dashboard for a book they're mid-read; developers working the detail page for new books need the same affordance.
- A shared composable + shared button component avoids duplicated logic.
- Constitution Principle V requires core actions within 2 taps; Start Session from the Dashboard satisfies this.

## Decision 5 — Session Note Capture UX

**Decision**: When a page-save completes (session ends), an inline text field slides in beneath the save confirmation within the same modal/dialog. It is optional (can be dismissed), has a 160-character limit, and submits with a second "Done" tap which writes `session_note` to the `progress_history` row via a lightweight PATCH. If dismissed, the row's `session_note` remains null.

**Rationale**:
- Inline (not a separate modal) reduces friction — the reader is already in a "save" interaction.
- POST-save rather than PRE-save ensures the row exists before the note is written (avoids a race condition where the note dialog appears before the DB write completes).
- 160-character limit enforces the "one sentence" spec requirement and maps to a common mental model (same as Twitter's legacy limit).
- Alternatives: pre-save note capture (rejected — adds friction to the core save flow), separate note screen (rejected — too many taps).
