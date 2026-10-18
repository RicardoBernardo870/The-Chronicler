-- =============================================================================
-- BookHero LIVE schema baseline (Supabase project zlndhygpqacygceivuvk)
-- Captured 2026-10-18 via read-only catalog queries (pg_get_functiondef,
-- pg_get_triggerdef, pg_policies, pg_get_constraintdef, pg_get_indexdef).
-- Scope: schema "public" (+ storage buckets/policies). activity_logs and any
-- activity-log-only objects are intentionally EXCLUDED.
-- This file is a REFERENCE snapshot, not a runnable migration (objects are
-- grouped by category, not ordered by dependency).
-- Location: supabase/reference/ (deliberately NOT supabase/migrations or supabase/schemas, so the
-- Supabase CLI never applies or diffs it). Regenerate when the live backend changes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION A. FUNCTIONS (pg_get_functiondef) — A1. reading / stats RPCs
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_book_passport_stats(p_user_id uuid, p_book_id uuid, p_time_zone text DEFAULT 'UTC'::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with
  authorized_book as (
    select id, greatest(total_pages, 0) as total_pages
    from public.books
    where id = p_book_id
      and user_id = p_user_id
      and p_user_id = auth.uid()
  ),
  history as (
    select
      ph.id,
      ph.recorded_at,
      least(greatest(ph.page, 0), ab.total_pages) as page
    from public.progress_history ph
    join authorized_book ab on ab.id = ph.book_id
    where ph.user_id = p_user_id
      and ph.book_id = p_book_id
  ),
  deltas as (
    select
      recorded_at,
      greatest(
        0,
        page - coalesce(
          max(page) over (
            order by recorded_at, id
            rows between unbounded preceding and 1 preceding
          ),
          0
        )
      ) as page_delta
    from history
  ),
  bounds as (
    select
      count(*) as history_count,
      min(recorded_at) as first_recorded_at,
      max(recorded_at) as last_recorded_at
    from history
  ),
  daily as (
    select
      (recorded_at at time zone p_time_zone)::date as day,
      coalesce(sum(page_delta), 0)::integer as pages
    from deltas
    group by 1
  ),
  peak as (
    select day, pages
    from daily
    order by pages desc, day asc
    limit 1
  ),
  vocabulary as (
    select count(le.id)::integer as vocabulary_count
    from authorized_book ab
    left join public.lexicon_entries le
      on le.book_id = ab.id
     and le.user_id = p_user_id
  )
  select json_build_object(
    'totalDays',
      case
        when b.history_count > 0
        then greatest(
          1,
          ceiling(extract(epoch from (b.last_recorded_at - b.first_recorded_at)) / 86400.0)::integer
        )
        else null
      end,
    'peakDay', p.day,
    'peakDayPages', p.pages,
    'vocabularyCount', coalesce(v.vocabulary_count, 0)
  )
  from bounds b
  cross join vocabulary v
  left join peak p on true;
$function$;

CREATE OR REPLACE FUNCTION public.get_last_session(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.get_library_breakdown(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.get_library_with_progress(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.get_monthly_reading(p_user_id uuid, p_year integer, p_timezone text DEFAULT 'UTC'::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with deltas as (
    select
      extract(month from (ph.recorded_at at time zone p_timezone))::int as m,
      greatest(0, ph.page - coalesce(prev.page, 0)) as pages
    from public.progress_history ph
    left join lateral (
      select p2.page
      from public.progress_history p2
      where p2.user_id = p_user_id
        and p2.book_id = ph.book_id
        and p2.recorded_at < ph.recorded_at
      order by p2.recorded_at desc
      limit 1
    ) prev on true
    where ph.user_id = p_user_id
      and p_user_id = (select auth.uid())
      and extract(year from (ph.recorded_at at time zone p_timezone))::int = p_year
  ),
  monthly_pages as (
    select m, sum(pages)::int as pages from deltas group by m
  ),
  finishes as (
    select
      extract(month from (f.first_finish at time zone p_timezone))::int as m,
      count(*)::int as books
    from (
      select ph.book_id, min(ph.recorded_at) as first_finish
      from public.progress_history ph
      join public.books b on b.id = ph.book_id
      where ph.user_id = p_user_id
        and p_user_id = (select auth.uid())
        and b.total_pages > 0
        and ph.page >= b.total_pages
      group by ph.book_id
    ) f
    where extract(year from (f.first_finish at time zone p_timezone))::int = p_year
    group by 1
  )
  select coalesce(
    json_agg(
      json_build_object(
        'month', gs.m,
        'pages', coalesce(mp.pages, 0),
        'booksFinished', coalesce(fi.books, 0)
      )
      order by gs.m
    ),
    '[]'::json
  )
  from generate_series(1, 12) gs(m)
  left join monthly_pages mp on mp.m = gs.m
  left join finishes fi on fi.m = gs.m
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_calendar(p_user_id uuid, p_month_start date, p_timezone text DEFAULT 'UTC'::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_records(p_user_id uuid, p_timezone text DEFAULT 'UTC'::text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with deltas as (
    select
      (ph.recorded_at at time zone p_timezone)::date as local_day,
      greatest(0, ph.page - coalesce(prev.page, 0)) as pages
    from public.progress_history ph
    left join lateral (
      select p2.page
      from public.progress_history p2
      where p2.user_id = p_user_id
        and p2.book_id = ph.book_id
        and p2.recorded_at < ph.recorded_at
      order by p2.recorded_at desc
      limit 1
    ) prev on true
    where ph.user_id = p_user_id
      and p_user_id = (select auth.uid())
  ),
  best_day as (
    select local_day, sum(pages)::int as pages
    from deltas
    group by local_day
    having sum(pages) > 0
    order by 2 desc, 1 desc
    limit 1
  ),
  sessions as (
    -- Cap at 12 h so a forgotten timer never becomes the record.
    select
      ph.recorded_at,
      round(extract(epoch from (ph.recorded_at - ph.session_start_at)) / 60.0)::int as minutes
    from public.progress_history ph
    where ph.user_id = p_user_id
      and p_user_id = (select auth.uid())
      and ph.session_start_at is not null
      and ph.recorded_at > ph.session_start_at
      and ph.recorded_at - ph.session_start_at <= interval '12 hours'
  ),
  best_session as (
    select minutes, (recorded_at at time zone p_timezone)::date as local_day
    from sessions
    order by minutes desc, recorded_at desc
    limit 1
  ),
  night_owl as (
    select exists (
      select 1
      from sessions s
      where extract(hour from (s.recorded_at at time zone p_timezone)) between 0 and 4
    ) as val
  ),
  finishes as (
    select
      b.title,
      min((ph.recorded_at at time zone p_timezone)::date) as first_day,
      min((ph.recorded_at at time zone p_timezone)::date)
        filter (where ph.page >= b.total_pages) as finish_day
    from public.progress_history ph
    join public.books b
      on b.id = ph.book_id
     and b.user_id = p_user_id
    where ph.user_id = p_user_id
      and p_user_id = (select auth.uid())
      and b.total_pages > 0
    group by b.id, b.title
  ),
  fastest as (
    select title, (finish_day - first_day + 1)::int as days
    from finishes
    where finish_day is not null
    order by days asc, title asc
    limit 1
  )
  select json_build_object(
    'bestDay',
      (select json_build_object('pages', pages, 'date', local_day) from best_day),
    'longestSession',
      (select json_build_object('minutes', minutes, 'date', local_day) from best_session),
    'fastestFinish',
      (select json_build_object('days', days, 'title', title) from fastest),
    'nightOwl',
      (select val from night_owl)
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_stats(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and coalesce(b.source, 'manual') = 'manual'
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
        where recorded_at >= date_trunc('month', now())
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

CREATE OR REPLACE FUNCTION public.get_reading_velocity(p_user_id uuid, p_book_ids uuid[])
 RETURNS TABLE(book_id uuid, days_left integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
-- A2. quest / retention / goal / page-capture lifecycle / utility functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_reading_quest_summary(p_user_id uuid, p_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_user_id <> (select auth.uid()) then
    raise exception 'Not allowed';
  end if;

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

-- NOTE: get_retention_summary is NOT activity-log related (weekly session-goal
-- nudge over progress_history + user_settings.weekly_goal) -> included.
CREATE OR REPLACE FUNCTION public.get_retention_summary(p_timezone text DEFAULT 'UTC'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := (select auth.uid());
  v_timezone text := 'UTC';
  v_week_start timestamptz;
  v_week_end timestamptz;
  v_week_start_local date;
  v_sessions_this_week integer := 0;
  v_active_days_this_week integer := 0;
  v_last_session_at timestamptz;
  v_days_since_last_session integer;
  v_weekly_goal integer := 3;
  v_goal_progress_pct integer := 0;
  v_nudge_code text := 'start_week';
begin
  if v_user_id is null then
    return json_build_object(
      'weekStart', null,
      'weekEnd', null,
      'timezone', 'UTC',
      'sessionsThisWeek', 0,
      'weeklyGoal', v_weekly_goal,
      'goalProgressPct', 0,
      'activeDaysThisWeek', 0,
      'lastSessionAt', null,
      'daysSinceLastSession', null,
      'nudgeCode', 'signed_out'
    );
  end if;

  select coalesce(us.weekly_goal, 3)
    into v_weekly_goal
  from public.user_settings us
  where us.user_id = v_user_id;

  if v_weekly_goal is null then
    v_weekly_goal := 3;
  end if;

  select name
    into v_timezone
  from pg_timezone_names
  where name = coalesce(nullif(trim(p_timezone), ''), 'UTC')
  limit 1;

  v_timezone := coalesce(v_timezone, 'UTC');
  v_week_start := date_trunc('week', now() at time zone v_timezone) at time zone v_timezone;
  v_week_end := v_week_start + interval '7 days';
  v_week_start_local := (v_week_start at time zone v_timezone)::date;

  with canonical_sessions as (
    select
      ph.book_id,
      ph.session_start_at,
      min(ph.recorded_at) as recorded_at
    from public.progress_history ph
    where ph.user_id = v_user_id
      and ph.session_start_at is not null
    group by ph.book_id, ph.session_start_at
  ),
  weekly_sessions as (
    select cs.recorded_at
    from canonical_sessions cs
    where cs.recorded_at >= v_week_start
      and cs.recorded_at < v_week_end
  )
  select
    count(*)::int,
    count(distinct (ws.recorded_at at time zone v_timezone)::date)::int
  into v_sessions_this_week, v_active_days_this_week
  from weekly_sessions ws;

  select max(ph.recorded_at)
    into v_last_session_at
  from public.progress_history ph
  where ph.user_id = v_user_id
    and ph.session_start_at is not null;

  if v_last_session_at is not null then
    v_days_since_last_session :=
      (now() at time zone v_timezone)::date
      - (v_last_session_at at time zone v_timezone)::date;
  end if;

  v_goal_progress_pct := least(
    100,
    round((v_sessions_this_week::numeric / v_weekly_goal) * 100)::int
  );

  v_nudge_code := case
    when v_sessions_this_week >= v_weekly_goal then 'goal_met'
    when coalesce(v_days_since_last_session, 0) >= 14 then 'comeback'
    when v_sessions_this_week = 0 then 'start_week'
    when v_sessions_this_week = v_weekly_goal - 1 then 'almost_there'
    else 'keep_going'
  end;

  return json_build_object(
    'weekStart', v_week_start,
    'weekEnd', v_week_end,
    'timezone', v_timezone,
    'sessionsThisWeek', v_sessions_this_week,
    'weeklyGoal', v_weekly_goal,
    'goalProgressPct', v_goal_progress_pct,
    'activeDaysThisWeek', v_active_days_this_week,
    'lastSessionAt', v_last_session_at,
    'daysSinceLastSession', v_days_since_last_session,
    'nudgeCode', v_nudge_code
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_weekly_goal(p_goal integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_goal < 1 or p_goal > 7 then
    raise exception 'Weekly goal must be between 1 and 7';
  end if;

  insert into public.user_settings (user_id, weekly_goal, updated_at)
  values (v_user_id, p_goal, now())
  on conflict (user_id)
  do update set weekly_goal = excluded.weekly_goal,
                updated_at = now();
end;
$function$;

-- !! SECURITY: SECURITY DEFINER, EXECUTE granted to anon + authenticated,
-- !! and NO auth.uid() check on p_user_id (see backend.md BE-SEC findings).
CREATE OR REPLACE FUNCTION public.prune_page_captures_for_book(p_user_id uuid, p_book_id uuid, p_keep integer DEFAULT 5)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  deleted_count integer;
begin
  if p_keep < 1 then
    raise exception 'p_keep must be at least 1';
  end if;

  with ranked as (
    select
      id,
      row_number() over (
        partition by user_id, book_id
        order by captured_at desc, page desc, id desc
      ) as rn
    from public.page_captures
    where user_id = p_user_id
      and book_id = p_book_id
  ),
  deleted as (
    delete from public.page_captures pc
    using ranked r
    where pc.id = r.id
      and r.rn > p_keep
    returning pc.id
  )
  select count(*)::integer into deleted_count
  from deleted;

  return deleted_count;
end;
$function$;

CREATE OR REPLACE FUNCTION public.after_page_capture_saved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.reading_quest_events (
    user_id,
    book_id,
    event_type,
    page,
    source_id,
    occurred_at
  )
  values (
    new.user_id,
    new.book_id,
    'page_capture',
    new.page,
    new.id,
    new.captured_at
  )
  on conflict (user_id, book_id, page)
  where event_type = 'page_capture' and book_id is not null and page is not null
  do update set
    source_id = coalesce(reading_quest_events.source_id, excluded.source_id),
    occurred_at = least(reading_quest_events.occurred_at, excluded.occurred_at);

  perform public.prune_page_captures_for_book(new.user_id, new.book_id, 5);
  return new;
end;
$function$;

-- (Defined live but see Section B: check whether any trigger still uses it.)
CREATE OR REPLACE FUNCTION public.record_page_capture_quest_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  total_pages integer;
  current_page integer;
begin
  insert into public.reading_quest_events (
    user_id,
    book_id,
    event_type,
    page,
    source_id,
    occurred_at
  )
  values (
    new.user_id,
    new.book_id,
    'page_capture',
    new.page,
    new.id,
    new.captured_at
  )
  on conflict (user_id, book_id, page)
  where event_type = 'page_capture' and book_id is not null and page is not null
  do update set
    source_id = coalesce(reading_quest_events.source_id, excluded.source_id),
    occurred_at = least(reading_quest_events.occurred_at, excluded.occurred_at);

  select b.total_pages, rp.current_page
    into total_pages, current_page
  from public.books b
  join public.reading_progress rp
    on rp.book_id = b.id
   and rp.user_id = b.user_id
  where b.id = new.book_id
    and b.user_id = new.user_id;

  if coalesce(total_pages, 0) > 0 and coalesce(current_page, 0) >= total_pages then
    delete from public.page_captures
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_page_captures_on_book_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  total_pages integer;
begin
  select b.total_pages into total_pages
  from public.books b
  where b.id = new.book_id
    and b.user_id = new.user_id;

  if coalesce(total_pages, 0) > 0 and new.current_page >= total_pages then
    delete from public.page_captures
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_book_quizzes_on_book_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  total_pages integer;
begin
  select b.total_pages into total_pages
  from public.books b
  where b.id = new.book_id
    and b.user_id = new.user_id;

  if coalesce(total_pages, 0) > 0 and new.current_page >= total_pages then
    delete from public.book_quizzes
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_isbn(p_isbn text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select nullif(upper(regexp_replace(coalesce(p_isbn, ''), '[^0-9X]', '', 'g')), '')
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_reading_goals_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- -----------------------------------------------------------------------------
-- A3. community: profiles / follows / blocks
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.block_community_user(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.can_community_users_interact(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when (select auth.uid()) is null then null
    else jsonb_build_object(
      'targetUserId', p_target_user_id,
      'allowed', public.community_interaction_reason((select auth.uid()), p_target_user_id) = 'allowed',
      'reason', public.community_interaction_reason((select auth.uid()), p_target_user_id)
    )
  end
$function$;

CREATE OR REPLACE FUNCTION public.community_block_cleanup_follows()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.community_remove_pair_follows(new.blocker_id, new.blocked_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_can_view_profile(p_viewer uuid, p_target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.community_cursor_payload(p_cursor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
begin
  if nullif(trim(coalesce(p_cursor, '')), '') is null then
    return null;
  end if;

  return convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
exception
  when others then
    return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_encode_cursor(p_created_at timestamp with time zone, p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select encode(
    convert_to(
      jsonb_build_object('createdAt', p_created_at, 'userId', p_user_id)::text,
      'utf8'
    ),
    'base64'
  )
$function$;

CREATE OR REPLACE FUNCTION public.community_ensure_count_on_profile_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.community_ensure_follow_count(new.user_id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_ensure_follow_count(p_user_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.community_follow_counts (user_id, followers_count, following_count)
  select p_user_id, 0, 0
  where p_user_id is not null
    and exists (
      select 1
      from public.community_profiles cp
      where cp.user_id = p_user_id
    )
  on conflict (user_id) do nothing
$function$;

CREATE OR REPLACE FUNCTION public.community_follow_counts_after_follow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.community_has_block_between(p_user_a uuid, p_user_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_user_a is null or p_user_b is null then true
    else exists (
      select 1
      from public.blocks b
      where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
         or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
    )
  end
$function$;

CREATE OR REPLACE FUNCTION public.community_interaction_reason(p_viewer uuid, p_target uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_viewer is null or p_target is null then 'profile_unavailable'
    when p_viewer = p_target then 'self'
    when public.community_has_block_between(p_viewer, p_target) then 'blocked'
    when not public.community_can_view_profile(p_viewer, p_target) then 'profile_unavailable'
    else 'allowed'
  end
$function$;

CREATE OR REPLACE FUNCTION public.community_profiles_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.community_reconcile_follow_counts()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.community_relationship_payload(p_viewer uuid, p_target uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- !! SECURITY: SECURITY DEFINER + EXECUTE granted to anon and authenticated,
-- !! no auth.uid() check -> any caller can delete follows between ANY pair.
CREATE OR REPLACE FUNCTION public.community_remove_pair_follows(p_user_a uuid, p_user_b uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.follow_community_user(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_community_relationship_state(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when (select auth.uid()) is null then null
    else public.community_relationship_payload((select auth.uid()), p_target_user_id)
  end
$function$;

CREATE OR REPLACE FUNCTION public.get_my_community_profile()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.is_username_available(p_username text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.unblock_community_user(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.unfollow_community_user(p_target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- -----------------------------------------------------------------------------
-- A4. community: public profile, search, lists, also-reading
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.also_reading_cursor_payload(p_cursor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.also_reading_encode_cursor(p_updated_at timestamp with time zone, p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select encode(
    convert_to(
      jsonb_build_object('updatedAt', p_updated_at, 'userId', p_user_id)::text,
      'utf8'
    ),
    'base64'
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_also_reading_for_book(p_book_id uuid, p_isbn text DEFAULT NULL::text, p_limit integer DEFAULT 3, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_public_profile_by_username(p_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.list_community_followers(p_user_id uuid, p_limit integer DEFAULT 20, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- list_community_following: identical to list_community_followers except the
-- join is cp.user_id = f.following_id and the filter is f.follower_id = p_user_id.
CREATE OR REPLACE FUNCTION public.list_community_following(p_user_id uuid, p_limit integer DEFAULT 20, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.list_my_blocked_users(p_limit integer DEFAULT 20, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.search_community_readers(p_query text, p_limit integer DEFAULT 20, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.upsert_my_community_profile(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- -----------------------------------------------------------------------------
-- A5. reading circles
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_circle_reaction(p_circle_id uuid, p_book_id uuid, p_source_page integer, p_content text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.circle_assert_member_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if public.circle_member_count(new.circle_id) >= 10 then
    raise exception 'circle_full' using errcode = 'P0001';
  end if;

  if public.circle_members_have_block(new.circle_id, new.user_id) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.circle_block_cleanup_memberships()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.circle_book_matches(p_circle_book_id uuid, p_circle_isbn text, p_user_id uuid, p_book_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.circle_member_count(p_circle_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::integer
  from public.circle_members
  where circle_id = p_circle_id;
$function$;

CREATE OR REPLACE FUNCTION public.circle_members_have_block(p_circle_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.circle_members cm
    where cm.circle_id = p_circle_id
      and cm.user_id <> p_user_id
      and public.community_has_block_between(cm.user_id, p_user_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.circle_progress_location(p_circle_id uuid, p_user_id uuid)
 RETURNS TABLE(book_id uuid, current_page integer, total_pages integer, normalized_location numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.circle_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.circle_user_is_member(p_circle_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
      and rc.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.circle_user_is_owner(p_circle_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.circle_members cm
    join public.reading_circles rc on rc.id = cm.circle_id
    where cm.circle_id = p_circle_id
      and cm.user_id = p_user_id
      and cm.role = 'owner'
      and rc.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION public.circle_users_can_share(p_user_a uuid, p_user_b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p_user_a is not null
     and p_user_b is not null
     and p_user_a <> p_user_b
     and not public.community_has_block_between(p_user_a, p_user_b);
$function$;

CREATE OR REPLACE FUNCTION public.create_reading_circle(p_book_id uuid, p_name text, p_invited_user_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_reading_circle_detail(p_circle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_visible_circle_reactions(p_circle_id uuid, p_min_location numeric DEFAULT NULL::numeric, p_max_location numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.invite_reading_circle_members(p_circle_id uuid, p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.leave_reading_circle(p_circle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.list_my_reading_circles(p_limit integer DEFAULT 20, p_cursor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.remove_reading_circle_member(p_circle_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_reading_circle_invitation(p_invitation_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- =============================================================================
-- SECTION B. TRIGGERS (pg_get_triggerdef) — all enabled ('O' = origin/local)
-- No triggers exist on auth.users (no "on signup" profile/settings bootstrap).
-- No updated_at triggers on books, lexicon_entries, recaps, up_next_order,
-- user_settings, page_captures, lore_cards (updated_at must be set by caller
-- where a column exists).
-- NOTE: after_page_capture_saved() (prune-to-5) is NOT attached to any trigger;
-- the live page_captures trigger calls record_page_capture_quest_event().
-- =============================================================================

CREATE TRIGGER circle_block_cleanup_memberships AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION circle_block_cleanup_memberships();
CREATE TRIGGER community_block_cleanup_follows AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION community_block_cleanup_follows();
CREATE TRIGGER circle_members_assert_insert BEFORE INSERT ON public.circle_members FOR EACH ROW EXECUTE FUNCTION circle_assert_member_insert();
CREATE TRIGGER community_profile_privacy_touch_updated_at BEFORE UPDATE ON public.community_profile_privacy FOR EACH ROW EXECUTE FUNCTION community_profiles_touch_updated_at();
CREATE TRIGGER community_ensure_count_on_profile_insert AFTER INSERT ON public.community_profiles FOR EACH ROW EXECUTE FUNCTION community_ensure_count_on_profile_insert();
CREATE TRIGGER community_profiles_touch_updated_at BEFORE UPDATE ON public.community_profiles FOR EACH ROW EXECUTE FUNCTION community_profiles_touch_updated_at();
CREATE TRIGGER community_follow_counts_after_follow_delete AFTER DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION community_follow_counts_after_follow();
CREATE TRIGGER community_follow_counts_after_follow_insert AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION community_follow_counts_after_follow();
CREATE TRIGGER page_capture_quest_event_after_save AFTER INSERT OR UPDATE ON public.page_captures FOR EACH ROW EXECUTE FUNCTION record_page_capture_quest_event();
CREATE TRIGGER reading_circles_touch_updated_at BEFORE UPDATE ON public.reading_circles FOR EACH ROW EXECUTE FUNCTION circle_touch_updated_at();
CREATE TRIGGER set_reading_goals_updated_at BEFORE UPDATE ON public.reading_goals FOR EACH ROW EXECUTE FUNCTION set_reading_goals_updated_at();
CREATE TRIGGER book_quizzes_delete_on_completion AFTER INSERT OR UPDATE OF current_page ON public.reading_progress FOR EACH ROW EXECUTE FUNCTION delete_book_quizzes_on_book_completion();
CREATE TRIGGER page_captures_delete_on_completion AFTER INSERT OR UPDATE OF current_page ON public.reading_progress FOR EACH ROW EXECUTE FUNCTION delete_page_captures_on_book_completion();
CREATE TRIGGER reading_progress_updated_at BEFORE UPDATE ON public.reading_progress FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- SECTION C. ROW LEVEL SECURITY — RLS is ENABLED (not FORCED) on every public
-- table. Rendered from pg_policies. All policies are PERMISSIVE.
-- Tables WITHOUT a policy for a command => that command is denied to
-- anon/authenticated via PostgREST (only SECURITY DEFINER RPCs / service role).
-- =============================================================================

-- achievements (insert-only ledger: no UPDATE / DELETE policy)
CREATE POLICY "Achievements are insertable by owner" ON public.achievements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Achievements are viewable by owner" ON public.achievements AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

-- anki_review_sessions
CREATE POLICY "Users manage own review sessions" ON public.anki_review_sessions AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- blocks (no UPDATE policy)
CREATE POLICY blocks_blocker_delete ON public.blocks AS PERMISSIVE FOR DELETE TO public USING ((blocker_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY blocks_blocker_insert ON public.blocks AS PERMISSIVE FOR INSERT TO public WITH CHECK ((blocker_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY blocks_participant_select ON public.blocks AS PERMISSIVE FOR SELECT TO public USING (((blocker_id = ( SELECT auth.uid() AS uid)) OR (blocked_id = ( SELECT auth.uid() AS uid))));

-- book_passports
CREATE POLICY "Users manage own book_passports" ON public.book_passports AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- book_quizzes
CREATE POLICY "Book quizzes are deletable by owner" ON public.book_quizzes AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Book quizzes are insertable by owner" ON public.book_quizzes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Book quizzes are viewable by owner" ON public.book_quizzes AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Book quizzes are updatable by owner" ON public.book_quizzes AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

-- books
CREATE POLICY "Users can manage their own books" ON public.books AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- circle_invitations (SELECT only; all writes via SECURITY DEFINER RPCs)
CREATE POLICY circle_invitations_recipient_or_owner_select ON public.circle_invitations AS PERMISSIVE FOR SELECT TO authenticated USING (((invited_user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT circle_user_is_owner(circle_invitations.circle_id, ( SELECT auth.uid() AS uid)) AS circle_user_is_owner)));

-- circle_members (SELECT only)
CREATE POLICY circle_members_member_select ON public.circle_members AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT circle_user_is_member(circle_members.circle_id, ( SELECT auth.uid() AS uid)) AS circle_user_is_member));

-- circle_reactions (SELECT own only; read others via get_visible_circle_reactions)
CREATE POLICY circle_reactions_author_select ON public.circle_reactions AS PERMISSIVE FOR SELECT TO authenticated USING ((author_id = ( SELECT auth.uid() AS uid)));

-- community_follow_counts (SELECT own only; maintained by triggers)
CREATE POLICY community_follow_counts_owner_select ON public.community_follow_counts AS PERMISSIVE FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));

-- community_profile_privacy (no DELETE policy; cascades from community_profiles)
CREATE POLICY community_profile_privacy_owner_insert ON public.community_profile_privacy AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY community_profile_privacy_owner_select ON public.community_profile_privacy AS PERMISSIVE FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY community_profile_privacy_owner_update ON public.community_profile_privacy AS PERMISSIVE FOR UPDATE TO public USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- community_profiles
CREATE POLICY community_profiles_owner_delete ON public.community_profiles AS PERMISSIVE FOR DELETE TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY community_profiles_owner_insert ON public.community_profiles AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY community_profiles_owner_select ON public.community_profiles AS PERMISSIVE FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY community_profiles_owner_update ON public.community_profiles AS PERMISSIVE FOR UPDATE TO public USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- follows (no UPDATE policy)
CREATE POLICY follows_follower_delete ON public.follows AS PERMISSIVE FOR DELETE TO public USING ((follower_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY follows_follower_insert ON public.follows AS PERMISSIVE FOR INSERT TO public WITH CHECK ((follower_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY follows_participant_select ON public.follows AS PERMISSIVE FOR SELECT TO public USING (((follower_id = ( SELECT auth.uid() AS uid)) OR (following_id = ( SELECT auth.uid() AS uid))));

-- lexicon_entries
CREATE POLICY "Users manage own lexicon_entries" ON public.lexicon_entries AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- lore_cards
CREATE POLICY lore_cards_delete_own ON public.lore_cards AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY lore_cards_insert_own ON public.lore_cards AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY lore_cards_select_own ON public.lore_cards AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY lore_cards_update_own ON public.lore_cards AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- page_captures
CREATE POLICY page_captures_delete_own ON public.page_captures AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY page_captures_insert_own ON public.page_captures AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY page_captures_select_own ON public.page_captures AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY page_captures_update_own ON public.page_captures AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- progress_history
CREATE POLICY "Users manage own progress_history" ON public.progress_history AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- reading_circles (SELECT only)
CREATE POLICY reading_circles_member_select ON public.reading_circles AS PERMISSIVE FOR SELECT TO authenticated USING (( SELECT circle_user_is_member(reading_circles.id, ( SELECT auth.uid() AS uid)) AS circle_user_is_member));

-- reading_dna (no DELETE policy; UPDATE has no WITH CHECK)
CREATE POLICY reading_dna_insert ON public.reading_dna AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY reading_dna_select ON public.reading_dna AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY reading_dna_update ON public.reading_dna AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));

-- reading_goals
CREATE POLICY "Reading goals are deletable by owner" ON public.reading_goals AS PERMISSIVE FOR DELETE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Reading goals are insertable by owner" ON public.reading_goals AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Reading goals are viewable by owner" ON public.reading_goals AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Reading goals are updatable by owner" ON public.reading_goals AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

-- reading_progress
CREATE POLICY "Users can manage their own progress" ON public.reading_progress AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- reading_quest_events (SELECT only; rows written by trigger)
CREATE POLICY "Reading quest events are viewable by owner" ON public.reading_quest_events AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));

-- recaps
CREATE POLICY "Users can manage their own recaps" ON public.recaps AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- up_next_order
CREATE POLICY "Users manage own up_next_order" ON public.up_next_order AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- user_settings (no DELETE policy)
CREATE POLICY users_own_settings_insert ON public.user_settings AS PERMISSIVE FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY users_own_settings_select ON public.user_settings AS PERMISSIVE FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY users_own_settings_update ON public.user_settings AS PERMISSIVE FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- vocabulary_extractions (no DELETE policy; UPDATE has no WITH CHECK)
CREATE POLICY vocabulary_extractions_insert ON public.vocabulary_extractions AS PERMISSIVE FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY vocabulary_extractions_select ON public.vocabulary_extractions AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY vocabulary_extractions_update ON public.vocabulary_extractions AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id));

-- storage.objects
CREATE POLICY community_avatars_owner_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'community-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));
CREATE POLICY community_avatars_owner_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'community-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));
CREATE POLICY community_avatars_owner_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'community-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));
CREATE POLICY community_avatars_owner_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'community-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text))))) WITH CHECK (((bucket_id = 'community-avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.jwt() ->> 'sub'::text)))));
CREATE POLICY "recap-images: owner can delete" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'recap-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "recap-images: owner can insert" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'recap-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));
CREATE POLICY "recap-images: owner can select" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'recap-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

-- =============================================================================
-- SECTION D. CONSTRAINTS (pg_get_constraintdef) — PK / UNIQUE / CHECK / FK
-- =============================================================================

-- achievements
ALTER TABLE public.achievements ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);
ALTER TABLE public.achievements ADD CONSTRAINT achievements_user_id_achievement_key_key UNIQUE (user_id, achievement_key);
ALTER TABLE public.achievements ADD CONSTRAINT achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- anki_review_sessions
ALTER TABLE public.anki_review_sessions ADD CONSTRAINT anki_review_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.anki_review_sessions ADD CONSTRAINT anki_review_sessions_user_id_key UNIQUE (user_id);
ALTER TABLE public.anki_review_sessions ADD CONSTRAINT anki_review_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- blocks
ALTER TABLE public.blocks ADD CONSTRAINT blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
ALTER TABLE public.blocks ADD CONSTRAINT blocks_no_self_chk CHECK ((blocker_id <> blocked_id));
ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.blocks ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- book_passports
ALTER TABLE public.book_passports ADD CONSTRAINT book_passports_pkey PRIMARY KEY (id);
ALTER TABLE public.book_passports ADD CONSTRAINT book_passports_book_id_key UNIQUE (book_id);
ALTER TABLE public.book_passports ADD CONSTRAINT book_passports_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.book_passports ADD CONSTRAINT book_passports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- book_quizzes
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_pkey PRIMARY KEY (id);
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_user_id_book_id_key UNIQUE (user_id, book_id);
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_page_snapshot_check CHECK ((page_snapshot >= 0));
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 3))));
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.book_quizzes ADD CONSTRAINT book_quizzes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- books
ALTER TABLE public.books ADD CONSTRAINT books_pkey PRIMARY KEY (id);
ALTER TABLE public.books ADD CONSTRAINT books_author_check CHECK (((char_length(author) >= 1) AND (char_length(author) <= 200)));
ALTER TABLE public.books ADD CONSTRAINT books_isbn_check CHECK ((isbn ~ '^\d{9}[\dX]$|^\d{13}$'::text));
ALTER TABLE public.books ADD CONSTRAINT books_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 500)));
ALTER TABLE public.books ADD CONSTRAINT books_total_pages_check CHECK ((total_pages >= 1));
ALTER TABLE public.books ADD CONSTRAINT books_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- circle_invitations
ALTER TABLE public.circle_invitations ADD CONSTRAINT circle_invitations_pkey PRIMARY KEY (id);
ALTER TABLE public.circle_invitations ADD CONSTRAINT circle_invitations_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES reading_circles(id) ON DELETE CASCADE;
ALTER TABLE public.circle_invitations ADD CONSTRAINT circle_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.circle_invitations ADD CONSTRAINT circle_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- circle_members
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_pkey PRIMARY KEY (circle_id, user_id);
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES reading_circles(id) ON DELETE CASCADE;
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_invitation_id_fkey FOREIGN KEY (invitation_id) REFERENCES circle_invitations(id) ON DELETE SET NULL;
ALTER TABLE public.circle_members ADD CONSTRAINT circle_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- circle_reactions
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_pkey PRIMARY KEY (id);
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_content_length CHECK (((length(btrim(content)) >= 1) AND (length(btrim(content)) <= 280)));
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_location_range CHECK (((normalized_location >= (0)::numeric) AND (normalized_location <= (100)::numeric)));
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_page_in_range CHECK ((source_page <= source_total_pages));
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_page_positive CHECK ((source_page > 0));
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_total_pages_positive CHECK ((source_total_pages > 0));
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.circle_reactions ADD CONSTRAINT circle_reactions_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES reading_circles(id) ON DELETE CASCADE;
-- community_follow_counts
ALTER TABLE public.community_follow_counts ADD CONSTRAINT community_follow_counts_pkey PRIMARY KEY (user_id);
ALTER TABLE public.community_follow_counts ADD CONSTRAINT community_follow_counts_non_negative_chk CHECK (((followers_count >= 0) AND (following_count >= 0)));
ALTER TABLE public.community_follow_counts ADD CONSTRAINT community_follow_counts_user_id_fkey FOREIGN KEY (user_id) REFERENCES community_profiles(user_id) ON DELETE CASCADE;
-- community_profile_privacy
ALTER TABLE public.community_profile_privacy ADD CONSTRAINT community_profile_privacy_pkey PRIMARY KEY (user_id);
ALTER TABLE public.community_profile_privacy ADD CONSTRAINT community_profile_privacy_user_id_fkey FOREIGN KEY (user_id) REFERENCES community_profiles(user_id) ON DELETE CASCADE;
-- community_profiles
ALTER TABLE public.community_profiles ADD CONSTRAINT community_profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE public.community_profiles ADD CONSTRAINT community_profiles_bio_len_chk CHECK (((bio IS NULL) OR (char_length(bio) <= 160)));
ALTER TABLE public.community_profiles ADD CONSTRAINT community_profiles_username_format_chk CHECK ((username ~ '^[a-z0-9_-]{3,30}$'::text));
ALTER TABLE public.community_profiles ADD CONSTRAINT community_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- follows
ALTER TABLE public.follows ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);
ALTER TABLE public.follows ADD CONSTRAINT follows_no_self_chk CHECK ((follower_id <> following_id));
ALTER TABLE public.follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- lexicon_entries
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_definition_check CHECK ((char_length(definition) >= 1));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_entry_type_check CHECK ((entry_type = ANY (ARRAY['dictionary'::text, 'quote'::text])));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_leitner_box_check CHECK (((leitner_box >= 1) AND (leitner_box <= 5)));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_page_found_check CHECK ((page_found >= 1));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'auto'::text])));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_term_check CHECK (((char_length(term) >= 1) AND (char_length(term) <= 200)));
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.lexicon_entries ADD CONSTRAINT lexicon_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- lore_cards
ALTER TABLE public.lore_cards ADD CONSTRAINT lore_cards_pkey PRIMARY KEY (id);
ALTER TABLE public.lore_cards ADD CONSTRAINT lore_cards_unique_milestone UNIQUE (user_id, book_id, unlocked_at_milestone);
ALTER TABLE public.lore_cards ADD CONSTRAINT lore_cards_unlocked_at_milestone_check CHECK ((unlocked_at_milestone = ANY (ARRAY[10, 20, 30, 40, 50, 60, 70, 80, 90])));
ALTER TABLE public.lore_cards ADD CONSTRAINT lore_cards_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.lore_cards ADD CONSTRAINT lore_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- page_captures
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_pkey PRIMARY KEY (id);
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_user_id_book_id_page_key UNIQUE (user_id, book_id, page);
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_confidence_check CHECK (((confidence >= (0)::numeric) AND (confidence <= (1)::numeric)));
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_page_check CHECK ((page >= 0));
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_source_check CHECK ((source = ANY (ARRAY['ocr'::text, 'manual'::text, 'import'::text])));
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_text_check CHECK (((char_length(text) > 0) AND (char_length(text) <= 10000)));
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_word_count_check CHECK ((word_count >= 0));
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.page_captures ADD CONSTRAINT page_captures_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- progress_history
ALTER TABLE public.progress_history ADD CONSTRAINT progress_history_pkey PRIMARY KEY (id);
ALTER TABLE public.progress_history ADD CONSTRAINT progress_history_page_check CHECK ((page >= 0));
ALTER TABLE public.progress_history ADD CONSTRAINT progress_history_session_note_check CHECK ((char_length(session_note) <= 160));
ALTER TABLE public.progress_history ADD CONSTRAINT progress_history_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.progress_history ADD CONSTRAINT progress_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- reading_circles
ALTER TABLE public.reading_circles ADD CONSTRAINT reading_circles_pkey PRIMARY KEY (id);
ALTER TABLE public.reading_circles ADD CONSTRAINT reading_circles_name_not_blank CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80)));
ALTER TABLE public.reading_circles ADD CONSTRAINT reading_circles_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.reading_circles ADD CONSTRAINT reading_circles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.reading_circles ADD CONSTRAINT reading_circles_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- reading_dna
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_pkey PRIMARY KEY (user_id);
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_books_finished_at_generation_check CHECK ((books_finished_at_generation >= 0));
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_mood_emojis_check CHECK (((array_length(mood_emojis, 1) >= 1) AND (array_length(mood_emojis, 1) <= 5)));
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_mood_tone_check CHECK (((char_length(mood_tone) >= 1) AND (char_length(mood_tone) <= 40)));
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_personality_check CHECK (((char_length(personality) >= 50) AND (char_length(personality) <= 800)));
ALTER TABLE public.reading_dna ADD CONSTRAINT reading_dna_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- reading_goals
ALTER TABLE public.reading_goals ADD CONSTRAINT reading_goals_pkey PRIMARY KEY (id);
ALTER TABLE public.reading_goals ADD CONSTRAINT reading_goals_user_year_key UNIQUE (user_id, year);
ALTER TABLE public.reading_goals ADD CONSTRAINT reading_goals_target_books_check CHECK ((target_books >= 1));
ALTER TABLE public.reading_goals ADD CONSTRAINT reading_goals_year_check CHECK (((year >= 2000) AND (year <= 2100)));
ALTER TABLE public.reading_goals ADD CONSTRAINT reading_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- reading_progress
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_pkey PRIMARY KEY (id);
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_book_id_user_id_key UNIQUE (book_id, user_id);
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.reading_progress ADD CONSTRAINT reading_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- reading_quest_events
ALTER TABLE public.reading_quest_events ADD CONSTRAINT reading_quest_events_pkey PRIMARY KEY (id);
ALTER TABLE public.reading_quest_events ADD CONSTRAINT reading_quest_events_event_type_check CHECK ((event_type = 'page_capture'::text));
ALTER TABLE public.reading_quest_events ADD CONSTRAINT reading_quest_events_page_check CHECK (((page IS NULL) OR (page >= 0)));
ALTER TABLE public.reading_quest_events ADD CONSTRAINT reading_quest_events_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE public.reading_quest_events ADD CONSTRAINT reading_quest_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- recaps
ALTER TABLE public.recaps ADD CONSTRAINT recaps_pkey PRIMARY KEY (id);
ALTER TABLE public.recaps ADD CONSTRAINT recaps_concept_watchlist_check CHECK ((char_length(concept_watchlist) > 0));
ALTER TABLE public.recaps ADD CONSTRAINT recaps_image_status_check CHECK (((image_status IS NULL) OR (image_status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed_safety'::text, 'failed_transient'::text, 'skipped'::text]))));
ALTER TABLE public.recaps ADD CONSTRAINT recaps_memory_jogger_check CHECK ((char_length(memory_jogger) > 0));
ALTER TABLE public.recaps ADD CONSTRAINT recaps_mode_check CHECK ((mode = ANY (ARRAY['corpus'::text, 'inferred'::text])));
ALTER TABLE public.recaps ADD CONSTRAINT recaps_thematic_bridge_check CHECK ((char_length(thematic_bridge) > 0));
ALTER TABLE public.recaps ADD CONSTRAINT recaps_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.recaps ADD CONSTRAINT recaps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- up_next_order
ALTER TABLE public.up_next_order ADD CONSTRAINT up_next_order_pkey PRIMARY KEY (id);
ALTER TABLE public.up_next_order ADD CONSTRAINT up_next_order_user_id_book_id_key UNIQUE (user_id, book_id);
ALTER TABLE public.up_next_order ADD CONSTRAINT up_next_order_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.up_next_order ADD CONSTRAINT up_next_order_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- user_settings
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_weekly_goal_check CHECK (((weekly_goal >= 1) AND (weekly_goal <= 7)));
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
-- vocabulary_extractions
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_pkey PRIMARY KEY (id);
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_capture_id_key UNIQUE (capture_id);
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_page_check CHECK ((page >= 0));
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'skipped'::text])));
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_words_added_check CHECK (((words_added >= 0) AND (words_added <= 5)));
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_book_id_fkey FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_capture_id_fkey FOREIGN KEY (capture_id) REFERENCES page_captures(id) ON DELETE SET NULL;
ALTER TABLE public.vocabulary_extractions ADD CONSTRAINT vocabulary_extractions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =============================================================================
-- SECTION E. INDEXES (pg_get_indexdef) — non-constraint + constraint-backed
-- =============================================================================
CREATE INDEX idx_anki_review_sessions_user ON public.anki_review_sessions USING btree (user_id);  -- redundant with UNIQUE(user_id)
CREATE INDEX blocks_blocked_blocker_idx ON public.blocks USING btree (blocked_id, blocker_id);
CREATE INDEX blocks_blocked_created_idx ON public.blocks USING btree (blocked_id, created_at DESC, blocker_id);
CREATE INDEX blocks_blocker_created_idx ON public.blocks USING btree (blocker_id, created_at DESC, blocked_id);
CREATE INDEX book_quizzes_book_id_idx ON public.book_quizzes USING btree (book_id);
CREATE INDEX books_normalized_isbn_user_idx ON public.books USING btree (normalize_isbn(isbn), user_id, id) WHERE (isbn IS NOT NULL);
CREATE INDEX books_user_id_id_idx ON public.books USING btree (user_id, id);
CREATE INDEX books_user_id_idx ON public.books USING btree (user_id);
CREATE INDEX circle_invitations_circle_status_idx ON public.circle_invitations USING btree (circle_id, status, created_at DESC);
CREATE INDEX circle_invitations_invited_by_idx ON public.circle_invitations USING btree (invited_by);
CREATE UNIQUE INDEX circle_invitations_pending_unique_idx ON public.circle_invitations USING btree (circle_id, invited_user_id) WHERE (status = 'pending'::circle_invitation_status);
CREATE INDEX circle_invitations_user_status_idx ON public.circle_invitations USING btree (invited_user_id, status, created_at DESC);
CREATE INDEX circle_members_circle_role_idx ON public.circle_members USING btree (circle_id, role, joined_at);
CREATE INDEX circle_members_invitation_id_idx ON public.circle_members USING btree (invitation_id) WHERE (invitation_id IS NOT NULL);
CREATE UNIQUE INDEX circle_members_one_owner_idx ON public.circle_members USING btree (circle_id) WHERE (role = 'owner'::circle_member_role);
CREATE INDEX circle_members_user_joined_idx ON public.circle_members USING btree (user_id, joined_at DESC);
CREATE INDEX circle_reactions_author_created_idx ON public.circle_reactions USING btree (author_id, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX circle_reactions_book_idx ON public.circle_reactions USING btree (book_id);
CREATE INDEX circle_reactions_circle_location_idx ON public.circle_reactions USING btree (circle_id, normalized_location, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX community_follow_counts_followers_idx ON public.community_follow_counts USING btree (followers_count DESC, user_id);
CREATE INDEX community_follow_counts_following_idx ON public.community_follow_counts USING btree (following_count DESC, user_id);
CREATE INDEX community_profiles_public_display_name_created_idx ON public.community_profiles USING btree (is_public, lower(COALESCE(display_name, ''::text)), created_at DESC, user_id);
CREATE INDEX community_profiles_public_username_created_idx ON public.community_profiles USING btree (is_public, lower(username), created_at DESC, user_id);
CREATE INDEX community_profiles_public_username_idx ON public.community_profiles USING btree (username) WHERE (is_public = true);
CREATE UNIQUE INDEX community_profiles_username_lower_uidx ON public.community_profiles USING btree (lower(username));
CREATE INDEX follows_follower_created_idx ON public.follows USING btree (follower_id, created_at DESC, following_id);
CREATE INDEX follows_following_created_idx ON public.follows USING btree (following_id, created_at DESC, follower_id);
CREATE INDEX follows_following_follower_idx ON public.follows USING btree (following_id, follower_id);
CREATE INDEX idx_lexicon_review ON public.lexicon_entries USING btree (user_id, next_review_at);
CREATE INDEX idx_lexicon_user_book ON public.lexicon_entries USING btree (user_id, book_id);
CREATE INDEX lexicon_entries_user_leitner_created_idx ON public.lexicon_entries USING btree (user_id, leitner_box, created_at DESC);
CREATE INDEX lore_cards_user_book_idx ON public.lore_cards USING btree (user_id, book_id);
CREATE INDEX lore_cards_user_created_at_idx ON public.lore_cards USING btree (user_id, created_at DESC);
CREATE INDEX idx_page_captures_user_book_page ON public.page_captures USING btree (user_id, book_id, page);  -- duplicate of UNIQUE(user_id,book_id,page)
CREATE INDEX page_captures_user_captured_at_idx ON public.page_captures USING btree (user_id, captured_at DESC);
CREATE INDEX idx_progress_history_book_user ON public.progress_history USING btree (book_id, user_id, recorded_at DESC);
CREATE INDEX progress_history_user_book_recorded_at_id_idx ON public.progress_history USING btree (user_id, book_id, recorded_at, id);
CREATE INDEX progress_history_user_book_recorded_at_idx ON public.progress_history USING btree (user_id, book_id, recorded_at);  -- prefix of previous
CREATE INDEX progress_history_user_recorded_at_desc_idx ON public.progress_history USING btree (user_id, recorded_at DESC);
CREATE INDEX progress_history_user_recorded_at_idx ON public.progress_history USING btree (user_id, recorded_at DESC);  -- DUPLICATE (advisor)
CREATE INDEX progress_history_user_session_start_idx ON public.progress_history USING btree (user_id, session_start_at, recorded_at) WHERE (session_start_at IS NOT NULL);
CREATE INDEX reading_circles_book_idx ON public.reading_circles USING btree (book_id, status);
CREATE INDEX reading_circles_created_by_idx ON public.reading_circles USING btree (created_by);
CREATE INDEX reading_circles_isbn_idx ON public.reading_circles USING btree (normalized_isbn, status) WHERE (normalized_isbn IS NOT NULL);
CREATE INDEX reading_circles_owner_status_idx ON public.reading_circles USING btree (owner_id, status, updated_at DESC);
CREATE INDEX reading_goals_user_year_idx ON public.reading_goals USING btree (user_id, year);  -- redundant with UNIQUE(user_id,year)
CREATE INDEX reading_progress_user_book_active_idx ON public.reading_progress USING btree (user_id, book_id, updated_at DESC) WHERE (current_page > 0);
CREATE INDEX reading_progress_user_id_idx ON public.reading_progress USING btree (user_id);
CREATE INDEX reading_progress_user_updated_at_idx ON public.reading_progress USING btree (user_id, updated_at DESC);
CREATE UNIQUE INDEX reading_quest_events_page_capture_unique_idx ON public.reading_quest_events USING btree (user_id, book_id, page) WHERE ((event_type = 'page_capture'::text) AND (book_id IS NOT NULL) AND (page IS NOT NULL));
CREATE INDEX reading_quest_events_user_type_occurred_idx ON public.reading_quest_events USING btree (user_id, event_type, occurred_at DESC);
CREATE INDEX recaps_book_user_idx ON public.recaps USING btree (book_id, user_id, created_at DESC);
CREATE INDEX recaps_image_status_idx ON public.recaps USING btree (image_status) WHERE (image_status IS NOT NULL);
CREATE INDEX recaps_user_created_at_idx ON public.recaps USING btree (user_id, created_at DESC);
CREATE INDEX vocabulary_extractions_user_recent_idx ON public.vocabulary_extractions USING btree (user_id, created_at DESC);
-- (PK / UNIQUE constraint indexes omitted here: see Section D.)

-- =============================================================================
-- SECTION F. ENUM TYPES (public)
-- =============================================================================
CREATE TYPE public.circle_invitation_status AS ENUM ('pending', 'accepted', 'declined', 'revoked', 'expired');
CREATE TYPE public.circle_member_role AS ENUM ('owner', 'member');
CREATE TYPE public.circle_status AS ENUM ('active', 'closed');
CREATE TYPE public.profile_visibility AS ENUM ('everyone', 'followers', 'nobody');

-- =============================================================================
-- SECTION G. STORAGE BUCKETS (storage.buckets) — policies in Section C
-- =============================================================================
-- id/name             public  file_size_limit  allowed_mime_types
-- community-avatars   true    5242880 (5 MiB)  image/jpeg, image/png, image/webp
-- recap-images        false   10485760 (10 MiB) image/png, image/jpeg, image/webp
-- Path convention enforced by policy: '<auth.uid()>/<...>' (first folder = user id).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-avatars', 'community-avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
       ('recap-images', 'recap-images', false, 10485760, ARRAY['image/png','image/jpeg','image/webp']);

-- =============================================================================
-- SECTION H. TABLE COLUMNS (information_schema) — reference only
-- =============================================================================
-- achievements: id uuid PK default gen_random_uuid() | user_id uuid NOT NULL | achievement_key text NOT NULL | earned_at timestamptz NOT NULL default now()
-- anki_review_sessions: id uuid PK | user_id uuid NOT NULL UNIQUE | last_reviewed_at timestamptz NOT NULL default now() | total_sessions int NOT NULL default 1 | known_count int NOT NULL default 0 | unknown_count int NOT NULL default 0
-- blocks: blocker_id uuid | blocked_id uuid | created_at timestamptz NOT NULL default now()   (PK blocker_id,blocked_id)
-- book_passports: id uuid PK | book_id uuid NOT NULL UNIQUE | user_id uuid NOT NULL | total_days int | peak_day date | peak_day_pages int | vocabulary_count int NOT NULL default 0 | ai_summary text | generated_at timestamptz NOT NULL default now()
-- book_quizzes: id uuid PK | user_id uuid NOT NULL | book_id uuid NOT NULL | page_snapshot int NOT NULL | questions jsonb NOT NULL | score int | answered_at timestamptz | generated_at timestamptz NOT NULL default now()
-- books: id uuid PK | user_id uuid NOT NULL | title text NOT NULL | author text NOT NULL | isbn text | cover_url text | total_pages int NOT NULL | genre text | created_at timestamptz NOT NULL default now() | description text | source text NOT NULL default 'manual' (observed values: manual, goodreads; NO check) | page_count_estimated bool NOT NULL default false
-- circle_invitations: id uuid PK | circle_id uuid NOT NULL | invited_user_id uuid NOT NULL | invited_by uuid NOT NULL | status circle_invitation_status NOT NULL default 'pending' | created_at timestamptz NOT NULL default now() | responded_at timestamptz
-- circle_members: circle_id uuid | user_id uuid | role circle_member_role NOT NULL default 'member' | invitation_id uuid | joined_at timestamptz NOT NULL default now()
-- circle_reactions: id uuid PK | circle_id uuid NOT NULL | author_id uuid NOT NULL | book_id uuid NOT NULL | source_page int NOT NULL | source_total_pages int NOT NULL | normalized_location numeric(6,3) NOT NULL | content text NOT NULL | created_at timestamptz NOT NULL default now() | deleted_at timestamptz
-- community_follow_counts: user_id uuid PK | followers_count int NOT NULL default 0 | following_count int NOT NULL default 0 | updated_at timestamptz NOT NULL default now()
-- community_profile_privacy: user_id uuid PK | progress_visibility / currently_reading_visibility / lexicon_visibility / reader_dna_visibility profile_visibility NOT NULL default 'nobody' | created_at, updated_at timestamptz NOT NULL default now()
-- community_profiles: user_id uuid PK | username text NOT NULL | display_name text | bio text | avatar_url text | is_public bool NOT NULL default false | created_at, updated_at timestamptz NOT NULL default now()
-- follows: follower_id uuid | following_id uuid | created_at timestamptz NOT NULL default now()   (PK follower_id,following_id)
-- lexicon_entries: id uuid PK | user_id uuid NOT NULL | book_id uuid NOT NULL | term text NOT NULL | definition text NOT NULL | entry_type text NOT NULL default 'dictionary' | context_sentence text | page_found int | leitner_box int NOT NULL default 1 | next_review_at date NOT NULL default CURRENT_DATE | created_at timestamptz NOT NULL default now() | source text NOT NULL default 'manual' | mastered bool NOT NULL default false | last_reviewed_at timestamptz
-- lore_cards: id uuid PK | user_id uuid NOT NULL | book_id uuid NOT NULL | title text NOT NULL | content text NOT NULL | type text NOT NULL (observed: Lore, Geography, History, Culture; NO check) | linked_entities text[] NOT NULL default '{}' | unlocked_at_page int NOT NULL | unlocked_at_milestone int NOT NULL | seen bool NOT NULL default false | created_at timestamptz NOT NULL default now()
-- page_captures: id uuid PK | user_id uuid NOT NULL | book_id uuid NOT NULL | page int NOT NULL | text text NOT NULL | word_count int NOT NULL | confidence numeric(3,2) NOT NULL | captured_at timestamptz NOT NULL default now() | source text NOT NULL default 'ocr' | resume jsonb | resume_generated_at timestamptz
-- progress_history: id uuid PK | book_id uuid NOT NULL | user_id uuid NOT NULL | page int NOT NULL | recorded_at timestamptz NOT NULL default now() | session_start_at timestamptz | session_note text
-- reading_circles: id uuid PK | owner_id uuid NOT NULL | created_by uuid NOT NULL | book_id uuid NOT NULL | canonical_book_id uuid (unused, no FK) | normalized_isbn text | title text NOT NULL | author text NOT NULL | cover_url text | name text NOT NULL | status circle_status NOT NULL default 'active' | created_at, updated_at timestamptz NOT NULL default now()
-- reading_dna: user_id uuid PK | personality text NOT NULL | mood_tone text NOT NULL | mood_emojis text[] NOT NULL | suggestions jsonb NOT NULL | books_finished_at_generation int NOT NULL | generated_at timestamptz NOT NULL default now()
-- reading_goals: id uuid PK | user_id uuid NOT NULL | year int NOT NULL | target_books int NOT NULL | created_at, updated_at timestamptz NOT NULL default now()
-- reading_progress: id uuid PK | book_id uuid NOT NULL | user_id uuid NOT NULL | current_page int NOT NULL default 0 (NO >=0 / <= total check) | updated_at timestamptz NOT NULL default now() | session_start_at timestamptz | session_paused_at timestamptz | dnf_at timestamptz
-- reading_quest_events: id uuid PK | user_id uuid NOT NULL | book_id uuid | event_type text NOT NULL | page int | source_id uuid | occurred_at timestamptz NOT NULL default now() | created_at timestamptz NOT NULL default now()
-- recaps: id uuid PK | book_id uuid NOT NULL | user_id uuid NOT NULL | progress_snapshot numeric(5,2) NOT NULL | memory_jogger text NOT NULL | concept_watchlist text NOT NULL | thematic_bridge text NOT NULL | created_at timestamptz NOT NULL default now() | page_snapshot int | mode text NOT NULL default 'inferred' | image_path text | image_status text | image_generated_at timestamptz
-- up_next_order: id uuid PK | user_id uuid NOT NULL | book_id uuid NOT NULL | sort_position int NOT NULL default 0 | updated_at timestamptz NOT NULL default now()
-- user_settings: id uuid PK | user_id uuid NOT NULL UNIQUE | weekly_goal int NOT NULL default 3 | created_at, updated_at timestamptz NOT NULL default now()
-- vocabulary_extractions: id uuid PK | user_id uuid NOT NULL | capture_id uuid UNIQUE | book_id uuid NOT NULL | page int NOT NULL | words_added int NOT NULL default 0 | status text NOT NULL | error_message text | created_at timestamptz NOT NULL default now()

-- =============================================================================
-- SECTION I. PLATFORM INVENTORY
-- =============================================================================
-- Installed extensions: plpgsql 1.0, pgcrypto 1.3 (extensions), uuid-ossp 1.1 (extensions),
--   pg_stat_statements 1.11 (extensions), supabase_vault 0.3.1 (vault).
--   pg_graphql is NOT installed (a "graphql" schema exists but the extension is absent).
-- NOT installed: pg_cron (no cron schema / no scheduled jobs), pg_net (no DB webhooks),
--   supabase_functions schema absent (no Database Webhooks), pgmq.
-- Realtime: publication supabase_realtime has NO tables -> no Postgres Changes streams.
-- Views / materialized views / sequences in public: none.
-- Privileges: anon + authenticated hold full table DML grants on every public table
--   (Supabase default); RLS is the only barrier.

-- -----------------------------------------------------------------------------
-- SECTION J. RUNTIME SETTINGS & DEFAULT PRIVILEGES — 2026-10-18
-- -----------------------------------------------------------------------------
-- pg_db_role_setting:
--   anon           : statement_timeout=3s
--   authenticated  : statement_timeout=8s
--   authenticator  : session_preload_libraries=safeupdate, statement_timeout=8s, lock_timeout=8s
--   (database-wide): app.settings.jwt_exp=3600
-- current_setting('TimeZone') = 'UTC' (no role-level override) -> every RPC that uses
--   current_date / date(ts) / date_trunc without an explicit zone is UTC-based.
-- pg_default_acl (schema public, owners postgres AND supabase_admin):
--   tables    (r): anon, authenticated, service_role = arwdDxtm (full DML)
--   functions (f): anon, authenticated, service_role = X (EXECUTE)
--   sequences (S): anon, authenticated, service_role = rwU
--   => every NEW function/table in public is automatically anon-executable / anon-writable
--      (RLS still applies to tables); CREATE OR REPLACE keeps an existing function's ACL.
-- Function count in public: 69 (60 SECURITY DEFINER; 60 executable by authenticated,
--   17 by anon). All 69 bodies in Section A were re-verified byte-identical to live
--   pg_get_functiondef output after CRLF normalisation.
