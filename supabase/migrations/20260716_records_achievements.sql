-- =====================================================================
-- Migration: 20260716_records_achievements.sql
-- Features : Personal records card (Stats page) + Achievements (Trophy Room)
-- Purpose  : 1) get_reading_records RPC — best-day pages, longest session,
--              fastest finish, and a night-owl flag, all from
--              progress_history (organic reads only — imports never write
--              history). Timezone-aware, same delta logic as
--              get_monthly_reading.
--            2) achievements table — insert-only ledger of earned
--              achievement keys, so "earned on" dates survive stat drift
--              (e.g. deleting a book never un-earns a trophy).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Personal records RPC
-- ---------------------------------------------------------------------

create or replace function public.get_reading_records(
  p_user_id uuid,
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
$$;

grant execute on function public.get_reading_records(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Achievements ledger
-- ---------------------------------------------------------------------

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

comment on table public.achievements is
  'Insert-only ledger of earned achievement keys. Definitions and unlock conditions live client-side (src/utils/achievements.ts); this table only remembers when each key was first earned, so trophies never regress.';

alter table public.achievements enable row level security;

drop policy if exists "Achievements are viewable by owner" on public.achievements;
create policy "Achievements are viewable by owner"
on public.achievements for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Achievements are insertable by owner" on public.achievements;
create policy "Achievements are insertable by owner"
on public.achievements for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- =====================================================================
-- End of migration
-- =====================================================================
