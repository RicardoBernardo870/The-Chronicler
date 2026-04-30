import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { type LibraryBreakdown } from '@/types'
import {
  swrStatus,
  swrRun,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

/**
 * 017 — Library breakdown via get_library_breakdown RPC.
 *
 * Replaces the client-side computed (booksStore.books + progressStore.progress)
 * with a single server-side RPC call returning genreDistribution, authorsCount,
 * status counts, and average completion.
 */

const BREAKDOWN_TTL = 120_000 // 120 s

// Module-level singleton refs — survive Vue component remounts so the SWR
// 'fresh' early-return doesn't leave a remounted component with a null ref.
const _breakdown = ref<LibraryBreakdown | null>(null)
const _loaded = ref(false)

export const useLibraryBreakdown = () => {
  const breakdown = _breakdown
  const loaded = _loaded

  // ── Fetcher ────────────────────────────────────────────────────────────────

  const _breakdownFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase.rpc('get_library_breakdown', {
      p_user_id: authStore.user.id,
    })
    if (error) throw error
    breakdown.value = data as LibraryBreakdown
    loaded.value = true
  }

  const fetchBreakdown = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.libraryBreakdown(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _breakdownFetcher).catch(() => {}))

    const status = swrStatus(key, BREAKDOWN_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _breakdownFetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first fetch
    await swrRun(key, _breakdownFetcher)
  }

  // Auto-fetch once on first composable use
  void fetchBreakdown()

  return { breakdown, loaded, fetchBreakdown }
}
