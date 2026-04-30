# Query Contract: The Great Library

**Feature**: 018-great-library | **Date**: 2026-04-30

---

## TypeScript Interfaces

### Input (filter state)

```typescript
// The composable's public filter state — all reactive refs
interface GreatLibraryFilters {
  searchQuery: string              // '' = no filter
  typeFilter: 'all' | 'dictionary' | 'lore'
  bookFilter: string | null        // null = all books; UUID otherwise
}
```

### Output (search result)

```typescript
// Defined in src/types/index.ts
export interface LexiconSearchResult extends LexiconEntry {
  bookTitle: string   // resolved from books join; 'Unknown Book' if orphaned
}
```

`LexiconEntry` is the existing domain type (camelCase). `LexiconSearchResult` adds only `bookTitle`.

### Book filter option (dropdown population)

```typescript
interface BookFilterOption {
  bookId: string
  bookTitle: string
}
```

---

## Supabase Query Contract

### Main search query

**Table**: `lexicon_entries`  
**Join**: `books(title)` via `book_id` FK  
**Auth**: `.eq('user_id', authStore.user.id)` — required on every call  
**Sort**: `.order('created_at', { ascending: false })` — stable, newest-first  
**Pagination**: `.range(from, to)` where `from = page * PAGE_SIZE`, `to = from + PAGE_SIZE - 1`  
**PAGE_SIZE**: `20`

#### Always-applied chain

```
supabase
  .from('lexicon_entries')
  .select('*, books(title)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .range(from, to)
```

#### Conditional modifiers (applied before `.range()`)

| Filter condition              | Modifier                                           |
|-------------------------------|----------------------------------------------------|
| `searchQuery` is non-empty    | `.or(\`term.ilike.%${q}%,definition.ilike.%${q}%\`)` |
| `typeFilter !== 'all'`        | `.eq('entry_type', typeFilter)`                    |
| `bookFilter !== null`         | `.eq('book_id', bookFilter)`                       |

#### Row shape returned by Supabase

```typescript
type LexiconEntryRow & { books: { title: string } | null }
```

The `books` field is `null` when the referenced book has been deleted (orphaned row).

#### Row mapper

```typescript
const mapSearchResult = (
  row: LexiconEntryRow & { books: { title: string } | null }
): LexiconSearchResult => ({
  ...mapLexiconEntry(row),
  bookTitle: row.books?.title ?? 'Unknown Book',
})
```

---

### Book filter options query

**Purpose**: Populate the book dropdown with only books that have at least one lexicon entry for the current user.

```
supabase
  .from('lexicon_entries')
  .select('book_id, books(title)')
  .eq('user_id', userId)
```

**Post-processing** (client-side deduplication):

```typescript
const seen = new Set<string>()
const options: BookFilterOption[] = []
for (const row of data ?? []) {
  if (!seen.has(row.book_id)) {
    seen.add(row.book_id)
    options.push({
      bookId: row.book_id,
      bookTitle: (row.books as { title: string } | null)?.title ?? 'Unknown Book',
    })
  }
}
```

---

## Pagination Contract

| Concept       | Value / Rule                                                          |
|---------------|-----------------------------------------------------------------------|
| Page size     | `20` (constant `PAGE_SIZE`)                                           |
| First page    | `page = 0`, `from = 0`, `to = 19`                                     |
| `hasMore`     | Set to `false` when the last fetch returned `< PAGE_SIZE` rows        |
| Search reset  | Any filter change calls `search()`: resets `page = 0`, clears `entries` |
| Append        | `loadNextPage()` increments page and appends results to `entries`     |
| Debounce      | `searchQuery` changes are debounced 300ms before triggering `search()`|

---

## Error Contract

All Supabase errors are caught and stored in `error: Ref<string | null>`.  
`loading` / `loadingMore` are always set to `false` after any error.  
`retry()` re-fetches the last failed page index without resetting state.

---

## Composable Public API

```typescript
// src/composables/useGreatLibrarySearch.ts
const {
  // State
  entries,        // Ref<LexiconSearchResult[]>  — accumulated across pages
  loading,        // Ref<boolean>                — true during page 0 load
  loadingMore,    // Ref<boolean>                — true during page > 0 load
  error,          // Ref<string | null>
  hasMore,        // Ref<boolean>
  searchQuery,    // Ref<string>                 — bound to input (debounced)
  typeFilter,     // Ref<'all' | 'dictionary' | 'lore'>
  bookFilter,     // Ref<string | null>
  bookOptions,    // Ref<BookFilterOption[]>     — for dropdown
  // Actions
  search,         // () => Promise<void>         — reset + fetch
  loadNextPage,   // () => Promise<void>         — append next page
  retry,          // () => Promise<void>         — retry last failed page
} = useGreatLibrarySearch()
```
