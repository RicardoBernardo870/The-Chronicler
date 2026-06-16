# Contract: Internal interfaces

## Service — `src/services/bookSearchService.ts` (new)

```ts
// All functions are abortable and never throw to the UI (resolve empty/partial on failure).
searchBooks(query: string, page: number, signal?: AbortSignal): Promise<BookSearchResult[]>
getBookDetail(source: 'openlibrary', key: string, signal?: AbortSignal): Promise<BookDetailDraft>
getRecommendations(draft: BookDetailDraft, excludeKey: string, signal?: AbortSignal): Promise<Recommendation[]>
```

## Composable — `src/composables/useBookSearch.ts` (new, module-singleton)

Mirrors the `useGreatLibrarySearch` shape (shared module-level refs, results cache for
back-navigation, 300ms `watchDebounced`, abortable, `loadNextPage`/`retry`):

```ts
useBookSearch(): {
  query: Ref<string>
  results: Ref<BookSearchResult[]>
  loading: Ref<boolean>
  loadingMore: Ref<boolean>
  error: Ref<string | null>
  hasMore: Ref<boolean>
  hasSearched: Ref<boolean>
  loadNextPage: () => Promise<void>
  retry: () => Promise<void>
}
```

Behavior: queries < 2 non-space chars do not trigger a fetch; a new query aborts the in-flight
request and resets to page 1; `hasMore` ← last page returned a full 20.

## Store — `src/stores/books.ts` (modified)

- `addBook` insert payload gains `description: input.description`.
- `updateBook` accepts `description` in its `changes` pick.
- `_libraryFetcher` (RPC path) maps `e.description` onto each hydrated `Book`.
- `addBookWithInitialStatus` signature unchanged (uses `AddBookInput`, which now includes
  `description`). Existing cache invalidations unchanged.

## Router — `src/router/index.ts` (modified)

```ts
{
  path: 'books/add/details/:source/:key',
  name: 'add-book-details',
  component: () => import('@/pages/BookSearchDetailPage.vue'), // lazy-loaded (Principle V)
}
```

`:key` may contain `/` (OL work keys like `/works/OL27448W`) → encode/decode with
`encodeURIComponent` when building/reading the route, or define `:key(.*)`.

## RPC — `get_library_with_progress` (modified in migration)

Re-created with `b.description` added to the SELECT and the returned column list. Signature,
`security definer`, and `(select auth.uid())` ownership filter unchanged. `LibraryBookEntry` type
extended with `description: string | null` to match.

## Component contracts (PrimeVue-first, Principle VI)

| Component | Responsibility | Key PrimeVue parts |
|-----------|----------------|--------------------|
| `AddBookPage.vue` (mod) | Landing step: Scan/Manual buttons + search section; routes to existing scan/form steps unchanged | `Button` |
| `BookSearchSection.vue` (new) | Search input + result list + loading/empty/error/load-more | `InputText`/`IconField`, `ProgressSpinner`, `Message`, `Button` |
| `BookSearchResultCard.vue` (new) | One result: cover, title, author; emits `select(result)` | `Image`/`Card` |
| `BookSearchDetailPage.vue` (new) | Re-fetch by key; duplicate notice; `BookForm` pre-fill; recommendations; save via store | `Message`, `ProgressSpinner`, `Skeleton` |
| `BookRecommendations.vue` (new) | Best-effort related titles; emits `select(rec)` → re-enter add flow | `Image`/`Card` |
| `BookForm.vue` (mod) | Add `description` field | `Textarea` |
