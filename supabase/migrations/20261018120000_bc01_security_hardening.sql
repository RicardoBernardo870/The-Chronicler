-- =============================================================================
-- BC-01 — Security hardening
-- docs/backend-consolidation-plan.md §BC-01 · docs/backend-contract.md §12
-- Fixes S-01, S-02, S-03, S-04, S-05, S-10, S-11 (follows + profile writes)
-- and the BC-01.8 advisor debt (auth_rls_initplan, unindexed FKs, dup indexes).
--
-- Backward compatible with the PWA:
--   * the four stats RPCs keep their (p_user_id …) signatures and payloads;
--     p_user_id must now equal auth.uid() (42501 'not_allowed' otherwise);
--   * every RPC the PWA calls stays executable by `authenticated`;
--   * the PWA never calls the helpers locked here and never writes
--     `follows` / `community_profiles` directly.
--
-- Deviation from BC-01.5 (documented in backend-contract.md §12):
--   the circle_* / community_* helpers stay in `public` with EXECUTE revoked
--   from anon/authenticated instead of moving to `private`. Thirty dormant
--   community RPCs call them schema-qualified (`public.community_…(`), so a
--   move would mean rewriting every caller. Revoking closes the hole (callers
--   are SECURITY DEFINER and run as the owner). The RLS policies that called
--   circle_user_is_member/owner with a caller-chosen uid are repointed at new
--   private.* helpers that take the uid from auth.uid().
--
-- The activity-log feature (activity_logs, log-geo) is deliberately untouched.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. private schema + identity assertion
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.assert_is_caller(p_user_id uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_user_id is distinct from (select auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_is_caller(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. BC-01.1 — owner checks on the four IDOR RPCs (S-01)
--    Bodies are verbatim from supabase/reference/live-baseline-2026-10-18.sql;
--    the only change is the leading `select private.assert_is_caller(...)`.
--    The outer function is SECURITY DEFINER (owner postgres), so the call
--    needs no grant to authenticated.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_library_with_progress(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.assert_is_caller(p_user_id);

  select coalesce(
    json_agg(
      json_build_object(
        'id',             b.id,
        'title',          b.title,
        'author',         b.author,
        'coverUrl',       b.cover_url,
        'totalPages',     b.total_pages,
        'genre',          b.genre,
        'isbn',           b.isbn,
        'description',    b.description,
        'source',             coalesce(b.source, 'manual'),
        'pageCountEstimated', coalesce(b.page_count_estimated, false),
        'currentPage',    coalesce(rp.current_page, 0),
        'percentage',
          case
            when b.total_pages > 0
            then least(100, round((coalesce(rp.current_page, 0)::numeric / b.total_pages) * 100, 2))
            else 0
          end,
        'status',
          case
            when rp.dnf_at is not null then 'dnf'
            when coalesce(rp.current_page, 0) = 0 then 'unread'
            when rp.current_page >= b.total_pages and b.total_pages > 0 then 'finished'
            else 'reading'
          end,
        'lastReadAt',     rp.updated_at,
        'sessionStartAt', rp.session_start_at,
        'dnfAt',          rp.dnf_at,
        'progressId',     rp.id
      )
      order by coalesce(rp.updated_at, b.created_at) desc
    ),
    '[]'::json
  )
  from public.books b
  left join public.reading_progress rp
    on rp.book_id = b.id
   and rp.user_id = p_user_id
  where b.user_id = p_user_id
$function$;

CREATE OR REPLACE FUNCTION public.get_library_breakdown(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.assert_is_caller(p_user_id);

  with
  books_with_status as (
    select
      b.id,
      b.author,
      nullif(trim(b.genre), '') as genre,
      b.total_pages,
      coalesce(rp.current_page, 0) as current_page,
      case
        when coalesce(rp.current_page, 0) = 0 then 'unread'
        when rp.current_page >= b.total_pages and b.total_pages > 0 then 'finished'
        else 'reading'
      end as status,
      case
        when b.total_pages > 0
        then least(100, round((coalesce(rp.current_page, 0)::numeric / b.total_pages) * 100, 1))
        else 0
      end as completion_pct
    from public.books b
    left join public.reading_progress rp
      on rp.book_id = b.id
     and rp.user_id = p_user_id
    where b.user_id = p_user_id
  ),
  stats as (
    select
      count(*) as total_count,
      count(distinct lower(trim(author))) filter (where author is not null) as authors_count,
      count(*) filter (where status = 'finished') as books_finished,
      count(*) filter (where status = 'reading') as books_in_progress,
      count(*) filter (where status = 'unread') as books_unstarted,
      coalesce(round(avg(completion_pct) filter (where status != 'unread'), 1), 0) as avg_completion_pct
    from books_with_status
  ),
  genre_counts as (
    select
      coalesce(genre, 'Uncategorized') as genre,
      count(*) as cnt
    from books_with_status
    group by coalesce(genre, 'Uncategorized')
  )
  select json_build_object(
    'genreDistribution',
      coalesce((
        select json_agg(
          json_build_object(
            'genre',      gc.genre,
            'count',      gc.cnt,
            'percentage', round(gc.cnt::numeric / nullif(s.total_count, 0) * 100, 1)
          )
          order by gc.cnt desc
        )
        from genre_counts gc
        cross join stats s
      ), '[]'::json),

    'authorsCount',
      s.authors_count,

    'booksFinished',
      s.books_finished,

    'booksInProgress',
      s.books_in_progress,

    'booksUnstarted',
      s.books_unstarted,

    'avgCompletionPct',
      s.avg_completion_pct
  )
  from stats s
$function$;

CREATE OR REPLACE FUNCTION public.get_last_session(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.assert_is_caller(p_user_id);

  with
  last_row as (
    select
      ph.id,
      ph.book_id,
      ph.page,
      ph.recorded_at,
      ph.session_start_at,
      ph.session_note,
      greatest(0, ph.page - coalesce(prev.page, 0)) as page_delta,
      coalesce(prev.page, 0) as prior_page,
      extract(epoch from (ph.recorded_at - ph.session_start_at)) as dur_sec
    from public.progress_history ph
    left join lateral (
      select ph_prev.page
      from public.progress_history ph_prev
      where ph_prev.user_id = p_user_id
        and ph_prev.book_id = ph.book_id
        and ph_prev.recorded_at < ph.recorded_at
      order by ph_prev.recorded_at desc
      limit 1
    ) prev on true
    where ph.user_id = p_user_id
    order by ph.recorded_at desc
    limit 1
  ),
  valid_sessions as (
    select
      greatest(0, ph.page - coalesce(prev.page, 0)) as page_delta,
      extract(epoch from (ph.recorded_at - ph.session_start_at)) as dur_sec
    from public.progress_history ph
    left join lateral (
      select ph_prev.page
      from public.progress_history ph_prev
      where ph_prev.user_id = p_user_id
        and ph_prev.book_id = ph.book_id
        and ph_prev.recorded_at < ph.recorded_at
      order by ph_prev.recorded_at desc
      limit 1
    ) prev on true
    where ph.user_id = p_user_id
      and ph.session_start_at is not null
      and extract(epoch from (ph.recorded_at - ph.session_start_at)) >= 60
      and greatest(0, ph.page - coalesce(prev.page, 0)) >= 1
    order by ph.recorded_at desc
    limit 3
  ),
  rolling_velocity as (
    select
      case
        when count(*) > 0 and sum(dur_sec) > 0
        then sum(page_delta) / (sum(dur_sec) / 3600.0)
        else null
      end as velocity
    from valid_sessions
  )
  select
    case
      when (select id from last_row) is null then null
      else json_build_object(
        'bookId',          lr.book_id,
        'bookTitle',       coalesce(b.title, 'Unknown Book'),
        'endedAt',         lr.recorded_at,
        'startedAt',       lr.session_start_at,
        'pagesDelta',      lr.page_delta,
        'startPage',       lr.prior_page,
        'endPage',         lr.page,
        'durationSeconds',
          case when lr.session_start_at is not null then round(lr.dur_sec) else null end,
        'velocityPph',
          case
            when lr.session_start_at is not null and lr.dur_sec >= 60 and lr.page_delta >= 1
            then round(lr.page_delta / (lr.dur_sec / 3600.0))
            else null
          end,
        'completionDelta',
          case
            when b.total_pages > 0
            then round((lr.page_delta::numeric / b.total_pages) * 1000) / 10
            else null
          end,
        'finishPredictionSessions',
          case
            when b.total_pages > 0
              and lr.page_delta >= 1
              and (b.total_pages - lr.page) > 0
              and rv.velocity is not null
              and rv.velocity > 0
            then ceil(
              (b.total_pages - lr.page)::numeric
              / greatest(1, rv.velocity * (coalesce(lr.dur_sec, 0) / 3600.0))
            )
            when b.total_pages > 0 and lr.page >= b.total_pages then 0
            else null
          end,
        'sessionNote',     lr.session_note
      )
    end
  from last_row lr
  join public.books b on b.id = lr.book_id
  cross join rolling_velocity rv
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_velocity(p_user_id uuid, p_book_ids uuid[])
 RETURNS TABLE(book_id uuid, days_left integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.assert_is_caller(p_user_id);

  with
  history as (
    select
      ph.book_id,
      ph.page,
      ph.recorded_at,
      ph.session_start_at,
      lag(ph.page) over (partition by ph.book_id order by ph.recorded_at) as prev_page
    from public.progress_history ph
    where ph.user_id = p_user_id
      and ph.book_id = any(p_book_ids)
      and ph.recorded_at > now() - interval '30 days'
  ),
  session_deltas as (
    select h.book_id, (h.page - h.prev_page) as delta
    from history h
    where h.session_start_at is not null
      and h.prev_page is not null
      and (h.page - h.prev_page) > 0
  ),
  session_avg as (
    select sd.book_id, count(*)::int as session_count, avg(sd.delta)::float as avg_pages
    from session_deltas sd
    group by sd.book_id
  ),
  per_day as (
    select
      h.book_id,
      date_trunc('day', h.recorded_at) as day,
      max(h.page) - min(h.page) as delta
    from history h
    group by h.book_id, date_trunc('day', h.recorded_at)
    having (max(h.page) - min(h.page)) > 0
  ),
  day_avg as (
    select pd.book_id, count(*)::int as day_count, avg(pd.delta)::float as avg_pages
    from per_day pd
    group by pd.book_id
  ),
  best as (
    select
      b.id as book_id,
      b.total_pages,
      coalesce(rp.current_page, 0) as current_page,
      case
        when sa.session_count >= 3 then sa.avg_pages
        when da.day_count >= 3 then da.avg_pages
        else null
      end as avg_pages
    from public.books b
    left join public.reading_progress rp
      on rp.book_id = b.id
     and rp.user_id = p_user_id
    left join session_avg sa on sa.book_id = b.id
    left join day_avg da on da.book_id = b.id
    where b.id = any(p_book_ids)
      and b.user_id = p_user_id
  )
  select
    best.book_id,
    case
      when ceil((best.total_pages - best.current_page)::float / best.avg_pages) <= 0 then 0
      else ceil((best.total_pages - best.current_page)::float / best.avg_pages)::int
    end as days_left
  from best
  where best.avg_pages is not null
    and best.avg_pages > 0
    and best.total_pages > 0
    and (best.total_pages - best.current_page) > 0
$function$;

-- -----------------------------------------------------------------------------
-- 2. BC-01.2 — NULL-safe guard in get_reading_quest_summary (S-02)
--    The old `if p_user_id <> auth.uid()` was NULL (no raise) for anon.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reading_quest_summary(p_user_id uuid, p_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform private.assert_is_caller(p_user_id);

  return (
    with params as (
      select
        make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC') as year_start,
        make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC') as next_year
    ),
    months as (
      select case
        when now() < year_start then 1::numeric
        else greatest(
          1::numeric,
          least(
            12::numeric,
            (extract(epoch from (least(now(), next_year) - year_start)) / 2629800.0)::numeric
          )
        )
      end as elapsed
      from params
    ),
    goal_row as (
      select *
      from public.reading_goals
      where user_id = p_user_id
        and year = p_year
      limit 1
    ),
    progress_rows as (
      select
        b.id,
        greatest(b.total_pages, 0) as total_pages,
        least(greatest(coalesce(rp.current_page, 0), 0), greatest(b.total_pages, 0)) as current_page,
        rp.updated_at
      from public.books b
      left join public.reading_progress rp
        on rp.book_id = b.id
       and rp.user_id = b.user_id
      where b.user_id = p_user_id
        and coalesce(b.source, 'manual') = 'manual'
    ),
    base_counts as (
      select
        coalesce(sum(current_page), 0)::integer as pages_read,
        count(*) filter (where total_pages > 0 and current_page >= total_pages)::integer as completed_books_all,
        count(*) filter (
          where total_pages > 0
            and current_page >= total_pages
            and updated_at >= (select year_start from params)
            and updated_at < (select next_year from params)
        )::integer as completed_books_year
      from progress_rows
    ),
    activity_counts as (
      select
        (select count(*)::integer from public.progress_history where user_id = p_user_id) as reading_sessions,
        (
          select count(*)::integer
          from public.reading_quest_events
          where user_id = p_user_id
            and event_type = 'page_capture'
        ) as page_captures,
        (select count(*)::integer from public.recaps where user_id = p_user_id) as recaps_generated,
        (select count(*)::integer from public.lore_cards where user_id = p_user_id) as lore_cards_unlocked
    ),
    sources as (
      select
        bc.pages_read,
        bc.completed_books_all as completed_books,
        ac.reading_sessions,
        ac.page_captures,
        ac.recaps_generated,
        ac.lore_cards_unlocked
      from base_counts bc
      cross join activity_counts ac
    ),
    xp as (
      select
        pages_read
        + completed_books * 25
        + reading_sessions * 10
        + page_captures * 5
        + recaps_generated * 20
        + lore_cards_unlocked * 15 as total_xp
      from sources
    ),
    level_calc as (
      select
        total_xp,
        case
          when total_xp < 1500 then 0
          when total_xp < 4000 then 1
          when total_xp < 8000 then 2
          when total_xp < 14000 then 3
          when total_xp < 22000 then 4
          when total_xp < 34000 then 5
          else 6
        end as level,
        case
          when total_xp < 1500 then 'Page Turner'
          when total_xp < 4000 then 'Chapter Seeker'
          when total_xp < 8000 then 'Margin Walker'
          when total_xp < 14000 then 'Lore Keeper'
          when total_xp < 22000 then 'Archive Runner'
          when total_xp < 34000 then 'Chapter Sage'
          else 'Library Legend'
        end as title,
        case
          when total_xp < 1500 then 0
          when total_xp < 4000 then 1500
          when total_xp < 8000 then 4000
          when total_xp < 14000 then 8000
          when total_xp < 22000 then 14000
          when total_xp < 34000 then 22000
          else 34000
        end as current_floor,
        case
          when total_xp < 1500 then 1500
          when total_xp < 4000 then 4000
          when total_xp < 8000 then 8000
          when total_xp < 14000 then 14000
          when total_xp < 22000 then 22000
          when total_xp < 34000 then 34000
          else null
        end as next_threshold
      from xp
    ),
    quest_base as (
      select
        p_year as year,
        gr.target_books,
        bc.completed_books_year,
        m.elapsed as months_elapsed,
        case when gr.target_books is null then null else round(gr.target_books::numeric / 12, 1) end as required_books_per_month,
        case when bc.completed_books_year > 0 then round(bc.completed_books_year::numeric / m.elapsed, 1) else null end as current_books_per_month,
        case when bc.completed_books_year > 0 then round((bc.completed_books_year::numeric / m.elapsed) * 12, 1) else null end as projected_books
      from params
      cross join months m
      cross join base_counts bc
      left join goal_row gr on true
    ),
    quest as (
      select
        *,
        projected_books is not null as has_projection,
        case
          when target_books is null then 0
          else least(100, round((completed_books_year::numeric / target_books::numeric) * 100, 1))
        end as progress_percent,
        case
          when target_books is null then 'no_goal'
          when completed_books_year >= target_books then 'complete'
          when projected_books is null then 'no_projection'
          when projected_books >= target_books * 1.1 then 'ahead'
          when projected_books >= target_books then 'on_track'
          when projected_books >= target_books * 0.75 then 'behind'
          else 'comeback'
        end as status
      from quest_base
    ),
    status_labels as (
      select
        status,
        case status
          when 'no_goal' then 'Set your reading quest'
          when 'no_projection' then 'Pace warming up'
          when 'ahead' then 'Ahead of pace'
          when 'on_track' then 'On track'
          when 'behind' then 'A little behind'
          when 'comeback' then 'Comeback arc available'
          when 'complete' then 'Quest complete'
          else 'On track'
        end as status_label
      from quest
    )
    select jsonb_build_object(
      'goal', (
        select case when gr.id is null then null else jsonb_build_object(
          'id', gr.id,
          'userId', gr.user_id,
          'year', gr.year,
          'targetBooks', gr.target_books,
          'createdAt', gr.created_at,
          'updatedAt', gr.updated_at
        ) end
        from goal_row gr
      ),
      'quest', (
        select jsonb_build_object(
          'year', q.year,
          'targetBooks', q.target_books,
          'completedBooks', q.completed_books_year,
          'progressPercent', q.progress_percent,
          'requiredBooksPerMonth', q.required_books_per_month,
          'currentBooksPerMonth', q.current_books_per_month,
          'projectedBooks', q.projected_books,
          'hasProjection', q.has_projection,
          'status', q.status,
          'statusLabel', sl.status_label
        )
        from quest q
        join status_labels sl on sl.status = q.status
      ),
      'level', (
        select jsonb_build_object(
          'level', level,
          'title', title,
          'totalXp', total_xp,
          'currentLevelXp', total_xp - current_floor,
          'nextLevelXp', coalesce(next_threshold - current_floor, 0),
          'xpToNextLevel', coalesce(greatest(next_threshold - total_xp, 0), 0),
          'progressPercent', case
            when next_threshold is null then 100
            else round(((total_xp - current_floor)::numeric / (next_threshold - current_floor)::numeric) * 100, 1)
          end
        )
        from level_calc
      ),
      'sources', (
        select jsonb_build_object(
          'pagesRead', pages_read,
          'completedBooks', completed_books,
          'readingSessions', reading_sessions,
          'pageCaptures', page_captures,
          'recapsGenerated', recaps_generated,
          'loreCardsUnlocked', lore_cards_unlocked
        )
        from sources
      )
    )
  );
end;
$function$;

-- -----------------------------------------------------------------------------
-- 3. BC-01.4 — dead and destructive objects (S-03)
--    after_page_capture_saved() is attached to no trigger.
--    prune_page_captures_for_book() has no identity check; live behaviour
--    already keeps captures until completion, so it is dropped (recreate in
--    `private` if a retention cap is ever decided).
-- -----------------------------------------------------------------------------
drop function if exists public.after_page_capture_saved();
drop function if exists public.prune_page_captures_for_book(uuid, uuid, integer);

-- -----------------------------------------------------------------------------
-- 4. BC-01.5 — RLS policy helpers that take the uid from auth.uid() (S-04)
-- -----------------------------------------------------------------------------
create or replace function private.is_circle_member(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = (select auth.uid())
      and rc.status = 'active'
  );
$$;

create or replace function private.is_circle_owner(p_circle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'owner'
      and rc.status = 'active'
  );
$$;

revoke all on function private.is_circle_member(uuid) from public, anon;
revoke all on function private.is_circle_owner(uuid) from public, anon;
grant execute on function private.is_circle_member(uuid) to authenticated;
grant execute on function private.is_circle_owner(uuid) to authenticated;

drop policy if exists circle_invitations_recipient_or_owner_select on public.circle_invitations;
create policy circle_invitations_recipient_or_owner_select on public.circle_invitations
  for select to authenticated
  using (invited_user_id = (select auth.uid()) or (select private.is_circle_owner(circle_id)));

drop policy if exists circle_members_member_select on public.circle_members;
create policy circle_members_member_select on public.circle_members
  for select to authenticated
  using ((select private.is_circle_member(circle_id)));

drop policy if exists reading_circles_member_select on public.reading_circles;
create policy reading_circles_member_select on public.reading_circles
  for select to authenticated
  using ((select private.is_circle_member(id)));

-- -----------------------------------------------------------------------------
-- 5. BC-01.3 — function grants (S-03, S-04, S-05)
--    (a) nothing in public is executable by PUBLIC/anon;
--    (b) authenticated loses EXECUTE on everything …
--    (c) … and gets it back only on the client allowlist.
--    service_role keeps its explicit grants (edge functions).
--    Trigger functions need no EXECUTE grant to fire.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- reading RPCs (PWA)
grant execute on function public.get_library_with_progress(uuid)          to authenticated;
grant execute on function public.get_reading_stats(uuid)                  to authenticated;
grant execute on function public.get_last_session(uuid)                   to authenticated;
grant execute on function public.get_library_breakdown(uuid)              to authenticated;
grant execute on function public.get_reading_velocity(uuid, uuid[])       to authenticated;
grant execute on function public.get_book_passport_stats(uuid, uuid, text) to authenticated;
grant execute on function public.get_reading_calendar(uuid, date, text)   to authenticated;
grant execute on function public.get_monthly_reading(uuid, integer, text) to authenticated;
grant execute on function public.get_reading_records(uuid, text)          to authenticated;
grant execute on function public.get_reading_quest_summary(uuid, integer) to authenticated;

-- identity (PWA + iOS v1)
grant execute on function public.get_my_community_profile()           to authenticated;
grant execute on function public.upsert_my_community_profile(jsonb)   to authenticated;
grant execute on function public.is_username_available(text)          to authenticated;

-- dormant community & circle RPCs (identity from auth.uid())
grant execute on function public.add_circle_reaction(uuid, uuid, integer, text)                          to authenticated;
grant execute on function public.block_community_user(uuid)                                              to authenticated;
grant execute on function public.can_community_users_interact(uuid)                                      to authenticated;
grant execute on function public.create_reading_circle(uuid, text, uuid[])                               to authenticated;
grant execute on function public.follow_community_user(uuid)                                             to authenticated;
grant execute on function public.get_also_reading_for_book(uuid, text, integer, text)                    to authenticated;
grant execute on function public.get_community_relationship_state(uuid)                                  to authenticated;
grant execute on function public.get_public_profile_by_username(text)                                    to authenticated;
grant execute on function public.get_reading_circle_detail(uuid)                                         to authenticated;
grant execute on function public.get_visible_circle_reactions(uuid, numeric, numeric, integer, text)     to authenticated;
grant execute on function public.invite_reading_circle_members(uuid, uuid[])                             to authenticated;
grant execute on function public.leave_reading_circle(uuid)                                              to authenticated;
grant execute on function public.list_community_followers(uuid, integer, text)                           to authenticated;
grant execute on function public.list_community_following(uuid, integer, text)                           to authenticated;
grant execute on function public.list_my_blocked_users(integer, text)                                    to authenticated;
grant execute on function public.list_my_reading_circles(integer, text)                                  to authenticated;
grant execute on function public.remove_reading_circle_member(uuid, uuid)                                to authenticated;
grant execute on function public.respond_to_reading_circle_invitation(uuid, boolean)                     to authenticated;
grant execute on function public.search_community_readers(text, integer, text)                           to authenticated;
grant execute on function public.unblock_community_user(uuid)                                            to authenticated;
grant execute on function public.unfollow_community_user(uuid)                                           to authenticated;

-- immutable, no data access; used by books_normalized_isbn_user_idx
grant execute on function public.normalize_isbn(text) to authenticated;

-- (d) future functions are not auto-granted. Per-schema defaults can only ADD
--     to the global ones, so PUBLIC's built-in EXECUTE is revoked globally.
--     Defaults owned by supabase_admin cannot be changed from a postgres
--     migration: run every migration as postgres.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- (e) OP-01.1 — no anonymous data access. Revoke anon table privileges on
--     every public table except activity_logs (activity-log feature is out of
--     scope), and stop default grants to anon on future tables/sequences.
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and c.relname <> 'activity_logs'
  loop
    execute format('revoke all on table public.%I from anon', r.relname);
  end loop;
end;
$$;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- -----------------------------------------------------------------------------
-- 6. BC-01.6 — child-table RLS checks book ownership (S-10)
--    Live count of cross-user rows on 2026-10-18: 0 in every table below.
--    Also fixes auth_rls_initplan on these policies.
-- -----------------------------------------------------------------------------

-- reading_progress (was FOR ALL)
drop policy if exists "Users can manage their own progress" on public.reading_progress;
create policy reading_progress_select_own on public.reading_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy reading_progress_insert_own on public.reading_progress
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy reading_progress_update_own on public.reading_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy reading_progress_delete_own on public.reading_progress
  for delete to authenticated using (user_id = (select auth.uid()));

-- progress_history (was FOR ALL)
drop policy if exists "Users manage own progress_history" on public.progress_history;
create policy progress_history_select_own on public.progress_history
  for select to authenticated using (user_id = (select auth.uid()));
create policy progress_history_insert_own on public.progress_history
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy progress_history_update_own on public.progress_history
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy progress_history_delete_own on public.progress_history
  for delete to authenticated using (user_id = (select auth.uid()));

-- recaps (was FOR ALL)
drop policy if exists "Users can manage their own recaps" on public.recaps;
create policy recaps_select_own on public.recaps
  for select to authenticated using (user_id = (select auth.uid()));
create policy recaps_insert_own on public.recaps
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy recaps_update_own on public.recaps
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy recaps_delete_own on public.recaps
  for delete to authenticated using (user_id = (select auth.uid()));

-- lexicon_entries (was FOR ALL)
drop policy if exists "Users manage own lexicon_entries" on public.lexicon_entries;
create policy lexicon_entries_select_own on public.lexicon_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy lexicon_entries_insert_own on public.lexicon_entries
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy lexicon_entries_update_own on public.lexicon_entries
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy lexicon_entries_delete_own on public.lexicon_entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- up_next_order (was FOR ALL)
drop policy if exists "Users manage own up_next_order" on public.up_next_order;
create policy up_next_order_select_own on public.up_next_order
  for select to authenticated using (user_id = (select auth.uid()));
create policy up_next_order_insert_own on public.up_next_order
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy up_next_order_update_own on public.up_next_order
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy up_next_order_delete_own on public.up_next_order
  for delete to authenticated using (user_id = (select auth.uid()));

-- book_passports (was FOR ALL)
drop policy if exists "Users manage own book_passports" on public.book_passports;
create policy book_passports_select_own on public.book_passports
  for select to authenticated using (user_id = (select auth.uid()));
create policy book_passports_insert_own on public.book_passports
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy book_passports_update_own on public.book_passports
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy book_passports_delete_own on public.book_passports
  for delete to authenticated using (user_id = (select auth.uid()));

-- lore_cards
drop policy if exists lore_cards_select_own on public.lore_cards;
drop policy if exists lore_cards_insert_own on public.lore_cards;
drop policy if exists lore_cards_update_own on public.lore_cards;
drop policy if exists lore_cards_delete_own on public.lore_cards;
create policy lore_cards_select_own on public.lore_cards
  for select to authenticated using (user_id = (select auth.uid()));
create policy lore_cards_insert_own on public.lore_cards
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy lore_cards_update_own on public.lore_cards
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy lore_cards_delete_own on public.lore_cards
  for delete to authenticated using (user_id = (select auth.uid()));

-- page_captures
drop policy if exists page_captures_select_own on public.page_captures;
drop policy if exists page_captures_insert_own on public.page_captures;
drop policy if exists page_captures_update_own on public.page_captures;
drop policy if exists page_captures_delete_own on public.page_captures;
create policy page_captures_select_own on public.page_captures
  for select to authenticated using (user_id = (select auth.uid()));
create policy page_captures_insert_own on public.page_captures
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy page_captures_update_own on public.page_captures
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy page_captures_delete_own on public.page_captures
  for delete to authenticated using (user_id = (select auth.uid()));

-- book_quizzes (already initplan-safe; add book ownership)
drop policy if exists "Book quizzes are insertable by owner" on public.book_quizzes;
drop policy if exists "Book quizzes are updatable by owner" on public.book_quizzes;
create policy "Book quizzes are insertable by owner" on public.book_quizzes
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy "Book quizzes are updatable by owner" on public.book_quizzes
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

-- vocabulary_extractions (update had no WITH CHECK)
drop policy if exists vocabulary_extractions_select on public.vocabulary_extractions;
drop policy if exists vocabulary_extractions_insert on public.vocabulary_extractions;
drop policy if exists vocabulary_extractions_update on public.vocabulary_extractions;
create policy vocabulary_extractions_select on public.vocabulary_extractions
  for select to authenticated using (user_id = (select auth.uid()));
create policy vocabulary_extractions_insert on public.vocabulary_extractions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );
create policy vocabulary_extractions_update on public.vocabulary_extractions
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.user_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 7. BC-01.7 — close direct-table bypasses of RPC rules (S-11)
--    follows are written only by follow_community_user (SECURITY DEFINER);
--    profiles only by upsert_my_community_profile (SECURITY DEFINER, owner
--    postgres, RLS not forced → unaffected).
-- -----------------------------------------------------------------------------
drop policy if exists follows_follower_insert on public.follows;
drop policy if exists community_profiles_owner_insert on public.community_profiles;
drop policy if exists community_profiles_owner_update on public.community_profiles;

-- -----------------------------------------------------------------------------
-- 8. BC-01.8 — remaining auth_rls_initplan policies (activity_logs excluded)
-- -----------------------------------------------------------------------------
drop policy if exists "Users can manage their own books" on public.books;
create policy "Users can manage their own books" on public.books
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own review sessions" on public.anki_review_sessions;
create policy "Users manage own review sessions" on public.anki_review_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists reading_dna_select on public.reading_dna;
drop policy if exists reading_dna_insert on public.reading_dna;
drop policy if exists reading_dna_update on public.reading_dna;
create policy reading_dna_select on public.reading_dna
  for select to authenticated using (user_id = (select auth.uid()));
create policy reading_dna_insert on public.reading_dna
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy reading_dna_update on public.reading_dna
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists users_own_settings_select on public.user_settings;
drop policy if exists users_own_settings_insert on public.user_settings;
drop policy if exists users_own_settings_update on public.user_settings;
create policy users_own_settings_select on public.user_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy users_own_settings_insert on public.user_settings
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy users_own_settings_update on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 9. BC-01.8 — FK indexes and duplicate indexes (activity_logs excluded)
-- -----------------------------------------------------------------------------
create index if not exists book_passports_user_id_idx          on public.book_passports (user_id);
create index if not exists lexicon_entries_book_id_idx         on public.lexicon_entries (book_id);
create index if not exists lore_cards_book_id_idx              on public.lore_cards (book_id);
create index if not exists page_captures_book_id_idx           on public.page_captures (book_id);
create index if not exists reading_quest_events_book_id_idx    on public.reading_quest_events (book_id);
create index if not exists up_next_order_book_id_idx           on public.up_next_order (book_id);
create index if not exists vocabulary_extractions_book_id_idx  on public.vocabulary_extractions (book_id);

-- identical to progress_history_user_recorded_at_desc_idx
drop index if exists public.progress_history_user_recorded_at_idx;
-- duplicate the unique constraints' indexes
drop index if exists public.idx_page_captures_user_book_page;      -- ≡ page_captures_user_id_book_id_page_key
drop index if exists public.idx_anki_review_sessions_user;          -- ≡ anki_review_sessions_user_id_key
drop index if exists public.reading_goals_user_year_idx;            -- ≡ reading_goals_user_year_key
