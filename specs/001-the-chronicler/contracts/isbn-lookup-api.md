# Contract: ISBN Lookup API

**Primary service**: Open Library API (https://openlibrary.org)
**Fallback service**: Google Books API (https://www.googleapis.com/books/v1)
**Direction**: Browser (Vue app) → Open Library / Google Books (direct CORS call)
**Auth**: None required for Open Library; optional API key for Google Books

---

## Primary: Open Library

### Request

```
GET https://openlibrary.org/api/books
  ?bibkeys=ISBN:{isbn13}
  &format=json
  &jscmd=data
```

- `isbn13`: 13-digit ISBN string, no hyphens.
- Can also accept ISBN-10 by substituting `ISBN:{isbn10}`.

### Response (success)

```json
{
  "ISBN:9780743273565": {
    "title": "The Great Gatsby",
    "authors": [{ "name": "F. Scott Fitzgerald" }],
    "number_of_pages": 180,
    "subjects": [{ "name": "Fiction" }],
    "cover": {
      "small": "https://covers.openlibrary.org/b/id/8739161-S.jpg",
      "medium": "https://covers.openlibrary.org/b/id/8739161-M.jpg",
      "large": "https://covers.openlibrary.org/b/id/8739161-L.jpg"
    }
  }
}
```

### Mapped output (internal BookMetadata type)

```typescript
interface BookMetadata {
  title: string
  author: string          // first author name, or "Unknown Author"
  coverUrl: string | null // large cover URL, or null if absent
  totalPages: number | null
  genre: string | null    // first subject name, or null
}
```

### Failure modes

| Condition | Response shape | Action |
|---|---|---|
| ISBN not found | `{}` (empty object) | Fall through to Google Books fallback |
| Network error | fetch throws | Fall through to fallback |
| `number_of_pages` absent | field missing | Set `totalPages: null`; user must enter manually |
| `cover` absent | field missing | Set `coverUrl: null` |

---

## Fallback: Google Books API

### Request

```
GET https://www.googleapis.com/books/v1/volumes
  ?q=isbn:{isbn13}
  &key={GOOGLE_BOOKS_API_KEY}   (optional for low-volume use)
```

### Response mapping

| Google Books field | Maps to |
|---|---|
| `items[0].volumeInfo.title` | `title` |
| `items[0].volumeInfo.authors[0]` | `author` |
| `items[0].volumeInfo.imageLinks.thumbnail` | `coverUrl` |
| `items[0].volumeInfo.pageCount` | `totalPages` |
| `items[0].volumeInfo.categories[0]` | `genre` |

### Failure modes

| Condition | Action |
|---|---|
| `items` empty or absent | Show manual entry form with empty fields |
| Network error | Show manual entry form with empty fields |
| `pageCount` absent | `totalPages: null`; user enters manually |

---

## Lookup Flow

```
scan/enter ISBN
  │
  ▼
Open Library lookup
  │
  ├─ success & complete → BookMetadata (pre-fill form)
  ├─ success & partial  → BookMetadata with nulls (pre-fill partial, user completes)
  └─ empty / error
        │
        ▼
      Google Books lookup
        │
        ├─ success → BookMetadata (pre-fill form)
        └─ error   → empty manual form + user notification
```

All paths end at the "Add Book" form. Auto-populated fields are editable before save.
