# Quickstart & Validation: Book Search & Add

**Feature**: 030-book-search-add | **Date**: 2026-06-16

A run/validation guide proving the feature end-to-end. Implementation detail lives in `tasks.md`
and the source; this file is how to verify it works.

## Prerequisites

- Repo deps installed (`npm install`); `.env` with Supabase vars and (optional)
  `VITE_GOOGLE_BOOKS_API_KEY`.
- The migration `supabase/migrations/20260616_book_description.sql` applied to the target Supabase
  project (adds `books.description`, extends `get_library_with_progress`).
- A signed-in user (Supabase Auth) with a library.

## Setup

```bash
npm install
# apply the new migration via your usual Supabase workflow (CLI push or MCP apply_migration)
npm run dev
```

## Validation scenarios

Each maps to spec acceptance criteria / success criteria.

### V1 — Reorganized Add Book screen (US2 / FR-001, FR-002)
1. Navigate to **Add a Book**.
2. Expect: two primary buttons **"Scan ISBN"** and **"Add Manually"** at the top, and a **search
   bar** in a section below.
3. Click **Scan ISBN** → the existing scanner step appears, behaving as before.
4. Go back; click **Add Manually** → the existing manual `BookForm` appears, behaving as before.
   *(Pass = both legacy flows visually/behaviorally unchanged — SC-005.)*

### V2 — Search and add (US1 / FR-005, FR-008, FR-009..FR-012)
1. In the search bar type a known title (e.g., `the hobbit`).
2. Expect results to appear automatically within ~3s (SC-004), each showing cover (when
   available), title, author.
3. Select a result → routed to `books/add/details/openlibrary/<key>`; form is pre-filled.
4. Review, optionally edit a field, choose a library status, **Save Book**.
5. Expect: routed to dashboard (if "Reading now") or library (otherwise); the book appears in the
   library. *(Whole flow < 60s — SC-001.)*

### V3 — Author and ISBN queries (US1 / FR-005)
1. Search an author name (e.g., `brandon sanderson`) → results include that author's books.
2. Search a raw ISBN (e.g., `9780261102385`) → the matching book appears.

### V4 — Pagination (FR-007a)
1. Run a broad query (e.g., `history`).
2. Expect ~20 results initially and a **Load more** (or infinite-scroll) control that appends the
   next page.

### V5 — Gap-fill from secondary source (US3 / FR-007)
1. Select a title whose Open Library record lacks a cover or page count.
2. Expect the missing field populated from Google Books (when available); otherwise the field is
   empty and editable. *(For popular books, ≤ 1 field needs manual entry — SC-002.)*

### V6 — Description persisted (FR-010, FR-012a)
1. Select a book that has a description; confirm it shows in the form.
2. Save, then re-open the saved book; confirm the description was persisted (DB
   `select description from books where id = …` is non-null).

### V7 — Recommendations, actionable (US4 / FR-013, FR-013a)
1. On a details page for a well-known book, confirm a recommendations area lists related titles.
2. Tap a recommendation → routed into the add flow for that title (its own pre-filled details).
3. Select a book with no recommendations → the area is hidden, page otherwise normal.

### V8 — Duplicate notice (FR-012b)
1. Search and open a book already in your library.
2. Expect a non-blocking "already in your library" message; **Save Book** is still enabled and
   works.

### V9 — Failure / empty / loading (Edge cases / FR-015, SC-006)
1. Search gibberish (e.g., `zzzqqq123`) → clear empty-state; Scan/Manual still usable.
2. Simulate offline (DevTools) and search → retryable error message; Scan/Manual still usable.
3. While a query is loading, a loading indicator is shown (not a frozen/blank screen).

## Automated checks

```bash
npm run lint
npm test
```

Targeted unit tests to add (see `tasks.md`): OL doc → `BookSearchResult` mapping; OL+GB →
`BookDetailDraft` merge (incl. `description` gap-fill); duplicate-detection helper;
`useBookSearch` debounce/pagination/abort behavior.

## Definition of Done

- All V1–V9 scenarios pass.
- `npm run lint` and `npm test` are green.
- Migration applied; `books.description` populated on a saved searched book.
- Scan ISBN and Add Manually flows verified unchanged (SC-005).
