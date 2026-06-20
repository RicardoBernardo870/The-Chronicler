# Feature Specification: Library Import (Goodreads & StoryGraph)

**Feature Branch**: `034-library-import`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Import Goodreads and StoryGraph libraries into BookHero. The reader uploads a CSV export; the app parses it, maps each row's read-status (read → completed at 100%; to-read and currently-reading → 'Want to read'), dedupes against the existing library, and creates the books quietly (no recaps, quest XP, or completion passports). Missing cover/genre/page metadata is enriched in the background via the existing book search (Google Books + Open Library). Books with no known page count are imported with a flagged placeholder the reader can fix later. Large libraries import with clear progress and partial-failure handling. Imported 'Want to read' books land in a surfaced TBR shelf with a 'Start reading' action. Out of scope v1: ratings, reviews, read-dates, a 'what to read next' recommender, wishlist-vs-owned."

## Clarifications

### Session 2026-06-18

- Q: Which import sources are supported? → A: Both **Goodreads** and **StoryGraph** CSV exports.
- Q: How is "currently-reading" mapped (the export has no current page, and status derives from current page)? → A: Maps to **"Want to read"** (the reader sets their real page when they start a session). Only "read" rows become completed.
- Q: Are ratings, reviews, and read-dates imported? → A: **No** — out of scope for v1 (BookHero has no field for them).
- Q: Are missing metadata fields blocking? → A: No — **save immediately, enrich cover/genre/pages in the background**; books with no known page count import with a flagged placeholder the reader can fix.
- Q: Do imported "read"/completed books inflate current-period stats? → A: **No.** They count toward **lifetime** library composition (total finished, genre breakdown, Reading DNA) but are **excluded** from current-period metrics — yearly reading goal, streaks, and "pages/sessions this month". This requires marking imported books so period-based stats can skip them.
- Q: Where does the reader start an import? → A: From the **Add Book** screen (alongside Scan ISBN / Add Manually / Search) **and** from the **empty-library / onboarding** state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import an existing library from a CSV (Priority: P1)

A reader who already tracks books on Goodreads or StoryGraph exports their library to a CSV and uploads it to BookHero. The app reads the file, recognizes which export it is, and creates the books in the reader's library with the right shelf status — turning an empty BookHero into a populated, personal library in one step.

**Why this priority**: This is the entire feature and the core activation win — a new reader with a populated library is far more likely to stay. Without it, nothing else matters.

**Independent Test**: Export a real Goodreads (and separately a StoryGraph) CSV, upload each, and confirm the books appear in the library with correct titles, authors, and shelf statuses, and that nothing pre-existing is duplicated.

**Acceptance Scenarios**:

1. **Given** a Goodreads CSV export, **When** the reader uploads it, **Then** its books are added to the library with statuses mapped (read → completed; to-read/currently-reading → "Want to read").
2. **Given** a StoryGraph CSV export, **When** the reader uploads it, **Then** the same mapping and import behavior applies.
3. **Given** a book in the CSV that already exists in the reader's library, **When** the import runs, **Then** it is skipped (not duplicated), matched by ISBN when present, otherwise by title + author.
4. **Given** "read" rows, **When** they are imported, **Then** they appear as completed (100%) **without** generating recaps, lore, quest XP, or completion passports.
5. **Given** an unrecognized or malformed file, **When** the reader uploads it, **Then** they get a clear message and no partial/garbage data is created.

---

### User Story 2 - Imported books get their cover and details filled in (Priority: P1)

After import, books that came in without a cover, genre, or page count are quietly enriched in the background so the library looks complete and is usable for reading sessions — without the reader waiting on it or doing manual cleanup.

**Why this priority**: A library of title-only rows with broken covers feels broken and won't be used. Enrichment is what makes the imported library feel first-class. It must not block the import itself, so it's a peer P1 delivered right after the rows land.

**Independent Test**: Import a CSV whose rows lack cover/genre/pages; confirm the books appear immediately, then their covers/genres/page counts populate shortly after without the reader doing anything.

**Acceptance Scenarios**:

1. **Given** imported books missing cover/genre/pages, **When** the import completes, **Then** the books are already present, and missing fields are filled in afterward in the background.
2. **Given** enrichment can't find a page count for a book (and the CSV had none), **When** the book is imported, **Then** it is still created with a clearly flagged placeholder page count the reader can correct, rather than dropped.
3. **Given** the enrichment source is unavailable, **When** import runs, **Then** the books still import with whatever the CSV provided; enrichment is best-effort and never blocks or fails the import.

---

### User Story 3 - See and start reading imported "Want to read" books (Priority: P2)

Imported "Want to read" books land in a browsable shelf the reader can scan, and starting one is a single obvious action — turning the freshly imported backlog into the next reading session.

**Why this priority**: Import populates the shelf; this is what converts a populated backlog into actual reading (the retention goal). It builds on US1 but the import is valuable on its own first.

**Independent Test**: After importing, open the "Want to read" shelf, confirm the imported queued books are listed, and use the "Start reading" action to begin one (which moves it into active reading).

**Acceptance Scenarios**:

1. **Given** imported "Want to read" books, **When** the reader opens the TBR shelf, **Then** those books are listed and browsable.
2. **Given** a book on the TBR shelf, **When** the reader taps "Start reading", **Then** the book becomes their active/in-progress read.
3. **Given** an empty TBR shelf, **When** the reader opens it, **Then** they see a clear, encouraging empty state (including a path to import or search).

---

### Edge Cases

- **Large library (e.g., 300–1000 rows)**: the reader sees clear progress ("142 of 300") and the app stays responsive; the import does not appear frozen.
- **Some rows fail** (unparseable, no title, no match): those rows are reported in a summary ("288 imported, 12 skipped") and do **not** abort the whole import.
- **Re-importing the same file** (or overlapping libraries): already-present books are skipped, not duplicated.
- **Duplicate rows within one file**: collapsed so a book imports once.
- **Missing page count** from CSV and enrichment: imported with a flagged placeholder, surfaced so the reader can fix it.
- **Mixed/ambiguous status values**: any non-"read" status maps to "Want to read"; unknown status defaults to "Want to read".
- **Very large file / wrong file type**: clear validation message; no crash.
- **Interrupted import** (navigation away / connection drop): partial progress is preserved (books already created stay) and the reader can resume/re-run safely (dedupe prevents doubles).
- **Quiet import**: no notifications, recaps, lore, quest XP, or passports fire for imported books, even the "read"/completed ones.
- **Stats integrity**: imported "read" books appear as finished in the library and lifetime composition, but do **not** appear in "this year/this month" activity or count toward the yearly reading goal or streaks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The reader MUST be able to upload a library export file and have its books added to their BookHero library.
- **FR-002**: The system MUST accept both **Goodreads** and **StoryGraph** CSV exports and correctly interpret each format's columns (at minimum title, author, ISBN, page count, and read-status/shelf).
- **FR-003**: The system MUST map read-status to BookHero status: **read → completed (100%)**; **to-read and currently-reading → "Want to read"**; unknown/empty → "Want to read".
- **FR-004**: The system MUST de-duplicate against the existing library — skipping a row that matches an existing book by ISBN, or (when no ISBN) by case-insensitive title + author — and MUST collapse duplicate rows within the same file.
- **FR-005**: Imported books MUST be created **quietly**: no recaps, lore, vocabulary, quest XP, completion passports, or notifications are generated for them, including for "read"/completed books.
- **FR-006**: The system MUST enrich missing cover, genre, and page-count metadata **in the background** using the existing book-search sources, without blocking or delaying the appearance of the imported books.
- **FR-007**: A book whose page count is unknown from both the CSV and enrichment MUST still be imported, with a clearly flagged placeholder page count the reader can correct later (it MUST NOT be silently dropped).
- **FR-008**: The system MUST show clear progress during import (e.g., "142 of 300") and remain responsive for large libraries.
- **FR-009**: Rows that cannot be parsed or matched MUST be skipped and reported in an import summary, without aborting the rest of the import.
- **FR-010**: On an unrecognized or malformed file, the system MUST show a clear message and create no partial/garbage data.
- **FR-011**: The system MUST present a completion summary (e.g., counts of imported, skipped-as-duplicate, and failed rows).
- **FR-012**: Imported "Want to read" books MUST appear in a browsable TBR ("Want to read") shelf with a prominent "Start reading" action that moves a book into active reading.
- **FR-013**: An interrupted or re-run import MUST be safe — already-created books persist and re-running does not create duplicates.
- **FR-014**: Imported books MUST carry a marker distinguishing them from manually-tracked books. Imported "read"/completed books MUST count toward **lifetime** library composition (total finished, genre breakdown, Reading DNA inputs) but MUST be **excluded** from current-period metrics — the yearly reading goal, reading streaks, and "pages/sessions this/last month".
- **FR-015**: The reader MUST be able to start an import from the **Add Book** screen (alongside Scan ISBN / Add Manually / Search) and from the **empty-library / onboarding** state.

### Key Entities *(include if data involved)*

- **Import File**: An uploaded CSV export (Goodreads or StoryGraph). Transient; not persisted after processing.
- **Import Row → Book**: Each usable row maps to a BookHero **Book** (existing entity: title, author, ISBN, cover, total pages, genre) plus an initial status (completed or "Want to read") and an **imported marker** (so period-based stats can exclude imported books). Ratings, reviews, and read-dates from the file are intentionally ignored.
- **Import Summary**: A transient result of the import — counts of imported, skipped (duplicate), and failed rows, with reasons. Shown to the reader; not necessarily persisted.
- **TBR Shelf**: The browsable view of the reader's "Want to read" books (the existing `queued` status surfaced as a first-class shelf).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can go from an empty BookHero to a populated library by importing a typical (≈100-book) export in **under 2 minutes** of their attention, with the books visible without waiting on enrichment.
- **SC-002**: At least **95%** of rows in a standard Goodreads/StoryGraph export are imported successfully (matched and created); the rest are reported, not lost.
- **SC-003**: After import, at least **90%** of imported books show a cover and page count once background enrichment settles (popular titles).
- **SC-004**: Importing the same library twice results in **zero** duplicate books.
- **SC-005**: No recaps, quest XP, or completion passports are generated by an import (0 side effects), verified for a library containing "read" books.
- **SC-007**: Importing N already-read books increases the reader's current-year reading-goal progress and recent-activity ("this month") stats by **0**, while their lifetime finished-book count reflects the import.
- **SC-006**: A reader can locate their imported "Want to read" books and start reading one in **under 15 seconds** after import.

## Assumptions

- BookHero's existing statuses are reused: "read" → the existing completed state (progress at total pages); "to-read"/"currently-reading" → the existing `queued` / "Want to read" state. No new status type is introduced.
- "currently-reading" maps to "Want to read" because the exports do not include a current page and BookHero derives reading status from the current page; the reader sets their true page when they start a session.
- Enrichment reuses the existing book-search behavior (Google Books primary, Open Library gap-fill) and is best-effort.
- The "quiet" import reuses the existing import-safe write path that already avoids progress-history, recap, capture, lore, and quest side effects.
- A reasonable upper bound for a single import is in the low thousands of rows; extreme outliers may be chunked but are not a v1 target.
- The placeholder page count for unknown-length books is a small, clearly-flagged value the reader is prompted to correct.
- Distinguishing imported books (FR-014) requires a marker on the book (e.g., an import flag/source); current-period stat surfaces (yearly goal, streaks, monthly activity) are expected to honor that marker, while lifetime/library-composition surfaces include imported books.

## Out of Scope

- Importing star ratings, reviews, or read-dates (BookHero has no field for these today; a future "ratings/reviews" feature could add them).
- A "what to read next" / TBR-ranking recommender.
- Wishlist-vs-owned distinction, shelves/tags/collections beyond the three existing statuses.
- Two-way sync or ongoing/automatic syncing with Goodreads/StoryGraph (this is a one-time, on-demand import).
- Importing from sources other than Goodreads and StoryGraph CSVs (e.g., Amazon/Kindle, LibraryThing, generic column-mapping UI).
