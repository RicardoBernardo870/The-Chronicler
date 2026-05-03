-- ============================================================================
-- File   : 20260503_also_reading_card.sql
-- Purpose: Stable read contract for Book Detail "Also Reading" community card.
-- ============================================================================

create or replace function public.normalize_isbn(p_isbn text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(upper(regexp_replace(coalesce(p_isbn, ''), '[^0-9X]', '', 'g')), '')
$$;

create index if not exists reading_progress_user_book_active_idx
  on public.reading_progress (user_id, book_id, updated_at desc)
  where current_page > 0;

create index if not exists books_user_id_id_idx
  on public.books (user_id, id);

create index if not exists books_normalized_isbn_user_idx
  on public.books (public.normalize_isbn(isbn), user_id, id)
  where isbn is not null;

create or replace function public.also_reading_encode_cursor(
  p_updated_at timestamptz,
  p_user_id uuid
)
returns text
language sql
stable
set search_path = public
as $$
  select encode(
    convert_to(
      jsonb_build_object('updatedAt', p_updated_at, 'userId', p_user_id)::text,
      'utf8'
    ),
    'base64'
  )
$$;

create or replace function public.also_reading_cursor_payload(p_cursor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_payload jsonb;
begin
  if p_cursor is null or btrim(p_cursor) = '' then
    return null;
  end if;

  begin
    v_payload := convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
  exception
    when others then
      raise exception 'invalid_cursor';
  end;

  if not (v_payload ? 'updatedAt') or not (v_payload ? 'userId') then
    raise exception 'invalid_cursor';
  end if;

  perform (v_payload->>'updatedAt')::timestamptz;
  perform (v_payload->>'userId')::uuid;

  return v_payload;
exception
  when invalid_datetime_format or invalid_text_representation then
    raise exception 'invalid_cursor';
end;
$$;

create or replace function public.get_also_reading_for_book(
  p_book_id uuid,
  p_isbn text default null,
  p_limit int default 3,
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
  v_limit int := least(greatest(coalesce(p_limit, 3), 1), 20);
  v_cursor jsonb := public.also_reading_cursor_payload(p_cursor);
  v_cursor_updated_at timestamptz;
  v_cursor_user_id uuid;
  v_viewed_book public.books%rowtype;
  v_viewed_isbn text;
  v_viewer_percentage numeric;
  v_items jsonb := '[]'::jsonb;
  v_total_visible int := 0;
  v_next_cursor text;
begin
  if v_viewer is null then
    raise exception 'not_authenticated';
  end if;

  if p_book_id is null then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'totalVisible', 0);
  end if;

  if v_cursor is not null then
    v_cursor_updated_at := (v_cursor->>'updatedAt')::timestamptz;
    v_cursor_user_id := (v_cursor->>'userId')::uuid;
  end if;

  select *
  into v_viewed_book
  from public.books b
  where b.id = p_book_id
    and b.user_id = v_viewer;

  if not found then
    return jsonb_build_object('items', '[]'::jsonb, 'nextCursor', null, 'totalVisible', 0);
  end if;

  v_viewed_isbn := public.normalize_isbn(coalesce(nullif(btrim(p_isbn), ''), v_viewed_book.isbn));

  select case
    when v_viewed_book.total_pages > 0
    then least(100, round((rp.current_page::numeric / v_viewed_book.total_pages) * 100, 2))
    else null
  end
  into v_viewer_percentage
  from public.reading_progress rp
  where rp.user_id = v_viewer
    and rp.book_id = p_book_id
  limit 1;

  with candidate_matches as (
    select
      f.following_id as user_id,
      cp.username,
      cp.display_name,
      cp.avatar_url,
      rp.book_id as matched_book_id,
      public.normalize_isbn(cb.isbn) as matched_isbn,
      rp.current_page,
      cb.total_pages,
      case
        when cb.total_pages > 0
        then least(100, round((rp.current_page::numeric / cb.total_pages) * 100, 2))
        else null
      end as percentage,
      rp.updated_at,
      case when rp.book_id = p_book_id then 'same_book' else 'same_isbn' end as match_type,
      case when rp.book_id = p_book_id then 0 else 1 end as match_rank,
      (
        cpp.progress_visibility = 'everyone'
        or cpp.progress_visibility = 'followers'
      ) as can_show_progress
    from public.follows f
    join public.community_profiles cp
      on cp.user_id = f.following_id
    join public.community_profile_privacy cpp
      on cpp.user_id = f.following_id
    join public.reading_progress rp
      on rp.user_id = f.following_id
    join public.books cb
      on cb.id = rp.book_id
     and cb.user_id = f.following_id
    where f.follower_id = v_viewer
      and public.community_can_view_profile(v_viewer, f.following_id)
      and (
        cpp.currently_reading_visibility = 'everyone'
        or cpp.currently_reading_visibility = 'followers'
      )
      and cb.total_pages > 0
      and rp.current_page > 0
      and rp.current_page < cb.total_pages
      and (
        rp.book_id = p_book_id
        or (
          v_viewed_isbn is not null
          and public.normalize_isbn(cb.isbn) = v_viewed_isbn
          and rp.book_id <> p_book_id
        )
      )
  ),
  ranked as (
    select distinct on (cm.user_id)
      cm.*
    from candidate_matches cm
    order by cm.user_id, cm.match_rank, cm.updated_at desc, cm.matched_book_id
  ),
  visible as (
    select
      r.*,
      case
        when not r.can_show_progress or v_viewer_percentage is null or r.percentage is null then null
        when abs(r.percentage - v_viewer_percentage) <= 10 then 'same_area'
        when r.percentage > v_viewer_percentage then 'ahead'
        else 'behind'
      end as relative_status
    from ranked r
  ),
  counted as (
    select count(*)::int as total_visible
    from visible
  ),
  paged as (
    select *
    from visible v
    where v_cursor is null
       or v.updated_at < v_cursor_updated_at
       or (v.updated_at = v_cursor_updated_at and v.user_id > v_cursor_user_id)
    order by v.updated_at desc, v.user_id
    limit v_limit + 1
  ),
  limited as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'userId', user_id,
            'username', username,
            'displayName', display_name,
            'avatarUrl', avatar_url,
            'matchType', match_type,
            'matchedBookId', matched_book_id,
            'matchedIsbn', case when match_type = 'same_isbn' then matched_isbn else null end,
            'currentPage', case when can_show_progress then current_page else null end,
            'totalPages', case when can_show_progress then total_pages else null end,
            'percentage', case when can_show_progress then percentage else null end,
            'relativeStatus', relative_status,
            'updatedAt', updated_at
          )
          order by updated_at desc, user_id
        ) filter (where rn <= v_limit),
        '[]'::jsonb
      ) as items,
      max(case when rn = v_limit + 1 then public.also_reading_encode_cursor(updated_at, user_id) end) as next_cursor
    from (
      select p.*, row_number() over (order by p.updated_at desc, p.user_id) as rn
      from paged p
    ) numbered
  )
  select
    coalesce(l.items, '[]'::jsonb),
    c.total_visible,
    l.next_cursor
  into v_items, v_total_visible, v_next_cursor
  from counted c
  cross join limited l;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', v_next_cursor,
    'totalVisible', coalesce(v_total_visible, 0)
  );
end;
$$;

revoke execute on function public.also_reading_encode_cursor(timestamptz, uuid) from public, anon;
grant execute on function public.also_reading_encode_cursor(timestamptz, uuid) to authenticated;

revoke execute on function public.also_reading_cursor_payload(text) from public, anon;
grant execute on function public.also_reading_cursor_payload(text) to authenticated;

revoke execute on function public.normalize_isbn(text) from public, anon;
grant execute on function public.normalize_isbn(text) to authenticated;

revoke execute on function public.get_also_reading_for_book(uuid, text, int, text) from public, anon;
grant execute on function public.get_also_reading_for_book(uuid, text, int, text) to authenticated;
