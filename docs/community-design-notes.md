# BookHero Community Design Notes

Source: community design discussion from 2026-05-02.

Speckit implementation prompts for the PWA community prototype live in `docs/community-speckit-prompts.md`.

The key insight with reading communities is that reading is solitary but identity is social. People do not want to be interrupted while reading. They want to share who they are as a reader and discover people like them. Every community feature should serve that tension.

## The Profile As Social Currency

The user profile already exists through Reader DNA, lexicon, and lifetime stats. Make it public-facing:

```text
+-------------------------------------+
|  [Avatar] Ricardo                   |
|  Chronicler - 34 books read         |
|                                     |
|  DNA: Gothic - Philosophical -      |
|       Existentialist                |
|                                     |
|  Currently Reading                  |
|  [Cover] The Master and Margarita   |
|  ########..  p.312 of 480           |
|                                     |
|  Recently Mastered Words            |
|  susurrus - palimpsest - aporia     |
|                                     |
|  [Follow] 847 followers             |
+-------------------------------------+
```

Privacy is granular. The user controls what is visible:

- Progress visible to: Everyone / Followers / Nobody
- Lexicon visible to: Everyone / Followers / Nobody
- Currently reading visible to: Everyone / Followers / Nobody

This matters. Some people read embarrassing things.

## Core Social Graph

Keep it asymmetric: follow, not friend. Reading taste is curatorial, not reciprocal.

```sql
create table follows (
  follower_id  uuid references auth.users,
  following_id uuid references auth.users,
  created_at   timestamptz default now(),
  primary key (follower_id, following_id)
);

create table user_profiles (
  user_id      uuid primary key references auth.users,
  username     text unique not null,
  display_name text,
  bio          text,
  avatar_url   text,
  is_public    boolean default true,
  created_at   timestamptz default now()
);
```

The follow graph unlocks everything else: feed, discovery, and reading together.

## The Social Feed

Not a generic timeline. Build a Reading Activity Feed scoped entirely to book events.

| Event | Feed Card |
| --- | --- |
| Someone finishes a book | "Ricardo finished Crime and Punishment after 3 weeks" |
| Someone hits a lore milestone | "Ana unlocked a Lore Card at 50% of Dune" |
| Someone adds a word to lexicon | "Marco added aporia from The Republic" |
| Someone starts a new book | "Sofia just started Blood Meridian" |
| Someone's Reading DNA updates | "Lena's reader profile evolved: now includes Dark Romanticism" |

No likes. No comments on feed items initially. Keep it signal-heavy, not noisy. Feed items are read-only observations, not conversation starters. This is deliberate: the community is built around books, not around reactions to reactions.

Add reactions later, such as a single "Read this too" button, once the feed has density.

## Reading Together

Two users are reading the same book. Surface it:

```text
+-------------------------------------+
|  3 people you follow are also       |
|  reading The Brothers Karamazov     |
|                                     |
|  [Avatar] Ana   - p.89              |
|  [Avatar] Marco - p.203 (ahead)     |
|  [Avatar] Sofia - p.45  (behind)    |
|                                     |
|  [Start a Reading Circle ->]        |
+-------------------------------------+
```

This card appears on the Book Detail Page when followers share a book. No action required. It creates ambient awareness that the user is not alone in the book.

## Reading Circles

Reading Circles are lightweight groups for a specific book.

- Up to 10 people
- Spoiler-safe by page progress
- Members can post a short reaction at any page
- Reaction content is capped at 280 characters
- Reactions are gated by page: `reaction.page <= viewer.current_page`
- When the user reaches a page with reactions, show a subtle indicator: "2 reactions at this page"

```sql
create table reading_circles (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid references books,
  created_by  uuid references auth.users,
  name        text,
  is_public   boolean default false,
  created_at  timestamptz
);

create table circle_reactions (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid references reading_circles,
  user_id     uuid references auth.users,
  page        int not null,
  content     text not null,
  created_at  timestamptz
);
```

The spoiler-safe mechanic is the differentiator: users cannot see reactions ahead of their current page.

## Book Clubs

Book Clubs are scheduled Reading Circles with structure.

```text
The Brothers Karamazov - Book Club
Hosted by Ricardo - 12 members - Scholar+

Week 1: Chapters 1-8      (Books 1-2)    <- current
Week 2: Chapters 9-18     (Books 3-5)
Week 3: Chapters 19-27    (Books 6-8)
Week 4: Chapters 28-end   (Books 9-12)

This week's discussion opens Sunday.
```

Capabilities:

- Club host sets the schedule and discussion prompts
- AI generates a discussion prompt for each week using the existing Gemini Edge Function pattern
- Discussion is async, threaded, and bounded to that week's chapters
- BookHero tracks if the reader is on pace and nudges when falling behind
- Public clubs are discoverable by book

Book Clubs are a natural Chronicler tier feature: hosting is paid, joining public clubs is Scholar.

## Discovery

### By DNA

When two users have overlapping DNA tags, such as both Gothic and Philosophical, surface community recommendations:

```text
Readers like you are reading:
- The Stranger - 34 readers with your DNA
- Nausea - 28 readers
- The Plague - 19 readers
```

This is a recommendation engine framed as community, not algorithm. That distinction matters for trust.

### By Book

Public book pages aggregate community data:

```text
The Master and Margarita

Community Stats
- 847 BookHero readers have read this
- Avg completion: 3.4 weeks
- Most added lexicon words: susurrus, palimpsest, ennui
- Top DNA tags unlocked: Magical Realism - Satire - Soviet Literature
- 4 active Reading Circles
- 2 upcoming Book Clubs
```

This makes BookHero useful before starting a book, not just while reading it.

## Social Lexicon Layer

Lexicon is already a differentiator. Make it social.

Word endorsements: when someone in the user's network adds a word, the user can tap "I know this one too" and add it to their own lexicon from the same book context, with the original note attached.

```text
Marco added mendicant from Don Quixote, p.88
"Someone who begs, especially a friar"
Marco's note: "Appears 12 times - Cervantes is obsessed"

[Add to my lexicon]
```

Vocabulary leaderboards: within a Reading Circle, show who added the most words this week. Keep this opt-in per circle so it remains lightweight.

Rare words: community-wide badge such as "You're one of 12 BookHero readers who know tmesis." Surface automatically when a word is uncommon in the corpus.

## Backend Architecture

The social layer is where Supabase needs careful design from the start.

| Concern | Solution |
| --- | --- |
| Feed generation | Precomputed `activity_feed` table. Insert rows on events via Postgres triggers and fan out to followers. |
| Real-time reactions | Supabase Realtime subscriptions on `circle_reactions`. |
| Username uniqueness | Postgres unique index plus Edge Function validation for profanity before write. |
| Notifications | Supabase Edge Function to APNS for events such as "Marco left a reaction at your current page". |
| Public book pages | New RPC `get_book_community_stats(isbn)` aggregates across all users for that ISBN. |
| Follow counts | Materialized view updated by trigger. Never count on read. |
| Blocking | `blocks` table checked in all feed and circle RPCs via RLS policy. |

Example fan-out trigger for completion:

```sql
create or replace function notify_feed_on_completion()
returns trigger language plpgsql as $$
begin
  if new.percentage >= 100 and old.percentage < 100 then
    insert into activity_feed (user_id, event_type, book_id, created_at)
    select follower_id, 'book_completed', new.book_id, now()
    from follows
    where following_id = new.user_id;
  end if;

  return new;
end;
$$;
```

Realtime is a strong fit for Supabase: `supabase.channel('circle:id').on('postgres_changes', ...)` gives live reactions without extra infrastructure.

## Monetization Fit

| Community Feature | Tier |
| --- | --- |
| Public profile | Free |
| Following / followers | Free |
| Activity feed following | Free |
| Reading Circles join | Scholar |
| Reading Circles create | Scholar |
| Book Clubs join public | Scholar |
| Book Clubs host | Chronicler |
| DNA-based reader discovery | Scholar |
| Vocabulary endorsements | Scholar |
| Rare word badges | Chronicler |

Community features are a strong subscriber retention mechanism. Once someone has followers, a Reading Circle, and shared vocabulary, churn becomes emotionally more expensive.

## Recommended Build Order

1. User profiles and follow graph: foundation everything else needs.
2. Activity feed: immediately makes the app feel alive.
3. Also-reading awareness on Book Detail: high value, low complexity.
4. Reading Circles with spoiler-safe reactions: the core differentiator.
5. Public book pages: community stats and discovery.
6. Book Clubs: most complex, highest retention value, build last.

The spoiler-safe page-gated reaction system is the feature worth putting on App Store screenshots.

## Implementation Notes

The first community slice now exists as the public reader profile foundation:

- Additive Supabase schema: `community_profiles`, `community_profile_privacy`, `follows`, and `blocks`.
- Stable PWA/iOS RPC contracts: `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available`, and `get_public_profile_by_username`.
- Privacy is enforced in the public profile RPC. Hidden sections are omitted, not returned with reason codes.
- Sensitive section defaults are `nobody`; the whole profile can also be made non-public.
- Minimal follow/block tables are present now so follower-only visibility and future blocking semantics have real backend predicates.

Current lexicon highlights use `leitner_box >= 5` and expose the existing lexicon `created_at` timestamp as `masteredAt`, because the current Leitner schema does not yet persist a separate mastered timestamp.
