# RPC Contracts: Community Follows And Blocks

All RPCs are stable contracts for both the PWA and future native iOS app. They must enforce
profile visibility and either-direction blocking server-side.

## Shared Types

### Relationship State

```json
{
  "targetUserId": "uuid",
  "isFollowing": true,
  "followsViewer": false,
  "isBlockedByViewer": false,
  "hasBlockedViewer": false,
  "followersCount": 12,
  "followingCount": 8,
  "canInteract": true,
  "reason": "allowed"
}
```

`reason` values: `allowed`, `self`, `blocked`, `profile_unavailable`.

### Cursor

List cursors are opaque strings to clients. Internally they may encode `(created_at, user_id)`.

## `search_community_readers(p_query text, p_limit int default 20, p_cursor text default null)`

Searches visible public reader profiles by username/display name.

**Auth**: signed-in user only.

**Rules**:

- Trim query; minimum useful query length is 2 characters.
- Exclude profiles hidden by public visibility or either-direction blocking.
- Exclude the viewer by default.
- Limit must be clamped to 1-50.

**Response**:

```json
{
  "items": [
    {
      "userId": "uuid",
      "username": "reader_name",
      "displayName": "Ricardo",
      "bio": "Short reader bio",
      "avatarUrl": "https://example.com/avatar.jpg",
      "isFollowing": false,
      "followsViewer": true,
      "followersCount": 12,
      "followingCount": 8
    }
  ],
  "nextCursor": "opaque-or-null"
}
```

## `get_community_relationship_state(p_target_user_id uuid)`

Returns viewer relationship state for one profile/user.

**Auth**: signed-in user only.

**Response**: Relationship State.

Unavailable targets return:

```json
{
  "targetUserId": "uuid",
  "isFollowing": false,
  "followsViewer": false,
  "isBlockedByViewer": false,
  "hasBlockedViewer": false,
  "followersCount": 0,
  "followingCount": 0,
  "canInteract": false,
  "reason": "profile_unavailable"
}
```

## `follow_community_user(p_target_user_id uuid)`

Creates a follow relationship from the signed-in viewer to the target.

**Auth**: signed-in user only.

**Rules**:

- Idempotent: following an already-followed target returns current state.
- Deny self-follow with `reason = self`.
- Deny blocked or unavailable targets.
- Updates durable counts transactionally.

**Response**: Relationship State plus optional `changed: boolean`.

## `unfollow_community_user(p_target_user_id uuid)`

Deletes the viewer -> target follow relationship.

**Auth**: signed-in user only.

**Rules**:

- Idempotent: unfollowing an already-unfollowed target returns current state.
- Updates durable counts transactionally when a row is removed.

**Response**: Relationship State plus optional `changed: boolean`.

## `block_community_user(p_target_user_id uuid)`

Creates a block from viewer to target.

**Auth**: signed-in user only.

**Rules**:

- Deny self-block with `reason = self`.
- Idempotent for already-blocked target.
- Deletes follows in both directions.
- Does not require target profile to be public.

**Response**:

```json
{
  "targetUserId": "uuid",
  "isBlockedByViewer": true,
  "removedFollowsCount": 2,
  "changed": true
}
```

## `unblock_community_user(p_target_user_id uuid)`

Deletes viewer's block row for target.

**Auth**: signed-in user only.

**Rules**:

- Idempotent for already-unblocked target.
- Does not restore deleted follows.

**Response**:

```json
{
  "targetUserId": "uuid",
  "isBlockedByViewer": false,
  "changed": true
}
```

## `list_community_followers(p_user_id uuid, p_limit int default 20, p_cursor text default null)`

Lists visible followers of the target profile.

**Auth**: signed-in user only.

**Rules**:

- Target profile must be visible to viewer.
- Exclude blocked/hidden/deleted users.
- Newest follow first.
- Limit clamped to 1-50.

**Response**:

```json
{
  "items": [
    {
      "userId": "uuid",
      "username": "reader_name",
      "displayName": "Ricardo",
      "avatarUrl": "https://example.com/avatar.jpg",
      "followedAt": "2026-05-03T10:00:00Z",
      "isFollowing": true
    }
  ],
  "nextCursor": "opaque-or-null"
}
```

## `list_community_following(p_user_id uuid, p_limit int default 20, p_cursor text default null)`

Same response shape and visibility rules as `list_community_followers`, but returns profiles
the target user follows.

## `list_my_blocked_users(p_limit int default 20, p_cursor text default null)`

Private blocked-users management list.

**Auth**: signed-in user only.

**Rules**:

- Returns only rows where viewer is blocker.
- May include minimal profile identity even when the blocked user's profile is non-public.
- Newest block first.

**Response**:

```json
{
  "items": [
    {
      "userId": "uuid",
      "username": "reader_name",
      "displayName": "Ricardo",
      "avatarUrl": "https://example.com/avatar.jpg",
      "blockedAt": "2026-05-03T10:00:00Z"
    }
  ],
  "nextCursor": "opaque-or-null"
}
```

## `can_community_users_interact(p_target_user_id uuid)`

Canonical interaction check for later community features.

**Auth**: signed-in user only.

**Response**:

```json
{
  "targetUserId": "uuid",
  "allowed": true,
  "reason": "allowed"
}
```

Reasons: `allowed`, `self`, `blocked`, `profile_unavailable`.

Use these reasons consistently:

- `allowed`: viewer and target are distinct, neither has blocked the other, and the target has a visible community profile.
- `self`: viewer and target are the same user. This is valid for profile display but invalid for follow/block actions.
- `blocked`: either user has blocked the other. Future feed, circle, lexicon, and discovery RPCs must treat this as a hard deny.
- `profile_unavailable`: target has no visible community profile or cannot participate in the requested community surface.
