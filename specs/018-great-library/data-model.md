# Data Model: The Great Library

**Feature**: 018-great-library | **Date**: 2026-04-30

---

## Existing Tables (no schema changes)

### `lexicon_entries`

| Column            | Type      | Notes                                      |
|-------------------|-----------|--------------------------------------------|
| id                | uuid PK   |                                            |
| user_id           | uuid FK   | auth.users                                 |
| book_id           | uuid FK   | books.id                                   |
| term              | text      | The word or lore term                      |
| definition        | text      | Definition or lore description             |
| entry_type        | text      | `'dictionary'` or `'lore'`                 |
| context_sentence  | text?     | Sentence the word appeared in              |
| page_found        | int?      | Page number where term was encountered     |
| leitner_box       | int       | Spaced repetition box (1–5)                |
| next_review_at    | timestamptz | Next Leitner review date                 |
| created_at        | timestamptz | Used for default sort (newest first)     |
| source            | text      | `'manual'` or `'auto'`                     |

### `books`

Used via foreign table join only — no direct store dependency.

| Column    | Type    | Notes used by this feature |
|-----------|---------|----------------------------|
| id        | uuid PK |                            |
| title     | text    | Shown on each entry card   |

---

## New TypeScript Types (`src/types/index.ts`)

### `LexiconSearchResult`

Extends `LexiconEntry` with book title resolved from the join.

```typescript
export interface LexiconSearchResult extends LexiconEntry {
  bookTitle: string   // resolved from books join; 'Unknown Book' if orphaned
}
```

---

## Composable State (`useGreatLibrarySearch`)

| Ref                   | Type                              | Description                                     |
|-----------------------|-----------------------------------|-------------------------------------------------|
| `entries`             | `Ref<LexiconSearchResult[]>`      | Accumulated results across all loaded pages     |
| `loading`             | `Ref<boolean>`                    | True during first page load                     |
| `loadingMore`         | `Ref<boolean>`                    | True while fetching page > 0                    |
| `error`               | `Ref<string \| null>`             | Last error message; null if none                |
| `hasMore`             | `Ref<boolean>`                    | False when last page returned < PAGE_SIZE rows  |
| `searchQuery`         | `Ref<string>`                     | Bound to the search input (debounced internally)|
| `typeFilter`          | `Ref<'all' \| 'dictionary' \| 'lore'>` | Bound to the type toggle               |
| `bookFilter`          | `Ref<string \| null>`             | Bound to the book dropdown (`null` = all books) |

| Action           | Signature                  | Description                                   |
|------------------|----------------------------|-----------------------------------------------|
| `search`         | `() => Promise<void>`      | Reset to page 0 and fetch with current filters|
| `loadNextPage`   | `() => Promise<void>`      | Append next page; no-op if !hasMore or busy   |
| `retry`          | `() => Promise<void>`      | Re-fetch the last failed page                 |

---

## Supabase Query Shape

### Base query (applied on every fetch)

```
supabase
  .from('lexicon_entries')
  .select('*, books(title)')
  .eq('user_id', authStore.user.id)
  .order('created_at', { ascending: false })
  .range(from, to)                    // offset pagination
```

### Conditional modifiers

| Condition              | Modifier added                                           |
|------------------------|----------------------------------------------------------|
| `searchQuery` non-empty | `.or('term.ilike.%{q}%,definition.ilike.%{q}%')`       |
| `typeFilter !== 'all'` | `.eq('entry_type', typeFilter)`                          |
| `bookFilter !== null`  | `.eq('book_id', bookFilter)`                             |

### Row mapper

```typescript
const mapSearchResult = (row: LexiconEntryRow & { books: { title: string } | null }): LexiconSearchResult => ({
  ...mapLexiconEntry(row),
  bookTitle: row.books?.title ?? 'Unknown Book',
})
```

### Book filter options query

To populate the book dropdown with only books that have entries for this user:

```
supabase
  .from('lexicon_entries')
  .select('book_id, books(title)')
  .eq('user_id', authStore.user.id)
```

Deduplicated client-side to `{ bookId, bookTitle }[]`.
