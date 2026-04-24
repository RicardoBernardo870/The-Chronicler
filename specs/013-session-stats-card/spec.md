# Feature Specification: Last Session Card

**Feature Branch**: `013-session-stats-card`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: User description: "The 'Last Session' Card — fitness ring for your brain"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Start & End a Reading Session (Priority: P1)

A reader opens the app, taps "Start Session" before picking up their book, then when they save their updated page number the session is automatically closed. The app records exactly when the session began and ended so all time-based metrics can be calculated precisely.

**Why this priority**: This is the foundational data-capture step. Without explicit session start/end timestamps, none of the new metrics (time, precise velocity, completion delta) are possible. It is the single change that unlocks everything else and must be backwards-compatible with readers who don't tap "Start Session" (legacy flow still works).

**Independent Test**: A reader can tap "Start Session", read for a known number of minutes, save their pages, and see the correct elapsed time displayed in the Last Session Card.

**Acceptance Scenarios**:

1. **Given** a reader has a book in progress, **When** they tap "Start Session" from either the Dashboard book card or the Book Detail page, **Then** a session timer begins and the start timestamp is recorded; both entry points reflect the active-session state immediately.
2. **Given** a session is active, **When** the reader saves their updated current page, **Then** the session is automatically ended, the end timestamp is recorded, and the Last Session Card is updated with the new metrics.
3. **Given** a reader saves pages without having started a session, **Then** the update is accepted normally (backwards-compatible), and the Last Session Card shows only legacy metrics (pages covered, completion %) without time-based ones.
4. **Given** a session is active and the reader closes the app without saving, **Then** on next open the in-progress session timer is still running and visible (the start timestamp was already persisted on the server at the moment "Start Session" was tapped), allowing them to continue or save at any point.

---

### User Story 2 — View Session Metrics on the Last Session Card (Priority: P1)

After ending a session the reader sees the Last Session Card updated with a celebratory, "fitness ring"-style summary showing all the big numbers from their sitting: pages covered, time spent, reading velocity, completion delta, and a prediction for when they will finish the book at their current pace.

**Why this priority**: This is the primary user-facing payoff of the feature. The card exists to make readers feel accomplished — without surfacing the metrics clearly, the session capture has no value.

**Independent Test**: After completing a session the Last Session Card displays all five metrics correctly, computed from the recorded start/end timestamps and page numbers.

**Acceptance Scenarios**:

1. **Given** a session was completed, **When** the reader views the Last Session Card, **Then** they see: distance covered ("You read 24 pages · p. 102 → p. 126"), time on clock ("42 minutes"), velocity ("34 pages/hour"), completion progress ("6% of the book in this sitting"), and a finish prediction ("At this pace, ~8 more sessions to finish").
2. **Given** the reader has only one session recorded, **When** they view the finish prediction, **Then** it is based solely on that session's velocity.
3. **Given** the reader's velocity varies significantly between sessions, **When** the finish prediction is shown, **Then** it uses a rolling average of the last 3 sessions' velocities to smooth out outliers.
4. **Given** a legacy progress update (no session start), **When** the Last Session Card is shown, **Then** it displays distance covered and completion delta but omits time, velocity, and prediction (those cells show "—").

---

### User Story 3 — End-of-Session Quick Note (Priority: P2)

When a session ends the reader is given a simple text field to write a one-sentence reminder of where they left off in the story — a mental bookmark in their own words.

**Why this priority**: This is a lightweight but high-value moment-of-truth capture. The reader is most engaged immediately after stopping; a one-sentence note prevents the "wait, what was happening?" feeling at their next session. It is optional, so it does not block the P1 metrics.

**Independent Test**: After ending a session, the reader can type a note, save it, and see it displayed on the Last Session Card on subsequent visits.

**Acceptance Scenarios**:

1. **Given** a session has just ended, **When** the save confirmation appears, **Then** a one-line text field labelled "Where did you leave off?" is shown with a 160-character limit.
2. **Given** the reader submits a note, **Then** it is stored with the session and displayed prominently on the Last Session Card under the metrics.
3. **Given** the reader skips the note field, **Then** the session saves normally and no note placeholder is shown on the card.
4. **Given** the reader has a previously saved note, **When** they end a new session, **Then** the note field is blank (not pre-populated with the old note).

---

### Edge Cases

- What happens when the reader starts a session, then starts another session on the same book without ending the first? → The new "Start Session" tap replaces the previous in-progress session (a warning prompt is shown: "You have an unfinished session from [time]. Start a new one?").
- What happens if the session duration is less than 1 minute? → Velocity is calculated normally; no minimum threshold is enforced, but sub-1-minute sessions show "< 1 min" for time.
- What happens if the reader reads 0 pages in a session (same start and end page)? → The session is recorded, time and velocity show as 0 pages/hour, the finish prediction is hidden.
- What happens if total pages is unknown (book added without page count)? → Completion delta and finish prediction are omitted; distance covered and time are still shown.
- What happens on an extremely long session (e.g., app left open overnight)? → No automatic timeout; elapsed time reflects real clock time. The reader can edit the session end time up to 24 hours after saving.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to start a reading session for any in-progress book with a single tap from either the Dashboard book card or the Book Detail page.
- **FR-002**: Saving an updated current page MUST automatically end an active session and record the end timestamp.
- **FR-003**: The Last Session Card MUST display: pages covered (with page range), elapsed session time, reading velocity (pages/hour), completion delta (percentage of book read in this session), and a finish prediction.
- **FR-004**: Finish prediction MUST be based on a rolling average of the reader's last 3 session velocities for the same book (or the single session if fewer than 3 exist).
- **FR-005**: When no session was started before a page update (legacy flow), the Last Session Card MUST display pages covered and completion delta but omit time-dependent metrics.
- **FR-006**: At session end, users MUST be offered a text field (max 160 characters) to record a one-sentence session note.
- **FR-007**: The session note MUST be displayed on the Last Session Card and persisted across app restarts.
- **FR-008**: If a second "Start Session" is triggered while one is already active, the user MUST be shown a confirmation before the previous session is discarded.
- **FR-009**: The feature MUST be fully backwards-compatible — existing progress history records without session timestamps MUST continue to display correctly with the metrics they support.
- **FR-011**: Tapping "Start Session" MUST immediately persist the session start timestamp to the server so the in-progress session survives app restarts and browser refreshes without any local-storage dependency.
- **FR-010**: Reading velocity MUST be calculated as: `(pages read) / (session duration in hours)`, rounded to the nearest whole number.

### Key Entities

- **ProgressHistory** (existing, extended): The existing progress record is the single source of truth for session data. Two nullable columns are added: `session_start_at` (timestamp of when the reader tapped "Start Session") and `session_note` (optional free-text reminder, max 160 chars). Existing rows without these columns are treated as legacy records — no backfill required. All session metrics (time, velocity, completion delta) are derived at read time from these two fields plus the existing page fields; no separate session table is created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Readers who start a session and save pages see an accurate elapsed time within 1 second of actual reading time.
- **SC-002**: Velocity displayed on the Last Session Card is within 1 page/hour of the mathematically correct value for any session longer than 1 minute.
- **SC-003**: The finish prediction is displayed within 2 seconds of the session-end save action on any device.
- **SC-004**: Legacy progress updates (no session start) continue to save successfully with zero errors — 100% backwards compatibility.
- **SC-005**: At least 60% of readers who see the note prompt write and save a note in the first month (engagement signal that the UX is discoverable and low-friction).
- **SC-006**: The Last Session Card renders all metrics in a single visible area without requiring scrolling on a standard mobile viewport (375px wide).

## Clarifications

### Session 2026-04-24

- Q: Should reading sessions be stored as extra columns on the existing `progress_history` table, or as a new separate table linked to progress records? → A: Add nullable `session_start_at` and `session_note` columns to the existing `progress_history` table (Option A).
- Q: Where is the "Start Session" button surfaced? → A: Both the Dashboard book card and the Book Detail page (Option C).
- Q: Where is the in-progress session start time persisted while the reader is still reading? → A: Written to the server immediately when "Start Session" is tapped (Option A).

## Assumptions

- Only one active session per book is supported at a time; multi-device simultaneous sessions are out of scope for this version.
- The "Start Session" trigger is an explicit tap, not an automatic detection (e.g., no screen-time or activity sensing). The start timestamp is written to the server at that moment, not buffered client-side.
- Session note editing after the fact is out of scope for v1; the note is captured once at session end.
- The finish prediction assumes a consistent reading pace (rolling 3-session average); it is explicitly labelled as an estimate to set reader expectations.
- Existing `progress_history` rows that lack `session_start_at` are treated as legacy records; no backfill migration is required.
- The card layout follows the existing "glass-surface" design language used throughout the dashboard — no new design system components are needed.
