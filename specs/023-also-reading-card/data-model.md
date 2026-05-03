# Data Model: Also Reading Card

## Viewed Book

**Purpose**: The book detail record the viewer is currently inspecting.

| Field | Rules |
|---|---|
| `book_id` | Required; must belong to the signed-in viewer for the PWA call path |
| `isbn` | Optional; normalized for same-work matching when present |
| `total_pages` | Required positive page count for progress percentage comparison |

**Relationships**:

- Belongs to the viewer through `books.user_id`.
- May match followed-reader books by exact book id or normalized ISBN.

## Viewer Progress

**Purpose**: The viewer's current progress for the viewed book, used for relative labels.

| Field | Rules |
|---|---|
| `current_page` | Optional; comparable only when present and total pages are positive |
| `percentage` | Derived from `current_page / total_pages`, clamped to 0-100 |

**Validation rules**:

- If missing, the card can still show eligible readers but must not return relative progress
  labels.
- Viewer progress is never exposed to other users by this RPC.

## Followed Reader

**Purpose**: A reader followed by the viewer who may be eligible for the card.

| Field | Rules |
|---|---|
| `user_id` | Required target user id |
| `username` | Required public username for profile navigation |
| `display_name` | Optional |
| `avatar_url` | Optional |
| `profile_available` | Must be true for the row to appear |

**Relationships**:

- Must have a `follows` row where `follower_id = viewer` and `following_id = user_id`.
- Must have a visible `community_profiles` row.
- Must not have a `blocks` row in either direction with the viewer.

## Followed Reader Active Progress

**Purpose**: A followed reader's currently reading state for the same book/work.

| Field | Rules |
|---|---|
| `book_id` | Required source book id from the followed reader's library |
| `current_page` | Required for active reading; returned only when progress visibility allows it |
| `total_pages` | Required positive page count |
| `percentage` | Derived and returned only when progress visibility allows it |
| `updated_at` | Used for ordering and cursor pagination |

**Validation rules**:

- Active means `current_page > 0` and `current_page < total_pages`.
- One followed reader appears at most once. If multiple matching active rows exist, choose the
  strongest match (`same_book` before `same_isbn`) and most recently updated row.
- Completed, queued, abandoned, or zero-page records are not eligible.

## Privacy Eligibility

**Purpose**: Determines which rows and fields can be returned.

| Field | Rules |
|---|---|
| `currently_reading_visibility` | Must allow the viewer before the followed reader appears |
| `progress_visibility` | Must allow the viewer before page, percentage, and relative labels appear |
| `is_follower` | True because the query is limited to followed readers, but still evaluated for visibility rules |

**Visibility states**:

- `everyone`: allowed for any non-blocked signed-in viewer.
- `followers`: allowed when the viewer follows the target.
- `nobody`: hidden from all non-owner viewers.

## Also Reading Result

**Purpose**: Card-ready response item for one visible followed reader.

| Field | Rules |
|---|---|
| `userId` | Followed reader id |
| `username` | Required for `/u/:username` navigation |
| `displayName` | Optional display label |
| `avatarUrl` | Optional avatar image |
| `matchType` | `same_book` or `same_isbn` |
| `matchedBookId` | Followed reader's matching book id |
| `matchedIsbn` | Normalized ISBN only when match type is `same_isbn` and safe to expose |
| `currentPage` | Nullable; present only when progress visibility allows it |
| `totalPages` | Nullable; present only when progress visibility allows it |
| `percentage` | Nullable; present only when progress visibility allows it |
| `relativeStatus` | `ahead`, `behind`, `same_area`, or null |
| `updatedAt` | Progress update timestamp for sorting and cursor construction |

**Ordering and pagination**:

- Sort newest active progress first, then `userId` as a stable tie-breaker.
- Cursor encodes the last returned `updatedAt` and `userId`.
- Default result size is 3; RPC clamps limits to 1-20.

## State Transitions

```text
No visible matches -> followed reader starts same book -> card appears
Visible match -> current-reading visibility becomes nobody -> row disappears
Visible match with progress -> progress visibility becomes nobody -> row remains without progress labels
Visible match -> either user blocks the other -> row disappears
Visible same_book match -> duplicate same_isbn row exists -> same_book row wins
Viewer progress missing -> relative labels omitted
```
