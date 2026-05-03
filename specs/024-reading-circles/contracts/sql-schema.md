# SQL Contract: Reading Circles

This feature should be implemented as one additive Supabase migration. Names may be refined
during implementation, but behavior and RPC response shapes must remain stable.

## New Types

```sql
create type public.circle_member_role as enum ('owner', 'member');
create type public.circle_status as enum ('active', 'closed');
create type public.circle_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');
```

If types already exist, create them idempotently with `do $$ begin ... end $$`.

## New Tables

### `public.reading_circles`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `owner_id uuid not null references auth.users(id) on delete cascade`
- `created_by uuid not null references auth.users(id) on delete cascade`
- `book_id uuid not null references public.books(id) on delete cascade`
- `canonical_book_id uuid null`
- `normalized_isbn text null`
- `title text not null`
- `author text not null`
- `cover_url text null`
- `name text not null`
- `status public.circle_status not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Validation:

- `length(btrim(name)) between 1 and 80`
- `status` controls whether new invitations/reactions are allowed.

### `public.circle_invitations`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `circle_id uuid not null references public.reading_circles(id) on delete cascade`
- `invited_user_id uuid not null references auth.users(id) on delete cascade`
- `invited_by uuid not null references auth.users(id) on delete cascade`
- `status public.circle_invitation_status not null default 'pending'`
- `created_at timestamptz not null default now()`
- `responded_at timestamptz null`

Validation:

- pending invitations do not grant access.
- unique pending invite per circle/user using a partial unique index:

```sql
create unique index if not exists circle_invitations_pending_unique_idx
  on public.circle_invitations (circle_id, invited_user_id)
  where status = 'pending';
```

### `public.circle_members`

Required columns:

- `circle_id uuid not null references public.reading_circles(id) on delete cascade`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `role public.circle_member_role not null default 'member'`
- `invitation_id uuid null references public.circle_invitations(id) on delete set null`
- `joined_at timestamptz not null default now()`
- primary key `(circle_id, user_id)`

Validation:

- exactly one owner per active circle, enforced by RPC/trigger plus a partial unique index:

```sql
create unique index if not exists circle_members_one_owner_idx
  on public.circle_members (circle_id)
  where role = 'owner';
```

- max 10 accepted members enforced by RPC and a trigger/check helper because SQL check
  constraints cannot count sibling rows.

### `public.circle_reactions`

Required columns:

- `id uuid primary key default gen_random_uuid()`
- `circle_id uuid not null references public.reading_circles(id) on delete cascade`
- `author_id uuid not null references auth.users(id) on delete cascade`
- `book_id uuid not null references public.books(id) on delete cascade`
- `source_page integer not null`
- `source_total_pages integer not null`
- `normalized_location numeric(6,3) not null`
- `content text not null`
- `created_at timestamptz not null default now()`
- `deleted_at timestamptz null`

Validation:

- `source_page > 0`
- `source_total_pages > 0`
- `source_page <= source_total_pages`
- `normalized_location between 0 and 100`
- `length(btrim(content)) between 1 and 280`
- author must be an accepted member.
- author progress must be at or beyond `normalized_location` at creation time.

## Index Requirements

Follow Supabase best practices: index every FK and common RLS/join/filter column; use composite
indexes for multi-column predicates with equality columns first and range/order columns last.

### Reading circles

```sql
create index if not exists reading_circles_owner_status_idx
  on public.reading_circles (owner_id, status, updated_at desc);

create index if not exists reading_circles_book_idx
  on public.reading_circles (book_id, status);

create index if not exists reading_circles_isbn_idx
  on public.reading_circles (normalized_isbn, status)
  where normalized_isbn is not null;
```

### Invitations

```sql
create index if not exists circle_invitations_user_status_idx
  on public.circle_invitations (invited_user_id, status, created_at desc);

create index if not exists circle_invitations_circle_status_idx
  on public.circle_invitations (circle_id, status, created_at desc);

create index if not exists circle_invitations_invited_by_idx
  on public.circle_invitations (invited_by);
```

### Members

```sql
create index if not exists circle_members_user_joined_idx
  on public.circle_members (user_id, joined_at desc);

create index if not exists circle_members_circle_role_idx
  on public.circle_members (circle_id, role, joined_at);

create index if not exists circle_members_invitation_id_idx
  on public.circle_members (invitation_id)
  where invitation_id is not null;
```

### Reactions

```sql
create index if not exists circle_reactions_circle_location_idx
  on public.circle_reactions (circle_id, normalized_location, created_at desc)
  where deleted_at is null;

create index if not exists circle_reactions_author_created_idx
  on public.circle_reactions (author_id, created_at desc)
  where deleted_at is null;

create index if not exists circle_reactions_book_idx
  on public.circle_reactions (book_id);
```

### Existing tables to verify

- `reading_progress (user_id, book_id, updated_at desc)` with `where current_page > 0`
- `books (user_id, id)`
- `books (normalize_isbn(isbn), user_id, id)` when ISBN matching is used
- follow/block primary and reverse indexes from community graph migrations

## RLS Requirements

- Enable RLS on every new table in the migration.
- Policies may allow accepted members to see safe non-content circle/member metadata.
- Reaction content should be read through `get_visible_circle_reactions`; direct table RLS
  should be either denied or limited to own authored reactions and non-sensitive metadata.
- Use `(select auth.uid())` in policies or indexed security-definer helper functions.
- Helper functions must use fixed `search_path = public` or `search_path = ''` with fully
  qualified names.

## Triggers And Helpers

Recommended helpers:

- `circle_user_is_member(p_circle_id uuid, p_user_id uuid)`
- `circle_user_is_owner(p_circle_id uuid, p_user_id uuid)`
- `circle_member_count(p_circle_id uuid)`
- `circle_viewer_progress_location(p_circle_id uuid, p_user_id uuid)`
- `circle_users_can_share(p_user_a uuid, p_user_b uuid)` reusing existing block helpers
- `circle_touch_updated_at()`

Recommended triggers:

- touch `updated_at` on circle changes.
- prevent more than 10 accepted members.
- prevent blocked user pairs from being inserted as members.
- optionally cleanup/remove unsafe memberships after block creation if existing block cleanup
  triggers are extended.

## Grants

- Revoke execute on new RPCs/helpers from `public` and `anon`.
- Grant execute only on stable public RPCs to `authenticated`.
- Keep internal helper execute privileges as narrow as possible.
- Add no broad table grants.

## Advisor Checks

After applying the migration, run Supabase security and performance advisors. Address or
document warnings about:

- function search path
- missing FK indexes
- duplicate indexes
- RLS disabled on new tables
- broad `anon`/`public` grants
- policies that call `auth.uid()` per row without `(select auth.uid())`
