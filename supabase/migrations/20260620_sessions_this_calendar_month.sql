-- =============================================================================
-- File   : 20260620_sessions_this_calendar_month.sql
-- Purpose: "Sessions this month" should mean the current CALENDAR month (e.g.
--          June 1 → now), not a rolling 30-day window. Switch the session count
--          filter to date_trunc('month', now()). Keeps the meaningful-session
--          definition (started, >= 60s, >= 1 page) from the prior migration.
--
-- Re-creates get_reading_stats; only the `sessionsThisMonth` date filter changes
-- vs. 20260619_sessions_this_month_fix.sql.
-- =============================================================================

create or replace function public.get_reading_stats(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $function$
  with
  authorized as (
    select p_user_id as user_id
    where p_user_id = (select auth.uid())
  ),
  deltas as (
    select
      ph.book_id,
      ph.recorded_at,
      ph.session_start_at,
      greatest(
        0,
        ph.page - lag(ph.page, 1, 0) over (
          partition by ph.book_id
          order by ph.recorded_at, ph.id
        )
      ) as page_delta,
      extract(epoch from (ph.recorded_at - ph.session_start_at)) as dur_sec
    from public.progress_history ph
    join authorized a on a.user_id = ph.user_id
  ),
  valid_sessions as (
    select page_delta, dur_sec
    from deltas
    where session_start_at is not null
      and dur_sec >= 60
      and page_delta >= 1
  ),
  reading_days as (
    select distinct date(recorded_at) as day
    from deltas
  ),
  streak_base as (
    select
      day,
      day - lag(day) over (order by day) - 1 as gap_before
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
  ),
  current_progress as (
    select
      least(greatest(rp.current_page, 0), b.total_pages) as pages_read
    from public.reading_progress rp
    join authorized a on a.user_id = rp.user_id
    join public.books b
      on b.id = rp.book_id
     and b.user_id = rp.user_id
    where b.total_pages > 0
      and rp.current_page > 0
  )
  select json_build_object(
    'pagesThisWeek',
      coalesce((
        select sum(page_delta) from deltas
        where recorded_at >= now() - interval '7 days'
      ), 0),

    'pagesThisMonth',
      coalesce((
        select sum(page_delta) from deltas
        where recorded_at >= now() - interval '30 days'
      ), 0),

    'totalPagesRead',
      coalesce((select sum(pages_read) from current_progress), 0),

    'totalReadingHours',
      coalesce((
        select round(sum(dur_sec) / 3600.0)
        from valid_sessions
      ), 0),

    -- Meaningful reading sessions (started, >= 60s, >= 1 page) within the
    -- current calendar month.
    'sessionsThisMonth',
      coalesce((
        select count(distinct (book_id, session_start_at)) from deltas
        where recorded_at >= date_trunc('month', now())
          and session_start_at is not null
          and dur_sec >= 60
          and page_delta >= 1
      ), 0),

    'currentStreakDays',
      coalesce((
        select len from streak_lengths
        where last_day >= current_date - 1
        order by last_day desc
        limit 1
      ), 0),

    'longestStreakDays',
      coalesce((select max(len) from streak_lengths), 0),

    'allTimeVelocityPph',
      coalesce((
        select round(sum(page_delta) / (sum(dur_sec) / 3600.0))
        from valid_sessions
        having sum(dur_sec) > 0 and sum(page_delta) > 0
      ), 0)
  )
$function$;
