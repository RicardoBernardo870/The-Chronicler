-- ============================================================================
-- File   : 20260502_rpc_performance_improvements.sql
-- Purpose: Performance-safe RPC refinements for library/profile aggregates.
--
-- Keeps response shapes and business rules unchanged while reducing repeated
-- progress_history scans and adding indexes that match the RPC access patterns.
-- ============================================================================

create index if not exists progress_history_user_book_recorded_at_idx
  on public.progress_history (user_id, book_id, recorded_at);

create index if not exists progress_history_user_recorded_at_desc_idx
  on public.progress_history (user_id, recorded_at desc);

create or replace function public.get_library_with_progress(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
        'currentPage',    coalesce(rp.current_page, 0),
        'percentage',
          case
            when b.total_pages > 0
            then least(100, round((coalesce(rp.current_page, 0)::numeric / b.total_pages) * 100, 2))
            else 0
          end,
        'status',
          case
            when coalesce(rp.current_page, 0) = 0 then 'unread'
            when rp.current_page >= b.total_pages and b.total_pages > 0 then 'finished'
            else 'reading'
          end,
        'lastReadAt',     rp.updated_at,
        'sessionStartAt', rp.session_start_at,
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
$$;

create or replace function public.get_reading_stats(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with
  deltas as (
    select
      book_id,
      recorded_at,
      session_start_at,
      greatest(
        0,
        page - lag(page, 1, 0) over (partition by book_id order by recorded_at)
      ) as page_delta,
      extract(epoch from (recorded_at - session_start_at)) as dur_sec
    from public.progress_history
    where user_id = p_user_id
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
  completed_books as (
    select b.total_pages
    from public.books b
    join public.reading_progress rp
      on rp.book_id = b.id
     and rp.user_id = p_user_id
    where b.user_id = p_user_id
      and b.total_pages > 0
      and rp.current_page >= b.total_pages
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
      coalesce((select sum(total_pages) from completed_books), 0),

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

create or replace function public.get_last_session(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
$$;

create or replace function public.get_library_breakdown(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
$$;

create or replace function public.get_reading_velocity(
  p_user_id uuid,
  p_book_ids uuid[]
)
returns table (
  book_id uuid,
  days_left int
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.get_library_with_progress(uuid) to authenticated;
grant execute on function public.get_reading_stats(uuid) to authenticated;
grant execute on function public.get_last_session(uuid) to authenticated;
grant execute on function public.get_library_breakdown(uuid) to authenticated;
grant execute on function public.get_reading_velocity(uuid, uuid[]) to authenticated;
