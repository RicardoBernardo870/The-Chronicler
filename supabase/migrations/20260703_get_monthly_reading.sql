-- Monthly reading chart: pages read + books finished per month for a year.
-- Pages = positive page deltas from progress_history (organic reads only —
-- imports never write history). Finished = first history row reaching the
-- book's total pages. Timezone-aware; auth-guarded like get_reading_calendar.
create or replace function public.get_monthly_reading(
  p_user_id uuid,
  p_year int,
  p_timezone text default 'UTC'
)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
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
$$;
