# Feature Specification: Completion Passport Session

**Feature Branch**: `029-completion-passport-session`  
**Created**: 2026-05-17  
**Status**: Draft  
**Input**: User description: "Address completion passport guidance and fix starting sessions after selecting a new book."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a Session After Selecting a New Book (Priority: P1)

As a reader who has just completed one book and selected another, I want Start Session to work immediately so I can continue reading without needing to save a page first.

**Why this priority**: This is a blocking bug in the core reading flow. Completing a book should not leave the next active book in a state where the normal session flow cannot begin.

**Independent Test**: Can be fully tested by completing a book, selecting another book from the library or up-next list, pressing Start Session immediately, and confirming the usual session-start flow opens without any prior page save.

**Acceptance Scenarios**:

1. **Given** the user has completed their current book and it has moved to the completed list, **When** they select a new unread or in-progress book and press Start Session, **Then** the session-start flow begins immediately.
2. **Given** the newly selected book has no saved page progress yet, **When** the user presses Start Session, **Then** the app asks for or derives the starting page through the normal session-start experience rather than requiring a separate save action first.
3. **Given** the user selects a new book after completion, **When** the active reading area refreshes, **Then** the displayed book is treated as the current active book for session, progress, capture, recap, lore, and passport actions.

---

### User Story 2 - Discover the Book Passport After Completion (Priority: P1)

As a reader who has completed a book, I want a clear, celebratory prompt to view my completed journey so I understand that the Book Passport is now available and worth checking.

**Why this priority**: Completion is a high-emotion moment and BookHero already generates meaningful post-book artifacts. Without guidance, users can miss the passport entirely.

**Independent Test**: Can be fully tested by completing a book and confirming a completion message appears with a direct action to view the Book Passport, while the completed book still moves to the completed list.

**Acceptance Scenarios**:

1. **Given** the user saves progress that completes a book, **When** completion is confirmed, **Then** the app shows a clear completion message that names the book and invites the user to view their journey.
2. **Given** the completion message is visible, **When** the user chooses the passport action, **Then** they are taken directly to the completed book's Book Passport or the closest existing journey view for that book.
3. **Given** the completion message is visible, **When** the user dismisses it or chooses to continue, **Then** the book remains completed and the user can proceed without losing their place in the app.
4. **Given** the user completes a book on a small mobile viewport, **When** the completion prompt appears, **Then** the primary passport action remains visible and easy to tap without covering critical navigation.

---

### User Story 3 - Preserve Completion and Selection State (Priority: P2)

As a reader moving from one book to the next, I want the completed book, selected new book, and reading-now state to remain consistent across refreshes so I can trust the app's library organization.

**Why this priority**: The prompt and session fix both depend on reliable state transitions. The app must avoid duplicate active books, stale completed-book state, or confusing dashboard cards.

**Independent Test**: Can be tested by completing a book, selecting a replacement, refreshing the app, and confirming the completed and active lists still match the user's last action.

**Acceptance Scenarios**:

1. **Given** a book has just been completed, **When** the dashboard or home view reloads, **Then** that book appears in the completed list and does not appear as the active reading-now book.
2. **Given** a replacement book has been selected, **When** the dashboard or home view reloads, **Then** the replacement appears as the active reading-now book and remains eligible for Start Session.
3. **Given** the user completes one book and selects another in the same app session, **When** app state refreshes in the background, **Then** the completion prompt does not reappear unless a new completion occurs.

---

### Edge Cases

- A user completes a book with no passport content available yet; the prompt should still celebrate completion and route to the best available journey or passport view without dead-ending.
- A user completes a book while offline or while generated artifacts are still pending; the prompt should avoid promising unavailable content and should keep a route back to the completed book.
- A user rapidly completes a book and selects a new book before the completion prompt is dismissed; the selected new book must remain the active reading book.
- A user selects a completed book by mistake after completing another book; Start Session should not revive a completed book unless the app already supports rereading as an explicit action.
- A user has multiple queued books; selecting any eligible replacement should make Start Session available immediately.
- A user refreshes after completion but before selecting a new book; the completed book stays completed and the reading-now area uses the existing empty or next-book state.
- A user completes the last book in their library; the prompt remains useful and does not require selecting a replacement.
- A user dismisses the passport prompt; they can still reach the Book Passport through the completed book's normal navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow a user to start a reading session immediately after selecting an eligible new active book following completion of another book.
- **FR-002**: The system MUST NOT require the user to save a page before Start Session becomes usable for a newly selected active book.
- **FR-003**: The system MUST preserve the normal session-start flow for books with no saved progress, including any expected starting-page entry or confirmation.
- **FR-004**: The system MUST ensure that completing a book removes it from the active reading-now position and places it in the completed list.
- **FR-005**: The system MUST ensure that selecting a replacement book after completion makes that replacement the active reading-now book for session and progress actions.
- **FR-006**: The system MUST show a completion prompt when a user newly completes a book.
- **FR-007**: The completion prompt MUST include a clear primary action to view the completed book's Book Passport or journey view.
- **FR-008**: The completion prompt MUST include a non-blocking way to dismiss or continue without viewing the passport immediately.
- **FR-009**: The completion prompt MUST use celebratory, supportive language and identify the completed book when that title is available.
- **FR-010**: The completion prompt MUST be usable on mobile and desktop viewports without covering critical navigation or requiring precision taps.
- **FR-011**: The system MUST avoid showing duplicate completion prompts for the same already-completed book during routine refreshes.
- **FR-012**: The system MUST keep the Book Passport reachable from the completed book after the prompt is dismissed.
- **FR-013**: The system MUST handle cases where passport or generated journey content is unavailable, pending, or partially complete with a graceful destination and message.
- **FR-014**: The system MUST keep completed-book state, active-book state, and selected-book state consistent after page refresh and app reload.

### Key Entities *(include if feature involves data)*

- **Completed Book**: A book whose progress has reached completion and belongs in the user's completed list. It may have associated journey artifacts such as passport, recaps, captures, or lore.
- **Active Reading Book**: The currently selected book shown in the reading-now area and eligible for Start Session, progress saving, page capture, recap, lore, and passport-related actions.
- **Completion Prompt**: A temporary user-facing message shown immediately after a new book completion, with a primary path to the Book Passport and a secondary dismiss or continue option.
- **Book Passport**: The completed book's journey view or artifact collection that lets a reader review their reading journey so far.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of tested completion-to-next-book flows, a user can select an eligible new book and start a session without first saving a page.
- **SC-002**: In 100% of tested book completions, the completed book moves out of reading-now and appears in the completed list.
- **SC-003**: In 100% of tested new completions, the user sees a completion prompt with a visible action to view the Book Passport or journey view.
- **SC-004**: A user can dismiss the completion prompt and continue using the app in under 5 seconds without losing completion state.
- **SC-005**: A user who chooses the passport action reaches the relevant completed-book journey destination in one action from the prompt.
- **SC-006**: After refreshing the app in tested flows, the completed book and newly selected active book remain in their expected states.
- **SC-007**: On representative mobile and desktop viewport checks, the completion prompt's primary action is visible without overlapping essential page controls.

## Assumptions

- The Book Passport or an equivalent completed-book journey route already exists or is expected to exist in the current product surface.
- The completion prompt should appear only for newly completed books, not every time a completed book is rendered.
- The best default UX is a celebratory non-blocking prompt with a primary "view journey/passport" action and a secondary continue/dismiss action.
- Starting a session on a book with no saved progress should use the existing first-session behavior rather than silently inventing a page number.
- Rereading completed books is out of scope unless the app already provides an explicit reread flow.
