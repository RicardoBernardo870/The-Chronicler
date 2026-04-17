# Feature Specification: Reading Suite v3

**Feature Branch**: `003-reading-suite-v3`
**Created**: 2026-04-17
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

---

### User Story 1 - Library & Dashboard UX Improvements (Priority: P1)

A reader opens the Library and immediately sees their active book pinned at the top — no label needed. They can toggle to a grid view to browse covers visually, then long-press a book card to edit its title or delete it. On the Dashboard, below the Completed list, they see an "Up Next" section of unstarted books, and they drag to reorder them to match their intended reading queue. They also notice the app's background gradient now fills the entire iPhone screen including behind the status bar notch. When they visit the Recap History for a book, each saved recap shows both the percentage and the exact page it was generated at.

**Why this priority**: These are UX polish items that affect every session. The library sort, grid view, edit/delete, and up-next queue directly improve daily usability and content discoverability. The iOS background fix resolves a visible visual defect.

**Independent Test**: Can be fully tested by opening the Library, toggling view modes, reordering the up-next list, editing a book, and verifying the iOS gradient renders correctly across the full screen.

**Acceptance Scenarios**:

1. **Given** a library with multiple books at varying progress percentages, **When** the Library loads, **Then** the book with the most recent progress update appears pinned at the top of the list, followed by remaining in-progress books sorted ascending by progress, then unstarted books, then completed books.
2. **Given** the Library is in list view, **When** the user taps the grid toggle, **Then** books are displayed as a grid of cover thumbnails with title and progress indicator visible beneath each cover; incomplete covers show a placeholder.
3. **Given** a book in the library, **When** the user selects the edit option on that book, **Then** a form pre-filled with the book's current data appears and allows updating title, author, genre, total pages, and cover; changes persist after saving.
4. **Given** a book in the library, **When** the user selects delete and confirms, **Then** the book and all its associated progress and recap data are permanently removed.
5. **Given** the Dashboard with books at 0% progress, **When** the user views the Dashboard, **Then** an "Up Next" section appears below Completed, listing all unstarted books in their saved order.
6. **Given** the Up Next section is visible, **When** the user reorders the books via drag handle, **Then** the new order is saved and persists across sessions.
7. **Given** the app is open on an iPhone, **When** the user scrolls or the app is at any scroll position, **Then** the background gradient covers the entire screen including the area behind the status bar notch with no bare color visible.
8. **Given** a recap has been saved, **When** the user views the Recap History page, **Then** each recap entry shows both the percentage completed and the exact page number at which the recap was generated.

---

### User Story 2 - ISBN Data Enrichment Fallback (Priority: P2)

A reader scans the ISBN of an older book. The primary lookup API returns a result but is missing the cover image. The app silently falls back to a secondary source to fetch the cover, and the book card displays it without the user needing to do anything. Fields that neither source can provide remain empty.

**Why this priority**: Cover images are critical for visual library browsing, especially in grid view. Missing covers degrade the grid experience significantly.

**Independent Test**: Can be tested by scanning ISBNs for books known to have incomplete data in the primary API and verifying covers and metadata are retrieved from the secondary source.

**Acceptance Scenarios**:

1. **Given** an ISBN scan returns a result missing a cover image, **When** the book is added, **Then** the app automatically queries a secondary source for the cover and uses it if found.
2. **Given** an ISBN scan returns a result missing any field (cover, genre, author, page count), **When** the book is added, **Then** the app queries the secondary source for that specific field only.
3. **Given** neither source has a particular field, **When** the book is added, **Then** that field is left empty with no error shown to the user.
4. **Given** the primary source has all fields, **When** the book is added, **Then** no secondary lookup is performed.

---

### User Story 3 - The Lexicon (Vocabulary Vault) (Priority: P3)

A reader encounters an unfamiliar word on page 142. They open the Lexicon, search for the word, and the definition is pulled automatically from a dictionary source. They paste the sentence from the book that contained the word and note the page number. For a fantasy book with invented terminology ("Shai'tan"), they create a custom "Lore" entry manually with their own definition. Each word appears as a frosted card that flips to reveal the full definition, context sentence, and page reference. On the Dashboard, a "Word of the Day" surfaces a word from their saved list to reinforce retention. Each book has its own glossary so words stay organized by the reading context in which they were learned.

**Why this priority**: Lexicon is the first major net-new feature that adds a dimension beyond progress tracking. It directly increases daily active engagement and retention value.

**Independent Test**: Can be tested end-to-end by adding a dictionary word, adding a lore entry, viewing the flip card, and verifying the Word of the Day appears on the Dashboard.

**Acceptance Scenarios**:

1. **Given** a user is viewing the Lexicon for a book, **When** they search for a word, **Then** the definition is fetched automatically and pre-filled; the user can then add a context sentence and page number before saving.
2. **Given** a user wants to add invented or book-specific terminology, **When** they create a "Lore" entry, **Then** they can enter a custom word, custom definition, optional context sentence, and page number without requiring an external lookup.
3. **Given** a saved word card, **When** the user taps it, **Then** it flips to reveal the full definition, context sentence, and page number where it was found.
4. **Given** words saved across multiple books, **When** the user views the Lexicon, **Then** words are organized per book with clear visual separation.
5. **Given** the user has at least one saved word, **When** they view the Dashboard, **Then** a "Word of the Day" card shows one word from their saved list chosen via spaced repetition logic; tapping it navigates to the full Lexicon entry.
6. **Given** multiple sessions over time, **When** the spaced repetition system selects the Word of the Day, **Then** words that have not been reviewed recently are surfaced before recently reviewed words (Leitner System: new/forgotten words appear more frequently).
7. **Given** a word has been reviewed, **When** the user marks it as "known," **Then** its review interval increases and it appears less frequently.

---

### User Story 4 - The Reading Pulse (Analytics) (Priority: P4)

A reader updates their page to 280. The book detail page updates to show "Reading Velocity: 42 pages/hour" based on their recent sessions, with a Finish Line prediction: "At this pace, you'll finish in ~3 hours 20 minutes." The hero card on the Dashboard also shows a subtle color shift from its calm default to an amber warning tone, indicating the Continuity Score has dropped because the book hasn't been touched in 5 days. Tapping the warning suggests generating a Memory Jogger. In the Library, a simple streak indicator shows consecutive days with reading activity for each book — no heatmap, just a number or small icon.

**Why this priority**: Analytics add motivational insight without requiring new input from the user. Data already exists; this surfaces it meaningfully.

**Independent Test**: Can be tested by logging progress updates over time, verifying velocity calculations, the finish line estimate, and the continuity score color change on the dashboard.

**Acceptance Scenarios**:

1. **Given** a user has logged at least two progress updates with timestamps, **When** they view the book detail, **Then** a Reading Velocity figure (pages per hour) is shown calculated from recent sessions.
2. **Given** a calculated reading velocity, **When** displayed, **Then** a Finish Line estimate is shown: "At your current pace, you'll finish in [X hours Y minutes]."
3. **Given** a book the user has not updated in more than 48 hours, **When** the Dashboard hero card is displayed, **Then** the hero card shifts to an amber/warning visual state to signal low Continuity Score.
4. **Given** the hero card is in warning state, **When** the user taps it or a prompt is shown, **Then** a suggestion to generate a Memory Jogger is displayed.
5. **Given** a book updated within the last 48 hours, **When** displayed, **Then** the hero card is in its normal visual state.
6. **Given** the Library view, **When** a book is displayed, **Then** a reading streak indicator shows the number of consecutive days the user logged progress for that book.

---

### User Story 5 - Milestone-Based Recapping (Priority: P5)

A reader opens the Book Detail page. The "Get Recap" button shows a locked state: "Read 18 more pages to unlock your next Memory Jogger." As they log progress past the 10% threshold from their last recap, the button unlocks. When they hit a milestone quietly in the background, the app runs an event extraction pass and stores the fragment. When they finally tap "Get Recap," the final briefing is assembled from stored fragments rather than re-reading from page 1 — making the response faster and using fewer AI resources.

**Why this priority**: This is the primary cost-control mechanism for AI usage and also adds a gamification layer that increases perceived value of the recap feature.

**Independent Test**: Can be tested by verifying the recap button locks at under 10% progress from last recap, unlocks after crossing the threshold, and generating a recap produces accurate output sourced from stored fragments.

**Acceptance Scenarios**:

1. **Given** a book where the user's progress has advanced less than 10% since their last recap, **When** they view the Book Detail page, **Then** the "Get Recap" button shows a locked state with a message indicating how many more pages are needed.
2. **Given** no previous recap exists for a book, **When** the user views the Book Detail, **Then** the "Get Recap" button is available immediately (no lock needed for the first recap).
3. **Given** the user's progress has crossed the 10% threshold since their last recap, **When** they view the Book Detail, **Then** the "Get Recap" button is unlocked and usable.
4. **Given** the user crosses a milestone, **When** the milestone is detected, **Then** a background event extraction fragment is stored silently with no visible loading state for the user.
5. **Given** stored fragments exist for a book, **When** the user requests a recap, **Then** the final briefing is assembled using those fragments and takes less time to generate than a full pass-1 extraction.
6. **Given** a locked recap state, **When** displayed, **Then** the message shows the exact number of pages remaining to unlock (e.g., "Read 12 more pages to unlock your Memory Jogger").

---

### User Story 6 - The Reading Odyssey (End-of-Book Wrap) (Priority: P6)

A reader marks their last page and the book reaches 100% progress. A celebration screen appears — or the book detail transforms — showing a "Book Passport": total days to finish, the day they read the most pages, how many Lexicon words they added, and a final AI-generated summary of the entire book. The card is shareable and visually distinct from the regular book card.

**Why this priority**: This is the emotional payoff of the entire reading journey. It reinforces the app's value proposition and is highly shareable — organic growth potential.

**Independent Test**: Can be tested by completing a book (setting progress to 100%) and verifying the Book Passport card generates with all fields populated.

**Acceptance Scenarios**:

1. **Given** a book where progress is updated to 100%, **When** the save is confirmed, **Then** a Book Passport is triggered and generated automatically.
2. **Given** the Book Passport is generated, **When** viewed, **Then** it shows: total days from first to last update, the single day with the most pages read (peak velocity day), count of Lexicon words added for that book, and a full-book AI summary.
3. **Given** the Book Passport is displayed, **When** the user views it, **Then** it is visually distinct from regular book cards (celebratory styling, different color scheme).
4. **Given** a completed book in the Library, **When** the user navigates to it, **Then** the Book Passport is accessible and re-viewable at any time.
5. **Given** the AI summary is being generated, **When** displayed, **Then** a loading state is shown while the summary processes, and the card becomes fully visible once complete.

---

### Edge Cases

- What happens if a user deletes a book that has Lexicon entries, recap history, and reading pulse data? All associated data should be removed.
- What if the user's reading velocity data spans very short sessions (e.g., 2 pages in 30 seconds from accidental taps)? Outlier sessions should be excluded from velocity calculations.
- What if the ISBN fallback also fails to find a missing field? Leave it empty, no error shown.
- What if a user marks a book as 100% before adding any Lexicon words? The vocabulary count shows 0 in the Book Passport.
- What if the background fragment extraction fails at a milestone? The next manual recap request should fall back to the standard two-pass approach.
- What if a user reorders Up Next books offline? Changes should be queued and synced when connectivity returns.
- What if the Word of the Day has no saved words yet? The dashboard card is hidden entirely until at least one word is saved.
- What if a grid view book has no cover image? A styled placeholder with the book's initials or a book icon is shown.

---

## Requirements *(mandatory)*

### Functional Requirements

**Library & Dashboard UX**
- **FR-001**: The Library MUST display the most recently updated in-progress book pinned at the top of the list with no special label required.
- **FR-002**: The Library MUST offer a toggle between list view and grid view; the selected view MUST persist across sessions.
- **FR-003**: Grid view MUST show cover thumbnail, book title (truncated if needed), and a compact progress indicator for each book.
- **FR-004**: Users MUST be able to edit any book's metadata (title, author, genre, total pages, cover URL) from the Library.
- **FR-005**: Users MUST be able to delete a book from the Library; deletion MUST require a confirmation step and MUST remove all associated data.
- **FR-006**: The Dashboard MUST display an "Up Next" section showing all books at 0% progress.
- **FR-007**: Users MUST be able to reorder books in the Up Next section; the order MUST persist across sessions.
- **FR-008**: The app background gradient MUST render fully behind the iOS status bar and notch area with no visible cutoff.
- **FR-009**: Each recap entry in Recap History MUST store and display both the percentage completed and the exact page number at time of generation.

**ISBN Enrichment**
- **FR-010**: When a primary ISBN lookup is missing one or more fields (cover, author, genre, page count), the system MUST automatically query a secondary source for those specific missing fields.
- **FR-011**: Fields not found in either source MUST be left empty without showing an error to the user.
- **FR-012**: If the primary source returns all required fields, no secondary lookup MUST be performed.

**The Lexicon**
- **FR-013**: Users MUST be able to search for a word and have its definition fetched automatically from a dictionary source.
- **FR-014**: When saving a word, users MUST be able to add an optional context sentence (text from the book) and the page number where the word was found.
- **FR-015**: Users MUST be able to create "Lore" entries with a custom term, custom definition, optional context sentence, and page number — without an external dictionary lookup.
- **FR-016**: Lexicon entries MUST be organized per book.
- **FR-017**: Each word card MUST support a flip interaction: front shows the word, back shows definition, context sentence, and page number.
- **FR-018**: The Dashboard MUST show a "Word of the Day" card selected via spaced repetition (Leitner System) from the user's saved words; the card MUST be hidden if no words are saved.
- **FR-019**: Users MUST be able to mark a word as "known," which increases its review interval in the spaced repetition system.
- **FR-020**: All Lexicon data and spaced repetition state MUST function fully offline.

**The Reading Pulse**
- **FR-021**: The system MUST calculate reading velocity (pages per hour) from logged progress updates with timestamps.
- **FR-022**: The book detail page MUST display reading velocity and a Finish Line prediction ("finish in ~X hours Y minutes") based on remaining pages.
- **FR-023**: The Dashboard hero card MUST shift to a visual warning state (amber tone) when the Continuity Score is low (book not updated for more than 48 hours).
- **FR-024**: When the hero card is in warning state, a prompt MUST suggest generating a Memory Jogger.
- **FR-025**: Each book in the Library MUST show a consecutive reading streak indicator (days with at least one progress update in a row).

**Milestone-Based Recapping**
- **FR-026**: The "Get Recap" button MUST be locked when the user's progress has advanced less than 10% since their last recap, showing exact pages remaining to unlock.
- **FR-027**: The first recap for any book MUST always be unlocked (no 10% threshold applies).
- **FR-028**: When a user crosses a 10% milestone, the system MUST silently run a background event extraction and store the result as a fragment.
- **FR-029**: When a user requests a recap, the system MUST use stored fragments to assemble the briefing when available, falling back to full extraction if fragments are absent or incomplete.

**The Reading Odyssey**
- **FR-030**: When a book reaches 100% progress, the system MUST automatically generate a Book Passport.
- **FR-031**: The Book Passport MUST contain: total days from first to last progress update, peak reading day (most pages in one day), Lexicon word count for that book, and a full-book AI-generated summary.
- **FR-032**: The Book Passport MUST use a visually celebratory design distinct from standard book cards.
- **FR-033**: The Book Passport MUST remain accessible for re-viewing from the completed book's detail page.

### Key Entities

- **LexiconEntry**: Word or lore term linked to a book; attributes: term, definition, type (dictionary/lore), context sentence, page number, book ID, spaced repetition state (box/interval/next review date).
- **RecapFragment**: Stored Pass-1 extraction result linked to a book and milestone percentage; attributes: book ID, page at extraction, percentage at extraction, extracted JSON content, created timestamp.
- **ReadingSession**: Derived from consecutive progress updates; attributes: book ID, start page, end page, start timestamp, end timestamp, pages read, duration in minutes.
- **BookPassport**: Generated wrap-up record for a completed book; attributes: book ID, total days, peak day, vocabulary count, AI summary text, generated timestamp.
- **UpNextOrder**: User-defined ordering for 0%-progress books; attributes: user ID, book ID, sort position.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can toggle between list and grid view in under 2 taps, with the preference remembered on next visit.
- **SC-002**: Book editing and deletion complete within 3 taps from the Library without navigating away from the page.
- **SC-003**: ISBN scans for books with missing fields automatically retrieve the missing data without any additional user action in 95% of cases where the secondary source has the field.
- **SC-004**: A Lexicon entry (dictionary word with context) is saved in under 60 seconds from opening the Lexicon.
- **SC-005**: Word of the Day is visible on the Dashboard for any user with at least one saved Lexicon entry, surfacing within the initial page load.
- **SC-006**: Reading velocity and Finish Line prediction are visible on the book detail page for any book with at least 2 progress updates.
- **SC-007**: The "Get Recap" locked state clearly communicates exactly how many pages remain before unlocking, with 0 ambiguity.
- **SC-008**: Book Passport generates automatically within 30 seconds of a book being marked complete.
- **SC-009**: The app background gradient renders without any visible cutoff on iOS devices (iPhone and iPad) across all scroll positions.
- **SC-010**: Recap History entries display both page number and percentage with no additional taps needed to see this information.

---

## Assumptions

- Existing Supabase schema will be extended with new tables for Lexicon, RecapFragments, ReadingSession history, and BookPassport; no breaking changes to existing tables.
- The secondary ISBN data source for the fallback enrichment is Google Books API (no API key required for basic metadata lookups).
- Spaced repetition (Leitner System) state is stored locally (IndexedDB) with optional sync to Supabase when online; offline-first is required.
- Reading velocity calculation uses only progress updates logged through the app; manual edits that jump many pages in a single update may produce outlier readings (outlier detection is in scope).
- The Book Passport AI summary uses the same Gemini pipeline as the Memory Jogger but with a 100% boundary.
- The iOS background gradient fix (safe-area handling) applies to all iOS Safari environments; no Android-specific changes are needed.
- Up Next ordering is per-user and stored server-side so it syncs across devices.
- The Reading Pulse analytics do not require new backend infrastructure — all calculations are performed client-side from existing progress data.
- Milestone fragment extraction runs in the background only when the device is online; if offline, the standard full extraction runs at recap-request time.
- Grid view cover images rely on the `coverUrl` field already stored per book; no new image hosting is introduced.
