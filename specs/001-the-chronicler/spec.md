# Feature Specification: The Chronicler — AI Reading Companion

**Feature Branch**: `001-the-chronicler`
**Created**: 2026-04-15
**Status**: Draft
**Input**: User description: The Chronicler constitution and product brief

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Get a Spoiler-Free Recap (Priority: P1)

A reader returns to a book they haven't touched in days or weeks. They open The Chronicler,
select their current book, and request a recap. The app delivers a three-part briefing scoped
exactly to where they left off: a summary of recent events (The Memory Jogger), a list of key
characters and concepts currently in play (The Concept Watchlist), and a sense of the
narrative's current mood and direction (The Thematic Bridge). The reader finishes reading the
briefing and immediately feels oriented enough to continue reading.

**Why this priority**: This is the core value proposition of the entire app. Without it, the
app has no reason to exist. Every other feature exists to enable or enrich this moment.

**Independent Test**: A reader with a book at 45% completion can trigger a recap and receive
a three-section briefing that accurately reflects events and characters at that progress
level — with no references to events that occur after page 45%.

**Acceptance Scenarios**:

1. **Given** a reader has a book with recorded progress, **When** they request a recap,
   **Then** the app returns a briefing with all three sections: Memory Jogger, Concept
   Watchlist, and Thematic Bridge.
2. **Given** a reader is at 45% of a book, **When** they receive a recap, **Then** no content
   in the recap references events, characters, or plot points from beyond 45% of the book.
3. **Given** a reader requests a recap, **When** the briefing is generated, **Then** it
   appears within an acceptable wait time on a standard mobile connection.
4. **Given** a recap has been generated, **When** the reader navigates away and returns,
   **Then** the previously generated recap is still accessible without regenerating it.

---

### User Story 2 — Update Reading Progress (Priority: P2)

After finishing a reading session, a reader logs their new page number in the app. The app
calculates their percentage completion and saves it. The next time they open the app, their
progress is exactly where they left it — across any device they use.

**Why this priority**: Accurate progress tracking is the foundation for spoiler-free recaps.
Without it, the Recap Engine cannot know what content to include or exclude.

**Independent Test**: A reader can open the app on their phone, update their page number,
close the browser, reopen on a different device, and see the same updated progress.

**Acceptance Scenarios**:

1. **Given** a reader has a book in their library, **When** they enter a new page number,
   **Then** the app saves the update and displays the new progress percentage.
2. **Given** a reader updates their progress on one device, **When** they open the app on
   a different device, **Then** the updated progress is visible without any manual sync.
3. **Given** the reader has no internet connection, **When** they update their progress,
   **Then** the app accepts the update locally and syncs it once connectivity is restored.
4. **Given** the reader enters a page number greater than the book's total pages,
   **When** they submit, **Then** the app flags the entry as invalid and prompts correction.

---

### User Story 3 — Add a Book via ISBN Scan (Priority: P3)

A reader picks up a physical book and wants to add it to their Chronicler library. They tap
"Add Book," point their device camera at the barcode, and the app automatically fills in the
title, author, cover image, total page count, and genre. The reader confirms and the book
appears in their library, ready for progress tracking.

**Why this priority**: Removing the friction of manual book entry is essential for physical
book readers. ISBN scan closes the physical-to-digital gap that is a core pillar of the
product.

**Independent Test**: A reader can add a physical book to their library in under 30 seconds
using only the ISBN barcode, with no manual text entry required.

**Acceptance Scenarios**:

1. **Given** a reader scans a valid ISBN barcode, **When** the scan completes, **Then** the
   app populates title, author, cover art, total page count, and genre automatically.
2. **Given** the ISBN lookup returns no result, **When** the reader is notified, **Then** the
   app presents a manual entry form pre-filled with any partial data available.
3. **Given** a reader adds a book via ISBN, **When** they complete the flow, **Then** the
   book appears in their library with a starting progress of page 0.
4. **Given** the ISBN scan fails (camera permission denied or barcode unreadable),
   **When** the failure occurs, **Then** the app falls back gracefully to the manual entry
   form with a clear explanation.

---

### User Story 4 — Review Historical Recaps (Priority: P4)

A reader wants to look back at recaps generated during earlier sessions — for example, to
recall the context from when they were at 30% versus where they are now at 60%. They navigate
to the recap history for a book and can read any previously saved briefing.

**Why this priority**: Persistent recap history transforms the app from a one-shot tool into a
long-term reading companion. It also prevents repeated AI calls for previously seen content.

**Independent Test**: A reader who has generated three recaps for a book at different progress
points can navigate to a history view and read all three in sequence.

**Acceptance Scenarios**:

1. **Given** a reader has generated at least one recap, **When** they view recap history for
   that book, **Then** all previously generated recaps are listed with their progress
   percentage and date.
2. **Given** a reader selects a historical recap, **When** it opens, **Then** all three
   sections (Memory Jogger, Concept Watchlist, Thematic Bridge) are displayed in full.
3. **Given** a reader has recaps on one device, **When** they open the app on another device,
   **Then** the same recap history is available.

---

### Edge Cases

- What happens when a book has no ISBN (e.g., a photocopied manuscript or indie zine)?
  Manual entry must remain fully functional as an independent path.
- What happens when the AI recap service is unavailable? The app must surface a clear
  error and allow the reader to retry — progress tracking must continue to function normally.
- What happens when the reader marks a book as 100% complete? The app should allow recaps
  at 100% and treat the full book as within scope.
- What happens when two editions of the same ISBN have different page counts? The edition
  scanned at time of book creation sets the total page count; the reader can edit it manually.
- What happens when the reader is completely offline for an extended period? All buffered
  progress updates sync on the next available connection, last-write-wins per book.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST generate a spoiler-free, three-part recap (Memory Jogger,
  Concept Watchlist, Thematic Bridge) scoped to the reader's current progress percentage.
- **FR-002**: The system MUST prevent recap content from referencing any narrative events,
  characters, or concepts beyond the reader's recorded progress point.
- **FR-003**: Readers MUST be able to log their current page number for any book in their
  library and have the system calculate percentage completion automatically.
- **FR-004**: The system MUST persist reading progress and generated recaps across sessions
  and devices without data loss.
- **FR-005**: Readers MUST be able to add a book to their library by scanning its ISBN
  barcode, with the system auto-populating title, author, cover art, total page count,
  and genre.
- **FR-006**: The system MUST provide a manual book entry fallback whenever ISBN lookup fails
  or returns incomplete data.
- **FR-007**: All previously generated recaps for a book MUST be stored and accessible in a
  recap history view, tagged with the progress percentage and date of generation.
- **FR-008**: The system MUST function as an installable Progressive Web App accessible on
  iOS, Android, and desktop without an app store.
- **FR-009**: The system MUST buffer progress updates locally when offline and sync them to
  the server when connectivity is restored.
- **FR-010**: The dashboard MUST surface exactly two primary actions on the home screen:
  update current read progress and access recaps.
- **FR-011**: The system MUST support dark mode from initial release to accommodate low-light
  reading environments.

### Key Entities

- **Book**: Represents a title in the reader's library. Key attributes: title, author, ISBN
  (optional), cover art URL, total page count, genre, date added.
- **ReadingProgress**: Tracks the reader's position in a book. Key attributes: current page,
  completion percentage, last updated timestamp. One per book per user.
- **Recap**: An AI-generated briefing linked to a specific book and progress snapshot.
  Attributes: Memory Jogger text, Concept Watchlist text, Thematic Bridge text, progress
  percentage at generation, generation timestamp.
- **User**: An authenticated reader with a personal library of books, progress records, and
  recap history.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can obtain a contextual recap for their current book within 30 seconds
  of opening the app, from any device.
- **SC-002**: A reader can add a physical book to their library via barcode scan in under
  30 seconds, measured from opening the "Add Book" flow to seeing the book in their library.
- **SC-003**: Reading progress updated on one device is visible on a second device within
  5 seconds when both devices are online.
- **SC-004**: Zero reading progress records or saved recaps are lost due to a page refresh,
  app reinstall, or device switch.
- **SC-005**: 95% of readers can complete the "update progress and get recap" core flow
  without requiring help or documentation, as measured by task completion rate in usability
  testing.
- **SC-006**: The app is installable and fully functional on iOS, Android, and modern desktop
  browsers with no app store dependency.

## Assumptions

- Readers are authenticated (have an account); anonymous usage and guest mode are out of
  scope for v1.
- A single reader account can hold multiple books simultaneously (a personal library).
- The target reader owns or has access to physical or digital books; the app does not provide
  book content itself.
- Book metadata quality depends on ISBN lookup service availability; edge cases with missing
  cover art or page counts are handled via manual override.
- The AI recap service requires an active internet connection; fully offline recap generation
  is out of scope for v1.
- Social features (sharing recaps, following other readers, public libraries) are explicitly
  out of scope for v1.
- The visual design is inspired by iOS liquid glass aesthetics with an emphasis on legibility
  in low-light environments.
- A single user cannot have two separate progress records for the same book edition (one
  progress record per book per user).
