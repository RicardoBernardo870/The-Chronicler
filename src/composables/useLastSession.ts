import { ref, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import {
  swrStatus,
  swrRun,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

/**
 * 017 — Last session data via get_last_session RPC.
 *
 * Replaces the full progress_history fetch + multi-step JS pipeline with a
 * single server-side RPC call that pre-computes page delta, duration,
 * velocity, completion delta, and finish prediction.
 *
 * NOTE: endedAt / startedAt are ISO strings (not Date objects) — the
 * formatRelativeToNow util accepts both, so call sites are unchanged.
 */

// Updated LastSession interface: dates are now ISO strings (not Date objects)
// since the RPC returns JSON with ISO timestamps.
export interface LastSession {
  bookId: string
  bookTitle: string
  endedAt: string             // ISO string (was Date)
  startedAt: string | null    // ISO string or null (was Date | null)
  pagesDelta: number
  startPage: number
  endPage: number
  durationSeconds: number | null
  velocityPph: number | null
  completionDelta: number | null
  finishPredictionSessions: number | null
  sessionNote: string | null
}

const SESSION_TTL = 30_000 // 30 s — session data is most volatile

// Module-level singleton refs — survive Vue component remounts so the SWR
// 'fresh' early-return doesn't leave a remounted component with a null ref.
const _lastSession = ref<LastSession | null>(null)
const _loaded = ref(false)

export const useLastSession = () => {
  const progressStore = useProgressStore()

  const lastSession = _lastSession
  const loaded = _loaded

  // ── Fetcher ────────────────────────────────────────────────────────────────

  const _sessionFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase.rpc('get_last_session', {
      p_user_id: authStore.user.id,
    })
    if (error) throw error
    // RPC returns null when the user has no progress_history rows
    lastSession.value = (data as LastSession | null) ?? null
    loaded.value = true
  }

  const fetchLastSession = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.lastSession(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _sessionFetcher).catch(() => {}))

    const status = swrStatus(key, SESSION_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _sessionFetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first fetch
    await swrRun(key, _sessionFetcher)
  }

  // Re-fetch whenever a session ends so the card updates immediately without
  // a page reload (same watcher as before — only the called fn changes).
  watch(() => progressStore.lastSessionEnded, (event) => {
    if (event) fetchLastSession()
  })

  return { lastSession, fetchLastSession, loaded }
}
