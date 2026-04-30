import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import { type ReadingStats } from '@/types'
import {
  swrStatus,
  swrRun,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

/**
 * 017 — Reader Profile lifetime stats via get_reading_stats RPC.
 *
 * Replaces the client-side JS aggregation (full progress_history fetch +
 * streak math + velocity loops) with a single server-side RPC call.
 * Exposes the same named refs as before so downstream components
 * (LifetimeStatsGrid) require no template changes.
 */

const STATS_TTL = 120_000 // 120 s

// Module-level singleton refs — survive Vue component remounts.
// The SWR cache is already module-level; these refs must match that lifetime
// so a second caller (e.g. LifetimeStatsGrid) gets the populated data even
// when swrStatus returns 'fresh' and the fetcher is skipped.
const _stats = ref<ReadingStats | null>(null)
const _loaded = ref(false)

export const useReadingProfile = () => {
  const progressStore = useProgressStore()

  const stats = _stats
  const loaded = _loaded

  // ── Fetcher ────────────────────────────────────────────────────────────────

  const _statsFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase.rpc('get_reading_stats', {
      p_user_id: authStore.user.id,
    })
    if (error) throw error
    stats.value = data as ReadingStats
    loaded.value = true
  }

  const fetchStats = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.readingStats(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _statsFetcher).catch(() => {}))

    const status = swrStatus(key, STATS_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _statsFetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first fetch
    await swrRun(key, _statsFetcher)
  }

  // ── Books finished / in progress — from progress store (unchanged) ─────────
  // readingDna store reads booksFinished.value to decide threshold gating —
  // keep this derived from progressStore.completedBooks (not the RPC).

  const booksFinished = computed(() => progressStore.completedBooks.length)
  const booksInProgress = computed(() => progressStore.inProgressBooks.length)

  // ── Computed refs derived from RPC result (return 0 when stats not loaded) ─

  const totalPagesRead = computed(() => stats.value?.totalPagesRead ?? 0)
  const totalReadingHours = computed(() => stats.value?.totalReadingHours ?? 0)
  const allTimeVelocityPph = computed(() => stats.value?.allTimeVelocityPph ?? 0)
  const currentStreak = computed(() => stats.value?.currentStreakDays ?? 0)
  const longestStreak = computed(() => stats.value?.longestStreakDays ?? 0)
  const sessionsThisMonth = computed(() => stats.value?.sessionsThisMonth ?? 0)

  // Auto-fetch once on first composable use (same pattern as before)
  void fetchStats()

  return {
    stats,
    loaded,
    fetchStats,
    booksFinished,
    booksInProgress,
    totalPagesRead,
    totalReadingHours,
    allTimeVelocityPph,
    currentStreak,
    longestStreak,
    sessionsThisMonth,
  }
}
