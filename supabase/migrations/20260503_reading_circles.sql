-- ============================================================================
-- Reading Circles
-- Purpose: Private invite-only circles with spoiler-safe page-gated reactions.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'circle_member_role') then
    create type public.circle_member_role as enum ('owner', 'member');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'circle_status') then
    create type public.circle_status as enum ('active', 'closed');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'circle_invitation_status') then
    create type public.circle_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');
  end if;
end $$;

create table if not exists public.reading_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  canonical_book_id uuid,
  normalized_isbn text,
  title text not null,
  author text not null,
  cover_url text,
  name text not null,
  status public.circle_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_circles_name_not_blank check (length(btrim(name)) between 1 and 80)
);

create table if not exists public.circle_invitations (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.reading_circles(id) on delete cascade,
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status public.circle_invitation_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.reading_circles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.circle_member_role not null default 'member',
  invitation_id uuid references public.circle_invitations(id) on delete set null,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.circle_reactions (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.reading_circles(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  source_page integer not null,
  source_total_pages integer not null,
  normalized_location numeric(6,3) not null,
  content text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint circle_reactions_page_positive check (source_page > 0),
  constraint circle_reactions_total_pages_positive check (source_total_pages > 0),
  constraint circle_reactions_page_in_range check (source_page <= source_total_pages),
  constraint circle_reactions_location_range check (normalized_location between 0 and 100),
  constraint circle_reactions_content_length check (length(btrim(content)) between 1 and 280)
);

create index if not exists reading_circles_owner_status_idx
  on public.reading_circles (owner_id, status, updated_at desc);

create index if not exists reading_circles_created_by_idx
  on public.reading_circles (created_by);

create index if not exists reading_circles_book_idx
  on public.reading_circles (book_id, status);

create index if not exists reading_circles_isbn_idx
  on public.reading_circles (normalized_isbn, status)
  where normalized_isbn is not null;

create unique index if not exists circle_invitations_pending_unique_idx
  on public.circle_invitations (circle_id, invited_user_id)
  where status = 'pending';

create index if not exists circle_invitations_user_status_idx
  on public.circle_invitations (invited_user_id, status, created_at desc);

create index if not exists circle_invitations_circle_status_idx
  on public.circle_invitations (circle_id, status, created_at desc);

create index if not exists circle_invitations_invited_by_idx
  on public.circle_invitations (invited_by);

create unique index if not exists circle_members_one_owner_idx
  on public.circle_members (circle_id)
  where role = 'owner';

create index if not exists circle_members_user_joined_idx
  on public.circle_members (user_id, joined_at desc);

create index if not exists circle_members_circle_role_idx
  on public.circle_members (circle_id, role, joined_at);

create index if not exists circle_members_invitation_id_idx
  on public.circle_members (invitation_id)
  where invitation_id is not null;

create index if not exists circle_reactions_circle_location_idx
  on public.circle_reactions (circle_id, normalized_location, created_at desc)
  where deleted_at is null;

create index if not exists circle_reactions_author_created_idx
  on public.circle_reactions (author_id, created_at desc)
  where deleted_at is null;

create index if not exists circle_reactions_book_idx
  on public.circle_reactions (book_id);

create index if not exists reading_progress_user_book_active_idx
  on public.reading_progress (user_id, book_id, updated_at desc)
  where current_page > 0;

create index if not exists books_user_id_id_idx
  on public.books (user_id, id);

create or replace function public.circle_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.circle_user_is_member(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
      and rc.status = 'active'
  );
$$;

create or replace function public.circle_user_is_owner(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
      and cm.role = 'owner'
      and rc.status = 'active'
  );
$$;

create or replace function public.circle_member_count(p_circle_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.circle_members
  where circle_id = p_circle_id;
$$;

create or replace function public.circle_users_can_share(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_a is not null
     and p_user_b is not null
     and p_user_a <> p_user_b
     and not public.community_has_block_between(p_user_a, p_user_b);
$$;

create or replace function public.circle_book_matches(
  p_circle_book_id uuid,
  p_circle_isbn text,
  p_user_id uuid,
  p_book_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.books b
    where b.id = p_book_id
      and b.user_id = p_user_id
      and (
        b.id = p_circle_book_id
        or (
          p_circle_isbn is not null
          and public.normalize_isbn(b.isbn) = p_circle_isbn
        )
      )
  );
$$;

create or replace function public.circle_progress_location(p_circle_id uuid, p_user_id uuid)
returns table (
  book_id uuid,
  current_page integer,
  total_pages integer,
  normalized_location numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id as book_id,
    rp.current_page,
    b.total_pages,
    least(100::numeric, greatest(0::numeric, round((rp.current_page::numeric / b.total_pages::numeric) * 100, 3))) as normalized_location
  from public.reading_circles rc
  join public.books b
    on b.user_id = p_user_id
   and (
      b.id = rc.book_id
      or (
        rc.normalized_isbn is not null
        and public.normalize_isbn(b.isbn) = rc.normalized_isbn
      )
   )
  join public.reading_progress rp
    on rp.book_id = b.id
   and rp.user_id = p_user_id
  where rc.id = p_circle_id
    and rc.status = 'active'
    and b.total_pages > 0
    and rp.current_page > 0
  order by
    case when b.id = rc.book_id then 0 else 1 end,
    rp.updated_at desc,
    b.id
  limit 1;
$$;

create or replace function public.circle_members_have_block(p_circle_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id <> p_user_id
      and public.community_has_block_between(cm.user_id, p_user_id)
  );
$$;

create or replace function public.circle_assert_member_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.circle_member_count(new.circle_id) >= 10 then
    raise exception 'circle_full' using errcode = 'P0001';
  end if;

  if public.circle_members_have_block(new.circle_id, new.user_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.circle_block_cleanup_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.circle_invitations ci
  using public.circle_members cm
  where ci.circle_id = cm.circle_id
    and ci.status = 'pending'
    and cm.user_id in (new.blocker_id, new.blocked_id)
    and ci.invited_user_id in (new.blocker_id, new.blocked_id);

  delete from public.circle_members cm
  using public.circle_members other
  where cm.circle_id = other.circle_id
    and cm.user_id = new.blocked_id
    and other.user_id = new.blocker_id;

  update public.reading_circles rc
  set status = 'closed',
      updated_at = now()
  where status = 'active'
    and not exists (
      select 1 from public.circle_members cm where cm.circle_id = rc.id
    );

  return new;
end;
$$;

drop trigger if exists reading_circles_touch_updated_at on public.reading_circles;
create trigger reading_circles_touch_updated_at
before update on public.reading_circles
for each row execute function public.circle_touch_updated_at();

drop trigger if exists circle_members_assert_insert on public.circle_members;
create trigger circle_members_assert_insert
before insert on public.circle_members
for each row execute function public.circle_assert_member_insert();

drop trigger if exists circle_block_cleanup_memberships on public.blocks;
create trigger circle_block_cleanup_memberships
after insert on public.blocks
for each row execute function public.circle_block_cleanup_memberships();

alter table public.reading_circles enable row level security;
alter table public.circle_invitations enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_reactions enable row level security;

drop policy if exists reading_circles_member_select on public.reading_circles;
create policy reading_circles_member_select on public.reading_circles
for select
to authenticated
using ((select public.circle_user_is_member(id, (select auth.uid()))));

drop policy if exists circle_invitations_recipient_or_owner_select on public.circle_invitations;
create policy circle_invitations_recipient_or_owner_select on public.circle_invitations
for select
to authenticated
using (
  invited_user_id = (select auth.uid())
  or (select public.circle_user_is_owner(circle_id, (select auth.uid())))
);

drop policy if exists circle_members_member_select on public.circle_members;
create policy circle_members_member_select on public.circle_members
for select
to authenticated
using ((select public.circle_user_is_member(circle_id, (select auth.uid()))));

drop policy if exists circle_reactions_author_select on public.circle_reactions;
create policy circle_reactions_author_select on public.circle_reactions
for select
to authenticated
using (author_id = (select auth.uid()));

create or replace function public.create_reading_circle(
  p_book_id uuid,
  p_name text,
  p_invited_user_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_book public.books%rowtype;
  v_circle_id uuid;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_invited uuid[] := '{}';
  v_skipped uuid[] := '{}';
  v_target uuid;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if v_name is null or length(v_name) > 80 then
    raise exception 'invalid_circle_name' using errcode = 'P0001';
  end if;

  select *
  into v_book
  from public.books
  where id = p_book_id
    and user_id = v_viewer;

  if not found then
    raise exception 'invalid_book' using errcode = 'P0001';
  end if;

  insert into public.reading_circles (
    owner_id,
    created_by,
    book_id,
    normalized_isbn,
    title,
    author,
    cover_url,
    name
  )
  values (
    v_viewer,
    v_viewer,
    v_book.id,
    public.normalize_isbn(v_book.isbn),
    v_book.title,
    v_book.author,
    v_book.cover_url,
    v_name
  )
  returning id into v_circle_id;

  insert into public.circle_members (circle_id, user_id, role)
  values (v_circle_id, v_viewer, 'owner');

  foreach v_target in array coalesce(p_invited_user_ids, '{}')
  loop
    if v_target is null or v_target = v_viewer then
      v_skipped := array_append(v_skipped, v_target);
    elsif not exists (
      select 1 from public.follows f
      where f.follower_id = v_viewer
        and f.following_id = v_target
    ) or public.community_has_block_between(v_viewer, v_target) then
      v_skipped := array_append(v_skipped, v_target);
    elsif exists (
      select 1 from public.circle_invitations ci
      where ci.circle_id = v_circle_id
        and ci.invited_user_id = v_target
        and ci.status = 'pending'
    ) then
      v_skipped := array_append(v_skipped, v_target);
    else
      insert into public.circle_invitations (circle_id, invited_user_id, invited_by)
      values (v_circle_id, v_target, v_viewer)
      on conflict do nothing;
      v_invited := array_append(v_invited, v_target);
    end if;
  end loop;

  return jsonb_build_object(
    'circleId', v_circle_id,
    'created', true,
    'invitedUserIds', coalesce(to_jsonb(v_invited), '[]'::jsonb),
    'skippedUserIds', coalesce(to_jsonb(v_skipped), '[]'::jsonb)
  );
end;
$$;

create or replace function public.invite_reading_circle_members(
  p_circle_id uuid,
  p_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_invited uuid[] := '{}';
  v_skipped uuid[] := '{}';
  v_target uuid;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_owner(p_circle_id, v_viewer) then
    raise exception 'not_circle_owner' using errcode = 'P0001';
  end if;

  foreach v_target in array coalesce(p_user_ids, '{}')
  loop
    if v_target is null or v_target = v_viewer then
      v_skipped := array_append(v_skipped, v_target);
    elsif not exists (
      select 1 from public.follows f
      where f.follower_id = v_viewer
        and f.following_id = v_target
    ) or public.community_has_block_between(v_viewer, v_target) then
      v_skipped := array_append(v_skipped, v_target);
    elsif exists (
      select 1 from public.circle_members cm
      where cm.circle_id = p_circle_id
        and cm.user_id = v_target
    ) then
      v_skipped := array_append(v_skipped, v_target);
    else
      insert into public.circle_invitations (circle_id, invited_user_id, invited_by)
      values (p_circle_id, v_target, v_viewer)
      on conflict do nothing;
      v_invited := array_append(v_invited, v_target);
    end if;
  end loop;

  return jsonb_build_object(
    'circleId', p_circle_id,
    'invitedUserIds', coalesce(to_jsonb(v_invited), '[]'::jsonb),
    'skippedUserIds', coalesce(to_jsonb(v_skipped), '[]'::jsonb)
  );
end;
$$;

create or replace function public.respond_to_reading_circle_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_invitation public.circle_invitations%rowtype;
  v_status public.circle_invitation_status;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select *
  into v_invitation
  from public.circle_invitations
  where id = p_invitation_id
    and invited_user_id = v_viewer
  for update;

  if not found or v_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending' using errcode = 'P0001';
  end if;

  if coalesce(p_accept, false) then
    if not exists (select 1 from public.reading_circles where id = v_invitation.circle_id and status = 'active') then
      raise exception 'circle_not_active' using errcode = 'P0001';
    end if;

    insert into public.circle_members (circle_id, user_id, role, invitation_id)
    values (v_invitation.circle_id, v_viewer, 'member', p_invitation_id);
    v_status := 'accepted';
  else
    v_status := 'declined';
  end if;

  update public.circle_invitations
  set status = v_status,
      responded_at = now()
  where id = p_invitation_id;

  return jsonb_build_object(
    'circleId', v_invitation.circle_id,
    'invitationId', p_invitation_id,
    'status', v_status,
    'member', case
      when v_status = 'accepted' then jsonb_build_object('userId', v_viewer, 'role', 'member', 'joinedAt', now())
      else null
    end
  );
end;
$$;

create or replace function public.list_my_reading_circles(
  p_limit integer default 20,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  return (
    with circle_rows as (
      select
        'circle'::text as type,
        rc.updated_at as sort_at,
        jsonb_build_object(
          'type', 'circle',
          'circle', jsonb_build_object(
            'circleId', rc.id,
            'name', rc.name,
            'book', jsonb_build_object(
              'bookId', rc.book_id,
              'title', rc.title,
              'author', rc.author,
              'coverUrl', rc.cover_url
            ),
            'memberCount', public.circle_member_count(rc.id),
            'pendingInviteCount', case
              when public.circle_user_is_owner(rc.id, v_viewer)
              then (
                select count(*)::integer
                from public.circle_invitations ci
                where ci.circle_id = rc.id
                  and ci.status = 'pending'
              )
              else 0
            end,
            'latestReactionAt', null
          ),
          'viewerRole', cm.role
        ) as payload
      from public.circle_members cm
      join public.reading_circles rc on rc.id = cm.circle_id
      where cm.user_id = v_viewer
        and rc.status = 'active'
        and not public.circle_members_have_block(rc.id, v_viewer)
    ),
    invitation_rows as (
      select
        'invitation'::text as type,
        ci.created_at as sort_at,
        jsonb_build_object(
          'type', 'invitation',
          'invitationId', ci.id,
          'circle', jsonb_build_object(
            'circleId', rc.id,
            'name', rc.name,
            'book', jsonb_build_object(
              'bookId', rc.book_id,
              'title', rc.title,
              'author', rc.author,
              'coverUrl', rc.cover_url
            ),
            'memberCount', public.circle_member_count(rc.id)
          ),
          'invitedBy', jsonb_build_object(
            'userId', cp.user_id,
            'username', cp.username,
            'displayName', cp.display_name,
            'avatarUrl', cp.avatar_url
          )
        ) as payload
      from public.circle_invitations ci
      join public.reading_circles rc on rc.id = ci.circle_id
      join public.community_profiles cp on cp.user_id = ci.invited_by
      where ci.invited_user_id = v_viewer
        and ci.status = 'pending'
        and rc.status = 'active'
        and not public.community_has_block_between(v_viewer, ci.invited_by)
    ),
    combined as (
      select * from circle_rows
      union all
      select * from invitation_rows
    ),
    paged as (
      select payload, sort_at, row_number() over (order by sort_at desc, type) as rn
      from combined
      where p_cursor is null or sort_at < p_cursor::timestamptz
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(payload order by sort_at desc), '[]'::jsonb),
      'nextCursor', max(case when rn = v_limit + 1 then sort_at::text end)
    )
    from paged
    where rn <= v_limit + 1
  );
end;
$$;

create or replace function public.get_reading_circle_detail(p_circle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_progress record;
  v_is_owner boolean;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_member(p_circle_id, v_viewer) or public.circle_members_have_block(p_circle_id, v_viewer) then
    return null;
  end if;

  v_is_owner := public.circle_user_is_owner(p_circle_id, v_viewer);

  select * into v_progress
  from public.circle_progress_location(p_circle_id, v_viewer);

  return (
    select jsonb_build_object(
      'circleId', rc.id,
      'name', rc.name,
      'book', jsonb_build_object(
        'bookId', rc.book_id,
        'title', rc.title,
        'author', rc.author,
        'coverUrl', rc.cover_url,
        'normalizedIsbn', rc.normalized_isbn
      ),
      'viewer', jsonb_build_object(
        'role', cm.role,
        'currentPage', v_progress.current_page,
        'totalPages', v_progress.total_pages,
        'normalizedLocation', v_progress.normalized_location
      ),
      'members', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'userId', m.user_id,
          'username', cp.username,
          'displayName', cp.display_name,
          'avatarUrl', cp.avatar_url,
          'role', m.role,
          'joinedAt', m.joined_at
        ) order by m.role desc, m.joined_at), '[]'::jsonb)
        from public.circle_members m
        join public.community_profiles cp on cp.user_id = m.user_id
        where m.circle_id = rc.id
          and not public.community_has_block_between(v_viewer, m.user_id)
      ),
      'pendingInvitations', case
        when v_is_owner then (
          select coalesce(jsonb_agg(jsonb_build_object(
            'invitationId', ci.id,
            'userId', ci.invited_user_id,
            'username', cp.username,
            'displayName', cp.display_name,
            'avatarUrl', cp.avatar_url,
            'status', ci.status,
            'createdAt', ci.created_at
          ) order by ci.created_at desc), '[]'::jsonb)
          from public.circle_invitations ci
          join public.community_profiles cp on cp.user_id = ci.invited_user_id
          where ci.circle_id = rc.id
            and ci.status = 'pending'
        )
        else '[]'::jsonb
      end,
      'createdAt', rc.created_at
    )
    from public.reading_circles rc
    join public.circle_members cm
      on cm.circle_id = rc.id
     and cm.user_id = v_viewer
    where rc.id = p_circle_id
      and rc.status = 'active'
  );
end;
$$;

create or replace function public.add_circle_reaction(
  p_circle_id uuid,
  p_book_id uuid,
  p_source_page integer,
  p_content text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_circle public.reading_circles%rowtype;
  v_book public.books%rowtype;
  v_progress public.reading_progress%rowtype;
  v_content text := btrim(coalesce(p_content, ''));
  v_location numeric;
  v_progress_location numeric;
  v_reaction_id uuid;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_member(p_circle_id, v_viewer) then
    raise exception 'not_circle_member' using errcode = 'P0001';
  end if;

  if public.circle_members_have_block(p_circle_id, v_viewer) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  if length(v_content) < 1 or length(v_content) > 280 then
    raise exception 'invalid_reaction_content' using errcode = 'P0001';
  end if;

  select * into v_circle
  from public.reading_circles
  where id = p_circle_id
    and status = 'active';

  if not found then
    raise exception 'invalid_circle' using errcode = 'P0001';
  end if;

  select * into v_book
  from public.books
  where id = p_book_id
    and user_id = v_viewer;

  if not found or v_book.total_pages <= 0 then
    raise exception 'invalid_book' using errcode = 'P0001';
  end if;

  if not public.circle_book_matches(v_circle.book_id, v_circle.normalized_isbn, v_viewer, p_book_id) then
    raise exception 'invalid_book' using errcode = 'P0001';
  end if;

  if p_source_page < 1 or p_source_page > v_book.total_pages then
    raise exception 'invalid_page' using errcode = 'P0001';
  end if;

  select * into v_progress
  from public.reading_progress
  where user_id = v_viewer
    and book_id = p_book_id;

  if not found or v_progress.current_page <= 0 then
    raise exception 'invalid_progress' using errcode = 'P0001';
  end if;

  v_location := least(100::numeric, greatest(0::numeric, round((p_source_page::numeric / v_book.total_pages::numeric) * 100, 3)));
  v_progress_location := least(100::numeric, greatest(0::numeric, round((v_progress.current_page::numeric / v_book.total_pages::numeric) * 100, 3)));

  if v_location > v_progress_location then
    raise exception 'reaction_ahead_of_progress' using errcode = 'P0001';
  end if;

  insert into public.circle_reactions (
    circle_id,
    author_id,
    book_id,
    source_page,
    source_total_pages,
    normalized_location,
    content
  )
  values (
    p_circle_id,
    v_viewer,
    p_book_id,
    p_source_page,
    v_book.total_pages,
    v_location,
    v_content
  )
  returning id into v_reaction_id;

  return jsonb_build_object(
    'reactionId', v_reaction_id,
    'circleId', p_circle_id,
    'normalizedLocation', v_location,
    'createdAt', now()
  );
end;
$$;

create or replace function public.get_visible_circle_reactions(
  p_circle_id uuid,
  p_min_location numeric default null,
  p_max_location numeric default null,
  p_limit integer default 50,
  p_cursor text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_progress record;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_min numeric := greatest(coalesce(p_min_location, 0), 0);
  v_max numeric;
  v_cursor_time timestamptz;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_member(p_circle_id, v_viewer) or public.circle_members_have_block(p_circle_id, v_viewer) then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'viewerProgressMissing', true);
  end if;

  select * into v_progress
  from public.circle_progress_location(p_circle_id, v_viewer);

  if v_progress.normalized_location is null then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'viewerProgressMissing', true);
  end if;

  v_max := least(coalesce(p_max_location, v_progress.normalized_location), v_progress.normalized_location, 100);

  if p_cursor is not null then
    v_cursor_time := p_cursor::timestamptz;
  end if;

  return (
    with eligible as (
      select
        cr.*,
        cp.username,
        cp.display_name,
        cp.avatar_url,
        case
          when v_progress.total_pages > 0
          then greatest(1, least(v_progress.total_pages, ceiling((cr.normalized_location / 100) * v_progress.total_pages)::integer))
          else null
        end as viewer_equivalent_page
      from public.circle_reactions cr
      join public.community_profiles cp on cp.user_id = cr.author_id
      where cr.circle_id = p_circle_id
        and cr.deleted_at is null
        and cr.normalized_location between v_min and v_max
        and (v_cursor_time is null or cr.created_at < v_cursor_time)
        and not public.community_has_block_between(v_viewer, cr.author_id)
      order by cr.created_at desc, cr.id
      limit v_limit + 1
    ),
    numbered as (
      select *, row_number() over (order by created_at desc, id) as rn
      from eligible
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(jsonb_build_object(
        'reactionId', id,
        'circleId', circle_id,
        'author', jsonb_build_object(
          'userId', author_id,
          'username', username,
          'displayName', display_name,
          'avatarUrl', avatar_url
        ),
        'content', content,
        'sourcePage', source_page,
        'sourceTotalPages', source_total_pages,
        'normalizedLocation', normalized_location,
        'viewerEquivalentPage', viewer_equivalent_page,
        'createdAt', created_at
      ) order by created_at desc) filter (where rn <= v_limit), '[]'::jsonb),
      'nextCursor', max(case when rn = v_limit + 1 then created_at::text end),
      'viewerProgressMissing', false
    )
    from numbered
  );
end;
$$;

create or replace function public.leave_reading_circle(p_circle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_was_owner boolean;
  v_new_owner uuid;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_member(p_circle_id, v_viewer) then
    raise exception 'not_circle_member' using errcode = 'P0001';
  end if;

  v_was_owner := public.circle_user_is_owner(p_circle_id, v_viewer);

  delete from public.circle_members
  where circle_id = p_circle_id
    and user_id = v_viewer;

  if v_was_owner then
    select user_id
    into v_new_owner
    from public.circle_members
    where circle_id = p_circle_id
    order by joined_at, user_id
    limit 1;

    if v_new_owner is null then
      update public.reading_circles
      set status = 'closed',
          updated_at = now()
      where id = p_circle_id;
    else
      update public.circle_members
      set role = 'owner'
      where circle_id = p_circle_id
        and user_id = v_new_owner;

      update public.reading_circles
      set owner_id = v_new_owner,
          updated_at = now()
      where id = p_circle_id;
    end if;
  end if;

  return jsonb_build_object('circleId', p_circle_id, 'left', true, 'newOwnerId', v_new_owner);
end;
$$;

create or replace function public.remove_reading_circle_member(
  p_circle_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_removed_count integer := 0;
  v_revoked_count integer := 0;
begin
  if v_viewer is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if not public.circle_user_is_owner(p_circle_id, v_viewer) then
    raise exception 'not_circle_owner' using errcode = 'P0001';
  end if;

  if p_user_id = v_viewer then
    raise exception 'use_leave_circle' using errcode = 'P0001';
  end if;

  delete from public.circle_members
  where circle_id = p_circle_id
    and user_id = p_user_id;
  get diagnostics v_removed_count = row_count;

  update public.circle_invitations
  set status = 'revoked',
      responded_at = now()
  where circle_id = p_circle_id
    and invited_user_id = p_user_id
    and status = 'pending';
  get diagnostics v_revoked_count = row_count;

  return jsonb_build_object(
    'circleId', p_circle_id,
    'userId', p_user_id,
    'removed', v_removed_count > 0,
    'revokedInvitation', v_revoked_count > 0
  );
end;
$$;

revoke execute on function public.circle_touch_updated_at() from public, anon;
revoke execute on function public.circle_user_is_member(uuid, uuid) from public, anon;
revoke execute on function public.circle_user_is_owner(uuid, uuid) from public, anon;
revoke execute on function public.circle_member_count(uuid) from public, anon;
revoke execute on function public.circle_users_can_share(uuid, uuid) from public, anon;
revoke execute on function public.circle_book_matches(uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.circle_progress_location(uuid, uuid) from public, anon;
revoke execute on function public.circle_members_have_block(uuid, uuid) from public, anon;
revoke execute on function public.circle_assert_member_insert() from public, anon;
revoke execute on function public.circle_block_cleanup_memberships() from public, anon;

revoke execute on function public.create_reading_circle(uuid, text, uuid[]) from public, anon;
revoke execute on function public.invite_reading_circle_members(uuid, uuid[]) from public, anon;
revoke execute on function public.respond_to_reading_circle_invitation(uuid, boolean) from public, anon;
revoke execute on function public.list_my_reading_circles(integer, text) from public, anon;
revoke execute on function public.get_reading_circle_detail(uuid) from public, anon;
revoke execute on function public.add_circle_reaction(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.get_visible_circle_reactions(uuid, numeric, numeric, integer, text) from public, anon;
revoke execute on function public.leave_reading_circle(uuid) from public, anon;
revoke execute on function public.remove_reading_circle_member(uuid, uuid) from public, anon;

grant execute on function public.circle_user_is_member(uuid, uuid) to authenticated;
grant execute on function public.circle_user_is_owner(uuid, uuid) to authenticated;
grant execute on function public.circle_member_count(uuid) to authenticated;
grant execute on function public.circle_progress_location(uuid, uuid) to authenticated;

grant execute on function public.create_reading_circle(uuid, text, uuid[]) to authenticated;
grant execute on function public.invite_reading_circle_members(uuid, uuid[]) to authenticated;
grant execute on function public.respond_to_reading_circle_invitation(uuid, boolean) to authenticated;
grant execute on function public.list_my_reading_circles(integer, text) to authenticated;
grant execute on function public.get_reading_circle_detail(uuid) to authenticated;
grant execute on function public.add_circle_reaction(uuid, uuid, integer, text) to authenticated;
grant execute on function public.get_visible_circle_reactions(uuid, numeric, numeric, integer, text) to authenticated;
grant execute on function public.leave_reading_circle(uuid) to authenticated;
grant execute on function public.remove_reading_circle_member(uuid, uuid) to authenticated;

comment on table public.reading_circles is 'Private invite-only reading circles centered on a book/work.';
comment on table public.circle_invitations is 'Pending and responded Reading Circle invitations. Pending invitations do not grant reaction access.';
comment on table public.circle_members is 'Accepted Reading Circle memberships. Membership controls circle detail and safe reaction access.';
comment on table public.circle_reactions is 'Short page/location-gated Reading Circle reactions. Read content through get_visible_circle_reactions.';
