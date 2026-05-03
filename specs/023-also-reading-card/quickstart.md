# Quickstart: Also Reading Card

## Prerequisites

- Current branch: `023-also-reading-card`
- Active feature pointer: `.specify/feature.json` points to `specs/023-also-reading-card`
- Existing community profile, follow, block, and privacy migrations are applied

## Implementation Smoke Path

1. Apply the additive Supabase migration for the also-reading RPC and indexes.
2. Run Supabase security and performance advisors.
3. Add TypeScript types for the RPC response.
4. Add the `useAlsoReadingStore` and cache key.
5. Add `AlsoReadingCard.vue` and optional `AlsoReadingListDialog.vue`.
6. Mount the card in `BookDetailPage.vue` after `BookProgressPanel`.
7. Run `npm.cmd test`.
8. Run `npm.cmd run build`.

## Manual Data Setup

Create or use three signed-in test users:

- Viewer
- Followed visible reader
- Followed hidden/blocked reader

For each user:

1. Create a public community profile.
2. Set privacy:
   - visible reader: currently reading = followers, progress = followers
   - hidden reader case: currently reading = nobody
   - progress-hidden case: currently reading = followers, progress = nobody
3. Make Viewer follow the test readers.
4. Add the same book to Viewer and followed reader, either with the same book id path or matching ISBN.
5. Set both users' progress to an active state, greater than 0 and less than total pages.

## Acceptance Checks

### Visible followed reader

1. Sign in as Viewer.
2. Open the matching Book Detail page.
3. Confirm the Also Reading card appears.
4. Confirm the visible reader appears with profile summary.
5. Select the reader and confirm navigation to `/u/:username`.

### ISBN match

1. Give Viewer and followed reader separate book records with the same ISBN.
2. Open Viewer's book detail page.
3. Confirm the reader appears as a same-work/same-ISBN match.

### No visible matches

1. Remove follows or set all candidates' currently-reading visibility to nobody.
2. Open the Book Detail page.
3. Confirm no empty Also Reading card appears.

### Progress privacy

1. Set followed reader currently-reading visibility to followers.
2. Set followed reader progress visibility to nobody.
3. Open the Book Detail page.
4. Confirm the reader appears without page, percentage, or relative labels.

### Relative status

1. Set both users' progress visible.
2. Put the followed reader more than 10% ahead of Viewer.
3. Confirm the card labels the reader `ahead`.
4. Put the followed reader more than 10% behind Viewer.
5. Confirm the card labels the reader `behind`.
6. Put the followed reader within 10% of Viewer.
7. Confirm the card labels the reader `same area`.

### Blocking

1. Create a block from Viewer to followed reader.
2. Open the Book Detail page.
3. Confirm the reader disappears.
4. Remove that block and create a block from followed reader to Viewer.
5. Confirm the reader still disappears.

### Non-blocking load

1. Throttle network or simulate a slow RPC.
2. Open the Book Detail page.
3. Confirm header and progress panel render and remain usable before card data resolves.

## Regression Checks

- Public profile pages still respect privacy.
- Follow/unfollow and block/unblock flows still work.
- Library and progress updates are unaffected.
- Empty book detail and book-not-found states do not attempt to render the card.
