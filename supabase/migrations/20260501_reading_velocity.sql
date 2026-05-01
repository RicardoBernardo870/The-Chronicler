-- ============================================================================
-- File   : 20260501_reading_velocity.sql
-- Feature: 019 — Reading Velocity RPC
-- Purpose: Server-side computation of "days remaining" estimates per in-progress
--          book. Replaces a per-page-load JS aggregation over progress_history.
--
-- Rules (mirrors useReadingVelocity composable):
--   * 30-day rolling window of progress_history.
--   * A "session" = a row whose session_start_at IS NOT NULL paired with the
--     prior chronological row for that book (delta in pages > 0).
--   * Fallback: if <3 sessions can be derived, group rows by calendar day
--     (max(page) - min(page) per day, > 0); needs ≥3 such days.
--   * days_left = ceil((total_pages - current_page) / avg_pages_per_session).
--   * 0 means "Finish today!"; NULL rows are simply omitted from the result.
-- Returns one row per book in p_book_ids that has computable velocity.
-- ============================================================================

create or replace function public.get_reading_velocity(
  p_user_id  uuid,
  p_book_ids uuid[]
)
returns table (
  book_id   uuid,
  days_left int
)
language plpgsql
security definer
set search_path = public
as $$
-- The RETURNS TABLE columns share names with CTE columns; tell PL/pgSQL to
-- prefer the column reference over the function output variable.
#variable_conflict use_column
begin
  return query
  with
  history as (
    select
      ph.book_id,
      ph.page,
      ph.recorded_at,
      ph.session_start_at,
      lag(ph.page) over (partition by ph.book_id order by ph.recorded_at)        as prev_page,
      lag(ph.recorded_at) over (partition by ph.book_id order by ph.recorded_at) as prev_recorded_at
    from progress_history ph
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
      ph.book_id,
      date_trunc('day', ph.recorded_at) as day,
      max(ph.page) - min(ph.page)        as delta
    from progress_history ph
    where ph.user_id = p_user_id
      and ph.book_id = any(p_book_ids)
      and ph.recorded_at > now() - interval '30 days'
    group by ph.book_id, date_trunc('day', ph.recorded_at)
    having (max(ph.page) - min(ph.page)) > 0
  ),
  day_avg as (
    select pd.book_id, count(*)::int as day_count, avg(pd.delta)::float as avg_pages
    from per_day pd
    group by pd.book_id
  ),
  best as (
    select
      b.id          as book_id,
      b.total_pages as total_pages,
      coalesce(rp.current_page, 0) as current_page,
      case
        when sa.session_count >= 3 then sa.avg_pages
        when da.day_count     >= 3 then da.avg_pages
        else null
      end as avg_pages
    from books b
    left join reading_progress rp on rp.book_id = b.id and rp.user_id = p_user_id
    left join session_avg sa      on sa.book_id = b.id
    left join day_avg     da      on da.book_id = b.id
    where b.id = any(p_book_ids)
      and b.user_id = p_user_id
  )
  select
    bst.book_id,
    case
      when ceil((bst.total_pages - bst.current_page)::float / bst.avg_pages) <= 0 then 0
      else ceil((bst.total_pages - bst.current_page)::float / bst.avg_pages)::int
    end as days_left
  from best bst
  where bst.avg_pages is not null
    and bst.avg_pages > 0
    and bst.total_pages > 0
    and (bst.total_pages - bst.current_page) > 0;
end;
$$;

comment on function public.get_reading_velocity(uuid, uuid[]) is
  'Returns days-left estimate per in-progress book over a 30-day window. '
  'Mirrors the legacy useReadingVelocity JS composable, server-side, in one round trip.';

grant execute on function public.get_reading_velocity(uuid, uuid[]) to authenticated;
