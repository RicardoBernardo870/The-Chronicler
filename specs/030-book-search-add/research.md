# Phase 0 Research: Book Search & Add

**Feature**: 030-book-search-add | **Date**: 2026-06-16

All Technical Context items were resolvable from the existing codebase and the spec's
clarifications; there were no open `NEEDS CLARIFICATION` markers. This document records the key
decisions and the alternatives considered.

## R1 — Open Library search endpoint & query shape

- **Decision**: Use `GET https://openlibrary.org/search.json?q=<query>&page=<n>&limit=20&fields=key,title,author_name,cover_i,first_publish_year,isbn,number_of_pages_median,subject`.
  A single `q` parameter naturally covers title, author, and ISBN (Open Library tokenizes all
  three), satisfying the one-search-bar requirement (FR-002). `fields` trims the payload for
  speed (SC-004); `limit=20` matches the agreed page size (FR-007a); `page` is 1-based for
  load-more.
- **Rationale**: One endpoint handles all three query types, so no client-side branching on
  "is this an ISBN?" is needed. Cover served from `https://covers.openlibrary.org/b/id/<cover_i>-M.jpg`.
- **Alternatives considered**: Separate `title=`/`author=`/`isbn=` params (rejected — forces the
  UI to guess intent); the `/api/books` bibkeys endpoint used by `useIsbn` (rejected — it is an
  ISBN-only lookup, not a search).

## R2 — Details fetch & metadata merge (OL primary, Google Books fallback)

- **Decision**: On selection, fetch the OL work/edition record by `key` for full metadata
  (description, subjects, page count, cover). Then fill any missing of {cover, description, pages,
  genre} from Google Books (`volumes?q=isbn:<isbn>` when an ISBN exists, else
  `volumes?q=intitle:<title>+inauthor:<author>`). Generalize the field-by-field merge already
  proven in `src/composables/useIsbn.ts` (`mergeMetadata`) and extend it with `description`.
- **Rationale**: Honors Constitution II's mandated source order and reuses a known-good merge
  strategy. Description is the one new field flowing through (FR-010, FR-012a).
- **Alternatives considered**: Google Books as primary (rejected — spec + constitution name Open
  Library primary); fetching details eagerly for every search result (rejected — wasteful; fetch
  only on selection).

## R3 — Passing the selected book to the details page (refresh-safe)

- **Decision**: Route `books/add/details/:source/:key`; the page re-fetches by `key` on mount.
  Search result list state lives in the `useBookSearch` module-singleton so "back" restores it.
- **Rationale**: Avoids serializing large objects into router state/`history.state`; survives hard
  refresh and deep links; mirrors the established `useGreatLibrarySearch` singleton + results-cache
  pattern already in the codebase.
- **Alternatives considered**: Pass the full result object via `router.push({ state })` (rejected
  — lost on refresh, awkward to type); stash in `sessionStorage` (rejected — re-fetch by key is
  simpler and always current).

## R4 — Search trigger & request hygiene

- **Decision**: `watchDebounced(query, run, { debounce: 300, maxWait: 1000 })`, skip queries
  shorter than 2 non-space chars, and abort the previous request with an `AbortController` when a
  newer keystroke fires.
- **Rationale**: Matches the existing Lexicon search feel (Q5), protects the public Open Library
  API from keystroke spam, and prevents out-of-order responses overwriting newer results.
- **Alternatives considered**: Explicit submit-only (rejected per Q5); no abort (rejected — race
  conditions on fast typing).

## R5 — Recommendations source

- **Decision**: Best-effort. Use the selected work's first `subject` (fallback: `author_name`) to
  run one OL search, exclude the current `key`, cap to ~6–8, and map to the same lightweight
  result shape. Hide the section on empty/error.
- **Rationale**: Zero new infrastructure, reuses the search service, and satisfies FR-013/FR-013a
  while staying within the "best-effort, hide when absent" clarification.
- **Alternatives considered**: A dedicated recommendation engine / embeddings (rejected — out of
  scope, over-engineered); Google Books "related" (rejected — no stable related endpoint).

## R6 — Persisting `description` (Supabase best practices)

- **Decision**: `alter table public.books add column if not exists description text;` — nullable,
  no default. Extend `get_library_with_progress` to select `description`. No new index. Rely on
  existing owner RLS for `books`.
- **Rationale**: A nullable column without a default is a metadata-only catalog change in modern
  Postgres — no full-table rewrite, negligible lock time (`lock-`/`schema-` guidance).
  `description` is never used in a `WHERE`/`ORDER BY`, so indexing it would only add write cost
  (`query-`/`schema-` guidance — avoid unused indexes). The column is owned data already protected
  by the table's RLS, so no policy change is needed (`security-` guidance).
- **Alternatives considered**: A separate `book_details` table (rejected — 1:1 with `books`, adds a
  join for no benefit); `varchar(n)` (rejected — Postgres `text` is preferred, no arbitrary cap
  needed); adding a GIN/full-text index now (rejected — no search-by-description requirement).

## R7 — Reusing `BookForm` vs. a new form

- **Decision**: Extend `BookForm.vue` with one `description` field (PrimeVue `Textarea`) and thread
  `description` through its `BookMetadata` initial + submit payload; the details page renders
  `BookForm` with the merged draft as `:initial`.
- **Rationale**: The form already implements every required field, validation, library-status
  selection, and post-save routing rules — reusing it guarantees parity with the existing flows
  (FR-011, FR-014, FR-017) and respects Principle VI (don't duplicate components).
- **Alternatives considered**: A bespoke details form (rejected — duplicates validation and drifts
  from the manual flow).

## R8 — Error / empty / loading UX

- **Decision**: PrimeVue building blocks — `ProgressSpinner` for loading, `Message`/`InlineMessage`
  for "no results" and error+retry, a `Button` "Load more" (or intersection-observer infinite
  scroll consistent with Lexicon). The Scan and Add Manually buttons live above the search section
  and are always rendered, so they remain usable during any search state (FR-015, SC-006).
- **Rationale**: Constitution VI (PrimeVue-first) and the spec's graceful-degradation requirement.
- **Alternatives considered**: Custom toast-only errors (rejected — inline state is clearer and
  retryable).
