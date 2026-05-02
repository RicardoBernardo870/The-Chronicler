# BookHero Community Speckit Prompts

Use these prompts with `/speckit-specify` when starting the PWA community prototype. The goal is not a throwaway experiment: the PWA should validate the community experience now, while the backend is designed as durable shared infrastructure for a future native iOS client.

Reference these documents in every prompt:

- `docs/community-design-notes.md`
- `docs/ios-implementation-plan.md` Phase 5
- `docs/ios-native-migration-details.md` backend reuse rules

Backend expectations for all community specs:

- All backend additions are additive and must not break existing PWA behavior.
- Supabase/Postgres design must be production-ready, with RLS from the first migration.
- RLS policies must avoid per-row expensive auth calls where possible, using `(select auth.uid())` and indexed helper checks.
- Every foreign key and common filter/join column must be indexed.
- Public/social reads should use stable RPC contracts where useful, so the future iOS app can consume the same backend without reverse-engineering PWA queries.
- Privacy and blocking must be enforced server-side, not only in the client.
- PWA UI can be minimal, but data contracts should be final or close to final.

Recommended order:

1. Profiles and privacy
2. Follow graph and blocking
3. Also-reading awareness
4. Reading circles and spoiler-safe reactions
5. Activity feed

The first four are enough for a small invite-only PWA test. The feed is included as a later prompt because it becomes useful once several people are active.

---

## Prompt 1: Public Profiles And Privacy

```text
Create the BookHero community foundation: public reader profiles with granular privacy controls.

Context:
- This is for the current Vue PWA first, but the backend must be durable shared infrastructure for a future native iOS app.
- Reference docs/community-design-notes.md, especially "The Profile As Social Currency".
- Reference docs/ios-native-migration-details.md for backend reuse rules.
- Existing private profile data already includes Reader DNA, lifetime stats, current reading state, and lexicon data.

Feature goal:
Users can create and maintain a public-facing reader profile that expresses who they are as a reader without exposing sensitive reading behavior by default.

Primary user value:
- A user can claim a username, set display name, avatar, and short bio.
- A user can preview their public profile.
- A user can choose who can see progress, currently reading, lexicon highlights, and Reader DNA.
- Other users can view the public parts of a profile according to those privacy settings.

Scope:
- User profile setup and editing.
- Public profile viewing by another signed-in user.
- Privacy controls for:
  - progress visibility: everyone / followers / nobody
  - currently reading visibility: everyone / followers / nobody
  - lexicon visibility: everyone / followers / nobody
  - Reader DNA visibility: everyone / followers / nobody
- Username must be unique, stable, URL-safe, and case-insensitive.
- Bio max length is 160 characters.
- Avatar can be represented as a URL for now.
- A user can make their whole profile non-public.

Backend requirements:
- Design final-ish additive social profile tables suitable for PWA and future iOS.
- Enforce username uniqueness at the database level.
- Enforce visibility server-side through RLS and/or RPCs.
- Include blocking compatibility even if block UI ships in the next feature.
- Include indexes for username lookup, public profile discovery, and auth-user joins.
- Avoid leaking private profile fields through direct table reads.
- Prefer stable read RPCs for profile summary/public profile payloads if that keeps the client contract cleaner.

Out of scope:
- Following and follower lists beyond whatever is necessary to evaluate privacy.
- Activity feed.
- Reading circles.
- Public discovery pages.
- Payments or subscription gates.

Success criteria:
- A new user can create a profile in under 2 minutes.
- A user can change each privacy setting and see the public preview update correctly.
- A second signed-in user only sees profile sections allowed by privacy rules.
- Username duplicate attempts are rejected with a clear user-facing error.
- Existing private profile page behavior remains unchanged.
```

---

## Prompt 2: Follow Graph And Blocking

```text
Add the BookHero asymmetric follow graph and blocking system.

Context:
- This builds on the public profiles feature.
- Reference docs/community-design-notes.md, especially "Core Social Graph".
- Reading taste is curatorial, so follows are asymmetric, not reciprocal friendships.
- Backend must be production-ready and reusable by the future native iOS app.

Feature goal:
Users can follow readers whose taste they trust, manage follower/following lists, and block users they do not want to interact with.

Primary user value:
- A user can search for another reader by username/display name.
- A user can follow and unfollow another reader.
- A user can view follower and following counts.
- A user can view followers/following lists subject to profile visibility.
- A user can block another user, hiding both users from each other across community surfaces.

Scope:
- Follow/unfollow from a profile.
- Username/display-name search for signed-in users.
- Followers and following lists.
- Follow counts.
- Block/unblock.
- Blocked users must disappear from search, profile views, and future social surfaces.
- Self-follow must be impossible.

Backend requirements:
- Design durable additive tables for follows and blocks.
- Follow uniqueness must be enforced by primary or unique constraints.
- Block rules must be enforced server-side and reusable by later feed/circle/profile queries.
- Follow count reads must not require expensive count-on-read patterns at scale; specify a durable count strategy for planning.
- Include indexes on follower_id, following_id, blocker_id, blocked_id, and username/search access paths.
- RLS must prevent users from mutating other users' follows/blocks.
- Use stable RPCs where helpful for search, follow/unfollow, and list reads.

Out of scope:
- Activity feed generation.
- Notifications for new followers.
- Recommendations.
- Reading circles.

Success criteria:
- Follow/unfollow updates profile state within 1 second for the acting user.
- A blocked user cannot see the blocker in search or profile surfaces.
- Follow counts remain correct after repeated follow/unfollow actions.
- A user cannot follow themselves.
- Future features can check "can these users interact?" through a single server-side rule or RPC.
```

---

## Prompt 3: Also Reading Awareness

```text
Add the "Also Reading" community awareness card to BookHero book detail pages.

Context:
- This builds on public profiles, privacy controls, follows, and blocking.
- Reference docs/community-design-notes.md, especially "Reading Together".
- This is the first high-value community feature for a small invite-only PWA group.
- Backend must be final enough for future iOS to call the same read contract.

Feature goal:
When a user opens a book detail page, they can see whether people they follow are also reading the same book, without interrupting the act of reading.

Primary user value:
- The user gets ambient awareness that they are not alone in the book.
- The user can see followed readers who are reading the same canonical book or same ISBN.
- The user can see relative progress labels like ahead, behind, or same area when privacy allows it.
- The user can jump to a followed reader's public profile.

Scope:
- Add an "Also Reading" card on Book Detail.
- Show followed users currently reading the same book.
- Match by canonical book id when shared, and by ISBN when available.
- Respect each followed user's currently-reading and progress privacy.
- Respect blocks both ways.
- Limit the card to a small number of readers by default with a way to view more if needed.
- The card should gracefully hide when there are no visible matches.

Backend requirements:
- Provide a stable RPC for also-reading data, e.g. by current user's id plus book id/ISBN.
- RPC must enforce privacy and block rules server-side.
- RPC should return only the fields needed by the card: user profile summary, book match metadata, current page/progress only when visible, and relative status.
- Add or verify indexes needed for matching by user, book_id, ISBN, progress status, and follow graph joins.
- Avoid client-side filtering of private data.
- Keep the contract reusable by future iOS.

Out of scope:
- Creating Reading Circles.
- Reactions and notes.
- Activity feed events.
- Notifications.

Success criteria:
- A user with followed readers on the same book sees the card on Book Detail.
- A user with no visible matches does not see an empty card.
- Privacy set to nobody hides current-reading/progress data from the card.
- Blocking either direction removes the user from the result.
- Card data loads without delaying the core Book Detail content.
```

---

## Prompt 4: Reading Circles And Spoiler-Safe Reactions

```text
Add private Reading Circles with spoiler-safe page-gated reactions.

Context:
- This is the core community differentiator.
- Reference docs/community-design-notes.md, especially "Reading Circles".
- This builds on profiles, follows, blocks, privacy, and also-reading awareness.
- The PWA UI can be minimal, but the backend must be durable and safe for future iOS reuse.

Feature goal:
Small groups can read the same book together and leave short page-specific reactions without exposing spoilers beyond each reader's current progress.

Primary user value:
- A user can create a private Reading Circle for a book.
- A user can invite or add followed readers to the circle.
- Members can leave short reactions pinned to a page.
- Members only see reactions at or behind their current page.
- When a user reaches a page with reactions, the app can surface a subtle "reactions at this page" indicator.

Scope:
- Private Reading Circles only for the first release.
- Up to 10 members per circle.
- Circle has a book, name, creator, members, and created timestamp.
- Member roles can be simple: owner and member.
- Users can leave, and owners can remove members.
- Reaction content max length is 280 characters.
- Reaction page must be a positive page number within the book's total page count.
- Reactions are visible only when `reaction.page <= viewer.current_page` for that book.
- Realtime updates should be supported for visible reactions while a circle view is open.

Backend requirements:
- Design final-ish additive tables for reading_circles, circle_members, and circle_reactions.
- Enforce max circle size server-side.
- Enforce membership, blocking, and reaction visibility server-side through RLS and/or security-definer RPCs.
- Do not rely only on client-side `page <= current_page` filtering.
- Include indexes for circle membership, book lookup, reaction page lookup, user lookup, and realtime access patterns.
- Provide stable RPCs for:
  - create circle
  - list my circles
  - get circle detail
  - get visible reactions for a circle/book/page range
  - add reaction
  - remove member / leave circle
- Realtime subscription should only deliver or reveal reactions the viewer is allowed to see, or the client must receive only IDs/events and then refetch via the visibility-safe RPC.
- Future iOS must be able to reuse the same RPCs and data contracts.

Out of scope:
- Public circles.
- Book Clubs and schedules.
- Threaded discussion.
- Push notifications.
- Vocabulary leaderboards.
- Subscription enforcement, unless an entitlement system already exists by implementation time.

Success criteria:
- A user can create a circle and add up to 9 other members.
- A member can add a 280-character reaction at a valid page.
- A member behind that page cannot read the reaction through UI or direct backend access.
- Once the member progresses to that page, the reaction becomes visible.
- Blocked users cannot remain together in a circle or see each other's reactions.
- Reactions appear live or refresh within 2 seconds for eligible viewers.
```

---

## Prompt 5: Reading Activity Feed

```text
Add the BookHero Reading Activity Feed for followed readers.

Context:
- This should be built after profiles, follows, blocking, and at least one meaningful activity source exists.
- Reference docs/community-design-notes.md, especially "The Social Feed".
- The feed is not a generic social timeline. It is a read-only stream of book-related events.
- Backend must be designed for scale now, even if the PWA beta has only a few users.

Feature goal:
Users can open a signal-heavy feed that shows meaningful reading activity from people they follow.

Primary user value:
- A user sees that followed readers are starting books, finishing books, unlocking lore, adding lexicon words, or evolving Reader DNA.
- The feed makes the app feel alive without becoming noisy.
- Feed cards are read-only observations at first.

Scope:
- Feed tab or page for signed-in users.
- Events:
  - book_started
  - book_completed
  - lore_unlocked
  - lexicon_word_added
  - reading_dna_updated
- Feed cards include profile summary, event type, book context when relevant, and timestamp.
- Respect profile privacy, lexicon privacy, current reading/progress privacy, and blocks.
- No likes, comments, reposts, or generic posting.
- Pull-to-refresh and live update while feed is open.

Backend requirements:
- Use a precomputed activity_feed design, not expensive timeline assembly on every read.
- Specify a durable fan-out or hybrid feed strategy for planning.
- Feed generation must not leak private data; privacy should be evaluated before insert or during read through safe RPCs.
- Include idempotency/deduping so repeated progress saves do not spam duplicate events.
- Include indexes for recipient user, actor user, event type, created_at, and optional book/event references.
- Use stable feed read RPCs with pagination.
- Realtime updates should use Supabase Realtime safely with RLS or refetch-by-RPC.
- Future iOS must be able to consume the same feed contract.

Out of scope:
- Reactions to feed items.
- Comments.
- Push notifications.
- Public global feed.
- Algorithmic ranking.

Success criteria:
- A user sees new followed-reader activity within 2 seconds while feed is open.
- Duplicate progress saves do not create duplicate completion/start events.
- Blocked users and private activity never appear in the feed.
- Feed supports pagination without missing or duplicating items.
- The feed remains understandable with only a small beta group.
```

---

## Optional Later Prompt: Social Lexicon Endorsements

```text
Add social lexicon endorsements to BookHero.

Context:
- Build this only after profiles, follows, and either feed or circles exist.
- Reference docs/community-design-notes.md, especially "Social Lexicon Layer".
- Lexicon is one of BookHero's differentiators, so this feature should feel quiet and useful, not gamified by default.

Feature goal:
Users can discover words added by people they follow or circle members and add those words to their own lexicon with preserved context.

Primary user value:
- A user sees that someone in their network added a word from a book.
- A user can add that word to their own lexicon with one action.
- Original book context and attribution can be retained when privacy allows.

Scope:
- "Add to my lexicon" action from eligible social surfaces.
- Preserve source attribution where allowed.
- Avoid duplicate entries for the same user/book/term combination.
- Respect lexicon privacy and blocks.
- Keep leaderboards and rare-word badges out of the first release unless needed by Reading Circles.

Backend requirements:
- Use server-side deduplication.
- Enforce lexicon privacy and block rules server-side.
- Preserve attribution without giving the original user write access to another user's lexicon.
- Include indexes for user/book/term lookup.
- Keep the contract reusable by PWA and future iOS.

Out of scope:
- Vocabulary leaderboards.
- Rare-word badges.
- Public corpus-wide word pages.

Success criteria:
- A user can add a shared word in one action.
- Duplicate add attempts do not create duplicate lexicon entries.
- Private lexicon entries never appear in social surfaces.
```

