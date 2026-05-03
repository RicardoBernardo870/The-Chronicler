# Quickstart: Community Follows And Blocks Validation

## Prerequisites

- Two or more signed-in test users with community profiles.
- At least one public profile and one non-public profile.
- Supabase migration applied.
- PWA running with authenticated sessions available for the test users.

## Backend Smoke Checks

1. Confirm tables exist:
   - `follows`
   - `blocks`
   - `community_follow_counts`
2. Confirm RLS is enabled for new/changed community tables.
3. Confirm execute privileges for graph RPCs are granted to signed-in users only.
4. Run Supabase security and performance advisors.
5. Confirm relationship indexes exist for both directions of follows and blocks.
6. Confirm profile search uses an index-supported plan for representative queries.

## Follow / Unfollow

1. Sign in as User A.
2. Open User B's visible public profile.
3. Follow User B.
4. Confirm the button changes to following/unfollow within 1 second.
5. Confirm User B follower count increments and User A following count increments.
6. Attempt Follow again and confirm no duplicate count or duplicate relationship.
7. Unfollow User B.
8. Confirm counts decrement and state returns to not-following.

## Search

1. Search by a username prefix.
2. Search by display name.
3. Confirm visible matching profiles appear.
4. Confirm private/non-public profiles do not appear.
5. Confirm the signed-in user does not appear in default results.
6. Confirm empty searches and no-match searches show useful states.

## Followers / Following Lists

1. Create multiple follows toward User B.
2. Open User B's followers list from a signed-in viewer who can see User B.
3. Confirm visible followers appear newest first.
4. Load another page if more rows exist.
5. Open User A's following list and confirm User B appears while followed.
6. Confirm counts do not rely on loaded list length.

## Block / Unblock

1. Sign in as User A and follow User B.
2. Sign in as User B and follow User A.
3. Sign back in as User A and block User B.
4. Confirm both follow relationships are removed.
5. Confirm User A and User B no longer appear to each other in search/profile/list surfaces.
6. Open User A's blocked-users management list.
7. Unblock User B.
8. Confirm search/profile visibility returns only if privacy settings allow it.
9. Confirm the old follows are not restored.

## Negative Cases

1. Attempt to follow self and confirm the action is denied.
2. Attempt to block self and confirm the action is denied.
3. Attempt to follow a blocked user and confirm the action is denied.
4. Repeatedly click follow/unfollow and confirm counts stay correct.
5. Repeatedly click block/unblock and confirm idempotent state.

## Expected Result

- Follow/unfollow updates state within 1 second for the acting user.
- Search and lists never show blocked or unavailable users.
- Counts remain correct after retries and block cleanup.
- Blocked-users management provides the recovery path for unblocking.
- Future features can use the canonical interaction check instead of duplicating block logic.
