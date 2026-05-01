import { ref, type Ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { swrStatus, swrRun, cacheKeys } from '@/composables/useCache'

// Value semantics:
//   number   → estimated days remaining (> 0)
//   'today'  → finish-today nudge (RPC returns 0)
//   null     → insufficient data / book not in result set
export type VelocityResult = number | 'today' | null

interface VelocityRow {
  book_id: string
  days_left: number
}

// ── Module-level singleton ──────────────────────────────────────────────────
// The data lives outside any component scope so it survives navigation and is
// only refreshed when:
//   * a session ends → progress store calls invalidate(cacheKeys.velocity(uid))
//   * the page is reloaded → module re-evaluates from scratch
// A "very long" TTL is used because the SWR primitive is the staleness arbiter
// here; we never let it auto-revalidate on a clock tick.
const _velocityMap = ref<Record<string, VelocityResult>>({})
const TTL_MS = 365 * 24 * 60 * 60 * 1000  // effectively forever — explicit invalidation only

/**
 * useReadingVelocity
 * ──────────────────
 * Thin client wrapper around `get_reading_velocity` RPC.
 * Aggregation (30-day window, session detection, per-day fallback,
 * average-pages → days-left math) runs server-side in one round trip.
 *
 * Cached at module level — `fetch()` short-circuits when the SWR entry is
 * fresh, so navigating away and back does NOT re-hit the network.
 */
export const useReadingVelocity = (bookIds: Ref<string[]>) => {
  const loading = ref(false)

  const _runRpc = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    if (bookIds.value.length === 0) return

    const { data, error } = await supabase.rpc('get_reading_velocity', {
      p_user_id:  authStore.user.id,
      p_book_ids: bookIds.value,
    })
    if (error) throw error

    const rows = (data ?? []) as VelocityRow[]
    const result: Record<string, VelocityResult> = {}
    for (const row of rows) {
      result[row.book_id] = row.days_left <= 0 ? 'today' : row.days_left
    }
    _velocityMap.value = result
  }

  const fetch = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) {
      _velocityMap.value = {}
      return
    }
    if (bookIds.value.length === 0) return

    const key = cacheKeys.velocity(authStore.user.id)
    const status = swrStatus(key, TTL_MS)

    if (status === 'fresh') return                 // ← cache hit, no network
    if (status === 'background') {                 // ← stale (TTL expired) — silent revalidate
      swrRun(key, _runRpc).catch(() => { _velocityMap.value = {} })
      return
    }
    // 'loading' — first call this page-lifetime, or after explicit invalidation
    loading.value = true
    try {
      await swrRun(key, _runRpc)
    } catch {
      _velocityMap.value = {}
    } finally {
      loading.value = false
    }
  }

  return { velocityMap: _velocityMap, loading, fetch }
}
