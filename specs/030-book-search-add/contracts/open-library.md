# Contract: Open Library API (primary source)

External, public, no API key. Consumed by `src/services/bookSearchService.ts`. All calls are
best-effort and MUST degrade gracefully (return empty/partial, never throw to the UI) per FR-015.

## 1. Search — title / author / ISBN

```
GET https://openlibrary.org/search.json
      ?q=<url-encoded query>
      &page=<1-based>
      &limit=20
      &fields=key,title,author_name,cover_i,first_publish_year,isbn,number_of_pages_median,subject
```

Response (relevant fields):

```jsonc
{
  "numFound": 1234,
  "docs": [
    {
      "key": "/works/OL27448W",
      "title": "The Lord of the Rings",
      "author_name": ["J.R.R. Tolkien"],
      "cover_i": 14625765,
      "first_publish_year": 1954,
      "isbn": ["9780261102385", "..."],
      "number_of_pages_median": 1178,
      "subject": ["Fantasy fiction", "..."]
    }
  ]
}
```

Mapping → `BookSearchResult`:

- `key` ← `doc.key`
- `title` ← `doc.title`
- `author` ← `doc.author_name?.[0] ?? null`
- `coverUrl` ← `doc.cover_i` ? `https://covers.openlibrary.org/b/id/<cover_i>-M.jpg` : `null`
- `firstPublishYear` ← `doc.first_publish_year ?? null`
- `isbn` ← `doc.isbn?.[0] ?? null`
- `source` ← `'openlibrary'`

Pagination: `page` increments for load-more; `hasMore` ← returned `docs.length === 20`
(consistent with the `useGreatLibrarySearch` heuristic).

## 2. Work detail (on selection)

```
GET https://openlibrary.org/works/<OLID>.json
```

Relevant fields: `description` (string or `{ value }`), `subjects` (string[]), `covers`
(number[]). Used to populate `description`, `genre` (first subject), and cover when the search doc
lacked them. Edition-specific page count may also come from
`GET https://openlibrary.org/works/<OLID>/editions.json` (first edition with `number_of_pages`) or
from Google Books gap-fill (see `google-books.md`).

## 3. Recommendations (best-effort)

Reuse `search.json` with the selected work's first `subject` (fallback `author`), exclude the
current `key`, cap to ~6–8:

```
GET https://openlibrary.org/search.json?subject=<subject>&limit=8&fields=key,title,author_name,cover_i,isbn
```

Empty result or any error → recommendations section hidden (FR-013).

## Failure modes

| Condition | Behavior |
|-----------|----------|
| Network error / non-2xx | Resolve to `[]` (search) or partial draft (detail); UI shows retryable error / proceeds with available fields. Scan & Manual stay usable. |
| `numFound = 0` | Empty-state message; user can refine. |
| Missing fields | Left empty in the draft, filled by Google Books where possible, else editable by the user. |
| Slow response | UI shows loading indicator; in-flight request aborted if the query changes. |
