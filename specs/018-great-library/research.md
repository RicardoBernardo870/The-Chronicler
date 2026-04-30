# Research: The Great Library

**Feature**: 018-great-library | **Date**: 2026-04-30

---

## D1 — Pagination Approach

**Decision**: Offset-based pagination using Supabase `.range(from, to)`.

**Rationale**: The query has multiple dynamic filters (search term, entry type, book). Cursor-based pagination (keyset) requires a stable sort key exposed to the client and becomes complex when combined with full-text search ranking — the sort order can shift between pages. Offset-based pagination is simple, composable with any filter, and perfectly adequate for collections up to ~1 000 entries (the expected upper bound per the spec). The only weakness (items shifting if new entries are inserted mid-scroll) is acceptable in this read-heavy browse context.

**Page size**: 20 entries per page. Matches the spec and is a common UX default for mobile lists.

**Alternatives considered**: Cursor-based (keyset) — rejected due to complexity with dynamic multi-column filters. Virtual scrolling (render all, window DOM) — rejected because it still requires fetching all data first.

---

## D2 — Server-Side Search

**Decision**: Use Supabase `.or('term.ilike.%query%,definition.ilike.%query%')` for partial, case-insensitive search across both term and definition columns.

**Rationale**: `ilike` is case-insensitive pattern matching on PostgreSQL. Combining two column searches via `.or()` is the idiomatic Supabase approach. No full-text search index is needed at the expected scale (< 1 000 entries). For larger collections a `tsvector` index could be added later without changing the frontend contract.

**Debounce**: 300ms on the search input before triggering a new query. Prevents a request per keystroke.

**Alternatives considered**: Client-side filter — rejected because the full collection is not loaded in memory (pagination). Full-text search (`fts`) — overkill at this scale, harder to combine with other filters.

---

## D3 — Including Book Title in Query Results

**Decision**: Use a Supabase foreign table join: `.select('*, books!inner(title)')`. The result shape returns `books: { title: string }` nested on each row. Map to a flat `LexiconSearchResult` type with `bookTitle: string`.

**Rationale**: `lexicon_entries` has a `book_id` FK to `books`. Supabase's PostgREST join syntax resolves this in a single query without a separate books fetch. `!inner` ensures only entries whose book exists are returned (guards against orphaned rows from deleted books — the spec requires a "Unknown Book" fallback, handled in the mapper).

**Alternative**: Fetch book titles separately via `booksStore.books` — rejected because the paginated query returns only a subset of entries; the booksStore may not have all titles loaded, and adding a dependency on the books store couples the composable unnecessarily.

---

## D4 — Infinite Scroll Mechanism

**Decision**: Use VueUse `useIntersectionObserver` watching a sentinel `<div>` at the bottom of the entry list.

**Rationale**: VueUse is already a project dependency (used in other composables). `useIntersectionObserver` provides a clean declarative API: when the sentinel enters the viewport, trigger `loadNextPage()`. No scroll event listeners to clean up. Works correctly on both desktop and mobile.

**Sentinel placement**: Rendered below the last entry card. Hidden when all pages are loaded or when the initial load is in progress.

**Alternatives considered**: Manual `scroll` event listener — more imperative, requires manual cleanup, less reliable cross-browser. Virtual scroller (PrimeVue `VirtualScroller`) — renders a fixed-height container, which conflicts with the variable-height card layout and the page's flex column layout.

---

## D5 — New Composable vs. Extending Existing Store

**Decision**: New `useGreatLibrarySearch` composable in `src/composables/useGreatLibrarySearch.ts`. Does not extend `useLexiconStore`.

**Rationale**: `useLexiconStore` stores entries grouped by `bookId` for per-book access patterns (BookDetailPage, WordOfTheDay). Injecting paginated cross-book search state into the same store would mix two very different access patterns and pollute the store's data model. The composable is self-contained: it owns the paginated result list, current page, filter state, and loading flags.

**Alternatives considered**: Extending `useLexiconStore` with search state — rejected because the store's `entriesByBook` map is incompatible with a flat paginated result list.

---

## D6 — Extend LexiconCard vs. New Component

**Decision**: Extend the existing `LexiconCard.vue` with an optional `bookTitle` prop. No new component needed.

**Rationale**: The Great Library needs the same flip animation, the same Leitner advance/reset controls, and the same content layout as `LexiconCard` — the only missing piece is the source book title. Adding a single optional display prop (`bookTitle?: string`) is a minimal, additive change that does not alter any existing behaviour. When `bookTitle` is provided, it is shown on the front face below the term; when absent (per-book lexicon views), the card renders exactly as before. This avoids duplicating ~100 lines of flip-card CSS and Leitner logic.

**What changes in `LexiconCard.vue`**:
- New optional prop: `bookTitle?: string`
- Front face: render book title line when prop is present (e.g. small muted text below term)
- No other changes — Leitner controls, flip mechanic, and back face are untouched

**Alternatives considered**: New `GreatLibraryEntryCard.vue` — rejected because it would duplicate the flip-card CSS and Leitner logic for no functional gain.
