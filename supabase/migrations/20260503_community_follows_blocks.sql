-- ============================================================================
-- File   : 20260503_community_follows_blocks.sql
-- Purpose: Asymmetric follow graph, durable counts, blocking, and reusable
--          community interaction RPCs.
-- ============================================================================

create table if not exists public.community_follow_counts (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint community_follow_counts_non_negative_chk
    check (followers_count >= 0 and following_count >= 0)
);

alter table public.community_follow_counts enable row level security;

drop policy if exists community_follow_counts_owner_select on public.community_follow_counts;
create policy community_follow_counts_owner_select on public.community_follow_counts
  for select
  using (user_id = (select auth.uid()));

create index if not exists community_follow_counts_followers_idx
  on public.community_follow_counts (followers_count desc, user_id);

create index if not exists community_follow_counts_following_idx
  on public.community_follow_counts (following_count desc, user_id);

create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc, following_id);

create index if not exists follows_following_created_idx
  on public.follows (following_id, created_at desc, follower_id);

create index if not exists blocks_blocker_created_idx
  on public.blocks (blocker_id, created_at desc, blocked_id);

create index if not exists blocks_blocked_created_idx
  on public.blocks (blocked_id, created_at desc, blocker_id);

create index if not exists community_profiles_public_username_created_idx
  on public.community_profiles (is_public, lower(username), created_at desc, user_id);

create index if not exists community_profiles_public_display_name_created_idx
  on public.community_profiles (is_public, lower(coalesce(display_name, '')), created_at desc, user_id);

create or replace function public.community_has_block_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_a is null or p_user_b is null then true
    else exists (
      select 1
      from public.blocks b
      where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
         or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
    )
  end
$$;

create or replace function public.community_can_view_profile(p_viewer uuid, p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_viewer is null or p_target is null then false
    when p_viewer = p_target then exists (
      select 1 from public.community_profiles cp where cp.user_id = p_target
    )
    when public.community_has_block_between(p_viewer, p_target) then false
    else exists (
      select 1
      from public.community_profiles cp
      where cp.user_id = p_target
        and cp.is_public = true
    )
  end
$$;

create or replace function public.community_interaction_reason(p_viewer uuid, p_target uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_viewer is null or p_target is null then 'profile_unavailable'
    when p_viewer = p_target then 'self'
    when public.community_has_block_between(p_viewer, p_target) then 'blocked'
    when not public.community_can_view_profile(p_viewer, p_target) then 'profile_unavailable'
    else 'allowed'
  end
$$;

create or replace function public.community_encode_cursor(p_created_at timestamptz, p_user_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select encode(
    convert_to(
      jsonb_build_object('createdAt', p_created_at, 'userId', p_user_id)::text,
      'utf8'
    ),
    'base64'
  )
$$;

create or replace function public.community_cursor_payload(p_cursor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  if nullif(trim(coalesce(p_cursor, '')), '') is null then
    return null;
  end if;

  return convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
exception
  when others then
    return null;
end;
$$;

create or replace function public.community_relationship_payload(p_viewer uuid, p_target uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with reason as (
    select public.community_interaction_reason(p_viewer, p_target) as value
  ),
  counts as (
    select
      coalesce(cfc.followers_count, 0) as followers_count,
      coalesce(cfc.following_count, 0) as following_count
    from public.community_profiles cp
    left join public.community_follow_counts cfc
      on cfc.user_id = cp.user_id
    where cp.user_id = p_target
  )
  select jsonb_build_object(
    'targetUserId', p_target,
    'isFollowing', exists (
      select 1
      from public.follows f
      where f.follower_id = p_viewer
        and f.following_id = p_target
    ),
    'followsViewer', exists (
      select 1
      from public.follows f
      where f.follower_id = p_target
        and f.following_id = p_viewer
    ),
    'isBlockedByViewer', exists (
      select 1
      from public.blocks b
      where b.blocker_id = p_viewer
        and b.blocked_id = p_target
    ),
    'hasBlockedViewer', exists (
      select 1
      from public.blocks b
      where b.blocker_id = p_target
        and b.blocked_id = p_viewer
    ),
    'followersCount', case when reason.value in ('allowed', 'self') then coalesce(counts.followers_count, 0) else 0 end,
    'followingCount', case when reason.value in ('allowed', 'self') then coalesce(counts.following_count, 0) else 0 end,
    'canInteract', reason.value = 'allowed',
    'reason', reason.value
  )
  from reason
  left join counts on true
$$;

create or replace function public.community_ensure_follow_count(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.community_follow_counts (user_id, followers_count, following_count)
  select p_user_id, 0, 0
  where p_user_id is not null
    and exists (
      select 1
      from public.community_profiles cp
      where cp.user_id = p_user_id
    )
  on conflict (user_id) do nothing
$$;

create or replace function public.community_follow_counts_after_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.community_ensure_follow_count(new.follower_id);
    perform public.community_ensure_follow_count(new.following_id);

    update public.community_follow_counts
    set following_count = following_count + 1,
        updated_at = now()
    where user_id = new.follower_id;

    update public.community_follow_counts
    set followers_count = followers_count + 1,
        updated_at = now()
    where user_id = new.following_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.community_follow_counts
    set following_count = greatest(following_count - 1, 0),
        updated_at = now()
    where user_id = old.follower_id;

    update public.community_follow_counts
    set followers_count = greatest(followers_count - 1, 0),
        updated_at = now()
    where user_id = old.following_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists community_follow_counts_after_follow_insert on public.follows;
create trigger community_follow_counts_after_follow_insert
after insert on public.follows
for each row execute function public.community_follow_counts_after_follow();

drop trigger if exists community_follow_counts_after_follow_delete on public.follows;
create trigger community_follow_counts_after_follow_delete
after delete on public.follows
for each row execute function public.community_follow_counts_after_follow();

create or replace function public.community_ensure_count_on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.community_ensure_follow_count(new.user_id);
  return new;
end;
$$;

drop trigger if exists community_ensure_count_on_profile_insert on public.community_profiles;
create trigger community_ensure_count_on_profile_insert
after insert on public.community_profiles
for each row execute function public.community_ensure_count_on_profile_insert();

create or replace function public.community_reconcile_follow_counts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.community_follow_counts (user_id, followers_count, following_count)
  select cp.user_id, 0, 0
  from public.community_profiles cp
  on conflict (user_id) do nothing;

  update public.community_follow_counts cfc
  set followers_count = coalesce(src.followers_count, 0),
      following_count = coalesce(src.following_count, 0),
      updated_at = now()
  from (
    select
      cp.user_id,
      coalesce(f_in.followers_count, 0)::integer as followers_count,
      coalesce(f_out.following_count, 0)::integer as following_count
    from public.community_profiles cp
    left join (
      select following_id as user_id, count(*) as followers_count
      from public.follows
      group by following_id
    ) f_in on f_in.user_id = cp.user_id
    left join (
      select follower_id as user_id, count(*) as following_count
      from public.follows
      group by follower_id
    ) f_out on f_out.user_id = cp.user_id
  ) src
  where cfc.user_id = src.user_id;
end;
$$;

select public.community_reconcile_follow_counts();

create or replace function public.community_remove_pair_follows(p_user_a uuid, p_user_b uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with removed as (
    delete from public.follows f
    where (f.follower_id = p_user_a and f.following_id = p_user_b)
       or (f.follower_id = p_user_b and f.following_id = p_user_a)
    returning 1
  )
  select count(*)::integer into v_deleted from removed;

  return coalesce(v_deleted, 0);
end;
$$;

create or replace function public.community_block_cleanup_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.community_remove_pair_follows(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

drop trigger if exists community_block_cleanup_follows on public.blocks;
create trigger community_block_cleanup_follows
after insert on public.blocks
for each row execute function public.community_block_cleanup_follows();

create or replace function public.get_community_relationship_state(p_target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select auth.uid()) is null then null
    else public.community_relationship_payload((select auth.uid()), p_target_user_id)
  end
$$;

create or replace function public.follow_community_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_reason text;
  v_row_count integer := 0;
begin
  if v_viewer is null then
    raise exception 'not_authenticated';
  end if;

  v_reason := public.community_interaction_reason(v_viewer, p_target_user_id);
  if v_reason <> 'allowed' then
    return public.community_relationship_payload(v_viewer, p_target_user_id)
      || jsonb_build_object('changed', false);
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_viewer, p_target_user_id)
  on conflict do nothing;

  get diagnostics v_row_count = row_count;

  return public.community_relationship_payload(v_viewer, p_target_user_id)
    || jsonb_build_object('changed', v_row_count > 0);
end;
$$;

create or replace function public.unfollow_community_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_row_count integer := 0;
begin
  if v_viewer is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.follows f
  where f.follower_id = v_viewer
    and f.following_id = p_target_user_id;

  get diagnostics v_row_count = row_count;

  return public.community_relationship_payload(v_viewer, p_target_user_id)
    || jsonb_build_object('changed', v_row_count > 0);
end;
$$;

create or replace function public.search_community_readers(
  p_query text,
  p_limit int default 20,
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
  v_query text := lower(trim(coalesce(p_query, '')));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor jsonb := public.community_cursor_payload(p_cursor);
  v_cursor_created_at timestamptz := nullif(v_cursor->>'createdAt', '')::timestamptz;
  v_cursor_user_id uuid := nullif(v_cursor->>'userId', '')::uuid;
  v_items jsonb;
  v_next_cursor text;
begin
  if v_viewer is null then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null);
  end if;

  if char_length(v_query) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null);
  end if;

  with candidates as (
    select
      cp.user_id,
      cp.username,
      cp.display_name,
      cp.bio,
      cp.avatar_url,
      cp.created_at,
      coalesce(cfc.followers_count, 0) as followers_count,
      coalesce(cfc.following_count, 0) as following_count,
      exists (
        select 1 from public.follows f
        where f.follower_id = v_viewer and f.following_id = cp.user_id
      ) as is_following,
      exists (
        select 1 from public.follows f
        where f.follower_id = cp.user_id and f.following_id = v_viewer
      ) as follows_viewer
    from public.community_profiles cp
    left join public.community_follow_counts cfc
      on cfc.user_id = cp.user_id
    where cp.user_id <> v_viewer
      and cp.is_public = true
      and not public.community_has_block_between(v_viewer, cp.user_id)
      and (
        lower(cp.username) like v_query || '%'
        or lower(coalesce(cp.display_name, '')) like v_query || '%'
      )
      and (
        v_cursor is null
        or (cp.created_at, cp.user_id) < (v_cursor_created_at, v_cursor_user_id)
      )
    order by cp.created_at desc, cp.user_id desc
    limit v_limit + 1
  ),
  limited as (
    select * from candidates limit v_limit
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'username', username,
        'displayName', display_name,
        'bio', bio,
        'avatarUrl', avatar_url,
        'isFollowing', is_following,
        'followsViewer', follows_viewer,
        'followersCount', followers_count,
        'followingCount', following_count
      )
      order by created_at desc, user_id desc
    ), '[]'::jsonb),
    case
      when (select count(*) from candidates) > v_limit
      then (
        select public.community_encode_cursor(created_at, user_id)
        from limited
        order by created_at asc, user_id asc
        limit 1
      )
      else null
    end
  into v_items, v_next_cursor
  from limited;

  return jsonb_build_object('items', v_items, 'nextCursor', v_next_cursor);
end;
$$;

create or replace function public.list_community_followers(
  p_user_id uuid,
  p_limit int default 20,
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
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor jsonb := public.community_cursor_payload(p_cursor);
  v_cursor_created_at timestamptz := nullif(v_cursor->>'createdAt', '')::timestamptz;
  v_cursor_user_id uuid := nullif(v_cursor->>'userId', '')::uuid;
  v_items jsonb;
  v_next_cursor text;
begin
  if v_viewer is null or not public.community_can_view_profile(v_viewer, p_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null);
  end if;

  with candidates as (
    select
      cp.user_id,
      cp.username,
      cp.display_name,
      cp.avatar_url,
      f.created_at as followed_at,
      exists (
        select 1 from public.follows vf
        where vf.follower_id = v_viewer and vf.following_id = cp.user_id
      ) as is_following
    from public.follows f
    join public.community_profiles cp
      on cp.user_id = f.follower_id
    where f.following_id = p_user_id
      and cp.is_public = true
      and not public.community_has_block_between(v_viewer, cp.user_id)
      and (
        v_cursor is null
        or (f.created_at, cp.user_id) < (v_cursor_created_at, v_cursor_user_id)
      )
    order by f.created_at desc, cp.user_id desc
    limit v_limit + 1
  ),
  limited as (
    select * from candidates limit v_limit
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'username', username,
        'displayName', display_name,
        'avatarUrl', avatar_url,
        'followedAt', followed_at,
        'isFollowing', is_following
      )
      order by followed_at desc, user_id desc
    ), '[]'::jsonb),
    case
      when (select count(*) from candidates) > v_limit
      then (
        select public.community_encode_cursor(followed_at, user_id)
        from limited
        order by followed_at asc, user_id asc
        limit 1
      )
      else null
    end
  into v_items, v_next_cursor
  from limited;

  return jsonb_build_object('items', v_items, 'nextCursor', v_next_cursor);
end;
$$;

create or replace function public.list_community_following(
  p_user_id uuid,
  p_limit int default 20,
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
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor jsonb := public.community_cursor_payload(p_cursor);
  v_cursor_created_at timestamptz := nullif(v_cursor->>'createdAt', '')::timestamptz;
  v_cursor_user_id uuid := nullif(v_cursor->>'userId', '')::uuid;
  v_items jsonb;
  v_next_cursor text;
begin
  if v_viewer is null or not public.community_can_view_profile(v_viewer, p_user_id) then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null);
  end if;

  with candidates as (
    select
      cp.user_id,
      cp.username,
      cp.display_name,
      cp.avatar_url,
      f.created_at as followed_at,
      exists (
        select 1 from public.follows vf
        where vf.follower_id = v_viewer and vf.following_id = cp.user_id
      ) as is_following
    from public.follows f
    join public.community_profiles cp
      on cp.user_id = f.following_id
    where f.follower_id = p_user_id
      and cp.is_public = true
      and not public.community_has_block_between(v_viewer, cp.user_id)
      and (
        v_cursor is null
        or (f.created_at, cp.user_id) < (v_cursor_created_at, v_cursor_user_id)
      )
    order by f.created_at desc, cp.user_id desc
    limit v_limit + 1
  ),
  limited as (
    select * from candidates limit v_limit
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'username', username,
        'displayName', display_name,
        'avatarUrl', avatar_url,
        'followedAt', followed_at,
        'isFollowing', is_following
      )
      order by followed_at desc, user_id desc
    ), '[]'::jsonb),
    case
      when (select count(*) from candidates) > v_limit
      then (
        select public.community_encode_cursor(followed_at, user_id)
        from limited
        order by followed_at asc, user_id asc
        limit 1
      )
      else null
    end
  into v_items, v_next_cursor
  from limited;

  return jsonb_build_object('items', v_items, 'nextCursor', v_next_cursor);
end;
$$;

create or replace function public.block_community_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_row_count integer := 0;
  v_removed integer := 0;
begin
  if v_viewer is null then
    raise exception 'not_authenticated';
  end if;

  if v_viewer = p_target_user_id then
    return jsonb_build_object(
      'targetUserId', p_target_user_id,
      'isBlockedByViewer', false,
      'removedFollowsCount', 0,
      'changed', false,
      'reason', 'self'
    );
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_viewer, p_target_user_id)
  on conflict do nothing;

  get diagnostics v_row_count = row_count;
  v_removed := public.community_remove_pair_follows(v_viewer, p_target_user_id);

  return jsonb_build_object(
    'targetUserId', p_target_user_id,
    'isBlockedByViewer', true,
    'removedFollowsCount', v_removed,
    'changed', v_row_count > 0
  );
end;
$$;

create or replace function public.unblock_community_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_row_count integer := 0;
begin
  if v_viewer is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.blocks b
  where b.blocker_id = v_viewer
    and b.blocked_id = p_target_user_id;

  get diagnostics v_row_count = row_count;

  return jsonb_build_object(
    'targetUserId', p_target_user_id,
    'isBlockedByViewer', false,
    'changed', v_row_count > 0
  );
end;
$$;

create or replace function public.list_my_blocked_users(
  p_limit int default 20,
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
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor jsonb := public.community_cursor_payload(p_cursor);
  v_cursor_created_at timestamptz := nullif(v_cursor->>'createdAt', '')::timestamptz;
  v_cursor_user_id uuid := nullif(v_cursor->>'userId', '')::uuid;
  v_items jsonb;
  v_next_cursor text;
begin
  if v_viewer is null then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null);
  end if;

  with candidates as (
    select
      b.blocked_id as user_id,
      cp.username,
      cp.display_name,
      cp.avatar_url,
      b.created_at as blocked_at
    from public.blocks b
    left join public.community_profiles cp
      on cp.user_id = b.blocked_id
    where b.blocker_id = v_viewer
      and (
        v_cursor is null
        or (b.created_at, b.blocked_id) < (v_cursor_created_at, v_cursor_user_id)
      )
    order by b.created_at desc, b.blocked_id desc
    limit v_limit + 1
  ),
  limited as (
    select * from candidates limit v_limit
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'userId', user_id,
        'username', username,
        'displayName', display_name,
        'avatarUrl', avatar_url,
        'blockedAt', blocked_at
      )
      order by blocked_at desc, user_id desc
    ), '[]'::jsonb),
    case
      when (select count(*) from candidates) > v_limit
      then (
        select public.community_encode_cursor(blocked_at, user_id)
        from limited
        order by blocked_at asc, user_id asc
        limit 1
      )
      else null
    end
  into v_items, v_next_cursor
  from limited;

  return jsonb_build_object('items', v_items, 'nextCursor', v_next_cursor);
end;
$$;

create or replace function public.can_community_users_interact(p_target_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select auth.uid()) is null then null
    else jsonb_build_object(
      'targetUserId', p_target_user_id,
      'allowed', public.community_interaction_reason((select auth.uid()), p_target_user_id) = 'allowed',
      'reason', public.community_interaction_reason((select auth.uid()), p_target_user_id)
    )
  end
$$;

revoke execute on function public.community_has_block_between(uuid, uuid) from public, anon;
grant execute on function public.community_has_block_between(uuid, uuid) to authenticated;

revoke execute on function public.community_can_view_profile(uuid, uuid) from public, anon;
grant execute on function public.community_can_view_profile(uuid, uuid) to authenticated;

revoke execute on function public.community_interaction_reason(uuid, uuid) from public, anon;
grant execute on function public.community_interaction_reason(uuid, uuid) to authenticated;

revoke execute on function public.community_relationship_payload(uuid, uuid) from public, anon;
grant execute on function public.community_relationship_payload(uuid, uuid) to authenticated;

revoke execute on function public.community_reconcile_follow_counts() from public, anon;
grant execute on function public.community_reconcile_follow_counts() to authenticated;

revoke execute on function public.get_community_relationship_state(uuid) from public, anon;
grant execute on function public.get_community_relationship_state(uuid) to authenticated;

revoke execute on function public.follow_community_user(uuid) from public, anon;
grant execute on function public.follow_community_user(uuid) to authenticated;

revoke execute on function public.unfollow_community_user(uuid) from public, anon;
grant execute on function public.unfollow_community_user(uuid) to authenticated;

revoke execute on function public.search_community_readers(text, int, text) from public, anon;
grant execute on function public.search_community_readers(text, int, text) to authenticated;

revoke execute on function public.list_community_followers(uuid, int, text) from public, anon;
grant execute on function public.list_community_followers(uuid, int, text) to authenticated;

revoke execute on function public.list_community_following(uuid, int, text) from public, anon;
grant execute on function public.list_community_following(uuid, int, text) to authenticated;

revoke execute on function public.block_community_user(uuid) from public, anon;
grant execute on function public.block_community_user(uuid) to authenticated;

revoke execute on function public.unblock_community_user(uuid) from public, anon;
grant execute on function public.unblock_community_user(uuid) to authenticated;

revoke execute on function public.list_my_blocked_users(int, text) from public, anon;
grant execute on function public.list_my_blocked_users(int, text) to authenticated;

revoke execute on function public.can_community_users_interact(uuid) from public, anon;
grant execute on function public.can_community_users_interact(uuid) to authenticated;
