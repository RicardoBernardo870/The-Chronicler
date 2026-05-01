# Feature Specification: Library Page Overhaul

**Feature Branch**: `019-library-page-overhaul`
**Created**: 2026-05-01
**Status**: Draft

---

## Clarifications

### Session 2026-05-01

- Q: Minimum sessions required for "days remaining" estimate → A: 3 sessions in the past 30 days
- Q: Desktop alternative to swipe actions → A: ⋯ hover icon on card revealing Edit/Delete

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Fix Data Bugs: Book Edit and Genre Display (Priority: P1)

A reader edits an existing book to correct its ISBN or genre. After saving, the updated values appear immediately everywhere in the app — on the book card's genre chip and in any field they changed. Currently, edits to ISBN are silently discarded and the genre chip never appears on library cards because the server data source does not include the genre field.

**Why this priority**: These are correctness bugs. The user is actively losing data they intentionally input. Everything else in this feature builds on top of an accurate book card, so these must be fixed first.

**Independent Test**: Edit a book's ISBN and genre. Navigate back to the Library. The genre chip appears on the book card and the correct ISBN is visible in the edit form when reopened.

**Acceptance Scenarios**:

1. **Given** a book with a genre set, **When** the Library loads, **Then** the genre chip is visible on the book card.
2. **Given** a user edits a book and changes its ISBN, **When** they save and reopen the edit form, **Then** the updated ISBN is shown.
3. **Given** a user edits a book and changes its genre, **When** they save, **Then** the genre chip on the card reflects the new genre immediately.
4. **Given** a user clears a book's ISBN during edit, **When** they save, **Then** the ISBN field is blank when the form is reopened.

---

### User Story 2 — Section Headers with Counts and Collapsible Archive (Priority: P1)

A reader with 20+ books in their library opens the page and immediately sees three clearly labelled sections: **Currently Reading**, **The Queue**, and **The Archives**. Each header shows how many books are in that section. The Archives section is collapsed by default to keep the page focused on active reading; the user can tap to expand it.

**Why this priority**: Navigation clarity breaks down fast with large libraries. Without section headers, a user cannot find where one status ends and another begins. This is a foundational UX requirement that impacts all users with more than a handful of books.

**Independent Test**: With books in all three states (in-progress, queued, completed), open the Library. Three distinct section headers appear with correct counts. The Archives section is collapsed by default. Tapping it expands the completed books list.

**Acceptance Scenarios**:

1. **Given** books across all states, **When** the Library loads, **Then** three headers are visible: "Currently Reading (N)", "The Queue (N)", and "The Archives (N)".
2. **Given** the Library has loaded, **When** the user first opens the page, **Then** The Archives section is collapsed and completed books are not visible without interaction.
3. **Given** The Archives is collapsed, **When** the user taps the header, **Then** the completed books list expands smoothly.
4. **Given** a section has zero books, **When** the Library loads, **Then** the header for that section still appears with a count of 0 (not hidden).
5. **Given** a book's status changes (e.g., marked complete), **When** the Library updates, **Then** the book moves to the correct section and counts update accordingly.

---

### User Story 3 — Page Count Display and Days-Remaining Estimate (Priority: P2)

A reader scanning their in-progress books wants to know not just a percentage but exactly where they are ("Page 142 of 450") and roughly how long until they finish ("~4 days left"). The days estimate is computed from their recent reading speed — it gives them a motivating nudge without requiring any manual input.

**Why this priority**: Percentages are abstract. "Page 142 of 450" is concrete and immediately meaningful. The days estimate adds motivation. These are additive improvements — the app works fine without them — so P2 is appropriate.

**Independent Test**: Open the Library with an in-progress book that has reading history. The card shows "Page X of Y" below the progress bar. A "~N days left" estimate appears if the user has recent reading activity. If there is no reading history, the estimate is omitted (not shown as zero or error).

**Acceptance Scenarios**:

1. **Given** an in-progress book, **When** the book card is displayed, **Then** the text "Page X of Y" is shown below the progress bar.
2. **Given** a user has logged reading sessions for a book, **When** the card displays, **Then** a "~N days left" estimate appears based on their average reading pace.
3. **Given** a user has fewer than 3 reading sessions for a book in the past 30 days, **When** the card displays, **Then** no days estimate is shown — only the page count.
4. **Given** a book is 100% complete, **When** its card is shown in The Archives, **Then** no days estimate is shown.

---

### User Story 4 — Swipe Left to Edit or Delete a Book (Priority: P2)

A reader browsing their library swipes left on any book card and sees two action buttons slide in from the right: **Edit** and **Delete**. Tapping Edit opens the book edit form. Tapping Delete shows a confirmation prompt before removing the book. This replaces the need to navigate into a book's detail page just to access management actions.

**Why this priority**: Swipe gestures are the standard interaction model for list management on mobile. They significantly reduce friction for common actions and make the app feel native. They are additive — the app functions without them.

**Independent Test**: On a mobile viewport, swipe left on any book card. Edit and Delete action buttons appear. Tapping Edit opens the book edit dialog with the correct book pre-filled. Tapping Delete prompts for confirmation and, if confirmed, removes the book from the list.

**Acceptance Scenarios**:

1. **Given** any book card, **When** the user swipes left, **Then** "Edit" and "Delete" action buttons are revealed behind the card.
2. **Given** swipe actions are revealed, **When** the user taps "Edit", **Then** the book edit form opens pre-filled with that book's current data.
3. **Given** swipe actions are revealed, **When** the user taps "Delete", **Then** a confirmation dialog appears before any deletion occurs.
4. **Given** a swipe is in progress, **When** the user swipes right or taps elsewhere, **Then** the card returns to its default position and actions are hidden.
5. **Given** swipe actions are revealed on one card, **When** the user swipes another card, **Then** the first card snaps back to its default position.
6. **Given** a non-touch (desktop) viewport, **When** the user hovers over a book card, **Then** a ⋯ icon appears; clicking it reveals Edit and Delete actions.

---

### User Story 5 — Optimistic Drag-and-Drop Reordering in The Queue (Priority: P2)

A reader reorders their reading queue by dragging books up or down. The card moves to its new position instantly as soon as they drop it — no flicker back to the original position while the save is in progress. The order persists when the user navigates away and returns.

**Why this priority**: The current drag-and-drop works but feels broken because the card snaps back to its old position momentarily before settling into the new one. This is jarring and erodes trust in the interaction. The fix is a simple optimistic update: commit the new order locally first, then save in the background.

**Independent Test**: Drag a book in The Queue to a new position. The card settles immediately in the new position without any visible snap-back. Navigate away and return — the order is preserved.

**Acceptance Scenarios**:

1. **Given** multiple books in The Queue, **When** the user drags a book to a new position and releases, **Then** the card stays in the new position instantly with no visible snap-back.
2. **Given** a successful reorder, **When** the user navigates away and returns to the Library, **Then** the queue is in the reordered state.
3. **Given** a reorder save fails (network error), **When** the failure is detected, **Then** the queue reverts to the previous order and a non-blocking error message is shown.

---

### Edge Cases

- What if a user swipes left on a book while another card's swipe actions are already open? The open card should snap closed automatically.
- What if the days-remaining estimate would be 0 or negative (the user is behind their expected pace)? Show a motivating message like "Finish today!" rather than a zero or negative number.
- What if the "Currently Reading" section is empty? Show the header with count 0; do not hide it — its absence would be confusing.
- What if a drag-and-drop reorder fails to save? Revert the local order and show a brief error toast. Do not leave the UI in an inconsistent state.
- What if a book has no total_pages set? Omit the "Page X of Y" display for that book specifically.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Library page MUST display all books grouped into three sections: "Currently Reading", "The Queue", and "The Archives", each showing a count of books in that section.
- **FR-002**: The Archives section MUST be collapsed by default when the user first opens the Library; tapping the section header MUST toggle the expanded/collapsed state.
- **FR-003**: Each book card for an in-progress book MUST display "Page X of Y" below the progress bar when total pages is known.
- **FR-004**: Each in-progress book card MUST display a "~N days left" estimate when the user has logged at least 3 reading sessions for that book within the past 30 days; the estimate MUST be omitted when fewer than 3 qualifying sessions exist.
- **FR-005**: All book cards MUST support a swipe-left gesture (touch) that reveals "Edit" and "Delete" action buttons; on non-touch viewports, a ⋯ icon button on the card MUST reveal the same actions on hover/focus; tapping/clicking Edit MUST open the book edit form; tapping/clicking Delete MUST present a confirmation prompt before deletion.
- **FR-006**: Only one card's swipe actions MUST be visible at a time; opening swipe actions on a second card MUST automatically close the first.
- **FR-007**: The Queue section MUST support drag-and-drop reordering; the new order MUST be reflected in the UI immediately upon release (optimistic update) without visible snap-back.
- **FR-008**: The server data source for the Library MUST return the genre field for each book so that genre chips display correctly on cards.
- **FR-009**: The book edit action MUST persist all editable fields including ISBN and genre; saving an edit MUST immediately reflect all changed fields on the book card.
- **FR-010**: If a drag-and-drop reorder fails to save, the UI MUST revert to the previous order and display a non-blocking error notification.

### Key Entities

- **Book**: Has title, author, genre (optional), ISBN (optional), cover, total pages, and a reading status (currently reading / queued / archived).
- **Reading Progress**: Current page and percentage for an in-progress book; drives the "Page X of Y" display.
- **Reading Velocity**: Derived from the user's recent session history; used to compute the days-remaining estimate.
- **Queue Order**: The user-defined sort position of books in The Queue; persists across sessions.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After editing a book's ISBN or genre and saving, the updated values are visible on the book card within 1 second — no page reload required.
- **SC-002**: A user with 30+ books can identify which section a specific book belongs to in under 5 seconds.
- **SC-003**: Dragging a book to a new position in The Queue results in the card settling at the target position in under 100ms with no visible snap-back.
- **SC-004**: The days-remaining estimate is visible on in-progress book cards for any user who has logged at least one reading session for that book.
- **SC-005**: Swipe actions (Edit/Delete) are reachable on any book card within a single swipe gesture — no tap-and-hold or multi-step navigation required.

---

## Assumptions

- The "days remaining" estimate is calculated from the user's average pages-per-session rate on that specific book (not a global average), using sessions from the past 30 days. The estimate is only shown when at least 3 qualifying sessions exist in that window; fewer than 3 sessions is not enough to produce a reliable pace.
- "The Queue" is the same data source as the existing "Up Next" section — books the user has queued to read next, ordered by the user-defined sort position.
- Swipe gestures apply on touch viewports; on non-touch (desktop/mouse) viewports, the same Edit and Delete actions are accessible via a ⋯ icon button that appears on card hover/focus.
- The collapsed/expanded state of The Archives section does not persist across sessions — it resets to collapsed on each visit.
- Genre chip display requires the genre field to be non-null and non-empty; books without a genre show no chip (unchanged from current behaviour).
- The book edit form already exists; this feature wires the swipe "Edit" action into it and ensures all fields (including ISBN) are correctly submitted on save.
