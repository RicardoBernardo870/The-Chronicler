# SQL Contract: Also Reading Card

This feature should be implemented as an additive migration. It does not require a new table.
Names may be refined during implementation, but the behavior and RPC response shape must remain
stable.

## Existing Tables

The feature reuses:

- `public.books`
- `public.reading_progress`
- `public.community_profiles`
- `public.community_profile_privacy`
- `public.follows`
- `public.blocks`

## Additive Functions

### `public.normalize_isbn(p_isbn text)`

Recommended helper:

```sql
create or replace function public.normalize_isbn(p_isbn text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(upper(regexp_replace(coalesce(p_isbn, ''), '[^0-9X]', '', 'g')), '')
$$;
```

If an equivalent helper already exists, reuse it.

### `public.get_also_reading_for_book(...)`

Required properties:

- `security definer`
- `stable`
- `set search_path = public`
- uses `(select auth.uid())` once or stores it in a local variable
- returns JSONB with `items`, `nextCursor`, and `totalVisible`
- enforces privacy and blocking in SQL before JSON construction
- clamps `p_limit` to 1-20

## Index Requirements

The implementation must verify existing indexes and add only missing ones. Follow Supabase
best practices: index WHERE/JOIN columns and prefer partial indexes for filtered read paths.

### Active progress by user

Existing community profile work added:

```sql
create index if not exists reading_progress_user_updated_at_idx
  on public.reading_progress (user_id, updated_at desc);
```

For this feature, add or verify a stronger active-reading path:

```sql
create index if not exists reading_progress_user_book_active_idx
  on public.reading_progress (user_id, book_id, updated_at desc)
  where current_page > 0;
```

If Postgres cannot use the partial predicate well with joined `books.total_pages`, document the
EXPLAIN result and use a non-partial composite index instead.

### Book owner and ISBN matching

```sql
create index if not exists books_user_id_id_idx
  on public.books (user_id, id);

create index if not exists books_normalized_isbn_user_idx
  on public.books (public.normalize_isbn(isbn), user_id, id)
  where isbn is not null;
```

The normalized ISBN index must be compatible with the helper's immutability.

### Follow and block graph

Existing graph work should already provide:

```sql
primary key (follower_id, following_id)

create index if not exists follows_following_follower_idx
  on public.follows (following_id, follower_id);

primary key (blocker_id, blocked_id)

create index if not exists blocks_blocked_blocker_idx
  on public.blocks (blocked_id, blocker_id);
```

Keep these indexes. Add no duplicate indexes unless EXPLAIN shows a missing ordering/filter
path for this RPC.

## Privacy and Blocking Predicates

The RPC should reuse existing helpers where available, especially:

- `community_has_block_between(viewer, target)`
- `community_can_view_profile(viewer, target)`
- `can_community_users_interact(target)` behavior/reasons

If helper reuse would make the query harder to optimize, inline equivalent `exists` checks with
indexed columns. Do not rely on client-side filtering.

## Result Selection Rules

- Candidate base is `follows` where `follower_id = viewer`.
- Join candidate profiles and privacy rows.
- Exclude non-public or unavailable profiles.
- Exclude either-direction blocks.
- Join candidate active `reading_progress` and `books`.
- Match direct same book id first; match normalized ISBN second when direct id differs.
- Use `distinct on (candidate user_id)` or an equivalent ranked subquery so each followed
  reader appears once.
- Rank `same_book` before `same_isbn`, then most recent progress update.
- Build JSON only after all visibility gates have been applied.

## RLS and Grants

- Existing table RLS remains enabled.
- The RPC may use `security definer` to read across users, but must return only filtered
  fields listed in the RPC contract.
- Revoke execute on the RPC from `public` and `anon`.
- Grant execute only to `authenticated`.
- No broad table grants are added.

## Advisor Checks

After applying the migration, run Supabase security and performance advisors. Address or
document any warnings about:

- function search path
- missing foreign-key indexes
- duplicate indexes
- RLS disabled on community tables
- unconstrained grants to `anon` or `public`
