# Feature Specification: Supabase RPC Aggregations

**Feature Branch**: `017-supabase-rpc-aggregations`
**Created**: 2026-04-30
**Status**: Draft

## Overview

All heavy data aggregation currently lives in the frontend — composables fetch entire raw tables and process them in JavaScript. This causes over-fetching, fragile sequential store dependency chains, and race conditions (e.g., the progress store must wait for the books store to resolve before it can map rows). The fix is to push all aggregation into the database as PostgreSQL functions, so each data need becomes a single parameterised call that returns pre-shaped results. No new tables, no backend server, no edge functions.

---

## User Scenarios & Testing

### User Story 1 — Library loads in a single round-trip (Priority: P1)

A reader opens the app. The library screen — listing every book with its current page, reading status, and last activity — appears without requiring the app to first fetch books, wait, then fetch progress and join them in JavaScript.

**Why this priority**: This is the entry point for the entire app. The current sequential fetch pattern caused a race condition that broke the Dashboard when navigating from the Profile page. Fixing it at the data layer eliminates that class of bug entirely.

**Independent Test**: Navigate to the library/dashboard page and observe that all books appear with their progress data without any loading gap between title and progress bar. Verify that navigating from Profile → Dashboard shows the currently-reading book correctly on every visit.

**Acceptance Scenarios**:

1. **Given** a user with 5 books in various states, **When** they open the app, **Then** all books display with correct current page, status, and last-read date in a single data load — no intermediate state where books appear without progress.
2. **Given** the user navigates from Profile → Dashboard, **When** the Dashboard mounts, **Then** the hero book (currently reading) is present and shows the correct page — not blank.
3. **Given** a book with no progress yet, **When** the library loads, **Then** that book appears with current_page = 0 and status = "unread".

---

### User Story 2 — Reading stats are computed server-side (Priority: P2)

A reader opens the Profile page. Stats such as "pages read this week", "current streak", "all-time velocity", and "total pages read" are shown immediately — computed by the database, not by downloading and looping through every progress history row in the browser.

**Why this priority**: The current implementation fetches every `progress_history` row ever recorded and runs aggregation in JS. As reading history grows, this becomes slower and more wasteful. Moving it to SQL is a correctness and performance improvement.

**Independent Test**: Open the Profile page and confirm lifetime stats display. Verify the "pages this week" value matches manual count from the Supabase table. Confirm the page does not download the full history table.

**Acceptance Scenarios**:

1. **Given** a user with reading history spanning multiple books and weeks, **When** the Profile stats load, **Then** pages_this_week, pages_this_month, total_pages_read, current_streak_days, longest_streak_days, and all_time_velocity_pph are all populated with correct values.
2. **Given** a user who read across two different books yesterday, **When** streak is computed, **Then** yesterday counts as one streak day (not two), and today's streak is active only if there is a history entry today.
3. **Given** a session with session_start_at = null (legacy row), **When** velocity is computed, **Then** that session is excluded from all_time_velocity_pph — no divide-by-zero or phantom velocity.

---

### User Story 3 — Last session summary is computed server-side (Priority: P2)

The "Last Session" card on the Dashboard shows book title, pages read, duration, velocity, and finish prediction. All of these values arrive as a single pre-computed object from the database rather than being assembled from raw rows in a composable.

**Why this priority**: `useLastSession` currently fetches every history row for the entire library just to find the most recent one and compute deltas. The calculation is also error-prone when rows from different books are adjacent — the LAG window function partitioned per book handles this correctly in SQL.

**Independent Test**: End a reading session. Confirm the Last Session card populates with the correct book, page delta, duration, and velocity. Deliberately create adjacent history rows for two different books and confirm no cross-book page contamination occurs.

**Acceptance Scenarios**:

1. **Given** a completed session on Book A followed by an unrelated row on Book B, **When** the last session is fetched for Book A, **Then** pages_delta reflects only pages read within Book A — not the page difference between the two different books.
2. **Given** a session with a valid session_start_at and duration ≥ 60 seconds, **When** the last session loads, **Then** duration_seconds, velocity_pph, and finish_prediction_sessions are all non-null.
3. **Given** a legacy row with no session_start_at, **When** the last session loads, **Then** duration_seconds and velocity_pph are null and the card renders gracefully with dashes.
4. **Given** a book where the reader is on the last page, **When** the last session loads, **Then** finish_prediction_sessions = 0 (already done).

---

### User Story 4 — Library breakdown metrics are computed server-side (Priority: P3)

The Profile page's Library Breakdown section shows genre distribution, author count, books finished, books in progress, and average completion percentage — all computed from a single database call.

**Why this priority**: Lower priority because the Profile page is not the primary daily-use surface, and the breakdown data is supplementary. However it still contributes to eliminating the `useLibraryBreakdown` JS aggregation.

**Independent Test**: Open the Profile page Library Breakdown section. Manually count distinct genres and authors in the Supabase books table for the test user and confirm values match. Change one book's status and confirm the counts update on next load.

**Acceptance Scenarios**:

1. **Given** a library with 8 books across 3 genres, **When** breakdown loads, **Then** genre_distribution has 3 entries each with correct count and percentage summing to 100%.
2. **Given** a book with no genre set, **When** breakdown loads, **Then** it appears under an "Unknown" or "Uncategorised" group — not silently dropped.
3. **Given** a library where 3 books are finished and 2 are in progress, **When** breakdown loads, **Then** books_finished = 3, books_in_progress = 2.

---

### Edge Cases

- A user with zero reading history: all numeric stats return 0, not null or errors.
- A book with total_pages = 0 or null: completion_delta and finish_prediction_sessions return null rather than infinity or NaN.
- Page delta going negative (user corrected their page backward): delta is clamped to 0, not treated as negative reading.
- A session whose duration is less than 60 seconds: excluded from velocity calculations, included in session count.
- Streak calculation at midnight boundary: a session recorded at 23:59 and one at 00:01 the next day are on consecutive days and maintain the streak.
- Multiple progress history rows on the same day for the same book: counts as one streak day, page delta uses only the highest page reached that day minus the prior day's page.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST expose a database function that returns all books for a user joined with their latest reading progress in a single call.
- **FR-002**: The function in FR-001 MUST return for each book: unique identifier, title, author, cover URL, total pages, current page, reading status, and last activity timestamp.
- **FR-003**: The system MUST expose a database function that returns pre-aggregated reading statistics for a user, including pages read in the last 7 and 30 days, all-time total pages, current streak in days, longest streak in days, and all-time reading velocity in pages per hour.
- **FR-004**: Streak calculation in FR-003 MUST count consecutive calendar days on which at least one progress entry exists, treating "today" and "yesterday" as qualifying end points (a streak is not broken if the reader has not yet read today).
- **FR-005**: Velocity calculation in FR-003 MUST only include sessions where a start timestamp is recorded, the session lasted at least 60 seconds, and at least 1 page was advanced.
- **FR-006**: Page delta calculations across all functions MUST use the prior row for the same book — never the prior row across different books — to prevent cross-book contamination.
- **FR-007**: The system MUST expose a database function that returns the most recent reading session for a user, pre-computing pages delta, duration, session velocity, completion percentage of the book, and finish prediction in sessions.
- **FR-008**: Finish prediction in FR-007 MUST use the rolling average of the last 3 valid sessions across all books to estimate pages per session.
- **FR-009**: The system MUST expose a database function that returns a library breakdown for a user including genre distribution with percentages, distinct author count, counts of finished/in-progress/unstarted books, and average completion percentage across started books.
- **FR-010**: All database functions MUST be callable with only the authenticated user's identifier as a parameter — no additional secrets or tokens required from the frontend.
- **FR-011**: The frontend composable for last session data MUST be updated to call the database function from FR-007 instead of fetching raw history rows.
- **FR-012**: The frontend composables and stores for reading stats MUST be updated to call the database function from FR-003 instead of computing in JavaScript.
- **FR-013**: The frontend store for library data MUST be updated to call the database function from FR-001 instead of issuing separate books and progress fetches that must be sequenced.
- **FR-014**: The frontend composable for library breakdown MUST be updated to call the database function from FR-009.
- **FR-015**: All updated frontend stores and composables MUST preserve the existing stale-while-revalidate caching behaviour — cached results are shown immediately, revalidation happens in the background.
- **FR-016**: TypeScript types MUST be updated to reflect the new shapes returned by the database functions — no `any` casts.

### Key Entities

- **Book**: A reading item owned by a user; has title, author, cover URL, total pages, genre, status.
- **Reading Progress**: The current state of a book for a user — current page, status, last updated.
- **Progress History**: The append-only log of page checkpoints — each row records book, user, page reached, timestamp, optional session start timestamp, and optional session note.
- **Reading Session**: A derived concept — a progress history row paired with its preceding row for the same book, yielding a page delta and a duration.
- **Reading Stats**: A derived aggregate — a single object summarising a user's lifetime and recent reading behaviour.
- **Library Breakdown**: A derived aggregate — genre and status distribution across a user's entire library.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: The library/dashboard page completes its initial data load in a single network request for library data — down from the current minimum of two sequential requests.
- **SC-002**: Navigating from the Profile page to the Dashboard always shows the currently-reading book with correct progress — zero regressions from the known race condition.
- **SC-003**: The Profile stats page does not download the full progress_history table; the payload for reading stats is under 1 KB regardless of how many history rows the user has.
- **SC-004**: All computed statistics (pages this week, streak, velocity, finish prediction) match values derivable by manually querying the Supabase table — zero calculation discrepancies.
- **SC-005**: The frontend codebase removes all in-JavaScript aggregation loops over raw history rows — composables that previously iterated `allHistory.value` are replaced with single RPC calls.
- **SC-006**: Existing SWR caching behaviour is preserved — repeated navigations within the TTL window do not trigger new network requests.

---

## Assumptions

- The existing `books`, `reading_progress`, and `progress_history` Supabase tables have the columns referenced in the feature description; no schema changes are required.
- The `books` table has a `genre` column; if the column does not exist, genre distribution falls back to a single "Unknown" category.
- The authenticated user's ID is available client-side from the auth store and passed as the sole parameter to each RPC function.
- The database functions are created with `SECURITY DEFINER` so they bypass row-level security safely — the calling code is responsible for never passing a user ID other than the currently authenticated user.
- The `useCache` composable (SWR primitive) introduced in feature `006-swr-data-caching` is the existing caching layer and will continue to be used unchanged.
- Finish prediction uses the same rolling 3-session logic currently implemented in `useLastSession.ts` — this moves to SQL but the algorithm is identical.
- There is no requirement to support offline / IndexedDB fallback for the RPC-derived data; the existing online-first behaviour is preserved.

---

## Clarifications

### Session 2026-04-30

- Q: Should genre distribution include books with no genre set, or silently exclude them? → A: Include them under an "Unknown" / "Uncategorised" label so percentages always sum to 100%.
- Q: For streak calculation, does "today" count even if no session has been recorded yet today? → A: Yes — the streak is not broken until the user has missed a full calendar day. A streak ending yesterday is still shown as the current streak.
