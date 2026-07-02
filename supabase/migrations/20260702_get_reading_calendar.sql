-- Reading calendar: per-day distinct books read for a month, derived from
-- progress_history. Day boundaries follow the caller's IANA timezone so a
-- 23:30 session lands on the reader's local day, not the UTC one.
-- Follows project RPC conventions (sql, stable, security definer) plus an
-- auth guard: rows are only returned for the caller's own user id.
create or replace function public.get_reading_calendar(
  p_user_id uuid,
  p_month_start date,
  p_timezone text default 'UTC'
)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  with bounds as (
    select
      date_trunc('month', p_month_start)::date as month_start,
      (date_trunc('month', p_month_start) + interval '1 month')::date as month_end
  ),
  day_books as (
    -- Coarse timestamptz range (index-friendly: user_id equality + recorded_at
    -- range), padded a day each side, then precise filtering on the
    -- timezone-converted date.
    select
      (ph.recorded_at at time zone p_timezone)::date as read_date,
      ph.book_id,
      min(ph.recorded_at) as first_read_at,
      max(ph.page) as furthest_page
    from public.progress_history ph
    cross join bounds
    where ph.user_id = p_user_id
      and p_user_id = (select auth.uid())
      and ph.recorded_at >= ((bounds.month_start - 1)::timestamp at time zone p_timezone)
      and ph.recorded_at <  ((bounds.month_end + 1)::timestamp at time zone p_timezone)
      and (ph.recorded_at at time zone p_timezone)::date >= bounds.month_start
      and (ph.recorded_at at time zone p_timezone)::date <  bounds.month_end
    group by 1, 2
  ),
  days as (
    select
      db.read_date,
      json_agg(
        json_build_object(
          'bookId', db.book_id,
          'title', coalesce(b.title, 'Unknown Book'),
          'coverUrl', b.cover_url,
          'furthestPage', db.furthest_page
        )
        order by db.first_read_at
      ) as books
    from day_books db
    join public.books b on b.id = db.book_id
    group by db.read_date
  )
  select coalesce(
    json_agg(
      json_build_object(
        'date', to_char(d.read_date, 'YYYY-MM-DD'),
        'books', d.books
      )
      order by d.read_date
    ),
    '[]'::json
  )
  from days d
$$;
