import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { type RetentionSummary } from '@/types'
import {
  cacheKeys,
  invalidate,
  registerRevalidator,
  swrRun,
  swrStatus,
} from '@/composables/useCache'

const RETENTION_TTL = 30_000
const UTC_TIMEZONE = 'UTC'

const _summary = ref<RetentionSummary | null>(null)
const _loaded = ref(false)
const _loading = ref(false)
const _error = ref<Error | null>(null)

export const invalidateRetentionSummary = (userId: string): void => {
  invalidate(cacheKeys.retentionSummary(userId))
}

export const resolveRetentionTimezone = (): string => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (!timezone) return UTC_TIMEZONE

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return timezone
  } catch {
    return UTC_TIMEZONE
  }
}

export const useRetentionSummary = () => {
  const summary = _summary
  const loaded = _loaded
  const loading = _loading
  const error = _error

  const fetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const { data, error: rpcError } = await supabase.rpc('get_retention_summary', {
      p_timezone: resolveRetentionTimezone(),
    })

    if (rpcError) throw rpcError

    summary.value = data as RetentionSummary
    loaded.value = true
    error.value = null
  }

  const fetchRetentionSummary = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.retentionSummary(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, RETENTION_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, fetcher).catch((err) => {
        error.value = err instanceof Error ? err : new Error(String(err))
      })
      return
    }

    loading.value = true
    try {
      await swrRun(key, fetcher)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw err
    } finally {
      loading.value = false
    }
  }

  const refresh = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.retentionSummary(authStore.user.id)
    loading.value = true
    try {
      await swrRun(key, fetcher)
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    summary,
    loaded,
    loading,
    error,
    fetchRetentionSummary,
    refresh,
  }
}
