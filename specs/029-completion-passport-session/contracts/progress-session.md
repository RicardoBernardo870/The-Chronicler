# Contract: Progress Session Start

## Purpose

Define the expected behavior when a user presses Start Session for an eligible active book, including books selected after completing another book and books that do not yet have a `reading_progress` row.

## Actors

- Reader using Dashboard or Book Detail.
- `SessionStartButton`.
- `useReadingSession(bookId)`.
- `useProgressStore.startSession(bookId)`.
- Supabase `reading_progress`.

## Preconditions

- User is authenticated.
- User is online.
- `bookId` belongs to the user.
- Book is eligible for reading and is not already completed.

## Expected Behavior

### Existing Progress Row

1. User presses Start Session.
2. The store writes `session_start_at = now` for the matching `book_id,user_id`.
3. Local progress and library-entry snapshots receive the confirmed `sessionStartAt`.
4. The button changes to active session state and starts elapsed time display.

### No Progress Row

1. User presses Start Session.
2. The store creates a `reading_progress` row for `book_id,user_id` with `current_page = 0` and `session_start_at = now`.
3. The new row is mapped into local progress state.
4. The active book remains selected.
5. The button changes to active session state without requiring a separate page save.

## Non-Goals

- Do not create a `progress_history` row on session start.
- Do not generate a capture prompt on session start.
- Do not set current page to 1 automatically.
- Do not support offline Start Session in this feature.

## Error Behavior

- Not authenticated: show existing user-facing error path.
- Offline: show existing Start Session offline error.
- Book not found or not owned: fail without creating local session state.
- Server write failure: do not show active session state.

## Cache And State Requirements

- Invalidate or touch the same library/progress cache keys currently used by progress mutations.
- Preserve the active-book selection after creating initial progress.
- Refresh-derived state must still show the book as active with `sessionStartAt` set after reload.

## Test Expectations

- Starting a session on a selected queued/unread book creates progress at page 0.
- Starting a session on an in-progress book preserves current page.
- Starting a session never creates `progress_history`.
- Saving progress after a session still ends the session and emits the normal session-ended event.
