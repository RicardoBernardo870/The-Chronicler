# Quickstart: Community Reader Profiles

## Prerequisites

- Supabase project available.
- PWA can sign in with an existing user.
- At least two test users are available for privacy checks.

## Validation Flow

1. Apply the community profile migration.
2. Confirm new tables have RLS enabled:
   - `community_profiles`
   - `community_profile_privacy`
   - `follows`
   - `blocks`
3. Confirm key indexes exist:
   - case-insensitive username uniqueness
   - public username lookup
   - follow relationship in both directions
   - block relationship in both directions
4. Sign in as User A.
5. Create a profile with:
   - username: `reader_a`
   - display name
   - avatar URL
   - bio under 160 characters
   - all sensitive sections defaulting to `nobody`
6. Verify duplicate username behavior:
   - Sign in as User B.
   - Attempt to claim `Reader_A`.
   - Confirm the duplicate is rejected with a clear message.
7. Verify username change behavior:
   - Sign in as User A.
   - Change username from `reader_a` to `reader_alpha`.
   - Sign in as User B and confirm `reader_a` can now be claimed.
8. Verify public profile section omission:
   - User A sets progress to `everyone`.
   - User A leaves currently reading as `nobody`.
   - User B opens `reader_alpha`.
   - Confirm aggregate stats can appear, but active book title/page details are absent.
9. Verify follower-only behavior:
   - Create minimal follow relationship from User B to User A.
   - User A sets Reader DNA to `followers`.
   - User B opens the profile and can see Reader DNA when present.
   - Remove the follow relationship and confirm Reader DNA is omitted.
10. Verify block behavior:
    - Create block record in either direction.
    - Confirm the public profile returns the generic unavailable state.
11. Verify private Profile page:
    - Open `/profile`.
    - Confirm private Reader DNA, lifetime stats, and existing profile cards behave as before.

## Expected Result

- Profile creation takes less than 2 minutes.
- Public profile RPCs return only allowed sections.
- Hidden sections have no reason codes or empty shells.
- Existing PWA profile behavior remains unchanged.
