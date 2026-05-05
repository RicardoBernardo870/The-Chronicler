import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAll } from '@/composables/useCache'

const mocks = vi.hoisted(() => ({
  currentUser: { id: 'user-1', email: 'reader@example.com' } as { id: string; email: string } | null,
  rpc: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mocks.currentUser,
  }),
}))

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
  },
}))

import { resolveRetentionTimezone, useRetentionSummary } from '@/composables/useRetentionSummary'

const summary = {
  weekStart: '2026-05-04T00:00:00.000Z',
  weekEnd: '2026-05-11T00:00:00.000Z',
  timezone: 'Europe/Lisbon',
  sessionsThisWeek: 2,
  weeklyGoal: 3,
  goalProgressPct: 67,
  activeDaysThisWeek: 2,
  lastSessionAt: '2026-05-05T20:00:00.000Z',
  daysSinceLastSession: 0,
  nudgeCode: 'keep_going',
}

beforeEach(() => {
  clearAll()
  mocks.currentUser = { id: 'user-1', email: 'reader@example.com' }
  mocks.rpc.mockReset()
  mocks.rpc.mockResolvedValue({ data: summary, error: null })
})

describe('useRetentionSummary', () => {
  it('calls get_retention_summary with timezone only, never a client user id', async () => {
    const { fetchRetentionSummary, summary: result, loaded } = useRetentionSummary()

    await fetchRetentionSummary()

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('get_retention_summary', {
      p_timezone: expect.any(String),
    })
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty('p_user_id')
    expect(result.value).toEqual(summary)
    expect(loaded.value).toBe(true)
  })

  it('serves fresh SWR cache without calling the RPC twice', async () => {
    const { fetchRetentionSummary } = useRetentionSummary()

    await fetchRetentionSummary()
    await fetchRetentionSummary()

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })

  it('refreshes explicitly even when the cache is fresh', async () => {
    const { fetchRetentionSummary, refresh } = useRetentionSummary()

    await fetchRetentionSummary()
    await refresh()

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })

  it('uses a new cache entry after auth clear and user switch', async () => {
    const { fetchRetentionSummary } = useRetentionSummary()

    await fetchRetentionSummary()
    clearAll()
    mocks.currentUser = { id: 'user-2', email: 'second@example.com' }
    await fetchRetentionSummary()

    expect(mocks.rpc).toHaveBeenCalledTimes(2)
  })

  it('falls back to UTC when the resolved browser timezone is invalid', () => {
    const dateTimeFormat = vi.spyOn(Intl, 'DateTimeFormat')
    dateTimeFormat.mockImplementation(((locale?: string | string[], options?: Intl.DateTimeFormatOptions) => {
      if (options?.timeZone === 'Bad/Zone') throw new RangeError('invalid time zone')
      return {
        format: () => '5/5/2026',
        resolvedOptions: () => ({ timeZone: 'Bad/Zone' }),
      } as Intl.DateTimeFormat
    }) as typeof Intl.DateTimeFormat)

    expect(resolveRetentionTimezone()).toBe('UTC')

    dateTimeFormat.mockRestore()
  })
})
