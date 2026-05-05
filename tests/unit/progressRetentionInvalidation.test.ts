import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cacheKeys,
  clearAll,
  swrRun,
  swrStatus,
} from '@/composables/useCache'

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', email: 'reader@example.com' },
  }),
}))

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}))

import { invalidateRetentionSummary } from '@/composables/useRetentionSummary'

const progressSource = readFileSync(resolve(process.cwd(), 'src/stores/progress.ts'), 'utf8')
const offlineSource = readFileSync(resolve(process.cwd(), 'src/composables/useOfflineSync.ts'), 'utf8')

beforeEach(() => {
  clearAll()
})

describe('progress retention invalidation', () => {
  it('centralizes retention summary cache invalidation behind a helper', async () => {
    const key = cacheKeys.retentionSummary('user-1')

    await swrRun(key, async () => {})
    expect(swrStatus(key, 60_000)).toBe('fresh')

    invalidateRetentionSummary('user-1')

    expect(swrStatus(key, 60_000)).toBe('loading')
  })

  it('invalidates after confirmed online progress writes', () => {
    expect(progressSource).toContain("import { invalidateRetentionSummary } from '@/composables/useRetentionSummary'")
    const onlineWriteSection = progressSource.slice(
      progressSource.indexOf('await syncToSupabase(bookId, currentPage)'),
      progressSource.indexOf('// T012 (013): insert progress_history with session_start_at'),
    )
    expect(onlineWriteSection).toContain('invalidate(cacheKeys.readingStats(authStore.user.id))')
    expect(onlineWriteSection).toContain('invalidateRetentionSummary(authStore.user.id)')
  })

  it('invalidates quietly after offline replay drains queued mutations', () => {
    expect(offlineSource).toContain('Promise<number>')
    expect(offlineSource).toContain('flushed++')
    expect(offlineSource).toContain('return flushed')
    expect(progressSource).toContain('const flushedCount = await flushQueue(syncToSupabase)')
    expect(progressSource).toContain('if (authStore.user && flushedCount > 0)')
    expect(progressSource).not.toContain('lastSessionEnded.value = flushedCount')
  })
})
