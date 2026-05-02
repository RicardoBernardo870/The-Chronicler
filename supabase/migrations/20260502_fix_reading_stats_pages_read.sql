-- ============================================================================
-- File   : 20260502_fix_reading_stats_pages_read.sql
-- Purpose: Fix get_reading_stats.totalPagesRead for in-progress books.
--
-- "Pages read" must reflect current reading_progress for every started book,
-- not only the total pages of completed books. The rest of the response shape
-- and aggregate behavior is preserved.
-- ============================================================================

create index if not exists progress_history_user_book_recorded_at_id_idx
  on public.progress_history (user_id, book_id, recorded_at, id);

create or replace function public.get_reading_stats(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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

    'sessionsThisMonth',
      coalesce((
        select count(*) from deltas
        where recorded_at >= now() - interval '30 days'
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
$$;

revoke execute on function public.get_reading_stats(uuid) from public;
revoke execute on function public.get_reading_stats(uuid) from anon;
grant execute on function public.get_reading_stats(uuid) to authenticated;
