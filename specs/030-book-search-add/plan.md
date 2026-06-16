# Implementation Plan: Book Search & Add

**Branch**: `030-book-search-add` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-book-search-add/spec.md`

## Summary

Add a third "add book" path — **search** — alongside the unchanged Scan ISBN and Add Manually
flows. The Add Book screen gains a landing layout with two primary action buttons on top and a
search section below. Typing a title/author/ISBN runs a debounced live search against the
**Open Library** search API (primary), paginated ~20 per page with load-more. Selecting a result
navigates to a new, refresh-safe **book details page** that re-fetches full metadata (Open Library
+ Google Books gap-fill), pre-fills an editable form (reusing `BookForm`), surfaces a persisted
**description**, shows a non-blocking "already in your library" notice for duplicates, and shows
best-effort, tappable recommendations. Saving reuses the existing `addBookWithInitialStatus`
mutation. The only backend change is a single nullable `description` column on `books` (plus
returning it from the `get_library_with_progress` RPC).

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`)

**Primary Dependencies**: PrimeVue 4, Pinia 3, Vue Router 4, Supabase JS v2, VueUse
(`watchDebounced`), date-fns v4 (existing). External: Open Library Search/Works APIs (primary),
Google Books API (gap-fill, existing `VITE_GOOGLE_BOOKS_API_KEY`).

**Storage**: Supabase PostgreSQL — `books` table extended with one nullable `description text`
column. No new tables. `get_library_with_progress` RPC extended to return `description`.

**Testing**: Vitest (`npm test`) + ESLint (`npm run lint`).

**Target Platform**: Installable PWA (iOS/Android/desktop), mobile-first one-handed use.

**Project Type**: Web application (single Vue front end + Supabase BaaS).

**Performance Goals**: Search results visible < 3s on a typical mobile connection (SC-004);
300ms debounce; in-flight requests aborted on new keystrokes; result payload trimmed via OL
`fields`/`limit`.

**Constraints**: Spoiler-free constraint N/A. Graceful degradation required — search failures
must never block the Scan/Manual paths. New pages lazy-loaded (Principle V). PrimeVue-first
(Principle VI).

**Scale/Scope**: Single-user library context; ~20 results per page; recommendations capped
(~6–8) best-effort. 1 migration, ~3 new components, 1 new page, 1 new composable, 1 new service,
type + store extensions.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment |
|-----------|------------|
| **I. Memory Continuity** | N/A — no recap/AI content in this feature. ✅ |
| **II. Physical-to-Digital Bridge** | Directly reinforced: search resolves edition metadata via **Open Library (primary) → Google Books (fallback)**, exactly the mandated source order; manual entry remains a first-class fallback; progress still keyed on absolute pages. ✅ |
| **III. AI-First Recap Engine** | N/A — feature does not touch the recap pipeline. ✅ |
| **IV. Data Integrity & Sync** | Supabase remains the datastore; the new `description` is written synchronously through the existing `addBook` insert before the UI confirms. No data-loss path introduced. ✅ |
| **V. PWA-First & Frictionless** | New page + components route-level lazy-loaded; "Add a Book" stays within two taps; external API calls are non-blocking and degrade gracefully (offline add is out of scope, consistent with existing ISBN lookup). ✅ |
| **VI. Component Architecture & UI Standards** | PrimeVue-first: InputText/IconField (search), Image (covers), Card/Message/InlineMessage, ProgressSpinner, Button. `BookForm` is reused for the editable details. New components are single-responsibility and < 250 lines, named by domain noun. Per-component PrimeVue imports. ✅ |

**UX Philosophy watch-item — "no discovery feeds in v1"**: Recommendations are *in-context,
best-effort related titles shown during the add flow on a book's own details page* (explicitly
requested in the spec and clarified as tappable to re-enter the same add flow). They are **not** a
standalone dashboard discovery feed, contain no gamification/social surface, and hide gracefully
when unavailable. Treated as compliant; flagged here for transparency. No Complexity Tracking
entry required.

**Result**: PASS (no violations; no justifications needed).

**Documented exception — primary book-data source (added post-implementation, user-directed)**:
Constitution Principle II and the Technical Stack section name *Open Library (primary) with Google
Books fallback*. For the Book Search & Add flow specifically, the order is **inverted**: Google Books
is primary (better/cleaner descriptions, richer metadata in one call) and Open Library is the
gap-fill fallback. This is a **scoped exception to this feature only** — the constitution is left
unchanged per the product owner's decision, and the Scan ISBN / Add Manually paths still follow the
constitution's Open-Library-primary order (`useIsbn.ts` untouched). If this proves out, a future
constitution amendment should reconcile Principle II.

## Project Structure

### Documentation (this feature)

```text
specs/030-book-search-add/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (external API + internal interfaces)
│   ├── open-library.md
│   ├── google-books.md
│   └── internal-interfaces.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── pages/
│   ├── AddBookPage.vue              # MODIFIED — new 'home' landing step (buttons + search);
│   │                                #   existing 'scan' and 'form' steps unchanged
│   └── BookSearchDetailPage.vue     # NEW — refresh-safe pre-filled details + recommendations
├── components/
│   └── books/
│       ├── BookSearchSection.vue    # NEW — search bar + results list + states (PrimeVue-first)
│       ├── BookSearchResultCard.vue # NEW — single result row (cover/title/author)
│       ├── BookRecommendations.vue  # NEW — best-effort related titles list
│       ├── BookForm.vue             # MODIFIED — add description field (PrimeVue Textarea)
│       └── IsbnScanner.vue          # UNCHANGED
├── composables/
│   ├── useBookSearch.ts             # NEW — module-singleton: debounced query, paginated results,
│   │                                #   load-more, abortable, results cache (pattern mirrors
│   │                                #   useGreatLibrarySearch)
│   └── useIsbn.ts                   # UNCHANGED (scan/manual lookup path)
├── services/
│   └── bookSearchService.ts         # NEW — Open Library search + OL/GB detail merge + recs
├── stores/
│   └── books.ts                     # MODIFIED — persist/return description in add/update/RPC paths
├── types/
│   └── index.ts                     # MODIFIED — BookMetadata/Book/BookRow + description; new
│                                    #   search/recommendation types & mappers
└── router/
    └── index.ts                     # MODIFIED — add books/add/details/:source/:key route

supabase/
└── migrations/
    └── 20260616_book_description.sql # NEW — ADD COLUMN description; extend RPC
```

**Structure Decision**: Web-application layout (existing). The Add Book entry point is extended
in place (`AddBookPage.vue`) so the Scan and Manual flows keep their exact current behavior; all
new surface area lives in new, single-responsibility components/pages/composables/services under
the established `src/**` domain folders, satisfying Principle VI.

## Key Design Decisions

1. **Refresh-safe details navigation by key, not by passed object.** The details route carries
   `:source` (`openlibrary`) and `:key` (OL work/edition key, or ISBN). The details page
   re-fetches metadata on mount, so a hard refresh or shared link still works and large objects
   are not stuffed into router state. Search results are kept in the `useBookSearch`
   module-singleton so navigating **back** preserves the prior result list (mirrors
   `useGreatLibrarySearch`).

2. **Reuse `BookForm` for the editable details.** The form already covers title, author, pages,
   genre, cover, ISBN, library status, and current page with validation matching the existing
   add-book rules (FR-014, FR-017). It is extended with a single `description` field rather than
   duplicating a form. Saving routes through `addBookWithInitialStatus` unchanged.

3. **Search engine & sources — UPDATED post-implementation (see Constitution exception below).**
   Originally Open Library was the search engine with Google Books only gap-filling. After review of
   description quality and call efficiency, this flow now uses **Google Books as the primary search
   and detail source** (`googleapis.com/books/v1/volumes`), with **Open Library gap-filling** missing
   cover/page-count/genre by ISBN (`openlibrary.org/api/books`). Descriptions are normalized via
   `src/utils/cleanDescription.ts` (strips HTML + Open Library's trailing `([source][n])`
   attribution footers). The Scan/Manual flow (`useIsbn.ts`) is unchanged.

4. **Best-effort recommendations.** Derived from the selected work's first subject (or same
   author) via an OL search, excluding the current title, capped to a handful. Hidden on empty or
   error (FR-013). Tapping a recommendation re-enters the details route for that title (FR-013a).

5. **Duplicate notice is client-side.** On the details page, compare against
   `booksStore.books` (already loaded) by normalized ISBN, else title+author, and render a
   non-blocking PrimeVue `Message`. No server round-trip, no block (FR-012b).

6. **Backend = one additive column (Supabase best practices).** `ALTER TABLE public.books ADD
   COLUMN IF NOT EXISTS description text;` is a metadata-only change (nullable, no default → no
   table rewrite, minimal lock). No index is added (description is never filtered/sorted
   server-side — avoids a useless index). Existing owner RLS on `books` covers the new column
   automatically. The `get_library_with_progress` RPC is updated to also return `description` so
   it can be displayed later; the function keeps its existing `(select auth.uid())` pattern.

## Complexity Tracking

> No Constitution violations — section intentionally empty.
