# Feature Specification: First-Run Onboarding

**Feature Branch**: `021-first-run-onboarding`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Create a polished first-run onboarding and first-library experience for BookHero, including automatic first active book focus, compact empty states, completed-book imports, and safeguards against unnecessary active-reading or AI workflows."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Active Book Becomes The Hero (Priority: P1)

A new reader who has exactly one book in progress sees that book automatically focused as the primary Dashboard book after they add or update progress.

**Why this priority**: This removes the first friction point found during new-user testing. The reader has already shown intent by progressing the book, so asking them to select it again makes the app feel unaware.

**Independent Test**: Register a fresh user, add one book, mark it in progress, navigate to the Dashboard, and verify the primary reading card displays that book without any manual selection.

**Acceptance Scenarios**:

1. **Given** a user has exactly one in-progress book and no explicit primary reading choice, **When** the user opens the Dashboard, **Then** that book appears as the primary reading card.
2. **Given** a user updates the current page for their only book, **When** the user navigates from the book detail or library view to the Dashboard, **Then** the Dashboard focuses that same book automatically.
3. **Given** a user refreshes the app after progressing their only active book, **When** the Dashboard loads, **Then** the same book remains the focused primary reading card.
4. **Given** a user has multiple active books and has made an explicit reading order choice, **When** the Dashboard loads, **Then** the explicit choice is preserved and automatic single-book behavior does not override it.

---

### User Story 2 - Tiny Libraries Avoid Redundant Sections (Priority: P1)

A reader with zero or one meaningful book candidate sees a focused Dashboard that avoids duplicated cards and empty section clutter.

**Why this priority**: Early app sessions set trust. Empty or duplicated structures make the product feel unfinished even when the underlying data is correct.

**Independent Test**: Exercise Dashboard states for no books, one queued book, one in-progress book, and one completed book, then verify only useful sections appear.

**Acceptance Scenarios**:

1. **Given** a user has no books, **When** the Dashboard opens, **Then** it shows a compact first-book state with a primary action to add a book and hides empty reading sections.
2. **Given** a user has exactly one in-progress book and it is shown as the primary reading card, **When** the Dashboard renders, **Then** the same book is not repeated in an in-progress list.
3. **Given** a user has no queued books, **When** the Dashboard renders, **Then** no heavy empty queue section appears unless it provides a clear next action.
4. **Given** a user has one queued book and no active books, **When** the Dashboard opens, **Then** the page presents a clear start-reading action without redundant queue clutter.

---

### User Story 3 - First-Time Empty Dashboard Guides The First Book (Priority: P1)

A new reader with no library entries understands the next step immediately from the Dashboard.

**Why this priority**: Before the first book exists, the Dashboard cannot rely on reading data. The experience must still feel intentional and useful.

**Independent Test**: Register a fresh user and open the Dashboard before adding any books; verify the page guides the user to add a book without showing broken or empty reading modules.

**Acceptance Scenarios**:

1. **Given** a new user has no books, **When** they open the Dashboard, **Then** they see one concise empty state with a primary action to add a book.
2. **Given** a new user has no books, **When** the empty state renders, **Then** it does not imply an error, missing configuration, or failed setup.
3. **Given** a new user chooses the primary action, **When** they activate it, **Then** they enter the add-book flow.

---

### User Story 4 - Add A Book As Already Completed (Priority: P2)

A reader who already has reading history can add finished books without creating active-reading tasks.

**Why this priority**: BookHero should support readers bringing their identity and history into the app, not only books they start after signup.

**Independent Test**: Add a book as already completed and verify it appears as completed, contributes to library identity, and does not become the active reading focus.

**Acceptance Scenarios**:

1. **Given** a user is adding a book, **When** they choose an initial status, **Then** they can choose queued, currently reading, or already completed.
2. **Given** a user chooses currently reading, **When** they save the book, **Then** they can provide a current page and the book becomes active reading.
3. **Given** a user chooses already completed, **When** they save the book, **Then** the book is recorded as finished and appears in completed library areas.
4. **Given** a user chooses queued, **When** they save the book, **Then** the book is recorded as not started and does not become the primary active reading card.

---

### User Story 5 - Completed Imports Do Not Trigger Active Reading Workflows (Priority: P2)

A reader importing completed books does not receive prompts or automated actions that only make sense during active reading.

**Why this priority**: Unwanted active-reading prompts and AI work during historical import would be confusing and may waste usage on the wrong context.

**Independent Test**: Add one or more books as completed and verify no active session, capture, recap, or continue-reading prompts are initiated by the import itself.

**Acceptance Scenarios**:

1. **Given** a user imports a completed book, **When** the book is saved, **Then** no active reading session prompt appears for that book.
2. **Given** a user imports a completed book, **When** the Dashboard renders, **Then** no continue-reading action is shown for that completed-only book.
3. **Given** a user imports completed books, **When** automated reading-assistant features are evaluated, **Then** features intended for active reading are not started by the import itself.
4. **Given** imported completed books affect long-term reader identity, **When** existing identity rules consider completed books, **Then** those books may contribute according to those existing rules.

---

### User Story 6 - Completed-Only Libraries Still Feel Useful (Priority: P2)

A reader with completed books but no active books sees a meaningful Dashboard that acknowledges their library while encouraging a next reading action.

**Why this priority**: Some users will import history first. The app should not punish that valid path by pretending they have an active book or showing a broken hero area.

**Independent Test**: Add one or more completed books to a new account and open the Dashboard; verify it acknowledges completed history and offers a natural next action.

**Acceptance Scenarios**:

1. **Given** a user has completed books and no active books, **When** the Dashboard opens, **Then** it shows a completed-library state rather than an empty active-reading card.
2. **Given** a user has completed-only history, **When** the Dashboard renders, **Then** it provides a clear action to add or start a currently-reading book.
3. **Given** a user has one completed book and no active books, **When** the Dashboard renders, **Then** that completed book is not presented as an active continue-reading hero.

---

### User Story 7 - Established Users Keep Their Reading Choice (Priority: P3)

A reader with multiple active books keeps their explicit or inferred reading order, while automatic onboarding logic only fills in obvious missing choices.

**Why this priority**: The onboarding improvements must not degrade behavior for users who already manage a larger library.

**Independent Test**: Create multiple in-progress books with and without an explicit reading order, then verify the Dashboard selects a deterministic primary book and preserves explicit choices.

**Acceptance Scenarios**:

1. **Given** a user has multiple in-progress books and an explicit primary or ordered reading choice, **When** the Dashboard loads, **Then** that explicit choice is preserved.
2. **Given** a user has multiple in-progress books and no explicit choice, **When** the Dashboard loads, **Then** the primary book is chosen deterministically from recent or ordered reading activity.
3. **Given** automatic single-book focus previously applied, **When** the user later has multiple active books and makes a manual choice, **Then** the manual choice takes precedence.

---

### Edge Cases

- A newly added book has a total page count of zero or missing page count; completion and progress choices must not produce invalid percentages.
- A user marks a book completed during creation and later changes it to currently reading; the Dashboard must reflect the new active status after the change.
- A user has one active book and many completed books; only the active book should be considered for primary continue-reading focus.
- A user has one queued book and later records a first page update; the Dashboard should promote it once it becomes in progress.
- A user has stale cached Dashboard data after adding or progressing a book; navigating home or refreshing must show the correct first-run state.
- A user imports several completed books quickly; the Dashboard should remain stable and avoid presenting each import as a reading session.
- A user has no books but previous account-level metadata; the first-book empty state should still be based on the absence of library entries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically focus the only in-progress book as the primary Dashboard reading card when no explicit primary reading choice exists.
- **FR-002**: The system MUST update the primary Dashboard reading card after a book is added, progress is changed, a book status changes, the user navigates to the Dashboard, or the app is refreshed.
- **FR-003**: The system MUST NOT duplicate the primary reading book in secondary in-progress sections when that secondary section would contain only the same book.
- **FR-004**: The system MUST hide empty or redundant Dashboard sections for users with zero or one meaningful book candidate.
- **FR-005**: The system MUST show a compact first-book empty state with a primary add-book action when a user has no books.
- **FR-006**: The system MUST allow users to choose an initial reading status when adding a book: queued, currently reading, or already completed.
- **FR-007**: The system MUST allow a current page value during book creation when the initial status is currently reading.
- **FR-008**: The system MUST record already-completed books as finished and show them in completed library areas.
- **FR-009**: The system MUST record queued books as not started and prevent them from becoming the active primary reading card unless later started or explicitly selected.
- **FR-010**: The system MUST NOT initiate active-reading workflows from completed-book imports, including reading-session prompts, page-capture prompts, continue-reading actions, or recap prompts.
- **FR-011**: The system MUST allow completed-book imports to contribute to completed library counts and reader identity rules where those rules already consider completed books.
- **FR-012**: The system MUST provide a meaningful completed-only Dashboard state for users with completed books and no active books.
- **FR-013**: The system MUST preserve explicit user reading choices when multiple active books exist.
- **FR-014**: The system MUST choose a deterministic primary book when multiple active books exist and no explicit choice has been made.
- **FR-015**: The system MUST keep library state, Dashboard state, book detail state, and reading order state consistent after add, progress, completion, and status-change actions.
- **FR-016**: The system MUST avoid creating duplicate or contradictory reading progress records when a book is added with an initial status.
- **FR-017**: The system MUST present onboarding states using concise, action-oriented copy and avoid tutorial-like or marketing-style content.
- **FR-018**: The system MUST support small-screen layouts where the final visible card or action is not obscured by persistent navigation.

### Key Entities

- **Library Entry**: A book in the user's library with title, author, page count, cover identity, and reading state.
- **Reading State**: The user's current relationship to a library entry: queued, currently reading, or completed.
- **Primary Reading Focus**: The book displayed as the main Dashboard reading card, derived from explicit user choice or deterministic onboarding rules.
- **Reading Order Choice**: A user-controlled or inferred ordering of books that determines which active book appears first when multiple candidates exist.
- **First-Run Dashboard State**: A simplified Dashboard presentation for users with no books, one active book, one queued book, or completed-only history.
- **Completed Import**: A book added as already read, intended to count as history without starting active-reading workflows.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of fresh-user test runs with exactly one in-progress book show that book as the primary Dashboard reading card after navigating home or refreshing.
- **SC-002**: Fresh users with no books can reach the add-book flow from the Dashboard in one primary action.
- **SC-003**: Fresh users with one in-progress book see no duplicate instance of that book in secondary Dashboard reading sections.
- **SC-004**: Fresh users can add a completed book without seeing any active-reading prompt for that book during the same session.
- **SC-005**: Users with completed-only libraries see a meaningful Dashboard state and a clear next action in 100% of completed-only test cases.
- **SC-006**: Established users with multiple active books retain their explicit primary or ordered reading choice in 100% of regression test cases.
- **SC-007**: At least 90% of first-run validation participants understand the next reading action without needing external instruction.
- **SC-008**: No automated active-reading assistant action is triggered solely by adding a book as already completed.

## Assumptions

- Existing user registration and authentication continue to work and are not part of this feature.
- Existing library, Dashboard, book detail, recap, capture, lexicon, and reader identity concepts remain in scope only where first-run behavior touches them.
- "Queued" means the user wants to read the book later and has not started progress.
- "Currently reading" means the user has an active page position below completion.
- "Already completed" means the user has finished the book before or during import and is logging reading history.
- Explicit user choice takes precedence over automatic onboarding inference.
- Completed imports can support reader identity and library statistics, but must not behave like reading sessions unless a user later starts an active reading flow.
