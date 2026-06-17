# Phase 1 Data Model: Book Search & Add

**Feature**: 030-book-search-add | **Date**: 2026-06-16

## 1. Persisted schema change

### `books` (existing table — one additive column)

| Column | Type | Null | Notes |
|--------|------|------|-------|
| `description` | `text` | YES | **NEW.** Plain-text book description sourced from Open Library / Google Books. Nullable, no default → metadata-only `ADD COLUMN` (no rewrite). |

All other `books` columns (`id`, `user_id`, `title`, `author`, `isbn`, `cover_url`,
`total_pages`, `genre`, `created_at`) are unchanged. Existing owner Row-Level Security on `books`
governs the new column — **no policy change**. **No index** on `description` (never filtered or
ordered server-side).

### Migration `supabase/migrations/20260616_book_description.sql`

Two operations, both idempotent and forward-only:

1. `alter table public.books add column if not exists description text;`
2. `create or replace function ... get_library_with_progress(...)` — re-create the RPC so its
   result set includes `b.description`. Preserve the existing signature, `security definer`
   setting, and `(select auth.uid())` ownership pattern; only add `description` to the returned
   columns. (See `contracts/internal-interfaces.md` for the exact return-shape addition.)

> Supabase best-practice notes: nullable-no-default keeps the lock metadata-only (`lock-`),
> skipping an index avoids write amplification on an un-queried column (`query-`/`schema-`), and
> reusing the table's existing RLS keeps the security surface unchanged (`security-`).

## 2. TypeScript type changes (`src/types/index.ts`)

### Extended

| Type | Change |
|------|--------|
| `Book` | add `description: string \| null` |
| `BookRow` | add `description: string \| null` (DB row shape) |
| `BookMetadata` | add `description: string \| null` |
| `LibraryBookEntry` | add `description: string \| null` (RPC row shape) |
| `mapBook(row)` | map `description: row.description` |
| `AddBookInput` | inherits `description` automatically (extends `Omit<Book, …>`) |

### New (search & recommendations — all transient, none persisted)

```text
BookSearchResult {
  source: 'openlibrary'
  key: string              // OL work/edition key or ISBN — used as the details route :key
  title: string
  author: string | null
  coverUrl: string | null
  firstPublishYear: number | null
  isbn: string | null
}

BookDetailDraft {          // merged OL + Google Books, pre-fill for BookForm
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
  description: string | null
  isbn: string | null
}

Recommendation = BookSearchResult   // same lightweight shape; tapping re-enters the add flow
```

Mappers (mirroring the existing `mapBook` / `mapSearchResult` style):
`mapOpenLibraryDoc(doc) → BookSearchResult`, `mapToDetailDraft(ol, gb?) → BookDetailDraft`.

## 3. Entity relationships & lifecycle

```text
Search Query ──(debounced)──▶ BookSearchResult[]   (Open Library search; paginated ~20)
        BookSearchResult ──(select / tap recommendation)──▶ route :source/:key
                                   │
                                   ▼
              BookDetailDraft  ◀── OL detail  ⊕ Google Books gap-fill
                                   │  (+ Recommendation[] best-effort)
                                   │  (+ duplicate check vs booksStore.books)
                                   ▼  user reviews/edits in BookForm, picks status
                            addBookWithInitialStatus(AddBookInput)
                                   ▼
                              books row (now incl. description)  ── persisted
```

- **Search Query / BookSearchResult / BookDetailDraft / Recommendation**: in-memory only; never
  written to the database. Result-list state is held in the `useBookSearch` module-singleton for
  back-navigation restore.
- **Book**: the only persisted entity; created on save via the existing mutation, now carrying
  `description`.

## 4. Validation rules (unchanged from existing add-book flow)

- `title` required (non-empty).
- `author` required (non-empty).
- `total_pages` required, ≥ 1.
- If `initialStatus = currentlyReading`, `currentPage` must be 1..(totalPages − 1).
- `isbn` optional; normalized to uppercase, non-numeric stripped (existing `BookForm` behavior).
- `description` optional; free plain text; no length cap enforced beyond DB `text`.

## 5. Duplicate determination (client-side, non-blocking)

A selected book is considered "already in library" when, against `booksStore.books`:

1. a normalized ISBN match exists (digits/`X`, uppercased), **or**
2. (no ISBN) a case-insensitive `title` + `author` match exists.

Result drives a non-blocking PrimeVue `Message`; saving is still permitted (FR-012b). Not
persisted; recomputed on page load.
