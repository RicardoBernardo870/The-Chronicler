# Data Model: Completion Passport Session

## Active Reading Book

**Represents**: The book currently shown as the reading-now hero and eligible for session, progress, recap, capture, lore, and passport actions.

**Source**: Existing `books` row plus optional `reading_progress` row and `useActiveBook` in-memory selection.

**Fields used by this feature**:

- `id`: stable book identifier.
- `title`: used in completion prompt copy.
- `author`: available for passport generation context.
- `totalPages`: used to calculate completion and preserve first-session page boundaries.
- `currentPage`: existing progress value, defaulting to 0 when no row exists.
- `percentage`: derived completion value, defaulting to 0 when no row exists.
- `sessionStartAt`: active-session marker on `reading_progress`.

**Validation rules**:

- Must belong to the authenticated user.
- Must not already be completed unless an explicit reread flow exists.
- Start Session may initialize progress at page 0 but must not claim pages were read.

**State transitions**:

```text
queued/unread selected -> active reading book
active reading book with no progress -> active session at page 0
active reading book with progress 1-99% -> active session at current page
active reading book reaches 100% -> completed book
```

## Completed Book

**Represents**: A book whose saved progress reaches 100% and appears in the completed list.

**Source**: Existing `reading_progress` percentage derived from `current_page / total_pages`.

**Fields used by this feature**:

- `id`: used for prompt deduplication and routing.
- `title`: displayed in completion prompt.
- `updatedAt`: supports completed-list ordering.
- `percentage`: determines completed state.

**Validation rules**:

- Prompt triggers only when progress crosses from below 100% to 100% or greater.
- Routine refresh of an already completed book must not trigger a new prompt.

**State transitions**:

```text
in progress below 100% -> newly completed -> completed list
newly completed -> passport prompt shown or dismissed
completed -> stable completed state on refresh
```

## Completion Prompt

**Represents**: A transient UI event that celebrates completion and points to the Book Passport.

**Source**: Client-side completion transition event, not a persisted table.

**Fields**:

- `bookId`: target book for routing.
- `bookTitle`: human-readable prompt title when available.
- `shownForBookId`: transient guard against duplicate display in one interaction.
- `primaryAction`: route to Book Passport or equivalent journey view.
- `secondaryAction`: dismiss/continue.

**Validation rules**:

- Must only be created for a newly completed book.
- Must remain dismissible.
- Must support pending or missing passport content.

## Book Passport Destination

**Represents**: The existing journey route for a completed book.

**Source**: Existing `/books/:id/passport` route and `book_passports` data.

**Fields used by this feature**:

- `bookId`: route parameter and store lookup key.
- `passport`: generated journey content when available.
- `isGenerating`: indicates pending passport generation.
- `loadError`: handles fetch/generation failures.

**Validation rules**:

- Route must remain accessible from prompt and completed book surfaces.
- Empty/pending states must not dead-end the user.
