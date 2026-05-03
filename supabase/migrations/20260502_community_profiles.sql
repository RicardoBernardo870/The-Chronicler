-- ============================================================================
-- File   : 20260502_community_profiles.sql
-- Purpose: Public reader profiles with granular server-enforced privacy.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'profile_visibility'
      and n.nspname = 'public'
  ) then
    create type public.profile_visibility as enum ('everyone', 'followers', 'nobody');
  end if;
end $$;

create table if not exists public.community_profiles (
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

create unique index if not exists community_profiles_username_lower_uidx
  on public.community_profiles (lower(username));

create index if not exists community_profiles_public_username_idx
  on public.community_profiles (username)
  where is_public = true;

create table if not exists public.community_profile_privacy (
  user_id uuid primary key references public.community_profiles(user_id) on delete cascade,
  progress_visibility public.profile_visibility not null default 'nobody',
  currently_reading_visibility public.profile_visibility not null default 'nobody',
  lexicon_visibility public.profile_visibility not null default 'nobody',
  reader_dna_visibility public.profile_visibility not null default 'nobody',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_chk check (follower_id <> following_id)
);

create index if not exists follows_following_follower_idx
  on public.follows (following_id, follower_id);

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_chk check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_blocker_idx
  on public.blocks (blocked_id, blocker_id);

create index if not exists reading_progress_user_updated_at_idx
  on public.reading_progress (user_id, updated_at desc);

create index if not exists lexicon_entries_user_leitner_created_idx
  on public.lexicon_entries (user_id, leitner_box, created_at desc);

alter table public.community_profiles enable row level security;
alter table public.community_profile_privacy enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;

drop policy if exists community_profiles_owner_select on public.community_profiles;
create policy community_profiles_owner_select on public.community_profiles
  for select
  using (user_id = (select auth.uid()));

drop policy if exists community_profiles_owner_insert on public.community_profiles;
create policy community_profiles_owner_insert on public.community_profiles
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists community_profiles_owner_update on public.community_profiles;
create policy community_profiles_owner_update on public.community_profiles
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists community_profiles_owner_delete on public.community_profiles;
create policy community_profiles_owner_delete on public.community_profiles
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists community_profile_privacy_owner_select on public.community_profile_privacy;
create policy community_profile_privacy_owner_select on public.community_profile_privacy
  for select
  using (user_id = (select auth.uid()));

drop policy if exists community_profile_privacy_owner_insert on public.community_profile_privacy;
create policy community_profile_privacy_owner_insert on public.community_profile_privacy
  for insert
  with check (user_id = (select auth.uid()));

drop policy if exists community_profile_privacy_owner_update on public.community_profile_privacy;
create policy community_profile_privacy_owner_update on public.community_profile_privacy
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists follows_participant_select on public.follows;
create policy follows_participant_select on public.follows
  for select
  using (
    follower_id = (select auth.uid())
    or following_id = (select auth.uid())
  );

drop policy if exists follows_follower_insert on public.follows;
create policy follows_follower_insert on public.follows
  for insert
  with check (follower_id = (select auth.uid()));

drop policy if exists follows_follower_delete on public.follows;
create policy follows_follower_delete on public.follows
  for delete
  using (follower_id = (select auth.uid()));

drop policy if exists blocks_participant_select on public.blocks;
create policy blocks_participant_select on public.blocks
  for select
  using (
    blocker_id = (select auth.uid())
    or blocked_id = (select auth.uid())
  );

drop policy if exists blocks_blocker_insert on public.blocks;
create policy blocks_blocker_insert on public.blocks
  for insert
  with check (blocker_id = (select auth.uid()));

drop policy if exists blocks_blocker_delete on public.blocks;
create policy blocks_blocker_delete on public.blocks
  for delete
  using (blocker_id = (select auth.uid()));

create or replace function public.community_profiles_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists community_profiles_touch_updated_at on public.community_profiles;
create trigger community_profiles_touch_updated_at
before update on public.community_profiles
for each row execute function public.community_profiles_touch_updated_at();

drop trigger if exists community_profile_privacy_touch_updated_at on public.community_profile_privacy;
create trigger community_profile_privacy_touch_updated_at
before update on public.community_profile_privacy
for each row execute function public.community_profiles_touch_updated_at();

create or replace function public.get_my_community_profile()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select auth.uid()) is null then null
    else (
      select jsonb_build_object(
        'profile', jsonb_build_object(
          'userId', cp.user_id,
          'username', cp.username,
          'displayName', cp.display_name,
          'bio', cp.bio,
          'avatarUrl', cp.avatar_url,
          'isPublic', cp.is_public,
          'createdAt', cp.created_at,
          'updatedAt', cp.updated_at
        ),
        'privacy', jsonb_build_object(
          'progress', cpp.progress_visibility,
          'currentlyReading', cpp.currently_reading_visibility,
          'lexicon', cpp.lexicon_visibility,
          'readerDna', cpp.reader_dna_visibility
        )
      )
      from public.community_profiles cp
      join public.community_profile_privacy cpp
        on cpp.user_id = cp.user_id
      where cp.user_id = (select auth.uid())
    )
  end
$$;

create or replace function public.is_username_available(p_username text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with normalized as (
    select lower(trim(coalesce(p_username, ''))) as username
  )
  select jsonb_build_object(
    'available',
      case
        when (select auth.uid()) is null then false
        when n.username !~ '^[a-z0-9_-]{3,30}$' then false
        when n.username in ('admin', 'api', 'auth', 'bookhero', 'login', 'profile', 'u') then false
        else not exists (
          select 1
          from public.community_profiles cp
          where lower(cp.username) = n.username
            and cp.user_id <> (select auth.uid())
        )
      end,
    'normalizedUsername', n.username
  )
  from normalized n
$$;

create or replace function public.upsert_my_community_profile(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_username text := lower(trim(coalesce(payload->>'username', '')));
  v_display_name text := nullif(trim(coalesce(payload->>'displayName', '')), '');
  v_bio text := nullif(trim(coalesce(payload->>'bio', '')), '');
  v_avatar_url text := nullif(trim(coalesce(payload->>'avatarUrl', '')), '');
  v_is_public boolean := coalesce((payload->>'isPublic')::boolean, true);
  v_progress_text text := coalesce(payload #>> '{privacy,progress}', 'nobody');
  v_currently_reading_text text := coalesce(payload #>> '{privacy,currentlyReading}', 'nobody');
  v_lexicon_text text := coalesce(payload #>> '{privacy,lexicon}', 'nobody');
  v_reader_dna_text text := coalesce(payload #>> '{privacy,readerDna}', 'nobody');
  v_progress public.profile_visibility;
  v_currently_reading public.profile_visibility;
  v_lexicon public.profile_visibility;
  v_reader_dna public.profile_visibility;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if v_username !~ '^[a-z0-9_-]{3,30}$'
     or v_username in ('admin', 'api', 'auth', 'bookhero', 'login', 'profile', 'u') then
    raise exception 'username_invalid';
  end if;

  if v_bio is not null and char_length(v_bio) > 160 then
    raise exception 'bio_too_long';
  end if;

  if v_progress_text not in ('everyone', 'followers', 'nobody')
     or v_currently_reading_text not in ('everyone', 'followers', 'nobody')
     or v_lexicon_text not in ('everyone', 'followers', 'nobody')
     or v_reader_dna_text not in ('everyone', 'followers', 'nobody') then
    raise exception 'visibility_invalid';
  end if;

  v_progress := v_progress_text::public.profile_visibility;
  v_currently_reading := v_currently_reading_text::public.profile_visibility;
  v_lexicon := v_lexicon_text::public.profile_visibility;
  v_reader_dna := v_reader_dna_text::public.profile_visibility;

  if exists (
    select 1
    from public.community_profiles cp
    where lower(cp.username) = v_username
      and cp.user_id <> v_uid
  ) then
    raise exception 'username_taken';
  end if;

  insert into public.community_profiles (
    user_id,
    username,
    display_name,
    bio,
    avatar_url,
    is_public
  )
  values (
    v_uid,
    v_username,
    v_display_name,
    v_bio,
    v_avatar_url,
    v_is_public
  )
  on conflict (user_id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        bio = excluded.bio,
        avatar_url = excluded.avatar_url,
        is_public = excluded.is_public;

  insert into public.community_profile_privacy (
    user_id,
    progress_visibility,
    currently_reading_visibility,
    lexicon_visibility,
    reader_dna_visibility
  )
  values (
    v_uid,
    v_progress,
    v_currently_reading,
    v_lexicon,
    v_reader_dna
  )
  on conflict (user_id) do update
    set progress_visibility = excluded.progress_visibility,
        currently_reading_visibility = excluded.currently_reading_visibility,
        lexicon_visibility = excluded.lexicon_visibility,
        reader_dna_visibility = excluded.reader_dna_visibility;

  return public.get_my_community_profile();
exception
  when invalid_text_representation then
    raise exception 'visibility_invalid';
  when unique_violation then
    raise exception 'username_taken';
end;
$$;

create or replace function public.get_public_profile_by_username(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer uuid := (select auth.uid());
  v_username text := lower(trim(coalesce(p_username, '')));
  v_owner uuid;
  v_is_owner boolean := false;
  v_is_follower boolean := false;
  v_blocked boolean := false;
  v_profile public.community_profiles%rowtype;
  v_privacy public.community_profile_privacy%rowtype;
  v_payload jsonb;
  v_stats jsonb;
  v_currently_reading jsonb;
  v_lexicon jsonb;
  v_dna jsonb;
begin
  if v_viewer is null then
    return null;
  end if;

  select *
  into v_profile
  from public.community_profiles cp
  where cp.username = v_username
  limit 1;

  if not found then
    return null;
  end if;

  v_owner := v_profile.user_id;
  v_is_owner := v_owner = v_viewer;

  select *
  into v_privacy
  from public.community_profile_privacy cpp
  where cpp.user_id = v_owner;

  if not found then
    return null;
  end if;

  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = v_viewer and b.blocked_id = v_owner)
       or (b.blocker_id = v_owner and b.blocked_id = v_viewer)
  )
  into v_blocked;

  if v_blocked then
    return null;
  end if;

  if not v_is_owner and not v_profile.is_public then
    return null;
  end if;

  select exists (
    select 1
    from public.follows f
    where f.follower_id = v_viewer
      and f.following_id = v_owner
  )
  into v_is_follower;

  v_payload := jsonb_build_object(
    'profile', jsonb_build_object(
      'userId', v_profile.user_id,
      'username', v_profile.username,
      'displayName', v_profile.display_name,
      'bio', v_profile.bio,
      'avatarUrl', v_profile.avatar_url
    )
  );

  if v_is_owner
     or v_privacy.progress_visibility = 'everyone'
     or (v_privacy.progress_visibility = 'followers' and v_is_follower) then
    with
    reading_days as (
      select distinct date(ph.recorded_at) as day
      from public.progress_history ph
      where ph.user_id = v_owner
    ),
    streak_base as (
      select day, day - lag(day) over (order by day) - 1 as gap_before
      from reading_days
    ),
    streak_groups as (
      select
        day,
        sum(case when gap_before > 0 or gap_before is null then 1 else 0 end)
          over (order by day) as grp
      from streak_base
    ),
    streak_lengths as (
      select grp, count(*) as len, max(day) as last_day
      from streak_groups
      group by grp
    )
    select jsonb_build_object(
      'booksRead',
        coalesce((
          select count(*)
          from public.books b
          join public.reading_progress rp
            on rp.book_id = b.id
           and rp.user_id = v_owner
          where b.user_id = v_owner
            and b.total_pages > 0
            and rp.current_page >= b.total_pages
        ), 0),
      'totalPagesRead',
        coalesce((
          select sum(least(greatest(rp.current_page, 0), b.total_pages))
          from public.reading_progress rp
          join public.books b
            on b.id = rp.book_id
           and b.user_id = v_owner
          where rp.user_id = v_owner
            and b.total_pages > 0
        ), 0),
      'currentStreakDays',
        coalesce((
          select len
          from streak_lengths
          where last_day = current_date
             or last_day = current_date - 1
          order by last_day desc
          limit 1
        ), 0),
      'longestStreakDays',
        coalesce((select max(len) from streak_lengths), 0)
    )
    into v_stats;

    v_payload := v_payload || jsonb_build_object('stats', v_stats);
  end if;

  if v_is_owner
     or v_privacy.currently_reading_visibility = 'everyone'
     or (v_privacy.currently_reading_visibility = 'followers' and v_is_follower) then
    select jsonb_build_object(
      'bookId', b.id,
      'title', b.title,
      'author', b.author,
      'coverUrl', b.cover_url,
      'currentPage', rp.current_page,
      'totalPages', b.total_pages,
      'percentage',
        case
          when b.total_pages > 0
          then least(100, round((rp.current_page::numeric / b.total_pages) * 100, 2))
          else 0
        end
    )
    into v_currently_reading
    from public.reading_progress rp
    join public.books b
      on b.id = rp.book_id
     and b.user_id = v_owner
    where rp.user_id = v_owner
      and b.total_pages > 0
      and rp.current_page > 0
      and rp.current_page < b.total_pages
    order by rp.updated_at desc
    limit 1;

    if v_currently_reading is not null then
      v_payload := v_payload || jsonb_build_object('currentlyReading', v_currently_reading);
    end if;
  end if;

  if v_is_owner
     or v_privacy.lexicon_visibility = 'everyone'
     or (v_privacy.lexicon_visibility = 'followers' and v_is_follower) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'term', le.term,
          'bookTitle', b.title,
          'masteredAt', le.created_at
        )
        order by le.created_at desc
      ),
      '[]'::jsonb
    )
    into v_lexicon
    from (
      select *
      from public.lexicon_entries
      where user_id = v_owner
        and leitner_box >= 5
      order by created_at desc
      limit 6
    ) le
    left join public.books b
      on b.id = le.book_id;

    if jsonb_array_length(v_lexicon) > 0 then
      v_payload := v_payload || jsonb_build_object('lexiconHighlights', v_lexicon);
    end if;
  end if;

  if v_is_owner
     or v_privacy.reader_dna_visibility = 'everyone'
     or (v_privacy.reader_dna_visibility = 'followers' and v_is_follower) then
    select jsonb_build_object(
      'personality', rd.personality,
      'moodTone', rd.mood_tone,
      'moodEmojis', coalesce(to_jsonb(rd.mood_emojis), '[]'::jsonb)
    )
    into v_dna
    from public.reading_dna rd
    where rd.user_id = v_owner;

    if v_dna is not null then
      v_payload := v_payload || jsonb_build_object('readerDna', v_dna);
    end if;
  end if;

  return v_payload;
end;
$$;

revoke execute on function public.get_my_community_profile() from public;
revoke execute on function public.get_my_community_profile() from anon;
grant execute on function public.get_my_community_profile() to authenticated;

revoke execute on function public.upsert_my_community_profile(jsonb) from public;
revoke execute on function public.upsert_my_community_profile(jsonb) from anon;
grant execute on function public.upsert_my_community_profile(jsonb) to authenticated;

revoke execute on function public.is_username_available(text) from public;
revoke execute on function public.is_username_available(text) from anon;
grant execute on function public.is_username_available(text) to authenticated;

revoke execute on function public.get_public_profile_by_username(text) from public;
revoke execute on function public.get_public_profile_by_username(text) from anon;
grant execute on function public.get_public_profile_by_username(text) to authenticated;
