# SQL Contract: Community Reader Profiles

This is a planning contract for the migration. The implementation migration may refine names
while preserving the same data and RPC behavior.

## Tables

```sql
create type public.profile_visibility as enum ('everyone', 'followers', 'nobody');

create table public.community_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  bio text,
  avatar_url text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_profiles_username_format_chk
    check (username ~ '^[a-z0-9_-]{3,30}$'),
  constraint community_profiles_bio_len_chk
    check (bio is null or char_length(bio) <= 160)
);

create unique index community_profiles_username_lower_uidx
  on public.community_profiles (lower(username));

create index community_profiles_public_username_idx
  on public.community_profiles (username)
  where is_public = true;

create table public.community_profile_privacy (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  progress_visibility public.profile_visibility not null default 'nobody',
  currently_reading_visibility public.profile_visibility not null default 'nobody',
  lexicon_visibility public.profile_visibility not null default 'nobody',
  reader_dna_visibility public.profile_visibility not null default 'nobody',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_chk check (follower_id <> following_id)
);

create index follows_following_follower_idx
  on public.follows (following_id, follower_id);

create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_chk check (blocker_id <> blocked_id)
);

create index blocks_blocked_blocker_idx
  on public.blocks (blocked_id, blocker_id);
```

## RLS Requirements

- Enable RLS on every new table in the first migration.
- Owner writes profile and privacy rows only where `user_id = (select auth.uid())`.
- Minimal follows allow insert/delete where `follower_id = (select auth.uid())`.
- Blocks allow insert/delete where `blocker_id = (select auth.uid())`; block UI is out of
  scope but the predicate must exist.
- Public profile data for other users is read through RPCs; direct table policies must not
  expose private section source data.
- Security-definer helper functions must set `search_path = public` and check
  `(select auth.uid())` rather than trusting caller-provided viewer IDs.

## Index Requirements

- `community_profiles(lower(username))` unique index for case-insensitive username claims.
- Partial public username index for public lookup/discovery paths.
- FK/relationship indexes for `follows` and `blocks` in both lookup directions.
- Existing source tables used in public profile summaries should reuse existing user/book
  indexes or add missing FK indexes during implementation if advisors flag them.
- Implementation adds read-path indexes for active reading and mastered lexicon highlights:
  `reading_progress(user_id, updated_at desc)` and
  `lexicon_entries(user_id, leitner_box, created_at desc)`.
