-- ============================================================================
-- File   : 20260517_book_passport_stats_rpc.sql
-- Purpose: Authoritative Book Passport stat aggregation.
--
-- Computes deterministic passport stats server-side:
--   * totalDays: first progress save to last progress save
--   * peakDay/peakDayPages: local calendar day with the most forward page delta
--   * vocabularyCount: lexicon entries scoped to the same user and book
-- ============================================================================

create index if not exists progress_history_user_book_recorded_at_idx
  on public.progress_history (user_id, book_id, recorded_at);

create index if not exists idx_lexicon_user_book
  on public.lexicon_entries (user_id, book_id);

create or replace function public.get_book_passport_stats(
  p_user_id uuid,
  p_book_id uuid,
  p_time_zone text default 'UTC'
)
returns json
language sql
stable
security definer
set search_path = public
as $$
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
$$;
