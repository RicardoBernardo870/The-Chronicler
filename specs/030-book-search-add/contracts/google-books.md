# Contract: Google Books API (secondary / gap-fill only)

External. Optional API key via existing `VITE_GOOGLE_BOOKS_API_KEY` (works without a key at lower
quota — same as today's `useIsbn.ts`). Used **only** to fill fields the Open Library record is
missing: cover, description, page count, genre. Never the primary search source (Constitution II).

## Lookup

By ISBN when available, else by title + author:

```
GET https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn>[&key=<key>]
GET https://www.googleapis.com/books/v1/volumes?q=intitle:<title>+inauthor:<author>[&key=<key>]
```

Response (relevant fields):

```jsonc
{
  "items": [
    {
      "volumeInfo": {
        "title": "…",
        "authors": ["…"],
        "pageCount": 1178,
        "description": "…",
        "categories": ["Fiction"],
        "imageLinks": { "thumbnail": "http://…" }
      }
    }
  ]
}
```

## Gap-fill merge (field-by-field; OL wins when present)

Generalizes the existing `mergeMetadata` in `src/composables/useIsbn.ts`, adding `description`:

| Draft field | Filled from Google Books when OL value is missing |
|-------------|---------------------------------------------------|
| `coverUrl` | `imageLinks.thumbnail` (force `https:`) |
| `description` | `volumeInfo.description` |
| `totalPages` | `volumeInfo.pageCount` |
| `genre` | `volumeInfo.categories?.[0]` |
| `author` | `volumeInfo.authors?.[0]` (only if OL had "Unknown Author") |

`title` always stays from the primary (Open Library) source.

## Failure modes

| Condition | Behavior |
|-----------|----------|
| No key / quota / network error | Skip gap-fill silently; keep the OL-only draft. |
| No `items` | No gap-fill; missing fields stay empty and user-editable. |
