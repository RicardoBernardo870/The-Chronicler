# RPC Contract: Reading Circles

All JSON fields use camelCase because the PWA and future first-party clients consume the
response directly. RPCs must enforce membership, invitations, blocks, max-size, and spoiler
gates before producing the response.

## Shared Types

### Circle Role

```json
"owner" | "member"
```

### Invitation Status

```json
"pending" | "accepted" | "declined" | "revoked" | "expired"
```

### Circle Summary

```json
{
  "circleId": "uuid",
  "name": "Sunday pages",
  "book": {
    "bookId": "uuid",
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "coverUrl": "https://example.com/cover.jpg"
  },
  "role": "owner",
  "memberCount": 4,
  "pendingInviteCount": 2,
  "latestReactionAt": "2026-05-03T18:42:00Z"
}
```

### Public Member Summary

```json
{
  "userId": "uuid",
  "username": "ana_reads",
  "displayName": "Ana",
  "avatarUrl": null,
  "role": "member",
  "joinedAt": "2026-05-03T18:42:00Z"
}
```

## `create_reading_circle(p_book_id uuid, p_name text, p_invited_user_ids uuid[] default '{}')`

Creates a private circle and pending invitations.

**Auth**: signed-in user only.

**Input rules**:

- `p_book_id` must belong to the caller.
- `p_name` is trimmed and must be 1-80 characters.
- `p_invited_user_ids` is optional and de-duplicated.
- Invited users must be followed by the owner and must not be blocked in either direction.
- Creating the owner membership counts as one accepted member; invitations do not count until
  accepted.

**Response**:

```json
{
  "circleId": "uuid",
  "created": true,
  "invitedUserIds": ["uuid"],
  "skippedUserIds": ["uuid"]
}
```

## `invite_reading_circle_members(p_circle_id uuid, p_user_ids uuid[])`

Adds pending invitations to an existing circle.

**Auth**: owner only.

**Rules**:

- Circle must be active.
- Caller must be current owner.
- Users must be followed by owner and able to interact with owner.
- Existing accepted members and existing pending invitations are skipped.
- Pending invitations grant no detail or reaction access.

## `respond_to_reading_circle_invitation(p_invitation_id uuid, p_accept boolean)`

Accepts or declines an invitation.

**Auth**: invited user only.

**Acceptance rules**:

- Invitation must be pending.
- Circle must be active.
- Accepted member count must be less than 10.
- Invited user must not be blocked with any current member.
- On accept, insert `circle_members` row and mark invitation `accepted`.
- On decline, mark invitation `declined`.

**Response**:

```json
{
  "circleId": "uuid",
  "invitationId": "uuid",
  "status": "accepted",
  "member": {
    "userId": "uuid",
    "role": "member",
    "joinedAt": "2026-05-03T18:42:00Z"
  }
}
```

## `list_my_reading_circles(p_limit int default 20, p_cursor text default null)`

Returns circles where the viewer is an accepted member plus pending invitations addressed to
the viewer.

**Auth**: signed-in user only.

**Rules**:

- `p_limit` is clamped to 1-50.
- Pending invitations are returned without reaction content.
- Accepted circle rows include only member-safe summary data.
- Blocked member pairs are excluded or flagged for cleanup without leaking reaction content.

**Response**:

```json
{
  "items": [
    {
      "type": "circle",
      "circle": { "circleId": "uuid", "name": "Sunday pages", "memberCount": 4 },
      "viewerRole": "member"
    },
    {
      "type": "invitation",
      "invitationId": "uuid",
      "circle": { "circleId": "uuid", "name": "Sunday pages", "memberCount": 4 },
      "invitedBy": { "userId": "uuid", "username": "ana_reads" }
    }
  ],
  "nextCursor": null
}
```

## `get_reading_circle_detail(p_circle_id uuid)`

Returns circle detail for accepted members.

**Auth**: accepted member only.

**Response**:

```json
{
  "circleId": "uuid",
  "name": "Sunday pages",
  "book": {
    "bookId": "uuid",
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "coverUrl": null,
    "normalizedIsbn": "9780441478125"
  },
  "viewer": {
    "role": "owner",
    "currentPage": 120,
    "totalPages": 304,
    "normalizedLocation": 39.474
  },
  "members": [],
  "pendingInvitations": [],
  "createdAt": "2026-05-03T18:42:00Z"
}
```

`pendingInvitations` is owner-only. Non-owners receive an empty array or omitted field.

## `get_visible_circle_reactions(p_circle_id uuid, p_min_location numeric default null, p_max_location numeric default null, p_limit int default 50, p_cursor text default null)`

Returns readable reactions at or behind the viewer's current normalized location.

**Auth**: accepted member only.

**Rules**:

- Viewer must have valid current progress and total pages for the circle work.
- `p_max_location` is capped to the viewer's normalized progress.
- Deleted reactions are omitted.
- Reactions by blocked users are omitted.
- `p_limit` is clamped to 1-100.

**Response**:

```json
{
  "items": [
    {
      "reactionId": "uuid",
      "circleId": "uuid",
      "author": {
        "userId": "uuid",
        "username": "ana_reads",
        "displayName": "Ana",
        "avatarUrl": null
      },
      "content": "This chapter finally clicked.",
      "sourcePage": 88,
      "sourceTotalPages": 304,
      "normalizedLocation": 28.947,
      "viewerEquivalentPage": 91,
      "createdAt": "2026-05-03T18:42:00Z"
    }
  ],
  "nextCursor": null
}
```

## `add_circle_reaction(p_circle_id uuid, p_book_id uuid, p_source_page int, p_content text)`

Adds a reaction for an accepted member.

**Rules**:

- Caller must be an accepted member.
- `p_book_id` must belong to caller and match the circle work by direct book/canonical id or
  normalized ISBN.
- Book total pages must be positive.
- `p_source_page` must be 1 through total pages.
- Derived normalized location must be at or behind caller's current normalized progress.
- Content after trim must be 1-280 characters.
- Blocks with current members reject the write or trigger cleanup before write.

## `leave_reading_circle(p_circle_id uuid)`

Removes caller membership.

**Rules**:

- Non-owner leaves directly.
- Owner departure transfers ownership to the earliest remaining member by `joined_at`.
- If no members remain, close the circle.

## `remove_reading_circle_member(p_circle_id uuid, p_user_id uuid)`

Owner removes an accepted member or revokes a pending invitation.

**Rules**:

- Caller must be owner.
- Owner cannot remove themselves through this RPC; use `leave_reading_circle`.
- Removed member loses detail and reaction access immediately.

## Error Behavior

- Unauthenticated callers receive standard Supabase auth/RPC errors.
- Unauthorized access returns empty/not found style responses where appropriate to avoid
  revealing private circle existence.
- Invalid input returns stable error codes such as `invalid_book`, `invalid_page`,
  `reaction_ahead_of_progress`, `circle_full`, `invitation_not_pending`, or `blocked`.

## Grants

- Revoke execute from `public` and `anon` on all public RPCs.
- Grant execute to `authenticated`.
- Do not expose table reads that bypass the RPC visibility contract.
