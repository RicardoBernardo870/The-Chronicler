# Data Model: Reading Circles

## Reading Circle

**Purpose**: A private group centered on one book/work.

| Field | Rules |
|---|---|
| `id` | UUID primary key |
| `owner_id` | Required user id; must be an accepted member with role `owner` |
| `created_by` | Required user id for audit; initially same as owner |
| `book_id` | Required creator/local book id |
| `canonical_book_id` | Optional shared/canonical book id when available |
| `normalized_isbn` | Optional normalized ISBN fallback for work matching |
| `title` | Required display title snapshot |
| `author` | Required display author snapshot |
| `name` | Required circle name, trimmed, bounded length |
| `status` | `active` or `closed` |
| `created_at` | Required |
| `updated_at` | Required |

**Validation rules**:

- Private-only in v1.
- Must have either a `book_id` or enough normalized book metadata to match member editions.
- Closing a circle prevents new invitations and reactions.

## Circle Invitation

**Purpose**: Pending owner invitation to an eligible followed reader.

| Field | Rules |
|---|---|
| `id` | UUID primary key |
| `circle_id` | Required FK to `reading_circles` |
| `invited_user_id` | Required invited reader |
| `invited_by` | Required owner/member who sent invite; v1 owner only |
| `status` | `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `created_at` | Required |
| `responded_at` | Nullable |

**Validation rules**:

- Only owners can create invitations in v1.
- Invited reader must be followed by the owner and must be able to interact with the owner.
- Pending invitations grant no reaction/content access.
- Accepting checks max accepted members and either-direction blocks at acceptance time.
- At most one pending invitation per `(circle_id, invited_user_id)`.

## Circle Member

**Purpose**: Accepted membership granting access to circle detail and safe reactions.

| Field | Rules |
|---|---|
| `circle_id` | Required FK to `reading_circles` |
| `user_id` | Required user id |
| `role` | `owner` or `member` |
| `joined_at` | Required |
| `invitation_id` | Nullable FK for accepted invite provenance |

**Validation rules**:

- Primary key is `(circle_id, user_id)`.
- A circle may have at most 10 accepted members including the owner.
- Exactly one active owner is required while a circle has members.
- Owner departure transfers ownership to the earliest remaining member by `joined_at`; if none remain, the circle closes.
- Blocking in either direction removes or hides unsafe member combinations through server-side cleanup/read gates.

## Circle Reaction

**Purpose**: Short member-authored reaction pinned to a source page and normalized location.

| Field | Rules |
|---|---|
| `id` | UUID primary key |
| `circle_id` | Required FK to `reading_circles` |
| `author_id` | Required accepted member id |
| `book_id` | Required author's local book edition |
| `source_page` | Positive page number in author's edition |
| `source_total_pages` | Positive total pages at creation time |
| `normalized_location` | Numeric percent-through-book, derived from `source_page / source_total_pages * 100` |
| `content` | Required, trimmed, 1-280 characters |
| `created_at` | Required |
| `deleted_at` | Nullable soft-delete timestamp |

**Validation rules**:

- Author must be an accepted circle member.
- Author must have a readable local book edition with positive total pages.
- `source_page` must be between 1 and `source_total_pages`.
- `normalized_location` must be at or behind the author's current normalized progress when created.
- Reactions ahead of the viewer's current normalized progress are never returned.
- Soft-deleted reactions are omitted from all user-facing reads.

## Reader Progress Location

**Purpose**: Derived viewer progress for spoiler gates.

| Field | Rules |
|---|---|
| `user_id` | Viewer/member user id |
| `book_id` | Viewer local edition id |
| `current_page` | Required for reaction visibility |
| `total_pages` | Must be positive |
| `normalized_location` | Derived percent-through-book, clamped 0-100 |

**Validation rules**:

- Missing or invalid total pages means the member cannot add or view gated reactions for that circle until metadata is corrected.
- Progress moving backward hides reactions beyond the new normalized location again.

## Stable Result Types

### Circle Summary

Card/list response item for "my circles".

| Field | Rules |
|---|---|
| `circleId` | Required |
| `name` | Required |
| `book` | Title, author, cover URL when available |
| `role` | Viewer role |
| `memberCount` | Accepted member count only |
| `pendingInviteCount` | Owner-visible count |
| `latestReactionAt` | Nullable, only from visible/safe reactions or aggregate metadata |

### Visible Reaction

Response item returned only after all gates pass.

| Field | Rules |
|---|---|
| `reactionId` | Required |
| `circleId` | Required |
| `author` | Public profile summary |
| `content` | Required, safe because server-side gated |
| `sourcePage` | Author/source page |
| `sourceTotalPages` | Author/source total pages |
| `normalizedLocation` | Required |
| `viewerEquivalentPage` | Nullable derived local equivalent page |
| `createdAt` | Required |

## State Transitions

```text
Circle created -> owner member inserted -> invitations pending
Pending invitation -> accepted -> accepted member inserted
Pending invitation -> declined/revoked/expired -> no membership
Active circle with 10 members -> invitation acceptance rejected
Accepted member -> leaves/removed -> loses detail and reaction access
Owner leaves -> earliest remaining member becomes owner
Last member leaves -> circle closes
Member adds valid behind/current reaction -> visible to members at/after normalized location
Member progresses forward -> more reactions become visible
Member progresses backward -> later reactions become hidden again
Either-direction block -> affected users cannot remain mutually visible
```
