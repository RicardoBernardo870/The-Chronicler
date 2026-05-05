import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260505_retention_summary.sql')
const migration = readFileSync(migrationPath, 'utf8')

describe('get_retention_summary migration contract', () => {
  it('derives caller identity from auth.uid and accepts no client user id', () => {
    expect(migration).toContain('v_user_id uuid := (select auth.uid())')
    expect(migration).toContain('create or replace function public.get_retention_summary(')
    expect(migration).not.toMatch(/p_user_id/i)
  })

  it('validates timezone input and falls back to UTC', () => {
    expect(migration).toContain('from pg_timezone_names')
    expect(migration).toContain("v_timezone := coalesce(v_timezone, 'UTC')")
    expect(migration).toContain("p_timezone text default 'UTC'")
  })

  it('uses local-week boundaries for the selected timezone', () => {
    expect(migration).toContain("date_trunc('week', now() at time zone v_timezone) at time zone v_timezone")
    expect(migration).toContain("v_week_end := v_week_start + interval '7 days'")
  })

  it('dedupes canonical sessions before weekly aggregation', () => {
    expect(migration).toContain('canonical_sessions as (')
    expect(migration).toContain('group by ph.book_id, ph.session_start_at')
    expect(migration).toContain('min(ph.recorded_at) as recorded_at')
  })

  it('returns the Reading Pulse summary shape', () => {
    for (const field of [
      'sessionsThisWeek',
      'weeklyGoal',
      'goalProgressPct',
      'activeDaysThisWeek',
      'lastSessionAt',
      'daysSinceLastSession',
      'nudgeCode',
    ]) {
      expect(migration).toContain(`'${field}'`)
    }
  })
})
