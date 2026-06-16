# Feature Specification: Book Search & Add

**Feature Branch**: `030-book-search-add`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "Currently, users can add a book in two ways: by scanning an ISBN code or by manually entering all book details, including an image URL. We want to improve this flow by introducing a third option: searching for a book. On the 'Add Book' screen, the top section should contain the primary actions, which are two buttons labeled 'Scan ISBN' and 'Add Manually'. Below these buttons, there should be a search section with a search bar where users can type a book title, author, or ISBN. For the search functionality, the Open Library API should be used as the primary data source. The Google Books API should be used to fill in any missing data when needed, such as images or descriptions. The Scan ISBN flow should work exactly as it does today, with no changes. The Add Manually option should open the existing manual entry dialog, also with no changes. For the Search and Add flow, the user searches for a book and a list of results is displayed. When the user selects a book, they are navigated to a new book details page that specifically shows all the book details, and if possible recommendations based on that book. This page should be pre-filled with all available data from the APIs, and the user should be able to review and edit the information before saving the new book."

## Clarifications

### Session 2026-06-16

- Q: Should the API-provided book description be persisted on the saved book record? → A: Yes — persist it by adding a `description` field to the saved book record.
- Q: How should a book that already exists in the reader's library be handled? → A: Warn but allow — show a non-blocking "already in your library" notice; the reader can still save.
- Q: What can the reader do with the recommendations on the detail page? → A: Actionable — tapping a recommendation launches the search-and-add flow for that title.
- Q: How many results should a search return? → A: Capped first page (~20) with "load more" / infinite scroll.
- Q: How does a search fire as the reader types? → A: Debounced live search as the reader types (~300ms).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for a book and add it (Priority: P1)

A reader wants to add a book to their library but does not have the physical book in hand to scan and does not want to type every field manually. They open the Add Book screen, type a book title, author name, or ISBN into the search bar, and see a list of matching books. They select the one they want, land on a pre-filled book details page, review the information, optionally edit it, choose a starting library status, and save the book to their library.

**Why this priority**: This is the core of the feature — it is the entirely new capability being introduced and delivers the primary value (adding a book quickly without scanning or full manual entry). Without it the feature does not exist.

**Independent Test**: Can be fully tested by entering a known title into the search bar, selecting a result, confirming the details page is populated with that book's information, and saving — then verifying the book appears in the library. Delivers immediate standalone value.

**Acceptance Scenarios**:

1. **Given** the reader is on the Add Book screen, **When** they type a recognizable book title into the search bar, **Then** a search runs automatically shortly after they stop typing and a list of matching book results is displayed, each showing enough information (such as title, author, and cover when available) to identify the book.
2. **Given** a list of search results is displayed, **When** the reader selects a result, **Then** they are navigated to a book details page pre-filled with that book's available information.
3. **Given** the reader is on the pre-filled book details page, **When** they review and (optionally) edit the fields and choose to save, **Then** the new book is added to their library with the reviewed values and they are returned to a relevant library/dashboard view.
4. **Given** the reader searches by author name, **When** results are returned, **Then** the results include books by that author.
5. **Given** the reader searches by ISBN, **When** a matching book exists, **Then** the corresponding book is returned as a result.
6. **Given** a search returns more results than fit on the first page, **When** the results are displayed, **Then** an initial page of results (about 20) is shown and the reader can load additional results.

---

### User Story 2 - Reorganized Add Book entry screen (Priority: P1)

A reader opening the Add Book screen sees a clear, reorganized layout: two primary action buttons — "Scan ISBN" and "Add Manually" — at the top, and a search section with a search bar below them. The reader can choose any of the three paths from this single screen.

**Why this priority**: The new search capability must be reachable, and the existing two paths must remain available and unchanged. The reorganized screen is the entry point that ties all three flows together and is required for the feature to be usable.

**Independent Test**: Can be tested by opening the Add Book screen and confirming the two labeled primary buttons appear at the top and a search bar appears below, and that each button reaches its respective flow.

**Acceptance Scenarios**:

1. **Given** the reader opens the Add Book screen, **When** the screen loads, **Then** the top section shows two primary action buttons labeled "Scan ISBN" and "Add Manually", and a search section with a search bar appears below them.
2. **Given** the reader is on the Add Book screen, **When** they choose "Scan ISBN", **Then** the existing ISBN scanning flow opens and behaves exactly as it does today.
3. **Given** the reader is on the Add Book screen, **When** they choose "Add Manually", **Then** the existing manual entry experience opens and behaves exactly as it does today.

---

### User Story 3 - Automatically fill gaps in book data (Priority: P2)

When a reader selects a book from search results, the book details page should be as complete as possible. The primary data source provides the bulk of the information; when key fields (such as cover image, description, page count, or genre) are missing, the system fills those gaps from the secondary source so the reader sees a richer, more complete pre-filled page.

**Why this priority**: It significantly improves the quality of the pre-filled page and reduces the amount of manual editing a reader must do, but the search-and-add flow still functions even if gap-filling is unavailable.

**Independent Test**: Can be tested by selecting a book whose primary-source record is missing a cover or page count and confirming that the missing field is populated from the secondary source (or left clearly empty/editable if neither source has it).

**Acceptance Scenarios**:

1. **Given** a selected book whose primary-source record is missing a cover image, **When** the details page loads, **Then** the cover is filled from the secondary source if available.
2. **Given** a selected book whose primary-source record is missing other key fields (description, page count, or genre), **When** the details page loads, **Then** those fields are filled from the secondary source when available.
3. **Given** a selected book for which neither source provides a particular field, **When** the details page loads, **Then** that field is shown empty and remains editable by the reader before saving.

---

### User Story 4 - See recommendations for the selected book (Priority: P3)

On the book details page for a selected search result, the reader can see recommendations related to that book (for example, similar titles or books in the same series/subject) when such recommendations are available.

**Why this priority**: It is an enhancement that adds discovery value ("if possible"), but the reader can fully complete the add-a-book task without it.

**Independent Test**: Can be tested by selecting a book that has related titles available and confirming a recommendations area appears with related books; and by selecting a book with no available recommendations and confirming the area is gracefully hidden or shows an appropriate empty state.

**Acceptance Scenarios**:

1. **Given** the reader is on the details page for a selected book that has related titles available, **When** the page loads, **Then** a recommendations area displays related books.
2. **Given** the reader is on the details page for a book with no available recommendations, **When** the page loads, **Then** the recommendations area is hidden or shows a non-blocking empty state, and the rest of the page works normally.
3. **Given** a recommendations area is displayed, **When** the reader taps a recommended title, **Then** the search-and-add flow launches for that title (leading to its own pre-filled, editable details page).

---

### Edge Cases

- **No results**: When a search returns no matches, the reader sees a clear empty-state message and can refine the query; the rest of the screen (Scan / Add Manually) remains usable.
- **Search service unavailable / network error**: When the search cannot be completed, the reader sees a non-blocking error message and can retry, while the Scan and Add Manually paths remain available.
- **Empty or very short query**: Submitting an empty query does not trigger a search; the system avoids unnecessary lookups for trivially short input.
- **Partial metadata**: A selected book missing required fields (e.g., page count) still loads the details page, with missing required fields flagged so the reader must supply them before saving.
- **Duplicate book**: When the reader selects a book that already exists in their library, the details page shows a non-blocking "already in your library" notice; the reader can still proceed and save.
- **Slow response**: While search results or the details page are loading, the reader sees a clear loading indicator rather than an empty or frozen screen.
- **Save failure**: If saving the reviewed book fails, the reader sees an error and their entered/edited values are preserved so they can retry.
- **Navigating back**: From the details page, the reader can return to the search results without losing their prior search.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Add Book screen MUST present two primary action buttons labeled "Scan ISBN" and "Add Manually" in a top section.
- **FR-002**: The Add Book screen MUST present a search section, below the primary actions, containing a search bar that accepts a book title, author, or ISBN.
- **FR-003**: The "Scan ISBN" action MUST invoke the existing ISBN scanning flow with no change to its current behavior.
- **FR-004**: The "Add Manually" action MUST invoke the existing manual entry experience with no change to its current behavior.
- **FR-005**: As the reader types a non-trivial search query, the system MUST automatically run the search shortly after they stop typing (debounced live search) and display a list of matching book results, without requiring a separate submit action.
- **FR-006**: The system MUST use the primary book data source for search and treat it as authoritative for results.
- **FR-007**: The system MUST use a secondary book data source to fill gaps (such as cover image, description, page count, or genre) when the primary source is missing those fields.
- **FR-007a**: The system MUST present search results in pages, showing an initial page of approximately 20 results and allowing the reader to load additional results.
- **FR-008**: Each search result MUST display enough information for the reader to distinguish it from other results (at minimum title and author, and a cover image when available).
- **FR-009**: When the reader selects a search result, the system MUST navigate them to a dedicated book details page for that book.
- **FR-010**: The book details page MUST be pre-filled with all available data gathered for the selected book, including the description when available.
- **FR-011**: The book details page MUST allow the reader to review and edit every pre-filled field before saving.
- **FR-012**: The book details page MUST allow the reader to save the book, adding it to their library with the reviewed values.
- **FR-012a**: The system MUST persist the book's description as part of the saved book record so it can be viewed after saving.
- **FR-012b**: When the selected book already exists in the reader's library, the book details page MUST show a non-blocking notice indicating it is already in the library, while still allowing the reader to save.
- **FR-013**: The book details page SHOULD display recommendations related to the selected book when such recommendations are available, and MUST hide or show a non-blocking empty state when they are not.
- **FR-013a**: When recommendations are displayed, selecting a recommended title MUST launch the search-and-add flow for that title, leading to its own pre-filled, editable details page.
- **FR-014**: The system MUST validate required book fields before saving and prevent saving until required fields are provided, consistent with the existing add-book validation rules.
- **FR-015**: The system MUST handle no-results, errors, and loading states gracefully, keeping the Scan and Add Manually paths available at all times.
- **FR-016**: After a successful save via the search-and-add flow, the system MUST route the reader to a relevant view consistent with the chosen starting library status (e.g., dashboard when starting to read now, library otherwise).
- **FR-017**: The search-and-add flow MUST let the reader choose an initial library status for the book (e.g., want to read, reading now, already finished) as the existing add-book flow does.

### Key Entities *(include if data involved)*

- **Search Query**: The text the reader enters (title, author, or ISBN) used to find candidate books. Transient; not persisted.
- **Search Result**: A candidate book returned from the search, summarizing identifying information (title, author, cover when available, and an identifier used to fetch full details). Transient; not persisted until saved.
- **Book Detail Draft**: The aggregated, pre-filled and editable representation of a selected book prior to saving — title, author, cover, page count, genre, description, ISBN, and chosen starting status. Becomes a saved library Book on save.
- **Recommendation**: A related book suggestion associated with the selected book, shown for discovery only; not added to the library unless the reader explicitly adds it. Transient; not persisted.
- **Book** (existing, extended): The reader-owned library record created on save, with title, author, ISBN, cover, total pages, genre, **description** (newly persisted), and creation time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can add a book using the search flow — from opening the Add Book screen to a saved book in their library — in under 60 seconds for a book that is found on the first search.
- **SC-002**: For the search-and-add flow, the reader needs to manually fill no more than one field on average for popular, well-cataloged books (the rest are pre-filled).
- **SC-003**: At least 90% of searches for a commonly available book title return at least one relevant result.
- **SC-004**: Search results are presented to the reader within 3 seconds for a typical query under normal network conditions.
- **SC-005**: The existing Scan ISBN and Add Manually flows continue to work exactly as before, with zero regressions reported against their prior behavior.
- **SC-006**: When a search returns no results or fails, 100% of the time the reader is shown a clear message and the Scan and Add Manually options remain usable.

## Assumptions

- **Reused save behavior**: Saving a book via the search-and-add flow uses the same underlying add-book behavior (validation, library-status selection, and post-save routing) as the existing flows; no new storage structures are introduced.
- **Primary/secondary sources**: "Open Library" is the primary search and data source and "Google Books" is the secondary gap-filling source, per the feature description. Title and core identity come from the primary source; missing fields are filled from the secondary source.
- **Description field**: The book details page surfaces a description sourced from the APIs, and the saved book record is extended to persist it (see FR-012a). Long-form formatting beyond plain text is out of scope.
- **Recommendations are best-effort**: Recommendations are shown only when readily derivable from available source data (e.g., same author, series, or subject). If no recommendations are available, the area is hidden. Selecting a recommendation re-enters the same search-and-add flow rather than adding the book directly. Building a dedicated recommendation-ranking engine is out of scope.
- **Duplicate handling**: If a reader selects a book already in their library, the system shows a non-blocking notice but still allows saving; automatic de-duplication and merge handling are out of scope for this feature.
- **Required fields unchanged**: The required fields for saving a book (title, author, valid page count, and status-dependent current page) match the current add-book rules.
- **No authentication changes**: The feature operates within the existing authenticated, single-user library context; no permission or sharing changes are introduced.
- **Network dependency**: Search and gap-filling depend on external book data services being reachable; offline search is out of scope, and failures degrade gracefully to the unchanged Scan/Manual paths.

## Out of Scope

- Changes to the existing Scan ISBN flow or the existing manual entry experience.
- A bespoke recommendation/recommendation-ranking engine beyond best-effort related titles from available data.
- Automatic de-duplication, merging, or hard-blocking of books already in the library (a non-blocking notice is shown instead).
- Persisting recommendation lists or data types other than the book description.
- Offline search capability.
