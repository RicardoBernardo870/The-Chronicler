-- ============================================================================
-- File   : 20260505_retention_summary.sql
-- Purpose: Reading Pulse weekly retention summary.
--
-- Counts confirmed reading sessions from progress_history rows that have a
-- session_start_at. The caller identity is always derived from auth.uid().
-- ============================================================================

create index if not exists progress_history_user_session_start_idx
  on public.progress_history (user_id, session_start_at, recorded_at)
  where session_start_at is not null;

create or replace function public.get_retention_summary(
  p_timezone text default 'UTC'
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.get_retention_summary(text) to authenticated;
