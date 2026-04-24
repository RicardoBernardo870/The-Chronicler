# Quickstart: Last Session Card — Acceptance Scenarios

## Setup assumptions

- User is authenticated and has at least one in-progress book (e.g., "Dune" by Frank Herbert, 900 pages, current page = 100).
- `progress_history` may have existing legacy rows (no `session_start_at`).

---

## Scenario 1 — Full happy-path session (Dashboard → Detail → save)

1. Open the Dashboard. Observe "Start Session" button on the hero book card. `reading_progress.session_start_at` is null.
2. Tap **Start Session**. Timer appears ("0:00"). `reading_progress.session_start_at` is set on the server.
3. Navigate to Book Detail page. Confirm the active-session indicator is also shown ("⏱ 0:03" or similar).
4. Wait ~2 minutes. Update current page from 100 → 134 and save.
5. **Expected on Last Session Card**:
   - Distance: "You read 34 pages (p. 100 → p. 134)"
   - Time: "~2 minutes"
   - Velocity: "~1,020 pages/hour" *(or realistic value if actual wait was 2 min)*
   - Completion: "3.8% of the book"
   - Prediction: shown (e.g., "~26 sessions at this pace")
6. `reading_progress.session_start_at` is null again (cleared).

---

## Scenario 2 — Legacy row (no session start)

1. Inspect an existing `progress_history` row with `session_start_at = null`.
2. Confirm Last Session Card shows:
   - Distance: shown (pages delta from prior row)
   - Completion delta: shown (if totalPages known)
   - Time, Velocity, Prediction: each shows "—" (not blank; explicit missing indicator)
3. No errors in console.

---

## Scenario 3 — Session note saved

1. Complete a full session (see Scenario 1).
2. After save, the note field appears: "Where did you leave off?"
3. Type: "Just arrived at Arrakis, Paul is overwhelmed." (≤160 chars). Tap **Save note**.
4. Navigate away and return to Dashboard.
5. **Expected on Last Session Card**: note text is displayed beneath the metrics grid.

---

## Scenario 4 — Session note skipped

1. Complete a full session.
2. Note field appears. Tap **Skip**.
3. Last Session Card shows metrics but no note section — the row for the note is entirely hidden.

---

## Scenario 5 — Double "Start Session" warning

1. Start a session for Book A.
2. Without saving, tap "Start Session" again for the same book.
3. **Expected**: confirmation prompt: "You have an unfinished session started at [HH:MM]. Start a new one?"
4. Tap **Cancel** → original session continues.
5. Tap **Confirm** → session_start_at is overwritten with new timestamp.

---

## Scenario 6 — App restart mid-session (server persistence check)

1. Start a session. Confirm `reading_progress.session_start_at` is set on server.
2. Close the browser tab entirely.
3. Reopen the app.
4. **Expected**: Dashboard shows the active-session indicator with elapsed time calculated from the stored `session_start_at` (not reset to zero).

---

## Scenario 7 — 0-page session

1. Start a session. Immediately update page to the same value (no change) and save.
2. **Expected on Last Session Card**:
   - Distance: "You read 0 pages"
   - Time: shown (actual elapsed)
   - Velocity: "—" (0 pages read)
   - Prediction: hidden

---

## Scenario 8 — Finish prediction rolling average

1. Complete 3 sessions for the same book with `session_start_at` recorded:
   - Session A: 20 pages in 30 min → 40 pph
   - Session B: 30 pages in 60 min → 30 pph
   - Session C: 10 pages in 15 min → 40 pph
2. Rolling average = (40+30+40)/3 = 36.67 → ~37 pph.
3. Remaining pages = 900 - (currentPage). Prediction = `ceil(remaining / 37)` sessions.
4. **Expected**: Prediction reflects the 3-session rolling average, not just the most recent session.

---

## Scenario 9 — Offline: Start Session blocked

1. Disable network.
2. Tap **Start Session**.
3. **Expected**: Error message "You appear to be offline. Start Session requires a connection." No optimistic state change.

---

## Scenario 10 — Book with unknown total pages

1. Add a book without a page count.
2. Start and complete a session.
3. **Expected on Last Session Card**:
   - Distance: shown (e.g., "24 pages")
   - Time, Velocity: shown (session-based)
   - Completion delta, Finish prediction: both hidden (no total pages to compute against)
