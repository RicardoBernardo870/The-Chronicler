# 02 · Reading Sessions, Progress, Completion, Passport & Dashboard — Business Rules
> **Prefix:** SES · **Verified against:** web master @ 8d8701c + live Supabase, 2026-10-18 · **Legend & glossary:** [README](README.md)

Last updated: 2026-10-18

## Overview

This area covers how a reader's position in a book is recorded and what that position drives:

- timed reading sessions (start, pause, resume, cancel, end);
- page saves and corrections, and the `progress_history` trail they leave;
- the completion definition and every effect a completion triggers;
- the Book Passport (completion summary);
- Dashboard composition and hero ("active book") selection;
- the finish-date forecast, the Insight nudge and the Last Session card;
- Focus mode;
- the offline progress queue.

Terms used in this file (full glossary in the [README](README.md)):

| Term | Meaning here |
|---|---|
| Timed session | A `progress_history` row whose `session_start_at` is not null, i.e. a page save that ended a running session. |
| Untimed update | A `progress_history` row with `session_start_at = null` (a pencil correction outside a session). |
| Quiet write | A `reading_progress` write that produces no history row and no client-side effects (DB triggers still fire): add-book initial status, CSV import, offline-queue replay, session/DNF column writes. |
| Hero | The single book featured on the Dashboard hero card ("active book"). |
| Valid session | A timed session with duration ≥ 60 s and page delta ≥ 1 (used by velocity, hours and pace). |

### Screens and entry points

| Web route (name) / surface | Purpose in this domain |
|---|---|
| `/` (`dashboard`) | Greeting, onboarding states, hero card (progress, forecast, session controls, Focus mode entry, capture prompt, note), Word of the Day (Lexicon), Last Session card, In Progress list, Up Next shelf, Completed row. |
| `/books/:id` (`book-detail`) | Progress panel: progress bar, session state machine, pencil correction, DNF shelve/resume, chips, inline capture prompt, "View Reading Journey". |
| `/books/:id/passport` (`book-passport`) | Book Passport: stats, AI "Your Story So Far", Share Journey. |
| `/library/dnf` (`library-dnf`) | DNF list with Resume (owned by [01 · Library](01-library.md); only the session cascade is specified here). |
| Page save sheet (dialog) | "Where did you stop?" (end mode) / "Update your page" (edit mode). |
| Cancel-session confirm, completion prompt (dialogs) | "Cancel session?"; "Finished: {title}". |
| Focus mode overlay (no route) | Full-screen timer with wake lock, auto-dim and reading-goal chips; only while a session runs. |
| Background | Offline queue drain (window `online` event, service-worker `sync`, every progress fetch); passport auto-generation; Insight milestone trigger. |

### Owning backend objects

Names only; shapes and grants are in [backend-contract §3 Tables, §8 RPC catalogue, §9 Triggers, §10 Edge functions](../backend-contract.md).

- **Tables:** `reading_progress`, `progress_history`, `book_passports`; read-only here: `up_next_order` (written by [01 · Library](01-library.md)), `books`.
- **Triggers:** `reading_progress_updated_at` → `set_updated_at()`; `page_captures_delete_on_completion` → `delete_page_captures_on_book_completion()`; `book_quizzes_delete_on_completion` → `delete_book_quizzes_on_book_completion()`; `page_capture_quest_event_after_save` → `record_page_capture_quest_event()` (on `page_captures`, relevant to completion).
- **RPCs:** `get_library_with_progress`, `get_last_session`, `get_reading_velocity`, `get_book_passport_stats`.
- **Edge functions:** `generate-recap` (mode `passport_summary`). The pre-start gate also calls `generate-page-resume` and `generate-book-quiz`, which are owned by [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md).
- **Planned (Phase 0, [backend-consolidation-plan](../backend-consolidation-plan.md)):** `start_session`, `pause_session`, `resume_session`, `cancel_session`, `save_progress`, DNF/resume RPCs, and `reading_progress.completed_at` (BC-04); a server-owned completion pipeline (BC-05); `p_timezone` on every stats RPC (BC-06).

### What Phase 0 changes in this domain (summary of Target lines)

| Decision | Effect here |
|---|---|
| D-06 · BC-04 | Session lifecycle and page saves become server RPCs on the **server clock**. `save_progress` writes progress + history + session end atomically, detects completion and stamps `reading_progress.completed_at`. Session and DNF RPCs never send `current_page`. Every save carries an idempotency key. |
| D-06 · BC-05 | One server owner for completion effects, whatever the client or path: passport stats frozen at completion, passport AI-summary job, capture/quiz purge (existing triggers), Insight milestone evaluation, achievements, DNA eligibility. |
| D-07 · BC-06 | Day boundaries (velocity per-day fallback, passport peak day) use the reader's IANA time zone, stored server-side. |
| D-08 · BC-04 | Any forward page change counts for pages, streaks and charts, including offline saves replayed with their original time. Session XP, session-count badges and the Last Session card require a real timed session. |
| D-12 · BC-08 | Insight milestones are evaluated on save, crossed milestones are back-filled, and a capture/metadata fallback exists, so the hero nudge stops promising Insights that never come. |
| BC-01 / BC-02 | Owner checks on the session RPCs, book-ownership RLS, verified JWTs in `generate-recap`. |

---

## Rules

### Progress model and percentage

#### SES-01 · One progress row per book and user
`reading_progress` holds at most one row per `(book_id, user_id)`. Every client write is an upsert with `onConflict: 'book_id,user_id'`.
- **Enforced:** `server:db` (`reading_progress_book_id_user_id_key UNIQUE (book_id, user_id)`); `client` (upsert target).
- **Source:** `src/stores/progress.ts:57-62,287-298,358-370,433-443`; live `pg_constraint`.

#### SES-02 · Client percentage keeps 2 decimals and is not capped
The web client computes `round(current_page / total_pages × 10000) / 100`, which is 0 when `total_pages ≤ 0` and is **not** capped at 100. The client can therefore briefly hold a percentage above 100 until the next library RPC refresh.
- **Enforced:** `client`.
- **Source:** `src/types/index.ts:435-444`; `src/stores/progress.ts:503-505`.
- **Note:** native clients should derive the percentage at use time from `(current_page, total_pages)`, cap it at 100, and never cache it separately (see SES-D21).

#### SES-03 · Server percentage and status precedence
`get_library_with_progress` returns `percentage = least(100, round(current_page / total_pages × 100, 2))` (0 when `total_pages ≤ 0`). It returns `status` with this precedence: `'dnf'` if `dnf_at` is not null; else `'unread'` if `current_page = 0` or there is no row; else `'finished'` if `current_page ≥ total_pages`; else `'reading'`.
- **Enforced:** `server:rpc` (`get_library_with_progress`).
- **Source:** live `pg_get_functiondef(get_library_with_progress)`.
- **Note:** a negative `current_page` (possible, SES-05) yields `'reading'`. The payload has no `sessionPausedAt` (SES-20).

#### SES-04 · Completion means current_page ≥ total_pages
A book is complete when `current_page ≥ total_pages` (percentage ≥ 100). The web client checks this through percentages. The DB triggers compare the integers `new.current_page >= books.total_pages` (with `total_pages > 0`).
- **Enforced:** `client` (`src/stores/progress.ts:277,617,693`, `src/utils/completionPrompt.ts:6-9`, `src/pages/BookDetailPage.vue:121`, `src/composables/useDashboardOnboardingState.ts:10`); `server:db` (completion triggers, SES-40).
- **Source:** as above; live trigger functions.
- **Target:** `save_progress` detects the first crossing server-side, stamps `reading_progress.completed_at` (first completion), and reports the crossing in its response. Clients stop comparing percentages, and "finished this year" uses `completed_at` (D-06 · BC-04).
- **Note:** the client's prompt and its passport/milestone checks use different rounding (SES-D20).

#### SES-05 · No database range check on current_page
`reading_progress.current_page` is `int NOT NULL DEFAULT 0` with no CHECK: negative values and values above `total_pages` are accepted. `progress_history.page` has `CHECK (page >= 0)`, and `books.total_pages` has `CHECK (total_pages >= 1)`. Range enforcement for progress is client-only (SES-24).
- **Enforced:** `server:db` (`progress_history_page_check`, `books_total_pages_check`); `client` for the `current_page` range.
- **Source:** live `pg_constraint`.
- **Target:** `save_progress` validates the page server-side (an integer within `[0, total_pages]`) (BC-04).

#### SES-06 · updated_at moves on every UPDATE
Trigger `reading_progress_updated_at` (BEFORE UPDATE, no column filter) sets `updated_at = now()` (server clock) on **every** UPDATE, including session start, pause, resume, cancel, session clear, DNF and resume-DNF. On INSERT the column defaults to `now()`. A cancel therefore bumps `updated_at` too.
- **Enforced:** `server:db` (`reading_progress_updated_at` → `set_updated_at()`).
- **Source:** live `pg_trigger`, `pg_get_functiondef(set_updated_at)`.
- **Target:** "finished this year" moves to `completed_at` (BC-04). Whether session-only writes should move "last read" is SES-Q15.
- **Note:** `updated_at` is `lastReadAt`. It drives library order, hero recency, the In Progress order, the recap 72-hour idle clock (REC-07 in [03 · Recaps](03-recaps.md)) and today's quest year (PRO-09/10 in [07 · Profile](07-profile-stats-goals.md)) ⚠ SES-D23.
- **Merged:** SES-23 (cancel bumps `updated_at`).

#### SES-07 · Local updatedAt drifts after pause, resume and cancel
The client never sends `updated_at`. After a confirmed upsert it replaces the optimistic local `updatedAt` with the server value. Pause, resume and cancel are plain updates whose result is not read back, so the local `updatedAt` stays older than the server's until the next library fetch.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:67-78,237,257-266,331-342`.

### Session start

#### SES-08 · A session is two columns on the progress row, per book
"Active session" means `reading_progress.session_start_at IS NOT NULL`. There is no session table. Sessions are **per book**: nothing prevents active sessions on several books at the same time.
- **Enforced:** `client` (no server guard).
- **Source:** `src/stores/progress.ts:269-315`; `src/composables/useReadingSession.ts:43-48`.
- **Target:** session state changes go through `start_session` / `pause_session` / `resume_session` / `cancel_session` RPCs (D-06 · BC-04). The single-session policy is SES-Q02.

#### SES-09 · Starting a session needs a connection
Start, pause and resume check `navigator.onLine` and throw "You appear to be offline. Start Session requires a connection." (respectively "Pause requires a connection." / "Resume requires a connection."). The message renders inline under the control. Sessions are never queued offline.
- **Enforced:** `client`.
- **Source:** `src/composables/useReadingSession.ts:95-114`; `src/components/session/SessionStartButton.vue:51-60,193-195`.
- **Note:** the offline check runs **after** the pre-start gate's reads (SES-14). Offline, cached state can still open the Memory Check or "Previously" dialog, and the reader sees the offline error only after tapping Begin/Skip (CAP-60a in [04](04-capture-resume-quiz.md)). Offline start is SES-Q03.

#### SES-10 · Start is refused for complete, shelved or unknown books (client only)
`startSession` throws "This book is already complete." when the local percentage is ≥ 100, "This book is shelved as Did Not Finish. Resume it first." when `dnfAt` is set, and "Book not found" when the book is not in the local library. The DB accepts the write in all three cases.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:273-282`.
- **Target:** `start_session` refuses complete and DNF books server-side (BC-04).

#### SES-11 · Start works without a progress row
Start upserts `{book_id, user_id, current_page: existing ?? 0, session_start_at: now, session_paused_at: null}`, which creates the row for a never-started book.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:284-300`; test `tests/unit/progressSession.spec.ts:71`.
- **Target:** `start_session` inserts a missing row with `current_page = 0` and never modifies an existing `current_page` (BC-04).

#### SES-12 · Session start time comes from the device clock
`session_start_at` is `new Date().toISOString()` on the starting device, not server `now()`. Durations across devices therefore depend on the two clocks agreeing (SES-93).
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:284`.
- **Target:** server clock (D-06 · BC-04).

#### SES-13 · Tapping Start while a session runs asks to cancel
When the session is active, the Start/stop control emits `cancelSession`, which opens the cancel confirm (SES-22). It never restarts the session. The declared `conflictWarning` event is never emitted ⚠ SES-D42.
- **Enforced:** `client`.
- **Source:** `src/components/session/SessionStartButton.vue:16,65-68`.

#### SES-14 · Pre-start gate order: Memory Check, then "Previously", then start
1. `bookQuiz.prepare()`. If the reader is eligible for Memory Check, show the quiz dialog and skip the resume. Eligibility: the last `progress_history.recorded_at` for the book is ≥ 48 h old, at least one capture has text, no fresh recap covers the position, and the quiz covering this position has not been answered. A book with no history is never eligible.
2. Otherwise `sessionResume.load()`. If a stored resume exists for the **highest-page** capture (not the most recent capture) and no fresh recap suppresses it (`recap.page_snapshot >= current_page`), show the "Previously" dialog. A highest-page capture with text but no `resume` is back-filled with `generate-page-resume` **awaited inside the Start tap**; a failed back-fill is silent and the session starts with no dialog.
3. Otherwise start immediately.

- **Enforced:** `client`.
- **Source:** `src/components/session/SessionStartButton.vue:62-101`; `src/composables/useBookQuiz.ts:28,69-73,86-92,110-117`; `src/composables/useSessionResume.ts:39-66`; `src/composables/usePageResume.ts:42-57`; `src/stores/captures.ts:110`.
- **Note:** `lastPageSavedAt` is fetched once per book per page lifetime, so a save on another device is not seen until reload. `quizByBook` is a module cache filled once per book, and all four prep reads swallow errors (a failed read means "not eligible", never a blocked start). The Start button is disabled while the gate and start run (double-tap guard). Gate eligibility, quiz and resume rules are owned by [04 · Capture, Resume & Quiz](04-capture-resume-quiz.md) (CAP-60…, CAP-61).

#### SES-15 · The session starts only on an explicit confirm
`session_start_at` is written only when the reader taps "Begin reading" (Previously dialog), "Skip to reading" (Memory Check intro) or the Memory Check summary's begin action. Dismissing a dialog any other way aborts the start, and nothing is written.
- **Enforced:** `client`.
- **Source:** `src/components/session/SessionStartButton.vue:103-106,205-211`; `src/components/session/SessionResumeDialog.vue:6-9`; `src/components/session/MemoryCheckDialog.vue:107`.

#### SES-16 · After a successful start the local state follows the server row
The local progress entry and library snapshot are replaced from the returned row, `progress` is touched fresh and `library` is invalidated.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:303-314`.

#### SES-87 · The start upsert also overwrites current_page from the local cache
The start upsert sends `current_page: existingProgress?.currentPage ?? 0`. A device with stale local state therefore **overwrites the server page**: if device B advanced to p.120 and device A still shows p.100, starting a session on A resets the server to 100, and a missing local row resets an existing server row to 0. `markDnf` has the same pattern (SES-75). Because `current_page` is in the SET list, these writes also fire the completion triggers (SES-40). No history row records the change ⚠ SES-D04.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:285,293,364`.
- **Target:** `start_session` and the DNF/resume RPCs never send `current_page` (D-06 · BC-04).

### Pause and resume

#### SES-17 · Pause stamps the pause time only when a session exists
Pause runs `UPDATE reading_progress SET session_paused_at = now(device) … WHERE session_start_at IS NOT NULL`, so it is a no-op when no session exists. It is online only (SES-09). Errors render inline as "Could not update the session" or the thrown message; Focus mode swallows them (SES-D39).
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:227-238`; `src/composables/useReadingSession.ts:102-107`; `src/components/session/SessionStartButton.vue:108-119`.
- **Target:** `pause_session` on the server clock (BC-04).

#### SES-18 · Resume shifts the start forward by the paused span
Resume sets `session_start_at' = session_start_at + (now − session_paused_at)` and `session_paused_at = null`. If the local `pausedAt` or start is unknown, resume silently does nothing.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:240-267`.
- **Target:** `resume_session` applies the shift server-side (BC-04).

#### SES-19 · The elapsed timer is derived from timestamps
Running: `floor((now − session_start_at) / 1000)` seconds, recomputed every 1 s. Paused: frozen at `max(0, floor((paused_at − start) / 1000))`, with a "paused" hint under the value. A reload re-seeds from the stored `session_start_at`. The running value is **not clamped**, so a start time in the future (clock skew) shows negative seconds. The label is `M:SS`, or `H:MM:SS` from one hour, in both the timer card and Focus mode.
- **Enforced:** `client`.
- **Source:** `src/composables/useReadingSession.ts:33-40,63-78`; `src/components/session/SessionStartButton.vue:41-49,175`; `src/components/session/FocusModeOverlay.vue:64-70`.

#### SES-20 · Pause state is fetched once per book per page lifetime
`get_library_with_progress` does not return `session_paused_at`. The client reads it with a separate select only once per book (`if (bookId in sessionPausedAt) return`), so a pause or resume made on another device is not seen until a full reload ⚠ SES-D24.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:214-225`.
- **Target:** refresh on foreground, or Realtime on `reading_progress` (recommended, BC-14).

#### SES-21 · Saving while paused never counts the paused tail
When a page is saved while paused, the history row's `session_start_at` = start + (now − paused_at). Paused time is never counted in a duration.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:507-518`.
- **Target:** `save_progress` applies the shift server-side (BC-04).

### Cancel session

#### SES-22 · Cancel ends the session with no record
Cancel sets `session_start_at = null` and `session_paused_at = null`. It writes **no** history row, leaves `current_page` unchanged, and bumps `updated_at` (SES-06). Confirm copy: header "Cancel session?", message "Cancel this session? No progress will be saved.", buttons "Cancel session" (danger) / "Keep session". It is reachable from the stop icon (SES-13) and from the end-mode sheet link "Cancel session — no progress saved". Errors are swallowed silently, and there is no offline guard.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:321-344`; `src/pages/DashboardPage.vue:299-313`; `src/pages/BookDetailPage.vue:70-82`; `src/components/session/PageSaveSheet.vue:116-123`.
- **Target:** `cancel_session` RPC on the server clock (BC-04). Clients should surface its errors.

### Page save (session end or correction)

#### SES-24 · Page validation in the sheet
`checkPageSave`: out-of-range if the value is null, undefined or NaN, or `< 0` or `> totalPages`; "unchanged" if it equals the stored page; Save is disabled unless `ok`. **Backward pages are allowed** (corrections). Non-integer values pass this check, but the integer column rejects them ⚠ SES-D34.
- **Enforced:** `client`.
- **Source:** `src/utils/pageSave.ts:14-30`; test `tests/unit/pageSave.spec.ts:9`.
- **Target:** `save_progress` validates the page server-side (BC-04). Clients keep the same validation for UX.

#### SES-25 · Page sheet copy
Out of range: "Enter a page between 0 and {total}." Unchanged in end mode: "You're still on page {n}. Update it to finish the session." Unchanged in edit mode: "That's already your current page." The end-mode sheet ("Where did you stop?", "Save & Finish") **always** shows the link "Cancel session — no progress saved", whatever the page; the edit-mode title is "Update your page".
- **Enforced:** `client`.
- **Source:** `src/components/session/PageSaveSheet.vue:34-46,116-123`.

#### SES-26 · Stepper bounds
− clamps at 0 and + clamps at `totalPages`, and each button is disabled at its bound. The input resets to the stored page every time the sheet opens.
- **Enforced:** `client`.
- **Source:** `src/components/session/PageSaveSheet.vue:25-32,79,100`.

#### SES-27 · The page is clamped again before saving
The page-level handler clamps again: `page = max(0, min(input, totalPages))`. If a session is active and the clamped page equals the stored page, a confirm appears ("No pages read" / "You need to update your page count to save a session." with "Update pages" / "Cancel session"). The sheet already blocks unchanged values, so this confirm is effectively unreachable ⚠ SES-D42.
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:245-266`; `src/pages/BookDetailPage.vue:134-152`.

#### SES-28 · Pencil corrections happen only outside a session
The pencil (edit mode) shows only when **no session is active** (hero). On the Book Detail panel it also requires the book to be not complete and not DNF. Edits are therefore always untimed and write history with `session_start_at = null`.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:199-213`; `src/components/book/BookProgressPanel.vue:74-84`.

#### SES-29 · A completed book cannot be lowered from the UI; page-count edits can un-complete it
After completion the panel pencil is hidden and a complete book is never the hero (SES-59), so there is no UI path to lower the page. The only indirect path is raising `books.total_pages`. CSV-import enrichment does this automatically: an imported "read" book without a page count is stored with the placeholder `total_pages = 100` and `current_page = 100`, and enrichment later sets the real `total_pages` without touching `reading_progress`. Any real count above 100 silently **un-completes** the book (e.g. 100/350 = 28.6 % → `'reading'`), which can bring it into In Progress and the hero after the next reload ⚠ SES-D22.
- **Enforced:** `client`.
- **Source:** `src/composables/useLibraryImport.ts:71-72`; `src/stores/books.ts:254,307,329,389-392`.
- **Note:** captures and quizzes purged at the original completion are gone for good (CAP-44 in [04](04-capture-resume-quiz.md)). Decision: SES-Q05.

#### SES-30 · Online save order
`updateProgress` online (`navigator.onLine === true`):
1. Compute `prevPct` from the local store and `newPct` (rounded, SES-02).
2. Capture `session_start_at` with the pause shift (SES-21) and set the local `sessionPausedAt = null`.
3. Snapshot the local progress and library entry for rollback.
4. Set `lastPageSavedAt[book] = now` optimistically (the recap cooldown anchor and the Memory Check "away" clock).
5. Apply the optimistic progress and library snapshot; invalidate `library`.
6. **Upsert `reading_progress {book_id, user_id, current_page}`**; apply the confirmed row.
7. Touch `progress`; invalidate `library`, `lastSession`, `readingStats` and `readingQuest` (prefix).
8. **Insert `progress_history {book_id, user_id, page, recorded_at: now(device), session_start_at: captured | null}`** returning `id`. A failure here is swallowed: no event, and the cooldown anchor stays optimistic ⚠ SES-D08.
9. If a session was active: run an **un-awaited** `UPDATE reading_progress SET session_start_at = null, session_paused_at = null`, clear the local session, and invalidate `library` and `velocity` ⚠ SES-D07.
10. If a history row was created, emit `lastSessionEnded = {bookId, historyRowId, sessionStartAt}` (SES-37, SES-88).
11. If `newPct >= 100 && prevPct < 100`: `fetchPassport`; if no row exists, `generatePassport` (fire-and-forget, SES-46).
12. `detectCrossedMilestone(prevPct, newPct)`, which may run `maybeUnlockForMilestone` (fire-and-forget, SES-69).

- **Enforced:** `client` (three separate PostgREST calls; not atomic).
- **Source:** `src/stores/progress.ts:495-665`.
- **Target:** one call, `save_progress(book_id, page, note, client_occurred_at, idempotency_key)`, on the server clock (client time only for offline replays). In one transaction it upserts `reading_progress`, inserts the history row (timed when a session is open, pause shift applied), ends the session, detects first completion and stamps `completed_at`. Completion effects then run server-side: passport job, purge, Insight milestones, achievements, DNA eligibility (D-06 · BC-04 · BC-05 · BC-08 · BC-09). Server-side recap eligibility reads the same history (BC-07).

#### SES-31 · Rollback when the progress upsert fails
If step 6 throws (or anything else synchronous inside the `try`), local progress and the library entry return to the snapshot (or are deleted/restored), `lastPageSavedAt` is restored, `library` is invalidated, and the error is re-thrown. The UI shows `e.message` or "Failed to save" (hero), or "Failed to save progress" (Book Detail). The rollback does **not** restore `sessionPausedAt`, which step 2 nulled. A failed save while paused therefore leaves the local timer running while the server stays paused ⚠ SES-D32.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:517,633-655`; `src/pages/DashboardPage.vue:292-293`; `src/pages/BookDetailPage.vue:180-181`.
- **Target:** a single `save_progress` call leaves nothing partial to roll back (BC-04).

#### SES-32 · Every online save writes a history row
A history row is written for **every** online save: session ends and pencil corrections, backward corrections included. `session_start_at` is non-null only for session ends. Offline saves write none (SES-77). History rows feed XP (+10 per row), streaks, calendar, monthly and records stats ([07 · Profile](07-profile-stats-goals.md), PRO-04).
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:562-583`.
- **Target:** every forward page change produces a history row that counts for pages, streaks and charts, including offline saves replayed with their original `client_occurred_at`. Only rows ended from a real timed session count for session XP, session-count badges and the Last Session card. Backward or zero-delta changes add no activity (D-08 · BC-04).

#### SES-33 · Initial status on add-book and import is a quiet write
`setInitialProgress` writes no history and fires no side effects (no event, passport, Insight or capture prompt). Page normalisation: queued → no row; completed → `total_pages`; currently reading → `clamp(currentPage ?? 1, 1, total − 1)`. CSV import writes progress rows directly (completed = `total_pages`; DNF = page 0 + `dnf_at`) with no history. Both upserts include `current_page`, so a completed initial status fires the completion triggers (a no-op on a new book). Edge case: a **1-page** book added as "currently reading" gives `max(1, min(req, 0)) = 1 = total` and is stored as **complete**.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:419-466`; `src/stores/books.ts:214-245,283-352`.
- **Target (recommended in BC-04):** write a baseline history row at the initial page when a book is added mid-way, so the starting page is never counted as read. The baseline must not count as activity (SES-Q17).
- **Note:** rules for the add-book form and import mapping live in [01 · Library](01-library.md) (LIB-14–17, LIB-77–83).

#### SES-88 · The session-ended event is a single in-memory slot
`lastSessionEnded` holds one event. A second history-producing save overwrites an unconsumed prompt for another book. Any full reload, including the service-worker update reload, drops a pending capture prompt, and the prompt cannot be offered again for that history row ⚠ SES-D33.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:40,609-613`.

#### SES-93 · Timestamp sources: device clock except updated_at
Device clock (`new Date().toISOString()`): `reading_progress.session_start_at`, `session_paused_at` and the shifted start, `dnf_at`, and `progress_history.recorded_at`. Server clock: `reading_progress.updated_at` (trigger/default) and every `created_at`. Nothing clamps durations except the stats RPCs (valid session ≥ 60 s; records ignore durations ≤ 0 or > 12 h). A session started on one device and ended on another is measured across two clocks ⚠ SES-D35.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:230,247-249,284,365,523,563`; live column defaults.
- **Target:** server clock for every session and history timestamp; `client_occurred_at` only for offline replays (D-06 · BC-04).

#### SES-94 · Saves are not idempotent
`progress_history` has no uniqueness and the client sends no idempotency key, so a repeated online save (double tap, client retry) writes duplicate history rows ⚠ SES-D09.
- **Enforced:** none.
- **Source:** live `pg_constraint` (no UNIQUE on `progress_history` beyond the PK); `src/stores/progress.ts:562-583`.
- **Target:** `save_progress` takes an `idempotency_key`; a replay with the same key is a no-op that returns the original result (BC-04).

### Session note

#### SES-34 · Note limits
The note is at most 160 characters: the UI uses `maxlength`, and the DB has `progress_history_session_note_check (char_length ≤ 160)`. A counter appears at ≥ 140 characters and switches to a warning style at ≤ 10 remaining. Empty or whitespace-only text cannot be saved, and the text is trimmed before saving.
- **Enforced:** `server:db` (length only); `client` (trim, non-blank, counter).
- **Source:** `src/components/session/SessionNoteField.vue:21-36,53-61`; live `pg_constraint`.

#### SES-35 · The note is written once, fire-and-forget, to the row just created
The note is written with `UPDATE progress_history SET session_note WHERE id = historyRowId AND user_id = uid`. Errors are only logged. It can be entered only through "Add note instead" in the capture prompt (placeholder "Where did you leave off?"), only for the history row just created, and it cannot be edited later.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:471-483`; `src/components/session/SessionCaptureField.vue:205-208,221-226`.
- **Target:** `save_progress` accepts the note in the same call (BC-04). Where the note is entered and whether it can be edited is SES-Q10.

#### SES-36 · The note shows only on the hero card
The note renders **only on the hero card**, and only when the most recent history row (`get_last_session`) belongs to the hero book. The Last Session card does not show it.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:99-103,313-319`.

### Capture prompt after a save

#### SES-37 · The capture prompt follows any online save that wrote history
The prompt ("Capture this page": Take photo / Upload image / Add note instead / Skip) shows after **any** online save that produced a history row: session ends, pencil edits, backward edits and **completing saves**. Dashboard: it renders on the hero card if `event.bookId === hero.id` (the watch is `immediate`). Book Detail: it renders inline if the event is for that book and the book is not DNF (the watch is **not** immediate). Offline saves never show it.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:607-614`; `src/components/dashboard/HeroBookCard.vue:76-86`; `src/pages/BookDetailPage.vue:55-61,293-299`.
- **Note:** on a completing save Book Detail still offers the prompt. A capture saved then is **deleted in the same statement** by `record_page_capture_quest_event` (the book is complete), while its +5 XP `reading_quest_events` row survives ⚠ SES-D13. Frequency decision: SES-Q11.

#### SES-38 · Capture page, auto-save and event consumption
The capture is saved at `page = reading_progress.current_page`, never at an OCR-derived page. OCR confidence ≥ 0.90 auto-saves; text is capped at 10 000 characters. Save, skip, and "Add note instead" + save/skip all consume the event (`consumeSessionEnded`). **Only the hero card** then refetches the last session. Book Detail only consumes the event, so a note saved there reaches the hero only after the 30 s `lastSession` TTL. Toasts: "Couldn't read that image" (upload), "OCR failed" (camera), "Page captured" / "Text analysed successfully." (auto-save), "Check the captured text" (low confidence). Inline panels: camera denied, offline, generic error, missing preview.
- **Enforced:** `client`; `server:db` text length (`page_captures_text_check`).
- **Source:** `src/components/session/SessionCaptureField.vue:61-90,111-140,158-189,318-400`; `src/components/dashboard/HeroBookCard.vue:136-142`; `src/pages/BookDetailPage.vue:63-68`.
- **Note:** capture, OCR and resume rules are owned by [04](04-capture-resume-quiz.md). On iOS the OCR path is on-device Vision first with the `ocr-page` fallback, and the 0.90 / 0.70 thresholds must be recalibrated for Vision (D-15).

### Completion

#### SES-39 · Client completion effects (online save only)
When an online save crosses 100 % (`prevPct < 100 && newPct >= 100`) the client runs:
- (a) the completion prompt (SES-41);
- (b) on the Dashboard only, `onBookCompleted(heroId)`, which re-infers the hero (SES-62);
- (c) passport auto-generation when no passport exists (SES-46);
- (d) the capture prompt (SES-37);
- (e) a last-session refetch;
- (f) the Insight milestone check. Reaching 100 % never unlocks an Insight (cap 90), but a jump from below 90 unlocks the highest crossed bucket ≤ 90 (SES-69).

- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:607-632`; `src/pages/DashboardPage.vue:282-291`; `src/utils/milestoneDetect.ts:21-43`.
- **Target:** one server owner for completion effects regardless of client or path (BC-05): frozen passport stats, the passport AI-summary job, the existing capture/quiz purge, Insight milestone evaluation (BC-08), achievements (BC-09) and DNA eligibility. Clients keep only UI reactions (prompt, hero rotation), driven by the save response (D-06 · BC-04 · BC-05).

#### SES-40 · Database completion purge
On any INSERT, or any UPDATE that lists `current_page`, on `reading_progress` where `current_page ≥ books.total_pages > 0`:
- `page_captures_delete_on_completion` → `delete_page_captures_on_book_completion()` deletes **all** of that user's captures for the book, including stored resumes;
- `book_quizzes_delete_on_completion` → `delete_book_quizzes_on_book_completion()` deletes the book's quiz.

Both are `AFTER INSERT OR UPDATE OF current_page … FOR EACH ROW`. They look up `total_pages` with `b.id = new.book_id AND b.user_id = new.user_id`, so they do nothing when the progress row's user doesn't own the book. "UPDATE OF current_page" fires whenever the column is in the SET list, even if unchanged. Every upsert that sends `current_page` therefore re-evaluates them: start session, `markDnf`, `setInitialProgress`, queue replay, import. Plain updates that omit it (pause, resume, cancel, session clear, `resumeDnf`) do not. A capture inserted or updated later on a complete book is purged by `record_page_capture_quest_event` (see SES-37).
- **Enforced:** `server:db`.
- **Source:** live `pg_trigger`, `pg_get_functiondef` of the three trigger functions.
- **Target:** stays the purge owner inside the BC-05 completion pipeline.

#### SES-41 · Completion prompt
Header "Finished: {title}" (a blank title falls back to "this book"); message "Your reading journey is ready. Open your Book Passport to see the story so far."; buttons "View Journey" (→ `book-passport`) and "Continue". The page handler computes it from the **unrounded** `page / total × 100` against the stored `prevPct`. It also shows for offline saves (SES-77) and for imported (`source <> 'manual'`) books.
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:118-129,278-291`; `src/pages/BookDetailPage.vue:162-179`; `src/utils/completionPrompt.ts:6-23`.
- **Target:** show the prompt when the save response reports a first completion (BC-04).
- **Note:** completion is deterministic (`page ≥ total`), so a client may show the prompt optimistically when it saves offline; the server effects run when the replay lands (BC-05).

#### SES-42 · What a completed book shows and hides
A completed book leaves In Progress (filter `< 100`), joins Completed (sorted by `updatedAt` desc), and can no longer be the hero. It loses session controls, pencil, End Session, Focus mode, the Memory Check chip, the DNF link and Get Recap. It keeps the Codex/Words chips, Insights, the recap carousel and history, and "View Reading Journey" when `book.source === 'manual'` (SES-52).
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:679-699`; `src/components/book/BookProgressPanel.vue:76,102,111,121,137-143,170,182`; `src/pages/BookDetailPage.vue:123,307-308`.

#### SES-43 · up_next_order rows are never removed by reading
Nothing deletes `up_next_order` rows when a book starts, completes or is shelved. Rows are only upserted by Library reordering and only disappear through the book-delete cascade.
- **Enforced:** `client` (absence of cleanup).
- **Source:** `src/stores/upNext.ts:45-86`; `src/pages/LibraryPage.vue:149-160`.
- **Note:** stale rows still steer hero inference (SES-59) ⚠ SES-D26; decision SES-Q14.

#### SES-89 · A "zombie" session can survive on a completed book
An offline completing save never clears the session (SES-77), so after replay the server has `current_page = total` **and** a non-null `session_start_at`. A stale second device can do the same: a pencil edit to the total, unaware of another device's session, writes untimed history and leaves the server session alone. Once a book is complete, no UI can cancel the session (no Start/End/Focus on complete books, and a complete book is never the hero). It keeps appearing as `sessionStartAt` in `get_library_with_progress` ⚠ SES-D06.
- **Enforced:** `client` (absence of cleanup).
- **Source:** `src/components/book/BookProgressPanel.vue:102,111,121`; `src/composables/useActiveBook.ts:43-70`.
- **Target:** `save_progress` ends any open session on the book in the same transaction, online or replayed, so a completion can no longer leave a session open (BC-04). Expiry of abandoned sessions is SES-Q16.

#### SES-95 · Completion paths fire different effect subsets
Only an online page save (Dashboard or Book Detail) fires the client effects of SES-39. The other paths fire only what the DB does:

| # | Path | Purge triggers | History row | Prompt | Passport | Insight (≤ 90 %) | Hero re-infer | Quest/XP +25 |
|---|---|---|---|---|---|---|---|---|
| 1 | Online save on the Dashboard hero | yes | yes | yes | yes, if no row | if a bucket is crossed | immediate | manual books, dated by `updated_at` (UTC year) |
| 2 | Online save on Book Detail | yes | yes | yes | yes, if no row | same | next Dashboard mount / signature watch | same |
| 3 | Offline save → later replay | at replay | **no** | yes, at save time | **no** | **no** | yes (Dashboard) | dated at **replay** time |
| 4 | Add book as "Already finished" | yes (INSERT) | no | no | no ("View Journey" shown → dead end) | no | n/a | yes (manual) |
| 5 | CSV import "read" | yes | no | no | no (button hidden) | no | n/a | **no** (imported) |
| 6 | `total_pages` lowered to ≤ `current_page` | **no** (no trigger on `books`) | no | no | no | no | at next re-infer | yes, retroactive |

- **Enforced:** `client` + `server:db` as listed.
- **Source:** `src/stores/progress.ts:425-466,495-665`; `src/stores/books.ts:223-245,325-352,376-411`; `src/composables/useOfflineSync.ts:76-88`; live triggers.
- **Target:** one server owner for completion effects, whatever the client or path (D-06 · BC-05). Offline replays become `save_progress` calls and run the full pipeline (BC-04). Which quiet completions (paths 4–5) get a passport is SES-Q06.

#### SES-96 · Page-count edits change completion silently
`updateBook` patches only `books`, and no trigger exists on `books`. Lowering `total_pages` to ≤ `current_page` makes the book `'finished'` with **no** completion effects: no purge, history, passport, prompt or Insight; the quest +25 XP is retroactive, dated by the progress row's last `updated_at`. Raising it above `current_page` on a finished book un-finishes it (SES-29). Captures and quizzes are already gone, the passport row stays but "View Journey" is hidden, and the book becomes hero-eligible again.
- **Enforced:** `client` (no server reaction).
- **Source:** `src/stores/books.ts:376-411`; live trigger list (none on `books`).
- **Target:** BC-05's "one owner regardless of path" requires completion to be evaluated when `total_pages` changes too (a trigger or RPC on `books`); the direction rules are SES-Q05.

### Book Passport

#### SES-44 · One passport per book
`book_passports` has one row per **book** (`book_passports_book_id_key UNIQUE (book_id)`, not per user+book). RLS: a single owner `ALL` policy. Columns: `total_days int?`, `peak_day date?`, `peak_day_pages int?`, `vocabulary_count int NOT NULL DEFAULT 0`, `ai_summary text?`, `generated_at timestamptz NOT NULL DEFAULT now()`.
- **Enforced:** `server:db`.
- **Source:** live `information_schema.columns`, `pg_constraint`, `pg_policies`.

#### SES-45 · Passport stat definitions
`get_book_passport_stats(p_user_id, p_book_id, p_time_zone DEFAULT 'UTC')` returns data only when `p_user_id = auth.uid()` and the caller owns the book; otherwise `{totalDays: null, peakDay: null, peakDayPages: null, vocabularyCount: 0}`.
- History pages are clamped to `[0, current total_pages]`.
- `page_delta = max(0, page − running max of earlier pages ordered by (recorded_at, id))`, a high-water mark, so backward edits never double count. The mark starts at **0**, so the first history row counts its whole page as read that day ⚠ SES-D18.
- `totalDays = max(1, ceil((last recorded_at − first recorded_at) / 86 400 s))` when any history exists, else null. This is **elapsed time**, not reading days.
- `peakDay` = the local date (`recorded_at AT TIME ZONE p_time_zone`) with the largest summed delta, ties to the earliest day; `peakDayPages` = that sum. Both are non-null whenever any history exists, even if every delta is 0 (then the earliest day with 0 pages).
- `vocabularyCount = count(lexicon_entries)` for the book and user, all entry types (quotes included).

- **Enforced:** `server:rpc` (`get_book_passport_stats`, SECURITY DEFINER, owner-guarded; EXECUTE granted to `anon` but returns the empty shape).
- **Source:** live `pg_get_functiondef(get_book_passport_stats)`; `has_function_privilege`.
- **Target:** stats are computed once at completion in the reader's stored IANA time zone and frozen (D-07 · BC-05 · BC-06). A baseline history row (SES-33) removes the first-row over-count (BC-04, recommended).
- **Note:** an unrecognised `p_time_zone` makes `AT TIME ZONE` raise SQLSTATE 22023 ("time zone … not recognized") once the book has history, so clients must send a valid IANA identifier.

#### SES-46 · When the passport is generated today
Generation happens **only** inside an online `updateProgress` that crosses 100 %, and only if `fetchPassport` finds no row. A per-tab `generating[bookId]` flag de-duplicates. It is never triggered by offline replay, add-book "completed", CSV import, the passport page or Book Detail ⚠ SES-D10.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:616-624`; `src/stores/bookPassport.ts:113-190`.
- **Target:** a server-owned, idempotent passport job runs once per first completion from any client or path (online save, offline replay, other device). It retries failures, validates a non-empty summary and persists the row; clients only read `book_passports` (D-06 · BC-05). Quiet completions: SES-Q06.

#### SES-47 · Passport generation sequence (web)
1. Call the stats RPC with the browser IANA time zone (fallback `'UTC'`).
2. Get the session access token, or throw "Not authenticated".
3. Raw `fetch` POST to `{VITE_SUPABASE_URL}/functions/v1/generate-recap` with `{title, author, isbn | null, percentage: 100, currentPage: totalPages, totalPages, mode: 'passport_summary'}`. The web sends no `apikey` header.
4. If `!response.ok`, throw `AI error: {status}`.
5. Stream text chunks into `streamingText[bookId]`.
6. Upsert `book_passports` `onConflict: 'book_id'` with the stats computed **before** streaming, `ai_summary` (the full text, possibly empty) and `generated_at = now(device)`.

Any **thrown** error (stats RPC, auth, HTTP status, stream) is logged and nothing is written; there is no retry. A failed upsert in step 6 is neither thrown nor logged (`if (!error && data)`). In the completion caller, `fetchPassport(bookId).then(…)` has no `.catch`, so a failed fetch is an unhandled rejection and generation never starts ⚠ SES-D12.
- **Enforced:** `client`; `server:edge` (`generate-recap` validation, SES-49).
- **Source:** `src/stores/bookPassport.ts:113-190`; `src/stores/progress.ts:619-623`.
- **Target:** replaced by the BC-05 server job. Mode `passport_summary` stays callable until the PWA migrates (D-05 · BC-05).

#### SES-48 · Passport stats are live and rewritten on view
Every `fetchPassport` cache miss (TTL 60 s) re-runs the stats RPC and **updates the stored row** if any stat differs. Passport stats are therefore live: e.g. `vocabulary_count` grows as words are added after completion. `ai_summary` is never regenerated. Triggers for a rewrite: the passport page, **every Book Detail mount** (it awaits `fetchPassport` for every book), and the SWR refocus revalidator after 60 s. The refresh uses the **viewing device's** time zone, so opening the passport from another zone can move and persist `peakDay` / `peakDayPages` ⚠ SES-D11.
- **Enforced:** `client`.
- **Source:** `src/stores/bookPassport.ts:55-103`; `src/pages/BookDetailPage.vue:91`.
- **Target:** frozen at completion; clients never write `book_passports` (BC-05 · BC-06).

#### SES-49 · The AI summary uses book metadata only
Model `gemini-2.5-flash`, temperature 0.8, `maxOutputTokens` 4096, thinking budget 0. The prompt asks for one celebratory paragraph of 90–100 words, with "No spoiler constraints". It uses title, author and ISBN (` ISBN: {isbn}.` only when truthy) — not the reader's captures, notes or recaps. Captures are already purged when generation starts (SES-40). Request validation needs `title`, `author`, `percentage !== undefined` and a truthy `totalPages`; `percentage`, `currentPage` and `totalPages` are otherwise unused. A body without `mode: 'passport_summary'` falls through to blurb (`currentPage === 0`) or recap. Success is `200 text/plain; charset=utf-8`, chunked, `Cache-Control: no-cache`. Errors are JSON `{error[, detail]}`: 401 "No authorization header" / "Unauthorized", 400 "Missing required fields", 503 "AI service not configured", 500 "Internal server error" with `detail`. A mid-stream failure aborts the body with no trailer. There is no 405 (a non-POST fails at `req.json()` → 500). CORS `*`.
- **Enforced:** `server:edge` (`generate-recap` v84, `handlers/passport.ts`, `prompts/passport.ts`, `index.ts`, `router.ts`).
- **Source:** deployed `generate-recap` v84 (matches repo `supabase/functions/generate-recap/`).
- **Target:** auth via verified JWT and no internal error text in 500s (BC-02). Grounding of the summary is SES-Q07.

#### SES-50 · Passport page states
- Loading: "Loading your reading journey...".
- Load error: "Could not load your reading journey." / "Please try again in a moment.".
- Generating without a row: "Crafting your reading journey…" with a live stream preview.
- No row and not generating: "Your passport is being generated." / "Check back in a moment." The page never triggers generation, so this state is **permanent** when generation failed or never ran ⚠ SES-D10.
- Content: three tiles ("{totalDays ?? —} days / to finish", "{peakDayPages ?? —} pages / peak day · {date}", "{vocabularyCount} / words learned"), "✦ Your Story So Far" (`aiSummary || streamText`) and "Share Journey".

Chrome: header "✦ / Reading Journey / {title} / by {author}"; "← Back" always pushes `book-detail` (not history back); if the book is not in the store the page loads it with `fetchLibrary()` (a plain `books` select). The peak date uses the device locale (`toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'})`) and is parsed with `new Date('YYYY-MM-DD')`, i.e. UTC midnight, so it shows one day early west of UTC ⚠ SES-D36.
- **Enforced:** `client`.
- **Source:** `src/pages/BookPassportPage.vue:23-38,55-143`.
- **Target:** the page reads the server job's state (pending / failed-will-retry / ready) instead of the dead end (BC-05).

#### SES-51 · Share Journey text
`I finished "{title}" by {author}! 📚✨\n\nRead in {totalDays ?? '?'} days with {vocabularyCount ?? 0} new words learned. #TheChronicler`. It uses `navigator.share` with title `My Reading Journey: {title}`, otherwise it copies to the clipboard silently ⚠ SES-D38.
- **Enforced:** `client`.
- **Source:** `src/pages/BookPassportPage.vue:40-47`.

#### SES-52 · "View Reading Journey" requires a manual book
The Book Detail button requires `isComplete && book.source === 'manual'`. The route itself is not guarded, and the completion prompt's "View Journey" has no source check. Imported books completed in-app get a passport but no button; manual books added as "Already finished" get a button to a dead end ⚠ SES-D14.
- **Enforced:** `client`.
- **Source:** `src/pages/BookDetailPage.vue:123`; `src/components/book/BookProgressPanel.vue:137-143`.
- **Note:** decision SES-Q06.

### Dashboard composition and hero

#### SES-53 · Dashboard mount sequence
1. `fetchLibraryWithProgress`. On a recorded error, show the toast "Some things didn't load" / "Reopen the app or refresh the page to try again." (30 s cooldown).
2. In parallel: `fetchProgress` + `upNext.fetchOrder`.
3. `lexicon.fetchEntriesForAllBooks`.
4. Word of the Day resolve + Anki session (fire-and-forget).
5. `fetchLoreForAllBooks` (fire-and-forget).
6. `initializeIfNeeded()` (hero).
7. Fetch recaps for the hero.

Any throw in steps 2–3 skips **every later step, including hero initialisation** ⚠ SES-D28.
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:157-190`; `src/composables/useLoadFailureNotice.ts:12-24`.

#### SES-54 · Dashboard render order
Greeting → skeleton while loading → state body. For `standard` and `oneInProgress` the body is: Hero (if any) → Word of the Day → Last Session → In Progress (if there are other in-progress books) → Up Next (**`standard` only**, if unread books exist) → Completed row (if completed > 0 and the state is not `completedOnly`).
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:224-240,316-450`.

#### SES-55 · Onboarding state derivation
Let active = `inProgressBooks` (0 < % < 100, not DNF), queued = books at 0 % that are not DNF, completed = books at ≥ 100 %:
- `empty` if there are no books;
- else `oneInProgress` if active = 1 and queued = 0;
- else `oneQueued` if active = 0, queued = 1 and completed = 0;
- else `completedOnly` if active = 0, queued = 0 and completed > 0;
- else `standard`.

A book at 0 % with an **active session** counts as queued.
- **Enforced:** `client`.
- **Source:** `src/composables/useDashboardOnboardingState.ts:28-93`.
- **Note:** only-DNF libraries, and "all unread plus ≥ 1 completed", give `standard` with no hero. A single 0 % book with a running session gives `oneQueued` with no hero and no visible timer.

#### SES-56 · Empty-state copy
- `empty`: "First book" / "Build your library" / "Add a book you are reading now, want to read next, or already finished.", buttons "Add a book" (→ `/books/add`) and "Import library" (opens the import dialog).
- `oneQueued`: "Ready when you are" / {title} / "Start this book to make it your active read.", buttons "Start reading" (→ Book Detail; **does not start a session**) and "Add another".
- `completedOnly`: "Library started" / "{n} completed book(s)" / "Your archive is in place. Add a current read when you are ready to track sessions and recaps.", up to 3 recent titles, buttons "Add current read" and "View library".

- **Enforced:** `client`.
- **Source:** `src/components/dashboard/DashboardEmptyState.vue`; `src/components/dashboard/CompletedOnlyState.vue`.

#### SES-57 · Greeting
Salutation by device-local hour: < 5 "Up late"; < 12 "Good morning"; < 18 "Good afternoon"; otherwise "Good evening". It is computed once per mount. The date line uses the English format `EEEE, MMMM d`. The name is community `display_name` → `username` → email local part → "Reader". When the identity has loaded and **no community profile exists**, the whole greeting is replaced by one button, "Set up your reader profile" / "Pick a username and an avatar" (→ `profile-edit`). While the identity loads, only the salutation and date show. With a profile, the avatar (image, or initials) links to `profile`.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/DashboardGreeting.vue:18-74`; `src/composables/useCommunityIdentity.ts:156-164`.

#### SES-58 · The hero lives in memory only
The hero ID is a module-level in-memory ref, lost on a full reload and **not persisted** anywhere. It records whether the selection was `explicit` (a tap) or `inferred` ⚠ SES-D27.
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:18-19`.
- **Note:** spec 011 (ephemeral) and spec 029 FR-014 (survives reload) conflict; the code follows 011. Decision: SES-Q01.

#### SES-59 · Hero inference
Candidates: books with progress where % < 100, not DNF, and (% > 0 **or** a session is active). Sort: books with an `up_next_order` row first, by `sort_position` ascending; then the rest by `progress.updatedAt` descending. The hero is the first candidate.
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:43-70`.

#### SES-60 · Keeping or replacing the hero
`initializeIfNeeded()` keeps the current hero if it is still readable: the book exists and is not DNF, and either (explicit and % < 100) or (inferred and in `inProgressBooks`, i.e. % > 0). Otherwise it re-infers. It runs on mount and whenever the `inProgressBooks` signature (`id:updatedAt`) changes. Shelving, deleting or completing the hero on Book Detail therefore re-infers through the signature watch while the Dashboard is mounted, otherwise on the next mount.
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:98-119`; `src/pages/DashboardPage.vue:192-200`.

#### SES-61 · Explicit selection
`setActive(id)` (an In Progress row or an Up Next cover) is a no-op when the ID is already the hero and otherwise marks the selection `explicit`. An explicitly chosen 0 % book stays the hero for the page lifetime, and is lost on reload unless a session was started.
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:76-80`.

#### SES-62 · Completing a non-hero book never moves the hero
`onBookCompleted(id)` re-infers **only** when the completed book is the current hero (spec 011 Q1).
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:87-92`.

#### SES-63 · In Progress list
In Progress = `inProgressBooks` minus the hero, sorted by `updatedAt` descending (**not** by `up_next_order`, unlike hero inference). It is a vertical list. Each row: cover, title, author, bar, `%` rounded to 0 dp, and a "New Lore" chip when unseen lore exists (tapping opens the book).
- **Enforced:** `client`.
- **Source:** `src/composables/useActiveBook.ts:37-41`; `src/stores/progress.ts:679-688`; `src/components/dashboard/InProgressSection.vue`.

#### SES-64 · Up Next shelf
Up Next = all books at exactly 0 % that are not DNF. Books with an `up_next_order` row come first by position; the rest follow in library-RPC order (`coalesce(rp.updated_at, b.created_at) desc`). The header has a count badge; tapping a cover makes it the hero without starting a session. Reordering happens on the Library page. **The hero is not excluded** from this shelf ⚠ SES-D25.
- **Enforced:** `client`.
- **Source:** `src/pages/DashboardPage.vue:202-215`; `src/components/dashboard/UpNextSection.vue`.

#### SES-65 · Completed row
Total completed count plus the 3 most recently updated covers (with a "+N" overflow), all as one button → `/library`.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/CompletedSection.vue`; `src/pages/DashboardPage.vue:217-222`.

#### SES-66 · Hero action area and display precision
- Idle: Start Session + Get Recap. When the recap is locked, Get Recap becomes a disabled "{lock label}" button (fallback "Read N more pages"); while the recap dialog is open it reads "Recap open".
- Active: timer card (pause · stop · `M:SS`/`H:MM:SS`) + "End Session" + "Focus mode" link. Get Recap is replaced only on the hero; on Book Detail it stays visible during a session.
- Precision: the hero and the Book Detail panel show `percentage.toFixed(1)` %, In Progress rows `toFixed(0)` %.
- Offline tag "Progress will sync when you're back online" renders **only on the hero card**; Book Detail has no pending-sync indicator.
- After an end-session save, a "✓ Saved" flag is set for 2 s, but it renders only while a session is active (`v-else-if`), so it shows only after an **offline** end (the online path clears the session first) ⚠ SES-D42.

- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:194-297`; `src/components/book/BookProgressPanel.vue:66`; `src/components/dashboard/InProgressSection.vue:65-67`; `src/pages/BookDetailPage.vue:307-316`; `src/pages/DashboardPage.vue:275-277`.
- **Note:** recap lock rules are owned by [03 · Recaps](03-recaps.md) (REC-03…10).

### Finish-date forecast and Insight nudge

#### SES-67 · Hero forecast line
`pagesLeft = max(0, total − current)`; `insight = pagesToNextInsight(current, total)`. If `insight ≤ 15` **and** `pagesLeft > 15`, show "N page(s) to your next Insight". Otherwise, if `pagesLeft > 0`, show "N pages left" (locale-formatted), plus "finish by ~{MMM d}" when velocity is known, where the date is device-local `today + days_left` with the English date-fns locale. The "you could finish today" branch exists but is unreachable (SES-70).
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:105-134,217-232`.
- **Note:** today the nudge can promise an Insight that never unlocks (SES-69) ⚠ SES-D37; with the BC-08 fallback (D-12) it becomes truthful.

#### SES-68 · Pages to the next Insight
`pct = current / total × 100` (unrounded); next milestone = `(floor(pct / 10) + 1) × 10`; null if it is > 90; `milestonePage = ceil(next / 100 × total)`; returns `milestonePage − current` when > 0, else null.
- **Enforced:** `client`.
- **Source:** `src/utils/milestoneDetect.ts:50-61`.

#### SES-69 · Insight milestone detection on save
Forward moves only. `bucket = floor(pct / 10) × 10` using the 2-dp rounded `prevPct` / `newPct`. When the bucket increases, return `min(newBucket, 90)` if it is ≥ 10 and > prevBucket. Multi-bucket jumps collapse to the latest bucket; skipped milestones are never back-filled. A card is generated only if a non-empty "master recap" exists (recaps with `progress_snapshot > 0` and `page_snapshot ≤ current_page`) and no card exists yet for that milestone; a backward-then-forward correction never re-bills it.
- **Enforced:** `client`; `server:db` uniqueness (`lore_cards_unique_milestone`).
- **Source:** `src/utils/milestoneDetect.ts:21-43`; `src/stores/loreCards.ts:99-185`.
- **Target:** detection moves into `save_progress`. Every crossed milestone (not only the latest) is generated or back-filled, including milestones crossed offline or failed, using the recap → captures → spoiler-guarded metadata fallback; inserts are `ON CONFLICT DO NOTHING`; clients only list and mark seen (D-06 · D-12 · BC-08).
- **Note:** generation rules are owned by [06 · Insights](06-insights.md) (INS-02…20).

#### SES-70 · Velocity RPC
`get_reading_velocity(p_user_id, p_book_ids uuid[])` returns `TABLE(book_id, days_left int)`:
- window: `progress_history.recorded_at > now() − 30 days` for the given books owned by `p_user_id`;
- `prev_page = lag(page)` over the **windowed** rows per book, so the oldest windowed row has no delta;
- session deltas: rows with `session_start_at` not null, a previous row, and a delta > 0;
- per-day deltas: `max(page) − min(page)` per `date_trunc('day', recorded_at)` in the DB zone (**UTC**), kept when > 0, so a day with a single save contributes nothing;
- `avg_pages` = the session average if there are ≥ 3 sessions, else the day average if there are ≥ 3 days, else none;
- `days_left = ceil((total − current) / avg_pages)`; rows are returned only when the average is > 0 and pages remain, so `days_left ≥ 1`.

The function computes "sessions left" when it uses the session average, but the UI labels the result as days ⚠ SES-D16.
- **Enforced:** `server:rpc` (`get_reading_velocity`; SECURITY DEFINER; no `auth.uid()` check, SES-85).
- **Source:** live `pg_get_functiondef(get_reading_velocity)`.
- **Target:** the per-day fallback buckets days in the reader's time zone (D-07 · BC-06); offline replays now contribute history (D-08 · BC-04); owner check (BC-01). Semantics: SES-Q08.

#### SES-71 · Client mapping of days_left
The client maps `days_left ≤ 0` to `'today'` and keeps other values as numbers. A missing book means null (no date shown). On an RPC error the whole map resets to `{}`.
- **Enforced:** `client`.
- **Source:** `src/composables/useReadingVelocity.ts:51-56,72,80`.

#### SES-90 · Forecast time zone and refresh
- The per-day fallback uses UTC days (server `TimeZone = UTC`, no role override), so one evening's reading can split across two "days", or two local days can merge.
- The finish date is `format(addDays(new Date(), n), "MMM d")` in device time with the English date-fns locale.
- The hero calls `velocity.fetch()` **only in `onMounted`**. `invalidate(velocity)` after a session save marks the key stale but neither clears `_velocityMap` nor refetches, so the hero's date stays stale until the Dashboard remounts or the hero changes. The cache is one key per user, not per book set: each call **replaces** the map, so whichever surface fetched first (hero with `[heroId]`, or Library with all reading books) decides what the other sees ⚠ SES-D15.
- Pencil edits and `total_pages` edits never invalidate velocity.

- **Enforced:** `client`; `server:rpc` (UTC buckets).
- **Source:** `src/components/dashboard/HeroBookCard.vue:108-121`; `src/composables/useReadingVelocity.ts:24-80`; live `pg_settings`.
- **Target:** reader time zone for day buckets (D-07 · BC-06).

### Last Session card

#### SES-72 · get_last_session
`get_last_session(p_user_id)` reads the most recent `progress_history` row across **all books** (timed or untimed). It returns null when there is none. Fields:
- `bookId`; `bookTitle` (fallback 'Unknown Book', unreachable because `books.title` is NOT NULL);
- `endedAt = recorded_at`; `startedAt = session_start_at`;
- `startPage` = the page of the previous row for that book (strictly earlier `recorded_at`; 0 if none); `endPage = page`; `pagesDelta = max(0, endPage − startPage)`;
- `durationSeconds = round(recorded_at − session_start_at)` when timed, else null (not clamped; can be negative);
- `velocityPph = round(delta / hours)` when timed, duration ≥ 60 s and delta ≥ 1;
- `completionDelta = round(delta / total × 1000) / 10` (1 dp, %), null only when `total_pages ≤ 0` (impossible: `books_total_pages_check`), so always present in practice (possibly 0);
- `finishPredictionSessions = ceil((total − endPage) / max(1, rollingVelocity × thisDurationHours))`, where rolling velocity = Σdelta / Σhours over the **last 3 valid sessions across all books** (the last row itself included when valid). This branch requires `pagesDelta ≥ 1`, pages remaining > 0 and a rolling velocity > 0; otherwise the value is `0` when `endPage ≥ total`, else null. An untimed row uses divisor `max(1, 0) = 1` ⚠ SES-D17;
- `sessionNote`.

The first history row of a book added mid-way reports `pagesDelta = endPage` and an inflated `velocityPph` ⚠ SES-D18.
- **Enforced:** `server:rpc` (`get_last_session`; SECURITY DEFINER; no `auth.uid()` check, SES-85).
- **Source:** live `pg_get_functiondef(get_last_session)`.
- **Target:** the card is built from the most recent **timed** session; untimed page changes no longer replace it (D-08 · BC-04). Owner check (BC-01). Baseline row (recommended, BC-04). Rolling-velocity scope: SES-Q09.

#### SES-73 · Card variants and copy
"Last Session" when `startedAt` is non-null, otherwise "Last Update". Both show the relative time, the cover (tap → image preview), the title, and the distance ("0 pages", or "N page(s) · p. {startPage+1} → p. {endPage}"). "This sitting · {x}% of the book" shows whenever `completionDelta` is not null, i.e. also for 0-page and backward updates. Timed-only fields: Time ("< 1 min" below 60 s or when negative, otherwise "{round(s/60)} minute(s)", no hours format), Velocity ("{n} pages/hr", locale-formatted; a null renders a muted "—"), and "At this pace" ("Finish next session! 🎉" when p ≤ 1, otherwise "~{p} more sessions"). With no history the slot renders nothing (the section wrapper is still emitted).
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/LastSessionCard.vue:10-27`; `src/components/dashboard/LastTimedSessionCard.vue:20-112`; `src/components/dashboard/LastUpdateCard.vue:18-28`.
- **Target:** the untimed "Last Update" variant no longer takes this slot (D-08).
- **Note:** after a completing timed session the card shows "Finish next session! 🎉" for an already finished book ⚠ SES-D17.

#### SES-74 · Relative time
< 120 s → "Just now" (a future timestamp from clock skew also gives "Just now"). Otherwise date-fns `formatDistanceToNow(addSuffix)`: "3 minutes ago", "about 1 hour ago", "1 day ago", "about 1 month ago". There is **no** "Yesterday" or "weeks" output, despite the code comments ⚠ SES-D42.
- **Enforced:** `client`.
- **Source:** `src/utils/date.ts:16-25`; `src/composables/useRelativeTime.ts:3-10`.
- **Note:** native wording: SES-Q12.

### DNF (session-relevant cascade)

#### SES-75 · Shelving ends a session without history; resuming touches only dnf_at
`markDnf` upserts `{current_page: local ?? 0, dnf_at: now(device), session_start_at: null, session_paused_at: null}`. It creates a row if none exists, **ends any running session without a history row** (no capture prompt, no session credit) and sends the cached page (SES-87). `resumeDnf` sets only `dnf_at = null` and requires an existing row (`.single()`). Neither writes `progress_history` or touches `up_next_order`; both bump `updated_at`.
- Shelved books are excluded from the hero, In Progress, Up Next and the queued count. Book Detail hides session controls, the pencil, chips, the capture prompt, Insights, the recap section and Memory Check, and shows "Shelved as Did Not Finish · {relative time}" with "Start reading again".
- Copy: link "Didn't finish it? Shelve this book"; confirm header "Didn't finish?", message "Shelve this book as Did Not Finish? Your progress and words are kept, but sessions, recaps and insights are paused until you resume.", buttons "Shelve it" / "Keep reading"; errors "Could not shelve the book. Try again." / "Could not resume the book. Try again.". The DNF list toasts "Back on the shelf" / "The book is back in your reading list." or "Resume failed" / "Could not resume the book. Try again.".

- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:351-417`; `src/components/book/BookProgressPanel.vue:76,86-109,155,181-188`; `src/pages/BookDetailPage.vue:223-248,286-304`; `src/pages/DnfListPage.vue:39-59`.
- **Target:** DNF/resume RPCs never send `current_page`; marking DNF ends an active session server-side. That is not a page change, so it adds no history row (D-08 · BC-04).
- **Note:** server stats ignore `dnf_at` (PRO-95). `completedBooks` does not exclude DNF, so a DNF book pushed to ≥ 100 % by a `total_pages` edit counts as finished. DNF rules beyond the session cascade are owned by [01 · Library](01-library.md) (LIB-90–95).

### Offline progress queue

#### SES-76 · The queue decision is made before any network attempt
The client queues only when `navigator.onLine === false` at save time. A save that fails while "online" (timeout, 5xx, DNS) is **rolled back with an error**, not queued.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:551,656`.
- **Target:** with `idempotency_key` (BC-04), a save that fails mid-flight can be queued and retried safely; native clients should queue on connectivity failures too.
- **Note:** platform-level queue rules are owned by [08 · Platform](08-platform-auth-account.md) (PLT-43–49).

#### SES-77 · What an offline save does and skips
Done: the optimistic local progress is kept; a record `{type: 'progress_update', payload: {bookId, currentPage, updatedAt}, retries: 0}` is added to IndexedDB; `pendingSync = true`; a Background Sync tag `progress-sync` is registered; the completion prompt still shows and the hero is re-inferred; `lastPageSavedAt[book] = now` is kept and never reverted.
Skipped: the history row, the session clear (the session stays active locally **and** on the server), the capture prompt, the last-session refresh, the passport and Insights ⚠ SES-D05.
Paused session: the local `sessionPausedAt` is nulled while the start stays unshifted, so the local timer resumes counting and jumps forward by the paused span while the server still holds `session_paused_at`; after a reload it shows paused again. If the IndexedDB `add` fails, `updateProgress` throws **after** the optimistic update with no rollback ⚠ SES-D31.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:507-529,656-664`; `src/composables/useOfflineSync.ts:31-47,91-100`.
- **Target:** the queued operation is a full `save_progress` call (page, note, `client_occurred_at`, `idempotency_key`). Its replay writes the history row at the original time, ends the session and runs the completion pipeline server-side (D-08 · BC-04 · BC-05).

#### SES-78 · Replay is a bare progress upsert
Replay calls only `syncToSupabase(bookId, currentPage)`, a `reading_progress` upsert of `current_page` as the **currently signed-in** user. The payload's `updatedAt` is ignored and the server stamps `now()` at replay. It never writes `progress_history`. Records replay FIFO with no staleness check, so an old queued page can overwrite a newer page saved elsewhere, and a replayed page ≥ total fires the completion purge ⚠ SES-D29.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:52-84`; `src/composables/useOfflineSync.ts:76-88`.
- **Target:** replay via `save_progress` with `client_occurred_at` (D-08 · BC-04). Conflict policy for stale replays: SES-Q18.

#### SES-91 · Offline progress on a never-started book can vanish before replay
Such a book has no `reading_progress` row, so its library entry keeps `progressId: null` (`applyProgressSnapshot` keeps the old id when the optimistic one is empty). The next progress fetch (TTL 30 s, a Dashboard or Book Detail mount, or a tab refocus) rebuilds the map from `libraryEntries`, **skips entries with `progressId === null`**, and replaces the whole map. The optimistic page therefore disappears from the hero, In Progress and Book Detail until the queue replays ⚠ SES-D30.
- **Enforced:** `client`.
- **Source:** `src/stores/books.ts:173`; `src/stores/progress.ts:105-128`.

#### SES-92 · IndexedDB failures break unrelated reads
The progress fetcher ends with `if (navigator.onLine) await drainQueue()`. `flushQueue` catches only per-record sync errors; `openDb()` / `getAll()` rejections propagate. When IndexedDB is unavailable, every online `fetchProgress` rejects, and the Dashboard mount aborts before `initializeIfNeeded()` (SES-53): no hero, plus the load-failure toast ⚠ SES-D31.
- **Enforced:** `client`.
- **Source:** `src/stores/progress.ts:131,149`; `src/composables/useOfflineSync.ts:79`.
- **Note:** unverified which current browsers still reject `indexedDB.open` (blocked site data, some private modes); this was not tested.

### Focus mode

#### SES-79 · Focus mode exists only during a session
The "Focus mode" link shows only while a session is active, and the overlay unmounts when the session ends. Opening or closing it never changes session state.
- **Enforced:** `client`.
- **Source:** `src/components/dashboard/HeroBookCard.vue:282-297`; `src/components/book/BookProgressPanel.vue:120-135`.

#### SES-80 · Screen wake lock
`navigator.wakeLock.request('screen')` on mount; re-requested on `visibilitychange → visible` while held; released on close, End Session or unmount. Failures are silent. It needs a secure context, so a plain-HTTP LAN host or an unsupported browser sleeps normally.
- **Enforced:** `client`.
- **Source:** `src/composables/useWakeLock.ts:12-53`.

#### SES-81 · Auto-dim
After 30 s without a `pointerdown`, a `rgba(0,0,0,0.94)` layer fades in over 1.2 s, showing the timer at 60 % indigo and "tap to wake"; it fades out in 0.15 s. The layer catches the waking tap so controls underneath cannot be hit. There is no dimming after "Time's up". Pausing neither dims early nor stops the dim timer.
- **Enforced:** `client`.
- **Source:** `src/components/session/FocusModeOverlay.vue:32-52,255-267,443-487`.

#### SES-82 · Reading-goal chips
Chips 15/30/45/60 min. Tapping a chip sets `goalStart = elapsedSeconds` and primes an `AudioContext` inside the gesture; tapping the active chip clears the goal; setting a new goal after time's up resets it. Remaining = `goal × 60 − (elapsed − goalStart)`, which freezes while paused. The display shows remaining time as `M:SS` (`H:MM:SS` past an hour), then "+M:SS" overtime, with "{elapsed} elapsed" underneath. Status text: "Paused" / "Time's up" / "Reading...".
- **Enforced:** `client`.
- **Source:** `src/components/session/FocusModeOverlay.vue:78-96,98-105,133-156,220`.

#### SES-83 · Goal reached
At zero (once per crossing): `timeUp = true`, the screen wakes, the chime plays (sine 880 Hz, ramp 0 → 0.28 in 20 ms, exponential decay to 0.001 at 1.1 s, stop at 1.2 s; dings at 0, 0.65, 1.9, 2.55, 3.8, 4.45 s, i.e. three double-dings), the device vibrates `[200, 100, 200]` where supported (not iOS Safari), and End Session pulses. The session keeps running. The goal is **not persisted**: it is lost when Focus mode closes, the session ends elsewhere, or the page reloads.
- **Enforced:** `client`.
- **Source:** `src/components/session/FocusModeOverlay.vue:100-156`.
- **Note:** the crossing is detected on the 1 s interval tick. When the tab is hidden or the phone locked, timers are throttled, so the chime and vibration are expected to fire late, on the first tick after return. This is inferred from timer-throttling behaviour and was not tested on devices. Focus-mode pause errors are swallowed although a comment claims the panel surfaces them ⚠ SES-D39. Decisions: SES-Q13.

### Authorization

#### SES-84 · Owner RLS without a book-ownership check
`reading_progress`, `progress_history`, `book_passports`, `up_next_order` and `books` each have the single policy `ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` (role `public`). The policies do **not** check that `book_id` belongs to the caller, so a client can write progress or history rows that reference another user's book ⚠ SES-D03.
- **Enforced:** `server:db` (RLS).
- **Source:** live `pg_policies`.
- **Target:** RLS on child tables checks book ownership (BC-01).

#### SES-85 · Three session RPCs trust p_user_id
`get_library_with_progress`, `get_last_session` and `get_reading_velocity` are `SECURITY DEFINER`, granted to `authenticated` (not `anon`), and never compare `p_user_id` with `auth.uid()`. Any signed-in account that knows a victim's UUID can read that library, active session, last book title and **private session note** ⚠ SES-D01. In contrast, `get_book_passport_stats` and `get_reading_stats` check `auth.uid()` (`get_book_passport_stats` is also executable by `anon`, returning the empty shape).
- **Enforced:** `server:rpc` (absence of check).
- **Source:** live `pg_get_functiondef`; `has_function_privilege`.
- **Target:** assert `p_user_id = auth.uid()`, keeping the parameter for PWA compatibility; revoke `anon`/PUBLIC EXECUTE (BC-01).

#### SES-86 · generate-recap does not verify the JWT signature
`generate-recap` runs with `verify_jwt = false`. `manualJwtDecode` only base64-decodes the payload to read `sub` and never verifies the signature; the passport path does not use the user ID at all ⚠ SES-D02. A second suspected defect: `atob(parts[1])` runs on a **base64url** segment, and WHATWG `atob` rejects `-` and `_`, which would map a valid token to `401 {"error":"Unauthorized"}`. This would happen when a payload byte is ≥ 0x80 (e.g. accented names in `user_metadata`) or the third byte of a 3-byte group is `>`, `?` or `~`. It is derived from `atob` semantics and code reading and was not reproduced against v84.
- **Enforced:** `server:edge` (absence of verification).
- **Source:** `supabase/functions/generate-recap/auth.ts`; live function settings.
- **Target:** `verify_jwt = true` (or a real `supabase.auth.getUser` check), drop the hand-rolled decode, no internal error text in 500s, and commit `supabase/config.toml` (BC-02).

### Account and lifecycle edges

#### SES-97 · Sign-out leaves session-domain state behind
Sign-out clears only the SWR metadata (`clearAll()` on user change) and reloads nothing. These survive in memory or on disk: the hero `activeBookId` (re-inferred because the book is not found), `lastSessionEnded`, `sessionPausedAt`, `lastPageSavedAt`, `pendingSync`, the progress map, `_lastSession`, `_velocityMap`, `quizByBook`, and the IndexedDB queue, which is not user-scoped and is **drained as the next user** ⚠ SES-D41.
- **Enforced:** `client`.
- **Source:** `src/stores/auth.ts:89,139-148`; `src/stores/progress.ts:31-46`; `src/composables/useActiveBook.ts:18-19`; `src/composables/useOfflineSync.ts:12-13`.
- **Note:** the full inventory is owned by [08 · Platform](08-platform-auth-account.md) and [11 · Cross-domain](11-cross-domain.md).

#### SES-98 · Book delete — session-domain effects
`DELETE books` cascades `reading_progress`, `progress_history`, `up_next_order` and `book_passports` (plus the other per-book tables). `removeBook` removes the local progress entry but does not purge IndexedDB queue records for the book (they fail on the FK forever, SES-78) and does not reset the hero (re-inferred because `bookById` is undefined). It does not invalidate `lastSession`, `velocity` or `readingStats`, so the Last Session card can show the deleted book for up to 30 s ⚠ SES-D40.
- **Enforced:** `server:db` (FK `ON DELETE CASCADE`); `client`.
- **Source:** `src/stores/books.ts:413-435`; live `pg_constraint`.
- **Note:** the full delete cascade is owned by [11 · Cross-domain](11-cross-domain.md).

---

## Flows

### F-1 · Session state machine (per book, today)

```
                    ┌──────────── cancel (clearSession) ─────────────┐
                    │                                                │
 IDLE ──Start──▶ [gate?] ──Begin/Skip──▶ ACTIVE ──pause──▶ PAUSED ──resume──▶ ACTIVE
  ▲                │ dismiss                │                 │
  │                ▼                        │ End Session     │ End Session (shift applied)
  │              IDLE                       ▼                 ▼
  └────────── save (online) ◀────── PAGE SHEET (end) ◀────────┘
              • history row with session_start_at
              • session cleared (un-awaited update)
  DNF shelve from ACTIVE/PAUSED ──▶ IDLE + dnf_at (no history)
  Offline save ──▶ stays ACTIVE (no history, session not cleared)
  Offline save while PAUSED ──▶ locally RUNNING (pause flag dropped, start unshifted), server still PAUSED
  Offline or stale completing save ──▶ "zombie" ACTIVE on a complete book; no UI can cancel it (SES-89)
```

Persisted at each step:

| Step | `reading_progress` | `progress_history` | Notes |
|---|---|---|---|
| Start | upsert `current_page` (the **local cached** value, or 0 without a local row; SES-87), `session_start_at = now(device)`, `session_paused_at = null`; trigger bumps `updated_at` | — | online only |
| Pause | `session_paused_at = now(device)` where a session exists | — | online only |
| Resume | `session_start_at += now − paused_at`, `session_paused_at = null` | — | online only; no-op when the local pause/start is unknown |
| Cancel | `session_start_at = null`, `session_paused_at = null` | — | no offline guard; errors swallowed |
| End (online) | (1) upsert `current_page`; (3) un-awaited clear of both session columns | (2) insert `{page, recorded_at = now(device), session_start_at = shifted start}` | then `lastSessionEnded` |
| End (offline) | local only, queued | — | the session stays active everywhere |
| DNF | upsert `{current_page: cached, dnf_at, session_* = null}` | — | ends the session without a record |

Failure paths:
- **Start, pause or resume error:** inline red text under the control ("Could not start session" / "Could not update the session" / the thrown message). In Focus mode, pause errors are swallowed.
- **End — progress upsert fails:** rollback and error (SES-31); the session stays active.
- **End — history insert fails:** silent. The page is saved, the session is still cleared (the clear depends only on the captured start), no capture prompt, and the session is lost from stats.
- **End — session clear fails:** silent. The server keeps `session_start_at` while the client shows idle. The in-page merge keeps the local session-less row (the failed update never bumped `updated_at`), so the session reappears only after a **full reload**. The next save then writes a second history row with the same `session_start_at`: `sessionsThisMonth` de-duplicates on `(book_id, session_start_at)`, but `totalReadingHours` and velocity double-count the time (SES-D07).

### F-2 · Session lifecycle under Phase 0 (target, BC-04)

1. `start_session(book_id)`: refuses complete or DNF books; inserts a missing row with `current_page = 0`; never touches an existing `current_page`; stamps `session_start_at = now()` (server); returns the row. Online only (SES-Q03).
2. `pause_session(book_id)` / `resume_session(book_id)`: server clock; resume applies the shift server-side.
3. `cancel_session(book_id)`: clears both columns; no history.
4. `save_progress(book_id, page, note, client_occurred_at, idempotency_key)`: validates the page; in **one transaction** upserts the page, inserts the history row (timed if a session is open, using the server clock, or `client_occurred_at` for an offline replay), ends any open session, detects a first completion and stamps `completed_at`. Returns at least the confirmed row, the history row id and whether this save completed the book; the exact shape is defined in BC-04. A repeated `idempotency_key` returns the original result.
5. Completion effects (BC-05) and Insight milestones (BC-08) run server-side after commit, from the history row.
6. DNF/resume RPCs: never send `current_page`; marking DNF ends an open session without history.

The PWA keeps working on the current PostgREST writes during the transition and then migrates to the same RPCs (D-05).

### F-3 · Page save — online, offline, failure (today)

1. Open the sheet (end mode from End Session; edit mode from the pencil). The input resets to the stored page.
2. Validate (SES-24) → Save → clamp (SES-27).
3. **Online:** SES-30 steps 1–12. Persisted: `reading_progress` (page), `progress_history` (page, device `recorded_at`, shifted start or null), session columns cleared (async), optionally `book_passports` (async) and `lore_cards` (async).
4. **Offline:** optimistic local state + IndexedDB record; nothing is persisted server-side until replay, and replay persists only the page (SES-77/78).
5. **Failures:** see F-1. "Online but failing" (timeout, 5xx) is rolled back with the raw error, not queued (SES-76).

Pencil correction (edit mode, no session) runs the same online path with `session_start_at = null`: it writes history, shows the capture prompt, starts the 6-hour recap cooldown and resets the 48-hour Memory Check clock (REC-04, CAP-61). Completion and milestone checks still apply.

### F-4 · Completion (online, Dashboard hero)

1. The reader ends a session at page = total (or corrects to total).
2. Upsert `current_page = total`. **DB triggers delete the book's page captures (with resumes) and its quiz** (SES-40). `updated_at = now()`, which also sets today's quest-year credit.
3. Insert the history row; clear the session; emit `lastSessionEnded`.
4. `fetchPassport` → no row → `generatePassport` streams the AI summary, then upserts the passport (SES-47).
5. Show "Finished: {title}". View Journey → `/books/:id/passport` (usually in the "Crafting your reading journey…" streaming state); Continue → stay.
6. `onBookCompleted(hero)` re-infers the hero, and the completed book moves to the Completed row. The capture prompt is no longer visible on the new hero card (event `bookId` ≠ hero).

Variants:
- **Book Detail:** the same save and prompt, but `onBookCompleted` is not called (the hero changes on the next Dashboard mount or signature watch). The inline capture prompt **is** shown. A capture saved then is inserted, its +5 XP event is recorded, and the capture is deleted in the same statement by `record_page_capture_quest_event`. The vocabulary-ledger insert then fails on the FK (logged), the resume update matches 0 rows, and the client keeps a ghost capture until reload (SES-D13).
- **Offline:** steps 3–4 never happen; the prompt promises a journey that is never generated, the passport page sticks at "Your passport is being generated.", and the session stays open on the complete book (SES-89). Captures and quiz are purged at replay.
- **Other paths:** see the SES-95 matrix (add-book "Already finished", import, `total_pages` edit).

Target: steps 2–4 and the Insight check happen inside or after `save_progress` on the server (BC-04 · BC-05 · BC-08). The client keeps steps 5–6 as UI.

### F-5 · Passport generation

Today: `none → generating(stream) → saved(ai_summary)`, or `generating → failed` (back to `none`, never retried). Once saved, stats refresh and are rewritten on fetch (SES-48); the summary is immutable, even when empty.

Target (BC-05): `completion detected → job queued → generating → ready` (stats frozen at completion, summary validated non-empty), or `→ failed_transient → retried`. The passport page renders the job state (SES-50).

### F-6 · Hero selection

```
mount → initializeIfNeeded
  hero null or no longer readable → infer (up_next_order position first, then most recent updatedAt) → 'inferred'
  tap In Progress row / Up Next cover → setActive → 'explicit'
  completion of the hero (Dashboard save) → onBookCompleted → infer
  inProgressBooks signature change → initializeIfNeeded (keeps a valid hero)
  hero shelved / deleted / completed on Book Detail → invalid at next initializeIfNeeded → infer
  full reload → state lost → infer
  sign-out / user switch → activeBookId survives (module ref) → bookById undefined → infer
```

### F-7 · Offline queue (today)

```
save while offline → IndexedDB add (autoIncrement id) → pendingSync = true → SyncManager.register('progress-sync') (Chromium only)
drain triggers: window 'online' │ SW 'sync' → postMessage FLUSH_PROGRESS_QUEUE to open windows │ any progress fetch while online │ tab refocus revalidator
drain: getAll() (key order = FIFO) → for each: upsert current_page as the current user → delete record; on error leave it and continue
after drain: pendingSync = false (even if records remain)
```

- `setupListeners()` runs on every app mount and registers `progress-sync` even when the queue is empty.
- No backoff; `retries` is never incremented; no cap. Records for a deleted book fail forever (FK `reading_progress_book_id_fkey`).
- Signed out: `syncToSupabase` throws "Not authenticated" and the records stay queued, to be replayed under whoever signs in next (SES-97).
- A record whose book is not in the local library is upserted, but its confirmed row is not applied locally.
- After a replay the confirmed row (including any still-open server session) is applied, and **no cache key is invalidated**.
- Concurrent drains (online event + SW message + fetch) each call `getAll()` independently and can replay out of order or twice.
- The service worker never touches IndexedDB and cannot flush after the tab is closed.

Target: each record is a typed, user-scoped `save_progress` operation with `client_occurred_at` and `idempotency_key`, replayed serially with backoff and dropped on permanent errors (BC-04; SES-Q18 for stale replays).

---

## Constants

| Name | Value | Meaning | Source |
|---|---|---|---|
| Completion threshold | `current_page ≥ total_pages` (≥ 100 %) | completion | `src/utils/completionPrompt.ts:9`; completion triggers |
| Client percentage precision | 2 dp, uncapped | `round(x × 10000) / 100` | `src/types/index.ts:440`; `src/stores/progress.ts:504` |
| Server percentage | 2 dp, capped at 100 | library RPC | `get_library_with_progress` |
| Displayed precision | hero/panel 1 dp; In Progress 0 dp; `completionDelta` 1 dp | display rounding | `HeroBookCard.vue:195`; `BookProgressPanel.vue:66`; `InProgressSection.vue:66`; `get_last_session` |
| Timer tick | 1 000 ms | elapsed refresh | `src/composables/useReadingSession.ts:37-39` |
| Timer label | `M:SS`; `H:MM:SS` from 3 600 s | session timer + Focus | `SessionStartButton.vue:41-49`; `FocusModeOverlay.vue:64-70` |
| Session note max | 160 chars | UI + DB CHECK | `SessionNoteField.vue:21`; `progress_history_session_note_check` |
| Note counter | shown at ≥ 140; warn at ≤ 10 left | note UI | `SessionNoteField.vue:22,59` |
| `AWAY_THRESHOLD_MS` | 48 h since last `recorded_at` | Memory Check gate | `src/composables/useBookQuiz.ts:28` |
| `AUTO_SAVE_CONFIDENCE` | 0.90 (Gemini-calibrated; recalibrate for Vision, D-15) | capture auto-save | `SessionCaptureField.vue:87` |
| Capture text max | 10 000 chars | capture cap | `SessionCaptureField.vue:90`; `page_captures_text_check` |
| `justSaved` | 2 000 ms | hero "Saved" flag | `src/pages/DashboardPage.vue:275-277` |
| Insight milestones | 10…90, step 10 | unlock buckets | `src/utils/milestoneDetect.ts:21-43`; `lore_cards_unlocked_at_milestone_check` |
| `MILESTONE_NUDGE_THRESHOLD` | 15 pages | hero Insight nudge | `HeroBookCard.vue:125` |
| Velocity window | 30 days | RPC history window | `get_reading_velocity` |
| Velocity minimum samples | ≥ 3 timed deltas, else ≥ 3 days | average selection | `get_reading_velocity` |
| Velocity day bucket | UTC calendar day (DB `TimeZone = UTC`) | per-day fallback | `get_reading_velocity` |
| Valid session | timed, ≥ 60 s, delta ≥ 1 | velocity/pace eligibility | `get_last_session`, `get_reading_stats` |
| Rolling pace window | last 3 valid sessions, all books | "At this pace" | `get_last_session` |
| Passport day bucket | device IANA zone, fallback `'UTC'` | peak day | `src/stores/bookPassport.ts:19-25` |
| Passport AI | `gemini-2.5-flash`, temp 0.8, 4 096 tokens, thinking 0, 90–100 words | summary | `generate-recap/handlers/passport.ts`, `prompts/passport.ts` |
| Relative "Just now" | < 120 s | relative time | `src/utils/date.ts:23` |
| Greeting hours | < 5 / < 12 / < 18 / else | salutation | `DashboardGreeting.vue:20-23` |
| Completed preview | 3 covers + "+N" | Completed row | `src/pages/DashboardPage.vue:217-222` |
| Load-failure toast cooldown | 30 000 ms | one toast per burst | `src/composables/useLoadFailureNotice.ts:12` |
| `DIM_AFTER_MS` | 30 000 ms | Focus auto-dim | `FocusModeOverlay.vue:32` |
| Dim layer | black 0.94; fade in 1.2 s, out 0.15 s | Focus dim | `FocusModeOverlay.vue:443-487` |
| `GOAL_PRESETS` | 15, 30, 45, 60 min | Focus goal chips | `FocusModeOverlay.vue:78` |
| Chime | 880 Hz sine, peak 0.28; offsets 0, 0.65, 1.9, 2.55, 3.8, 4.45 s | 3 double-dings | `FocusModeOverlay.vue:107-131` |
| Vibration | `[200, 100, 200]` ms | time's up | `FocusModeOverlay.vue:154` |
| Import placeholder pages | 100 (completed import rows get `current_page = 100`) | CSV rows without a page count | `src/stores/books.ts:254,307,329` |
| Add-book "reading" clamp | `[1, total − 1]`, default 1 (1-page book → complete) | initial status | `src/stores/books.ts:214-221` |
| IndexedDB | db `chronicler-offline` v1, store `progress_queue`, keyPath `id` autoIncrement | offline queue | `src/composables/useOfflineSync.ts:12-28` |
| Sync tag | `progress-sync` | Background Sync | `useOfflineSync.ts:96`; `src/sw.ts:63-66` |
| SW → window message | `{type: 'FLUSH_PROGRESS_QUEUE'}` | drain trigger | `src/sw.ts:72`; `src/App.vue:30` |
| `statement_timeout` (role `authenticated`) | 8 s | every PostgREST/RPC call | `pg_roles.rolconfig` |
| Recap lock (related) | +5 %, 6 h cooldown, 72 h idle grant | uses `lastPageSavedAt` and `updated_at` | `src/composables/useRecapLock.ts:6-8` ([03](03-recaps.md)) |
| SWR TTLs | see Caching & offline | cache freshness | `src/stores/*`, `src/composables/*` |

---

## Data touchpoints

Shapes, grants and indexes: [backend-contract](../backend-contract.md) §3 (tables), §8 (RPCs), §9 (triggers), §10 (edge functions).

| Object | Read / write | By whom |
|---|---|---|
| `reading_progress` | R/W (upsert page, session columns, `dnf_at`) | web progress store (start/pause/resume/cancel/save/DNF/initial status), import, queue replay; trigger bumps `updated_at` |
| `progress_history` | W insert (online save); W update `session_note`; R latest `recorded_at` per book | web progress store; read by the session and stats RPCs |
| `book_passports` | R; W upsert + stat rewrites | web passport store |
| `up_next_order` | R (Dashboard ordering, hero inference) | web Dashboard; written by Library reorder ([01](01-library.md)) |
| `books` | R (via library RPC; plain select on the passport page) | web |
| `page_captures`, `book_quizzes` | D on completion | DB triggers |
| `reading_quest_events` | W (+5 XP per captured page, survives the purge) | DB trigger `record_page_capture_quest_event` |
| `lexicon_entries` | R (count) | `get_book_passport_stats` |
| `get_library_with_progress` | R | Dashboard, Library, Profile |
| `get_last_session` | R | Last Session card, hero note |
| `get_reading_velocity` | R | hero forecast, Library cards |
| `get_book_passport_stats` | R | passport generation and refresh |
| `generate-recap` (`passport_summary`) | call (stream) | web passport store |
| `generate-page-resume`, `generate-book-quiz` | call | pre-start gate ([04](04-capture-resume-quiz.md)) |
| IndexedDB `chronicler-offline/progress_queue` | R/W | web offline queue |

Indexes used by these reads: `progress_history (user_id, recorded_at desc)`, `(user_id, book_id, recorded_at, id)`, `(book_id, user_id, recorded_at desc)`, partial `(user_id, session_start_at, recorded_at) WHERE session_start_at IS NOT NULL`; `reading_progress (user_id, updated_at desc)`, partial `(user_id, book_id, updated_at desc) WHERE current_page > 0`. No CHECK ties `progress_history.session_start_at ≤ recorded_at`.

---

## Client-side logic & server migration

Rules each client implements today, and where they go under Phase 0 (D-06). Until a work package ships, native clients replicate the "today" column exactly (with the defect fixes noted in Notes for native clients). The PWA migrates to the same RPCs (D-05).

| # | Rule (IDs) | Today | Phase 0 | After Phase 0 |
|---|---|---|---|---|
| 1 | Start guards: not complete, not DNF (SES-10) | client | `start_session` (BC-04) | server; clients still hide the controls |
| 2 | Page range and integer validation (SES-24, SES-27, SES-05) | client | `save_progress` validates (BC-04) | server + client UX validation |
| 3 | Save composition: upsert → history → session clear (SES-30) | client, 3 calls, non-atomic | `save_progress` (BC-04) | server |
| 4 | Pause/resume shift and save-while-paused shift (SES-18, SES-21) | client, device clock | session RPCs (BC-04) | server |
| 5 | Timestamps (SES-93) | device clock | server clock; `client_occurred_at` for replays (BC-04) | server |
| 6 | Column discipline: session/DNF writes must not send `current_page` (SES-87, SES-75) | violated | session + DNF RPCs (BC-04) | server |
| 7 | Completion detection (SES-04, SES-39) | client `prevPct < 100 ≤ newPct` | `save_progress` + `completed_at` (BC-04) | server; client reads the response flag |
| 8 | Completion effects: passport, Insight milestones, achievements, DNA eligibility (SES-39, SES-46, SES-69) | client (purge already server) | BC-05, BC-08, BC-09 | server |
| 9 | Passport stats refresh and rewrite (SES-48) | client on every view | frozen at completion (BC-05) | server; client read-only |
| 10 | Day buckets: velocity fallback, passport peak day (SES-70, SES-45) | UTC / viewer's device zone | reader's stored zone (BC-06) | server |
| 11 | Offline queue semantics (SES-76–78) | client, page-only replay | replay through `save_progress` (BC-04) | client queue, server semantics |
| 12 | Zombie/stale session hygiene (SES-89) | none | session ended by `save_progress` (BC-04); expiry SES-Q16 | server + client stale check |
| 13 | Session note trim / non-blank (SES-34) | client | `save_progress(note)` validates (BC-04) | server + client UX |
| 14 | Memory Check / "Previously" gate (SES-14, SES-15) | client | — | stays client ([04](04-capture-resume-quiz.md)) |
| 15 | Hero selection, onboarding states, In Progress / Up Next ordering (SES-55, SES-58–64) | client | — | stays client (UI); decisions SES-Q01, SES-Q14 |
| 16 | Forecast line, nudge math, finish-date formatting (SES-67, SES-68, SES-71) | client | — | stays client |
| 17 | Last Session card variant and copy (SES-73) | client | data source becomes timed-only (D-08) | stays client |
| 18 | Completion prompt and hero rotation (SES-41, SES-62) | client | driven by the save response (BC-04) | stays client |
| 19 | Greeting, relative time, date formats (SES-57, SES-74) | client | — | stays client |
| 20 | Focus mode (SES-79–83) | client | — | stays client |
| 21 | Session-row ownership and RPC owner checks (SES-84, SES-85) | none | BC-01 | server |

---

## Caching & offline

**SWR primitive** (`src/composables/useCache.ts`): each key is `fresh` (≤ TTL, no fetch), `background` (stale data served, then revalidated) or `loading` (no data). `invalidate` sets `fetchedAt = 0`; it neither clears data nor fetches, so the **next** `fetch*()` becomes a blocking load. Surfaces that fetch only `onMounted` (hero velocity, Last Session card) stay stale until they remount or an explicit refetch runs (the `lastSessionEnded` watcher in `useLastSession.ts:88-90`). A tab returning to visible re-runs registered revalidators for stale keys; velocity registers none. `clearAll()` runs on user change.

| Key | TTL | Notes |
|---|---|---|
| `progress:{uid}` | 30 s | hydrated from `libraryEntries` with no network when the library is loaded; per book the local entry wins when `local.updatedAt >= derived.updatedAt`, so changes that don't move `updated_at` (a `total_pages` edit) never refresh the cached percentage until reload |
| `library:{uid}` | 60 s | `get_library_with_progress` |
| `books:{uid}` | 60 s | plain `books` select |
| `lastSession:{uid}` | 30 s | `get_last_session` |
| `velocity:{uid}` | 365 days (explicit invalidation only) | one key per user; each call replaces the whole map (SES-90) |
| `bookPassport:{uid}:{bookId}` | 60 s | a miss re-runs stats and may rewrite the row (SES-48) |
| `upNext:{uid}` | 60 s | `up_next_order` |
| `readingStats`, `readingQuest:*`, `readingRecords`, `libraryBreakdown` | 120 s / 60 s | owned by [07 · Profile](07-profile-stats-goals.md) |

Invalidation matrix (this domain's writes):

| Action | progress | library | lastSession | readingStats | readingQuest* | velocity | bookPassport | libraryBreakdown |
|---|---|---|---|---|---|---|---|---|
| startSession | touch | ✔ | | | | | | |
| clearSession (cancel) | | ✔ | | | | | | |
| pause / resume | — | — | | | | | | |
| updateProgress online | touch | ✔ (2–3×) | ✔ | ✔ | ✔ | ✔ only if a session was active | | |
| updateProgress offline | — | ✔ (optimistic) | | | | | | |
| markDnf / resumeDnf | touch | ✔ | | | | | | |
| setInitialProgress | touch | ✔ | | ✔ | ✔ | ✔ | | ✔ |
| updateBook | | ✔ | | | ✔ | | | ✔ |
| removeBook | ✔ | ✔ | | | ✔ | | ✔ | ✔ |
| queue drain | — | — | — | — | — | — | — | — |
| passport generate / refresh | | | | | | | touch | |

Gaps: pencil edits and `total_pages` edits don't invalidate velocity; removeBook doesn't invalidate `lastSession`, `velocity` or `readingStats`; DNF doesn't invalidate `readingStats`, `velocity` or `readingQuest`; a queue drain invalidates nothing; `readingRecords` is never invalidated by progress writes (SES-D44).

Module singletons outside SWR (survive navigation and sign-out): `activeBookId` + selection source, `_lastSession`, `_velocityMap`, `quizByBook`, and in the progress store `sessionPausedAt`, `lastPageSavedAt`, `lastSessionEnded`, `pendingSync`.

Storage keys:
- IndexedDB `chronicler-offline` / `progress_queue`; record `{id: number (auto), type: 'progress_update', payload: {bookId, currentPage, updatedAt}, retries: 0}`; **not user-scoped**.
- No localStorage keys in this domain (Supabase auth uses its default `sb-<ref>-auth-token`).
- SW runtime caches `book-covers` (CacheFirst, 200 entries, 30 days, `covers.openlibrary.org`) and `isbn-api` (NetworkFirst, 100 entries, 7 days) are not user data.

Offline behaviour:
- Needs network: session start, pause, resume, cancel (no guard, fails), DNF, capture, passport, every RPC.
- Works offline: viewing cached screens and **saving a page** (queued, SES-77).
- The service-worker update reloads the page once (`controllerchange`). This closes Focus mode (goal lost), drops a pending capture prompt (SES-88), the in-memory `pendingSync` badge (records remain), an open sheet's typed value and the hero selection (SES-58). The session itself survives because it is server-side.

Target: refresh session columns on foreground, or add `reading_progress` to the Realtime publication (recommended, BC-14); a delta library RPC (`changed_since`, BC-14).

---

## Known defects

| ID | Defect | Impact | Fix |
|---|---|---|---|
| SES-D01 | `get_library_with_progress`, `get_last_session`, `get_reading_velocity` never compare `p_user_id` with `auth.uid()` (SES-85). | Any signed-in account can read another reader's library, active session, last book and private session note. | BC-01 owner assert (keep the param). |
| SES-D02 | `generate-recap` runs `verify_jwt = false` with decode-only auth; suspected base64url `atob` rejection of valid tokens (SES-86, unverified). | Forged tokens spend AI credits; a valid token could get 401 and kill passport generation. | BC-02. |
| SES-D03 | RLS on `reading_progress`, `progress_history`, `book_passports` doesn't check book ownership; the offline queue is not user-scoped (SES-84, SES-97). | A queued record drained after a user switch creates a progress row for another user's book. | BC-01 book-ownership RLS; user-scoped queue purged on sign-out. |
| SES-D04 | Session start and DNF upserts send the cached `current_page` (SES-87, SES-75). | A stale device rewinds real progress with no history trail and may re-fire the completion purge. | BC-04 session/DNF RPCs; meanwhile never send `current_page` with session/DNF writes. |
| SES-D05 | Offline session end is lossy: no history, session never cleared, time lost from stats; a paused session desyncs (SES-77, SES-78). | Offline reading is invisible to streaks, charts, velocity and the passport; the reader must cancel a still-running session. | BC-04 replay through `save_progress` with `client_occurred_at` (D-08). |
| SES-D06 | "Zombie" sessions on complete books; no UI can cancel them (SES-89). | Stale `sessionStartAt` leaks to every client (Live Activities, widgets). | BC-04 (save ends the session); client stale-session check; SES-Q16. |
| SES-D07 | The post-save session clear is un-awaited and unchecked (SES-30 step 9). | The session reappears after reload; the next save writes a second history row with the same start and double-counts hours and velocity. | BC-04 atomic save. |
| SES-D08 | A failed history insert is swallowed while the session is still cleared (SES-30 step 8). | The page is saved but the session vanishes from stats; no capture prompt; cooldown anchor stays optimistic. | BC-04 atomic save. |
| SES-D09 | Saves are not idempotent (SES-94). | Double taps or retries write duplicate history rows (+10 XP each, inflated stats). | BC-04 `idempotency_key`. |
| SES-D10 | No passport for add-book "finished", offline completions or failed generations; no retry; the page never triggers generation (SES-46, SES-50). | "View Journey" leads to a permanent "being generated" dead end. | BC-05 server job; SES-Q06. |
| SES-D11 | Passport stats are rewritten on every view (incl. every Book Detail mount), from the viewer's time zone (SES-48). | The "frozen" record drifts; two devices in different zones keep rewriting `peak_day`. | BC-05 freeze at completion; BC-06 stored zone. |
| SES-D12 | Empty AI stream persisted as `ai_summary = ''`; upsert errors swallowed without a log; `fetchPassport().then()` has no catch (SES-47). | Permanently blank summary; silent failures; unhandled rejection. | BC-05 validates non-empty; until then add a catch and treat empty as failure. |
| SES-D13 | The capture prompt is offered after a completing save (Book Detail); the capture is deleted in the same statement while its +5 XP is recorded (SES-37). | The reader's capture silently disappears; vocab ledger fails on the FK; ghost capture in the client. | Suppress the prompt on completing saves (SES-Q11); drop the ghost locally. |
| SES-D14 | `canViewJourney` requires `source = 'manual'` (SES-52). | Imported books completed in-app hide an existing passport; manual "finished" adds show a dead-end button. | SES-Q06. |
| SES-D15 | Velocity cache is one key per user and each call replaces the map; the hero fetches only on mount; pencil and `total_pages` edits never refresh it; an error resets the map (SES-90). | Finish dates vanish or go stale on the hero and Library. | Cache per (user, book), merge results, refetch after every history-producing save. |
| SES-D16 | `days_left` is sessions-left labelled as days; the per-day fallback uses UTC days and needs ≥ 2 saves per UTC day; the "today" branch is unreachable (SES-70). | Misleading "finish by" dates. | BC-06 reader zone; SES-Q08. |
| SES-D17 | `finishPredictionSessions = 0` for a finished book renders "Finish next session! 🎉"; untimed rows still compute a prediction with divisor 1 (SES-72, SES-73). | Wrong copy after completion; a trap for native clients. | Hide "At this pace" when `endPage ≥ total`; RPC returns null for untimed rows (D-08). |
| SES-D18 | A book added mid-way has no baseline, so its first history row counts the whole start page (SES-45, SES-72). | Inflated Last Session pages and pages/hr, passport peak day and stats. | BC-04 baseline row (recommended); SES-Q17. |
| SES-D19 | `get_reading_stats` uses a lag delta, so backward-then-forward corrections re-count pages, unlike the passport's high-water mark. | Inflated week/month/records stats (cross-domain, [07](07-profile-stats-goals.md)). | High-water deltas for forward changes only (D-08 · BC-04/BC-06). |
| SES-D20 | The completion prompt uses unrounded `page / total × 100`; passport and milestone checks use the 2-dp value (SES-41). | Diverge for `total_pages ≥ 20 000` (99.995 % rounds to 100). | Integer compare `page ≥ total` / server flag (BC-04). |
| SES-D21 | After a `total_pages` edit the progress map keeps the stale percentage; the next save's stale `prevPct` can drop an Insight milestone or misplace completion detection. | A missed 40 % Insight; the hero line and % bar disagree. | Derive % at use time; server detection (BC-04, BC-08). |
| SES-D22 | CSV-import enrichment raises `total_pages` on a placeholder "read" book and un-completes it (SES-29). | A finished import becomes "reading" at 100/350 and can become the hero. | Keep `current_page = total_pages` for completed books when the page count changes (SES-Q05; [01](01-library.md)). |
| SES-D23 | `updated_at` is bumped by session start, pause, cancel and DNF; the local bump is applied only for start (SES-06, SES-07). | Reorders lists and hero, changes "last read", resets the recap idle clock, moves the quest year; behaviour differs before and after reload. | `completed_at` for the quest (BC-04); SES-Q15. |
| SES-D24 | Pause state is cached for the page lifetime; resume no-ops without a local `pausedAt` (SES-20). | A pause or resume on another device is invisible; the timer is wrong. | Refetch on foreground and library refresh; BC-14. |
| SES-D25 | The Up Next shelf doesn't exclude the hero (SES-64). | An explicit 0 % hero appears twice; violates the hero-exclusion invariant in `useActiveBook.ts:15-16`. | Exclude the hero (SES-Q14). |
| SES-D26 | `up_next_order` rows are never removed; stale positions outrank recency in hero inference (SES-43, SES-59). | A long-finished queue position can pick the wrong hero. | SES-Q14. |
| SES-D27 | The hero is lost on reload, including an explicitly chosen unread book (SES-58). | Spec 029 FR-014 / 020 FR-013 unmet. | SES-Q01. |
| SES-D28 | Any throw in Dashboard mount steps 2–3 skips hero initialisation; Book Detail mount has no try/catch (SES-53). | No hero; on Book Detail, later steps (word count, lore seen) silently skipped. | Isolate each step's errors. |
| SES-D29 | Offline queue robustness: `retries` never incremented; no backoff, cap or dead-letter; deleted-book records retry forever; concurrent drains race; `pendingSync` cleared on failure and lost on reload; FIFO with no staleness check (SES-78, F-7). | Stale pages overwrite newer ones; poison records loop; the badge lies. | Serial drain with a mutex, backoff, drop on 23503/42501, persisted pending state; BC-04 idempotency; SES-Q18. |
| SES-D30 | Offline progress on a never-started book disappears locally before replay (SES-91). | The reader's save seems lost for up to the replay. | Keep optimistic entries with no `progressId` in the derived map. |
| SES-D31 | IndexedDB failures propagate: online progress fetches reject, Dashboard loses the hero; an offline enqueue failure leaves the unsaved page on screen (SES-92, SES-77). | No hero; silent data loss. | Catch queue errors in the fetcher; roll back the optimistic offline update on enqueue failure. |
| SES-D32 | A failed online save while paused does not restore `sessionPausedAt` (SES-31). | The local timer runs while the server is paused. | Restore it in the rollback. |
| SES-D33 | `lastSessionEnded` is a single in-memory slot (SES-88). | A second save overwrites another book's capture prompt; a reload drops it for good. | Key pending prompts by history row id; persist them. |
| SES-D34 | Non-integer pages pass the sheet and the DB rejects them (SES-24). | The hero shows a raw Postgres error. | Integer-only input; server validation (BC-04). |
| SES-D35 | Device-clock timestamps (SES-93, SES-19). | Negative or under-counted durations, a negative timer, negative `durationSeconds`. | BC-04 server clock. |
| SES-D36 | The passport parses `peakDay` with `new Date('YYYY-MM-DD')` (UTC midnight) (SES-50). | Shows one day early west of UTC. | Parse as a floating calendar date. |
| SES-D37 | The hero nudge promises an Insight that never unlocks without a recap (SES-67, SES-69). | Broken promise for readers who never generate a recap. | BC-08 fallback (D-12). |
| SES-D38 | Share: `navigator.share` AbortError unhandled; clipboard fallback gives no confirmation (SES-51). | Console error on cancel; the reader doesn't know the text was copied. | Catch AbortError; show a "Copied" toast. |
| SES-D39 | Focus-mode pause errors are swallowed; a comment claims the panel surfaces them (SES-83). | Silent failures inside Focus mode. | Show the error in the overlay. |
| SES-D40 | Book delete leaves queue records (retry forever) and doesn't invalidate `lastSession`, `velocity`, `readingStats` (SES-98). | The Last Session card shows a deleted book for up to 30 s. | Purge the book's queue records and invalidate those keys. |
| SES-D41 | Sign-out leaves session-domain state and the queue behind (SES-97). | The next user replays the previous user's records. | Purge all per-user state on any user change ([08](08-platform-auth-account.md)). |
| SES-D42 | Dead code, inert UI and stale comments: `conflictWarning`/`sessionConflict` never emitted or handled; `iconOnly` unused; the "Saved" flag reachable only offline; unreachable "No pages read" confirm; `useReadingSession.clearSession` unused; duplicate `upNext` computed in `useActiveBook`; DB `after_page_capture_saved()` attached to no trigger; date-helper comments claiming "Yesterday"/"weeks"; `useOfflineSync.ts:5-7` claims the SW flushes after the tab is closed. | Misleads maintainers and native ports. | Remove or fix; drop `after_page_capture_saved` under BC-01. |
| SES-D43 | `useOfflineSync.ts` and `App.vue:29` use the `function` keyword. | Violates the project's arrow-functions-only rule. | Convert to arrow functions. |
| SES-D44 | Invalidation gaps (see Caching & offline). | Stale velocity, stats, quest and records after edits, DNF, delete and replay. | Complete the invalidation matrix. |

---

## Open decisions

| ID | Question | Current behaviour | Recommendation |
|---|---|---|---|
| SES-Q01 | Should the explicitly chosen hero survive relaunch, and per device or per account? | Ephemeral module ref; lost on reload (SES-58). | Persist per account (e.g. a server-side setting) so web, iOS and widgets agree; inference stays the fallback. |
| SES-Q02 | May several books have running sessions at once? | Allowed; no guard; the "confirm before discarding" conflict dialog was never built (SES-08, SES-13). | One active session per user: `start_session` returns a conflict naming the other book, and the client offers end or cancel. This also simplifies the Live Activity. |
| SES-Q03 | Should session start, pause, resume and cancel work offline? | All online-only; only page saves queue (SES-09). | Keep start/pause/resume/cancel online-only in v1 (they need the server clock); ending offline is covered by queued `save_progress` (D-08 · BC-04). |
| SES-Q04 | Is there a re-read or "un-complete" flow? | No UI can lower the page after completion (SES-29). | Add an explicit "Read again" action that starts a new read-through (keeps `completed_at`, resets `current_page`), rather than unlocking the pencil. |
| SES-Q05 | When `total_pages` changes, what happens to completion? | Raising un-completes silently (imports); lowering completes with no effects (SES-29, SES-96). | Server rule: a book with `completed_at` stays complete (set `current_page = total_pages`); lowering to ≤ `current_page` runs the BC-05 pipeline. |
| SES-Q06 | Which completions get a passport, and when is "View Reading Journey" shown? | Only online in-app crossings generate; the button needs `source = 'manual'` (SES-46, SES-52). | Generate for any completion with ≥ 1 history row (any client or path, incl. offline); show the button whenever a passport row exists; no AI job for imports or "already finished" adds without history. |
| SES-Q07 | Should the passport summary be grounded in the reader's own material? | Title/author/ISBN only, no spoiler constraints (SES-49). | Ground it in the reader's recaps (they survive completion) with a metadata fallback, inside the BC-05 job; captures are purged by then. |
| SES-Q08 | What does the finish estimate mean? | `days_left` mixes sessions-left and days; shown as a date (SES-70). | Return days from a per-day pace in the reader's zone (BC-06), and optionally sessions-left separately; show a date only for real days. |
| SES-Q09 | Should the "At this pace" prediction use the same book or all books? | Last 3 valid sessions across all books; spec 013 FR-004 says same book (SES-72). | Same book when it has ≥ 3 valid sessions, otherwise all books. |
| SES-Q10 | Where is the session note entered, shown and edited? | Only via "Add note instead" in the capture prompt; shown only on the hero; not editable; spec 013 FR-007 says the Last Session card (SES-35, SES-36). | Offer the note in the end-session sheet (sent through `save_progress`), show it on the Last Session card, allow later edits. |
| SES-Q11 | After which saves should the capture prompt appear? | After every online save with history, including backward edits and completing saves (SES-37, SES-D13). | Only after forward saves that don't complete the book; suppress on completion (the capture would be deleted) and on backward or zero-delta corrections. |
| SES-Q12 | Should native relative-time wording match the web? | date-fns strings ("1 day ago", "about 1 month ago") (SES-74). | Use platform formatters (localised); accept the difference. |
| SES-Q13 | Focus mode: persist the goal? Notify at goal end when locked? Really dim the screen? | Goal in memory only; chime only while visible; simulated dim overlay (SES-81–83). | Persist the goal for the session on the device; schedule a local notification at goal end (ask permission on the first chip tap); real dimming with guaranteed restore. |
| SES-Q14 | Up Next semantics: exclude the hero? Remove `up_next_order` rows when a book leaves 0 %? | Hero not excluded; rows never removed; stale rows steer hero inference (SES-43, SES-64). | Exclude the hero; remove the row when a book starts (server side, in `start_session`/`save_progress`) and ignore rows for books > 0 % in inference. |
| SES-Q15 | Which writes move "last read" (`updated_at`)? | Every UPDATE, including session-only and DNF writes (SES-06). | Add an explicit last-page-change timestamp (or derive "last read" from the latest forward history row) for ordering, hero recency and the recap idle clock (BC-07); keep `updated_at` technical. |
| SES-Q16 | Should abandoned sessions expire? | Never; zombies persist (SES-89). | Treat a session older than 12 h (the records cap) as stale: the server reports it as stale and clients ask to end or cancel; no automatic history row. |
| SES-Q17 | How is the BC-04 baseline history row represented? | No baseline; the first row over-counts (SES-33, SES-D18). | A marked row (e.g. a `kind`/`is_baseline` column) excluded from XP, streaks, charts, Last Session and velocity; decide whether to back-fill existing mid-way books. |
| SES-Q18 | What happens when an offline replay is older than the server's latest change? | FIFO last-write-wins; an old page can overwrite a newer one (SES-78). | Always record the history row at `client_occurred_at` (D-08), but update `current_page` only when the replay is newer than the server's last page change; the idempotency key de-duplicates. |
| SES-Q19 | Do Live Activities, Dynamic Island and the session widget ship in iOS v1? | Not applicable to the PWA. | Ship the Live Activity in v1 (the timer derives from timestamps, so no per-second updates); widgets can follow. |

Questions answered by the 2026-10-18 decisions and therefore not repeated: clock authority (D-06 · BC-04), security fix timing (BC-01/BC-02 Required), "what counts as a reading session" (D-08), passport immutability (BC-05), one server owner for completion effects (BC-05), multi-device page authority for session/DNF writes (BC-04), Insights without recaps and skipped milestones (D-12 · BC-08), day boundaries (D-07 · BC-06). Realtime vs foreground refresh is not repeated here either: it stays open as PLT-Q12 in [08](08-platform-auth-account.md) (BC-14, recommended).

---

## Notes for native clients

### Platform-agnostic (iOS now, Android later)

- **Use the Phase 0 RPCs as soon as they exist** (`start_session`, `pause_session`, `resume_session`, `cancel_session`, `save_progress`, DNF/resume). Until then:
  - replicate SES-30's exact order and the pause shift;
  - **never send `current_page` with start, pause, resume, cancel or DNF writes**, using plain updates (or `INSERT … ON CONFLICT DO UPDATE SET session_start_at = excluded.session_start_at, session_paused_at = NULL` when the row may be missing);
  - use one clock consistently for start and end.
- **The session lives on the server.** Render the timer from `session_start_at` / `session_paused_at`; never treat a local counter as the truth. Re-read both columns on foreground, on pull-to-refresh and on every library refresh (the library RPC omits `session_paused_at`).
- **Stale sessions:** treat a session on a complete or DNF book as stale and clear it (end any Live Activity); see SES-Q16 for age-based expiry.
- **Percentage:** derive it from `(current_page, total_pages)` at use time, 2 dp, capped at 100. Completion is the integer compare `current_page ≥ total_pages`.
- **Page entry:** integers only, clamped to `[0, total_pages]`; block unchanged values; the same copy as SES-25.
- **Completion:** once BC-05 ships, rely on the save response for the prompt and hero rotation; don't generate passports or Insights client-side. Never offer a capture on the completing save (it is deleted immediately, SES-D13). Any client-side use of captures must happen before the completing write.
- **Passport:** read-only after BC-05. Parse `peakDay` as a floating calendar date (no time zone). Add a retry/pending state; never the "being generated" dead end. Share text as SES-51.
- **Last Session card:** after D-08 it shows timed sessions only. Hide "At this pace" when the book is finished and for untimed rows.
- **Velocity:** cache per (user, book), merge rather than replace, and refetch after every history-producing save, pencil edits included.
- **Offline queue:**
  - user-scoped and persisted across launches;
  - typed operations (`save_progress` with page, note, `client_occurred_at`, `idempotency_key`);
  - serial drain with exponential backoff and a cap;
  - drop records on permanent errors (FK 23503, RLS 42501);
  - purge the book's records on delete and all records on sign-out (or flush first);
  - show a pending-sync indicator that survives relaunch;
  - also queue when an online save fails for connectivity reasons (safe with the idempotency key).
- **Time zone:** send the device IANA identifier wherever a `p_timezone` / `p_time_zone` parameter exists (an invalid value makes the passport RPC fail). After BC-06 the reader's zone is stored server-side.
- **Timeouts:** the `authenticated` role has an 8 s `statement_timeout`; set request timeouts ≥ 10 s and treat SQLSTATE 57014 as retryable once.
- **Sign-out:** purge all per-user state: caches, the hero, pending prompts, queued saves, widgets, Live Activities.
- **Hero, onboarding states, ordering, greeting and forecast** are UI rules: reproduce SES-54–68 exactly unless SES-Q01/SES-Q14 change them.
- **Don't copy the defects in the Known defects table**, notably SES-D04, SES-D05, SES-D07, SES-D13, SES-D15, SES-D17 and SES-D29.

### iOS-specific (iOS 26+, iPhone first — D-04)

- **Timer:** `Text(timerInterval:pauseTime:countsDown:)` or `TimelineView(.periodic(from:by: 1))`, with `.monospacedDigit()`, Dynamic Type via `@ScaledMetric`, and a VoiceOver label such as "Session active, 12 minutes elapsed" without per-second announcements.
- **Live Activity (ActivityKit) and Dynamic Island** for the running session (SES-Q19):
  - attributes `{bookId, title, author, totalPages}`, content state `{sessionStartAt (shifted), pausedAt?, currentPage}`;
  - render with `Text(timerInterval:)`, so the system ticks and updates are pushed only on pause, resume and end;
  - pause and resume via `LiveActivityIntent` buttons calling the session RPCs (they need the session token in the App Group/Keychain);
  - "End" deep-links into the end-session sheet, because a page number cannot be entered in the activity;
  - end the activity on save, cancel, DNF, completion, or when a fetch shows the session ended elsewhere;
  - activities are capped by the system (about 8 h active), so handle longer sessions.
- **In-app running session:** a `TabView` `.tabViewBottomAccessory` showing the timer is a natural Liquid Glass fit.
- **Glass:** use native Liquid Glass (`.glassEffect`, `GlassEffectContainer`) for the timer card and session controls, with no pre-iOS-26 fallback. Respect Reduce Transparency and Increase Contrast with solid surfaces, and Reduce Motion (no dim fade or shimmer). Keep text-dense sheets (page sheet, completion prompt) opaque.
- **Page sheet:** `.sheet` with `.presentationDetents([.medium])`, a `Stepper` plus a `TextField` with `.keyboardType(.numberPad)` and a keyboard toolbar "Done". `.sensoryFeedback(.success)` on save and `.warning` on a blocked save.
- **Pre-start gates:** present Memory Check and "Previously" as sheets. Write the session only on the explicit begin action and treat swipe-dismiss as abort (SES-15).
- **Focus mode:**
  - full-screen cover with `UIApplication.shared.isIdleTimerDisabled = true` while visible; reset it on disappear and when `scenePhase` leaves `.active`;
  - real dimming through the window scene's screen brightness after 30 s, restored on tap, exit, background and termination; keep the black overlay to swallow the wake tap;
  - goal end while backgrounded or locked: a `UNTimeIntervalNotificationTrigger` with a short sound (`.timeSensitive` needs the capability and can be revoked; fall back to `.active`), cancelled on goal clear, session end or pause; ask notification permission on the first chip tap;
  - foreground chime via `AVAudioPlayer`/`AVAudioEngine` with the `.ambient` session category (respects the silent switch, doesn't stop the user's music); haptics via `UINotificationFeedbackGenerator` / Core Haptics; no `audio` background mode (rejection risk).
- **Capture prompt:** on-device Apple Vision text recognition first, `ocr-page` (Gemini) as the fallback on low confidence; the 0.90 auto-save and 0.70 warning thresholds are Gemini-calibrated and must be recalibrated for Vision (D-15).
- **Completion:** `.alert` or a celebratory sheet with `.sensoryFeedback(.success)`; then rotate the hero and reload widget timelines.
- **Share Journey:** `ShareLink` with the SES-51 text; optionally a card image rendered with `ImageRenderer`.
- **Passport streaming (only until BC-05):** supabase-swift `functions.invoke` buffers responses, so stream with `URLSession.bytes(for:)` (Authorization + `apikey` headers), send `mode: "passport_summary"` explicitly, and upsert only after a **non-empty** stream. The streamed functions API in newer supabase-swift versions was not checked.
- **Dashboard:** `ScrollView` + `LazyVStack` in SES-54 order; In Progress is a vertical list; Up Next a horizontal `ScrollView`. Greeting from `Calendar.current.component(.hour, from:)` with the same thresholds; localised dates via `Date.FormatStyle`; `RelativeDateTimeFormatter` per SES-Q12.
- **Widgets:** a "Currently Reading" widget uses the same hero rule (or the persisted hero, SES-Q01) from an App Group cache, never the network with the user token. Reload timelines after every save.
- **Orientation:** portrait only on iPhone (parity with the PWA manifest).
