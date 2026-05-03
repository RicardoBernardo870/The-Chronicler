# RPC Contract: Also Reading Card

All fields use camelCase because the PWA and future first-party clients consume the JSON
directly. The RPC must enforce privacy and blocking before producing the response.

## Shared Types

### Match Type

```json
"same_book" | "same_isbn"
```

### Relative Status

```json
"ahead" | "behind" | "same_area" | null
```

Rules:

- `same_area`: followed reader progress is within 10% of viewer progress.
- `ahead`: followed reader progress is more than 10% ahead of viewer progress.
- `behind`: followed reader progress is more than 10% behind viewer progress.
- `null`: progress is hidden or not comparable.

## `get_also_reading_for_book(p_book_id uuid, p_isbn text default null, p_limit int default 3, p_cursor text default null)`

Returns followed readers who are currently reading the same book/work as the viewer's current
book detail page.

**Auth**: signed-in user only.

**Input rules**:

- `p_book_id` is required.
- `p_isbn` is optional and should be normalized server-side before comparison.
- `p_limit` is clamped to 1-20.
- `p_cursor` is optional and opaque to clients.
- If `p_book_id` does not belong to the viewer, return an empty page rather than exposing
  whether another user's book exists.

**Eligibility rules**:

- Candidate users must be followed by the viewer.
- Candidate users must have a visible public community profile summary.
- Either-direction blocks exclude the candidate entirely.
- Candidate currently-reading visibility must allow the viewer.
- Candidate progress visibility controls page, percentage, and relative fields independently.
- Candidate active reading state is `current_page > 0` and `current_page < total_pages`.
- Same `book_id` matches before same normalized ISBN matches.

**Response**:

```json
{
  "items": [
    {
      "userId": "uuid",
      "username": "ana_reads",
      "displayName": "Ana",
      "avatarUrl": "https://example.com/avatar.png",
      "matchType": "same_book",
      "matchedBookId": "uuid",
      "matchedIsbn": null,
      "currentPage": 89,
      "totalPages": 796,
      "percentage": 11.18,
      "relativeStatus": "behind",
      "updatedAt": "2026-05-03T18:42:00Z"
    }
  ],
  "nextCursor": "opaque-or-null",
  "totalVisible": 3
}
```

`totalVisible` is the number of visible eligible readers for the query, not the number returned
on the current page. It may be capped internally if exact counts become expensive, but the
contract must still let the card decide whether to show "view more".

## Empty Result

Return an empty page when no visible matches exist:

```json
{
  "items": [],
  "nextCursor": null,
  "totalVisible": 0
}
```

The PWA must hide the card for this response.

## Hidden Progress Result

When currently-reading is visible but progress is not visible:

```json
{
  "userId": "uuid",
  "username": "marco",
  "displayName": "Marco",
  "avatarUrl": null,
  "matchType": "same_isbn",
  "matchedBookId": "uuid",
  "matchedIsbn": "9780374528379",
  "currentPage": null,
  "totalPages": null,
  "percentage": null,
  "relativeStatus": null,
  "updatedAt": "2026-05-03T18:42:00Z"
}
```

## Error Behavior

- Unauthenticated callers receive the standard Supabase auth/RPC error.
- Invalid cursor values return `invalid_cursor`.
- Other unexpected failures surface as request errors; the PWA treats them as non-blocking and
  leaves the Book Detail page usable.

## Grants

- Revoke execute from `public` and `anon`.
- Grant execute to `authenticated`.
- Do not expose direct read access to hidden profile, privacy, follow, block, book, or progress
  rows beyond existing RLS policies.
