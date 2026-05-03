# UI Contracts: Community Follows And Blocks

The current PWA UI may stay small, but it should exercise the final backend contracts.

## Public Profile Page

Existing `PublicProfilePage.vue` gains:

- Follow/unfollow action for other visible profiles.
- Block action for other visible profiles.
- Follower and following counts.
- Followers/following list entry points.
- Relationship state loading and error states.

Rules:

- Never render Follow for the viewer's own profile.
- If relationship state says `blocked` or `profile_unavailable`, render the existing unavailable state.
- Follow/unfollow buttons use optimistic disabled/loading state but show success only after server confirmation.
- Counts are displayed from server relationship/profile payloads, not client-side list lengths.

## Reader Search

Add a PrimeVue Dialog or page section for reader search.

States:

- Empty query: prompt to search by username/display name.
- Loading: skeleton rows.
- Results: profile summary rows with Follow button/state when allowed.
- Empty results: concise no-match state.
- Error: retry action.

## Followers / Following Dialog

Use a PrimeVue Dialog, Tabs if both lists are available, and list rows.

Behavior:

- Cursor-based "Load more" or infinite sentinel.
- Rows include avatar, username/display name, and viewer follow state.
- Hidden/blocked users are omitted without reason rows.

## Blocked Users Management

Add a private account-management panel, likely on `CommunityProfileEditPage.vue` or a nested
community settings section.

Behavior:

- Shows only the signed-in user's blocked users.
- Provides Unblock action per row.
- Includes empty, loading, error, and success states.
- Does not expose blocked user private reading sections.

## Store / Composable Contract

Add a community graph store/composable with:

- `searchReaders(query, cursor?)`
- `followUser(targetUserId)`
- `unfollowUser(targetUserId)`
- `blockUser(targetUserId)`
- `unblockUser(targetUserId)`
- `fetchFollowers(userId, cursor?)`
- `fetchFollowing(userId, cursor?)`
- `fetchBlockedUsers(cursor?)`
- `fetchRelationshipState(targetUserId)`

The store should update cached relationship state and counts from RPC responses, then invalidate
any affected public profile/search/list cache keys.
