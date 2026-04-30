# Feature Specification: The Great Library

**Feature Branch**: `018-great-library`
**Created**: 2026-04-30
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse All Vocabulary Across Every Book (Priority: P1)

A reader who has been saving words and lore terms while reading multiple books wants a single place to see their entire personal vocabulary collection — every word they've ever looked up, every lore term they've recorded, across their whole library. Today they can only see per-book entries from the book detail page. The Great Library gives them the full picture.

**Why this priority**: This is the core value proposition of the page. Everything else (search, filters) layers on top of a browsable collection. Without this, nothing else matters.

**Independent Test**: Navigate to the Great Library route. All lexicon entries the user has saved across all books appear in a list, each showing the term, its definition, which book it came from, and whether it is a dictionary word or lore term. Entries load in batches; scrolling to the bottom loads more.

**Acceptance Scenarios**:

1. **Given** a user has saved vocabulary entries across 3 books, **When** they open the Great Library, **Then** entries from all 3 books appear sorted by most recently added first.
2. **Given** more than 20 entries exist, **When** the user scrolls to the bottom of the list, **Then** the next 20 entries load and append below without replacing existing ones.
3. **Given** fewer than 20 entries exist, **When** the page loads, **Then** all entries appear and no "load more" trigger is shown.
4. **Given** the user has no saved entries yet, **When** they open the Great Library, **Then** an empty state is shown inviting them to start adding words while reading.

---

### User Story 2 — Search the Collection by Term or Definition (Priority: P1)

A reader remembers saving a word "sonder" or a lore term "the Veil" but cannot recall which book it was from. They type it into the search bar and immediately see matching entries across their entire library. Search must work across both the term itself and its definition text.

**Why this priority**: Search is a primary navigation tool for any large collection. Without it the page is only browsable, which breaks down past 50–100 entries.

**Independent Test**: Type a partial term into the search bar. Only entries whose term or definition contains that text (case-insensitive) appear. The entry count updates. Clearing the search restores the full list.

**Acceptance Scenarios**:

1. **Given** the collection contains entries, **When** the user types a search query, **Then** only entries whose term or definition contains that text are shown (case-insensitive, partial match).
2. **Given** a search query is active, **When** the user scrolls to the bottom, **Then** the next page of matching results loads — not unfiltered results.
3. **Given** a search returns no matches, **When** the query is entered, **Then** a clear "no results" message is shown alongside an option to clear the search.
4. **Given** a search query is active, **When** the user clears the input, **Then** the full unfiltered collection restores from page 1.
5. **Given** any filter combination is active, **When** the user changes the search query, **Then** the result list resets to page 1 before loading new results.

---

### User Story 3 — Filter by Entry Type and Book (Priority: P2)

A reader studying lore wants to see only their lore terms, not dictionary words. Another reader wants to revisit vocabulary from a specific book they just finished. The type toggle (All / Dictionary / Lore) and book dropdown let them narrow the collection instantly.

**Why this priority**: Filters significantly improve usability for a growing collection but the page delivers value without them.

**Independent Test**: Select "Lore" in the type toggle — only lore entries appear. Select a specific book from the dropdown — only entries from that book appear. Combine both filters — only lore entries from that book appear. Each filter change resets to page 1.

**Acceptance Scenarios**:

1. **Given** the type filter is set to "Dictionary", **When** the list loads, **Then** only entries with entry_type = dictionary appear.
2. **Given** the type filter is set to "Lore", **When** the list loads, **Then** only entries with entry_type = lore appear.
3. **Given** a book is selected in the book filter, **When** combined with a type filter, **Then** only entries matching both conditions appear.
4. **Given** any filter is active, **When** changed, **Then** the list resets to page 1 and fresh results load.
5. **Given** the book filter dropdown, **When** opened, **Then** only books that have at least one lexicon entry for this user appear as options.

---

### Edge Cases

- What happens when a book that had lexicon entries is deleted? Entries should still appear with the book title shown as "Deleted book" or similar fallback — entries must not silently disappear.
- What if a search query returns exactly 20 results? The infinite scroll trigger should appear; scrolling should reveal there are no further results (empty next page = stop showing trigger).
- What if the network request fails mid-scroll? The existing entries remain; an error message appears near the bottom with a retry option.
- What if the user's entire collection is empty (first-time user)? An encouraging empty state is shown rather than a blank page.
- What if a context sentence or page number was not recorded for an entry? Those fields are simply omitted from the card — no placeholder shown.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Great Library MUST be accessible via a dedicated route from the bottom navigation bar or a clearly labelled profile/library link.
- **FR-002**: The page MUST display all of the authenticated user's lexicon entries across all books, sorted by creation date descending by default.
- **FR-003**: Each entry card MUST display: the term, the definition, the entry type (Dictionary or Lore), the source book title, and — when available — the page number where it was found and the context sentence.
- **FR-004**: The page MUST load entries in pages of 20, fetching the next page automatically when the user scrolls to the bottom of the current list (infinite scroll).
- **FR-005**: The page MUST provide a text search input that filters entries by term or definition (partial, case-insensitive match) against the server-stored collection.
- **FR-006**: Changing the search query MUST reset the list to page 1 and fetch the first page of filtered results before appending further pages.
- **FR-007**: The page MUST provide a type filter toggle with three states: All, Dictionary, Lore. Default state is All.
- **FR-008**: The page MUST provide an optional book filter that lists only books the user has lexicon entries for. Selecting a book narrows results to that book only.
- **FR-009**: All active filters (search text, entry type, book) MUST apply simultaneously and each change MUST reset to page 1.
- **FR-010**: When no entries match the current filters, the page MUST display a contextual empty state distinguishing between "no entries yet" and "no results for this search/filter".
- **FR-011**: When a network request fails, the page MUST retain already-loaded entries and display a non-blocking error indicator with a retry action.
- **FR-012**: The page MUST show a loading skeleton while the first page is being fetched.
- **FR-013**: When all available entries for the current filter have been loaded, the infinite scroll trigger MUST disappear and a subtle "all entries loaded" indicator shown.

### Key Entities

- **Lexicon Entry**: A single vocabulary or lore term saved by the user. Has a term, definition, entry_type (dictionary/lore), book association, optional page number, optional context sentence, and creation timestamp.
- **Book**: The source of a lexicon entry. Referenced by its title for display. Entries whose source book has been deleted still appear with a fallback title.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with 200 entries can open the Great Library and see the first 20 results in under 2 seconds on a standard mobile connection.
- **SC-002**: Typing a search query surfaces relevant results in under 1 second after the user stops typing (with a short debounce of 300ms or less).
- **SC-003**: Scrolling through a collection of 500 entries causes no visible jank or layout shift — entries append smoothly without re-rendering existing cards.
- **SC-004**: Applying any combination of filters (type + book + search) always shows correct, consistent results — no entries from other users, no duplicates, no missing matches.
- **SC-005**: The page is reachable in at most 2 taps from any screen in the app.

---

## Assumptions

- The `lexicon_entries` table already exists with columns: `id`, `user_id`, `book_id`, `term`, `definition`, `entry_type`, `context_sentence`, `page_found`, `created_at`. No schema changes are needed.
- Book titles are available via a join with the `books` table on `book_id`.
- If a book has been deleted but its lexicon entries remain (orphaned rows), the UI will display a fallback title such as "Unknown Book" rather than failing.
- The book filter dropdown will show only books that have at least one lexicon entry for the current user — not the entire library.
- Pagination is offset-based (page index × page size) rather than cursor-based, which is simpler to implement alongside search/filter and acceptable given the expected collection sizes (hundreds, not millions).
- A debounce of 300ms is applied to the search input before triggering a server request to avoid excessive queries on every keystroke.
- The Great Library is a read-only view — editing or deleting entries from this page is out of scope for this version.
- The bottom navigation bar has space for one additional item, or the page is reachable from the Profile section if the nav is full.
