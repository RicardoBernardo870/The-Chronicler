# Quickstart: Reading Circles

## Prerequisites

- Current branch: `024-reading-circles`
- Active feature pointer: `.specify/feature.json` points to `specs/024-reading-circles`
- Existing community profile, follow, block, also-reading, and privacy migrations are applied

## Implementation Smoke Path

1. Apply the additive Supabase migration for circle tables, RLS, indexes, triggers, and RPCs.
2. Run Supabase security and performance advisors.
3. Add TypeScript types for circle summaries, invitations, members, and reactions.
4. Add the `useReadingCirclesStore` and cache keys.
5. Add `useReadingCircles` composable for Book Detail orchestration.
6. Add Reading Circle components under `src/components/community/`.
7. Mount the compact Reading Circles panel in `BookDetailPage.vue`.
8. Run `npm.cmd test`.
9. Run `npm.cmd run build`.

## Manual Data Setup

Create or use four signed-in test users:

- Owner
- Invited reader
- Existing member
- Blocked reader

For each user:

1. Create a public community profile.
2. Add the same work/book to their library. Use at least one different edition with a different
   total page count.
3. Set reading progress with positive current page and positive total pages.
4. Make Owner follow Invited reader and Existing member.
5. Add a block case in each direction for Blocked reader tests.

## Acceptance Checks

### Create and invite

1. Sign in as Owner.
2. Open the Book Detail page.
3. Create a Reading Circle and invite Invited reader.
4. Confirm Owner is an accepted owner member.
5. Confirm Invited reader has only a pending invitation and cannot read reactions before
   accepting.

SQL smoke coverage:

- `create_reading_circle` creates one owner member and pending invitations.
- `invite_reading_circle_members` skips non-followed, self, existing member, blocked, and already-pending users.
- Pending invited users cannot read `get_reading_circle_detail` before accepting.

### Accept invitation

1. Sign in as Invited reader.
2. Open the Reading Circles entry point.
3. Accept the pending invitation.
4. Confirm the circle appears with member access.

SQL smoke coverage:

- `respond_to_reading_circle_invitation(..., true)` inserts one member row and marks the invitation accepted.
- `respond_to_reading_circle_invitation(..., false)` marks the invitation declined and does not insert membership.

### Max members

1. Seed a circle with 10 accepted members.
2. Try accepting another pending invitation.
3. Confirm acceptance is rejected and member count remains 10.

SQL smoke coverage:

- The max-member trigger rejects the 11th accepted member.
- The invitation remains non-accepted after the failed acceptance.

### Reaction creation

1. Sign in as an accepted member with valid progress.
2. Add a reaction at the current page or behind it with 280 or fewer characters.
3. Confirm it saves and appears for eligible members.
4. Try content over 280 characters and confirm rejection.
5. Try page 0, a page beyond total pages, and a page ahead of current progress; confirm all
   are rejected.

SQL smoke coverage:

- `add_circle_reaction` accepts a valid member reaction with a stored normalized location.
- `add_circle_reaction` rejects over-280-character content, page 0, beyond-edition pages,
  missing progress, and ahead-of-author-progress pages.

### Spoiler gate across editions

1. Give Owner a 300-page edition and Invited reader a 600-page edition.
2. Owner adds a reaction at page 150, normalized to 50%.
3. Set Invited reader progress to page 240 of 600, normalized to 40%.
4. Confirm Invited reader cannot read the reaction through UI or direct RPC.
5. Move Invited reader to page 300 of 600.
6. Confirm the reaction becomes visible.

SQL smoke coverage:

- `get_visible_circle_reactions` returns no content for normalized locations ahead of viewer progress.
- The same RPC returns content after the viewer reaches or passes the reaction's normalized location.
- Direct table access does not replace the RPC visibility contract.

### Progress moved backward

1. Set a member past a reaction and confirm visibility.
2. Move their progress backward before the reaction's normalized location.
3. Confirm the reaction is hidden again.

SQL smoke coverage:

- Visibility is derived from current progress on each RPC call, not cached reaction grants.

### Blocking

1. Create a circle with two accepted members.
2. Create a block in either direction.
3. Confirm affected users cannot remain mutually visible and cannot read each other's
   reactions.
4. Confirm realtime/refetch does not leak hidden reaction content during cleanup.

SQL smoke coverage:

- New blocks remove/restrict shared circle membership visibility.
- Existing pending invitations between blocked users are revoked or hidden.
- Reaction reads exclude blocked authors.

### Realtime safe refresh

1. Open circle detail as a viewer.
2. Add an eligible reaction as another member.
3. Confirm the viewer sees it live or after safe refetch within 2 seconds.
4. Add a reaction ahead of the viewer's progress.
5. Confirm no readable content for that reaction is delivered.

SQL smoke coverage:

- Realtime is treated as invalidation/refetch; visible content still comes from `get_visible_circle_reactions`.

## Validation Notes

- `npm.cmd test`: passed on 2026-05-03; 3 files and 37 tests passed.
- `npm.cmd run build`: passed on 2026-05-03; `vue-tsc -b` and Vite/PWA build completed.
- Supabase migration via MCP: applied successfully on 2026-05-03 with migration name `reading_circles`.
- Supabase security advisor: completed. It reports existing project-wide security-definer warnings plus authenticated security-definer warnings for the new stable Reading Circles RPCs and helper functions used by RLS/read contracts. No anonymous execute warning was reported for the new Reading Circles public RPCs.
- Supabase performance advisor: completed. It reports existing unindexed-FK and auth RLS initplan warnings from older tables/policies, plus unused-index info for new Reading Circle indexes before production traffic. New circle FK/filter paths are covered by the migration indexes.
- Manual quickstart acceptance: pending.

## Regression Checks

- Also Reading card still loads independently on Book Detail.
- Public profile privacy still hides sections server-side.
- Follow/unfollow and block/unblock flows still work.
- Library and progress updates are unaffected.
- Book Detail remains usable when circle RPCs fail or are slow.
