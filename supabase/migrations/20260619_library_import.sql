-- 034 Library Import (Goodreads & StoryGraph)
-- Additive: mark imported books so current-period stats can exclude them, and flag
-- placeholder page counts. Bodies below are the LIVE definitions captured during
-- planning; only the documented lines changed (see specs/034-library-import/contracts/rpc-changes.md).

-- ── Schema: provenance + placeholder flag ──────────────────────────────────────
alter table public.books
  add column if not exists source text not null default 'manual',
  add column if not exists page_count_estimated boolean not null default false;

-- Imported = source <> 'manual'. Values used by this feature: 'manual','goodreads','storygraph'.

-- ── get_reading_quest_summary: EXCLUDE imported books from quest/XP ─────────────
-- Only change: `and coalesce(b.source,'manual') = 'manual'` added to progress_rows.
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
        and coalesce(b.source, 'manual') = 'manual'   -- 034: imports never count toward quest/XP
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

-- ── get_reading_stats: EXCLUDE imported books from totalPagesRead ───────────────
-- Only change: `and coalesce(b.source,'manual') = 'manual'` added to current_progress.
-- deltas/valid_sessions/streak_* read progress_history (imports write none) — untouched.
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
      and coalesce(b.source, 'manual') = 'manual'   -- 034: imported books don't inflate totalPagesRead
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

-- ── get_library_with_progress: EXTEND with source + pageCountEstimated ──────────
-- Only change: two new keys in json_build_object; all books still returned.
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
$function$;
