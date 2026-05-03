# SQL Contract: Community Follows And Blocks

This contract extends the existing community profile migration. Names may be refined during
implementation, but the data behavior and RPC outputs must remain stable.

## Existing Tables

The prior community profile foundation already creates:

- `public.community_profiles`
- `public.community_profile_privacy`
- `public.follows`
- `public.blocks`

This feature must reuse those tables and add only missing production graph behavior.

## Additive Table

```sql
create table public.community_follow_counts (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  followers_count integer not null default 0 check (followers_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),
  updated_at timestamptz not null default now()
);

create index community_follow_counts_followers_idx
  on public.community_follow_counts (followers_count desc, user_id);
```

## Additive Search Index

Implementation should add indexed username/display-name search support. Preferred contract:

```sql
create index community_profiles_search_idx
  on public.community_profiles
  using gin (
    to_tsvector(
      'simple',
      coalesce(username, '') || ' ' || coalesce(display_name, '')
    )
  )
  where is_public = true;
```

If generated columns are preferred during implementation, the external search RPC behavior must
remain the same.

## Relationship Index Requirements

Existing relationship indexes must be preserved:

```sql
-- primary key covers follower -> following lookup
primary key (follower_id, following_id)

-- reverse lookup for follower lists
create index follows_following_follower_idx
  on public.follows (following_id, follower_id);

-- primary key covers blocker -> blocked lookup
primary key (blocker_id, blocked_id)

-- reverse lookup for either-direction block checks
create index blocks_blocked_blocker_idx
  on public.blocks (blocked_id, blocker_id);
```

Add list pagination indexes if advisors or EXPLAIN show the primary/reverse indexes are not
enough for `(created_at, user_id)` cursor ordering:

```sql
create index follows_following_created_idx
  on public.follows (following_id, created_at desc, follower_id);

create index follows_follower_created_idx
  on public.follows (follower_id, created_at desc, following_id);

create index blocks_blocker_created_idx
  on public.blocks (blocker_id, created_at desc, blocked_id);
```

## Helper Functions

All security-definer helpers must:

- `set search_path = public`
- use `(select auth.uid())` for current-user checks
- be granted only as required
- avoid returning private source-table data directly

Required helper behavior:

- `community_has_block_between(user_a uuid, user_b uuid)` returns true if either direction block exists.
- `community_can_view_profile(viewer uuid, target uuid)` returns true only when target profile exists, is public or owned by viewer, and no either-direction block exists.
- `community_can_interact(viewer uuid, target uuid)` returns a reason code for `allowed`, `self`, `blocked`, or `profile_unavailable`.
- Count maintenance helper increments/decrements `community_follow_counts` atomically.
- Count reconciliation helper can rebuild counts from `follows` for maintenance/testing.

## Trigger / Transaction Requirements

- Follow insert increments target `followers_count` and actor `following_count`.
- Follow delete decrements target `followers_count` and actor `following_count`, clamped at zero.
- Block creation deletes any follow rows where `(follower_id, following_id)` is either direction for the pair.
- Block deletion does not recreate follows.
- Profile creation ensures a count row exists for the profile owner.

## RLS Requirements

- RLS remains enabled on `follows` and `blocks`.
- Enable RLS on `community_follow_counts` in the first migration that creates it.
- Direct count-row reads may be limited to owners or denied; public count exposure should happen through safe RPC payloads.
- Users may create/delete only their own follow rows where `follower_id = (select auth.uid())`.
- Users may create/delete only their own block rows where `blocker_id = (select auth.uid())`.
- Search and list reads must go through RPCs that enforce public profile visibility and either-direction block exclusion.

## Grants

- Revoke execute from `public` and `anon` for all new community graph RPCs.
- Grant execute only to `authenticated`.
- Avoid granting broad table access beyond existing RLS policies.
