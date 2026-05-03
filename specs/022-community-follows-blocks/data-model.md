# Data Model: Community Follows And Blocks

## Follow Relationship

**Purpose**: Represents one reader following another reader.

| Field | Rules |
|---|---|
| `follower_id` | Required signed-in user id; cannot equal `following_id` |
| `following_id` | Required target user id with a visible community profile |
| `created_at` | Relationship creation timestamp |

**Relationships**:

- Belongs to the follower user.
- Points at the followed reader user.
- Updates `community_follow_counts` for both users on insert/delete.

**Validation rules**:

- Pair is unique.
- Self-follow is impossible.
- Either-direction block prevents creation.
- Target profile must be visible to the acting user.

## Block Relationship

**Purpose**: Represents one user blocking another user.

| Field | Rules |
|---|---|
| `blocker_id` | Required signed-in user id; cannot equal `blocked_id` |
| `blocked_id` | Required blocked user id |
| `created_at` | Block creation timestamp |

**Relationships**:

- Belongs to the blocker user.
- Hides both users from each other across community surfaces.
- Deletes follow relationships in both directions when created.

**Validation rules**:

- Pair is unique.
- Self-block is impossible.
- Unblock removes only the block row and never restores deleted follows.

## Community Follow Counts

**Purpose**: Durable profile counts for O(1) profile reads.

| Field | Rules |
|---|---|
| `user_id` | Primary key; references a community profile/user |
| `followers_count` | Non-negative integer |
| `following_count` | Non-negative integer |
| `updated_at` | Last count update timestamp |

**Relationships**:

- One row per community profile/user.
- Maintained by follow insert/delete and reconciliation helpers.

**Validation rules**:

- Counts cannot be negative.
- Blocking removes follows first, so count updates reflect only active relationships.

## Reader Search Result

**Purpose**: A visible profile summary returned by search.

| Field | Rules |
|---|---|
| `userId` | Public profile owner id |
| `username` | URL-safe public username |
| `displayName` | Optional display name |
| `bio` | Optional short bio |
| `avatarUrl` | Optional avatar URL |
| `isFollowing` | Whether viewer follows this user |
| `followsViewer` | Whether this user follows viewer, when visible |
| `followersCount` | Current follower count |
| `followingCount` | Current following count |

**Visibility rules**:

- Excludes non-public profiles.
- Excludes either-direction blocked pairs.
- Excludes the signed-in viewer unless a caller explicitly asks for self results.

## Follow List Item

**Purpose**: One visible row in followers/following list results.

| Field | Rules |
|---|---|
| `userId` | Visible profile owner id |
| `username` | Public username |
| `displayName` | Optional display name |
| `avatarUrl` | Optional avatar URL |
| `followedAt` | Timestamp of the follow relationship |
| `isFollowing` | Whether the viewer follows this listed user |

**Pagination**:

- Lists are ordered by newest relationship first.
- Cursor includes the last row's relationship timestamp and listed user id.

## Blocked User List Item

**Purpose**: Private account-management row for unblocking.

| Field | Rules |
|---|---|
| `userId` | Blocked user id |
| `username` | Best available username at block-list read time |
| `displayName` | Optional display name |
| `avatarUrl` | Optional avatar URL |
| `blockedAt` | Block timestamp |

**Visibility rules**:

- Only visible to the signed-in blocker.
- May include minimal profile identity even when the blocked user's profile is non-public so the blocker can recognize and unblock them.

## Interaction Eligibility

**Purpose**: Canonical decision for future community surfaces.

| Result | Meaning |
|---|---|
| `allowed` | Users may see/interact according to requested surface rules |
| `self` | The pair is the same user; self social relationship actions are denied |
| `blocked` | Either-direction block denies visibility/interaction |
| `profile_unavailable` | Target profile is missing or not visible to viewer |

## State Transitions

```text
Not following -> Follow -> Following
Following -> Unfollow -> Not following
Following either direction -> Block -> Blocked + both follows deleted
Blocked -> Unblock -> Not following, visibility restored only if profile privacy allows
Visible profile -> Profile made non-public -> hidden from search/lists except owner/private block management
```
