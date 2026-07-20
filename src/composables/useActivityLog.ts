import { ref, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Who is who ────────────────────────────────────────────────────────────────
// These IDs mirror the RLS policies in
// supabase/migrations/20260720_activity_logs.sql. The database is the real
// gate: SELECT is only granted to the admin account, INSERT only to tracked
// accounts for their own rows. The constants below just keep the UI honest.

export const ACTIVITY_LOG_ADMIN_ID = '7e1ff11d-6600-4a4d-8d28-8b64daf95a09'

const TRACKED_USER_IDS = new Set(['f817241e-f331-421c-b1a8-8147da346e9d'])

export interface ActivityLogEntry {
  id: string
  userId: string
  event: string
  path: string | null
  userAgent: string | null
  createdAt: string
}

// ── Recording (tracked accounts) ──────────────────────────────────────────────

// One row per page load per user — a reload is a new "use", but auth-state
// churn within a running session shouldn't spam the table.
const loggedThisPageLoad = new Set<string>()
let watching = false

const recordActivity = async (userId: string, event: string): Promise<void> => {
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      event,
      path: window.location.pathname,
      user_agent: navigator.userAgent,
    })
  } catch {
    /* best-effort — never let telemetry break the app */
  }
}

/**
 * Call once from App.vue. Watches the signed-in user and records an
 * `app_open` event whenever a tracked account starts using the app
 * (cold start with a persisted session, or a fresh sign-in).
 */
export const setupActivityLogging = (): void => {
  if (watching) return
  watching = true
  const authStore = useAuthStore()
  watch(
    () => authStore.user?.id,
    (id) => {
      if (!id || !TRACKED_USER_IDS.has(id)) return
      if (loggedThisPageLoad.has(id)) return
      loggedThisPageLoad.add(id)
      void recordActivity(id, 'app_open')
    },
    { immediate: true },
  )
}

// ── Reading (admin account) ───────────────────────────────────────────────────

const FETCH_LIMIT = 300

export const useActivityLog = () => {
  const entries = ref<ActivityLogEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchEntries = async (): Promise<void> => {
    loading.value = true
    error.value = null
    try {
      const { data, error: dbError } = await supabase
        .from('activity_logs')
        .select('id, user_id, event, path, user_agent, created_at')
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT)
      if (dbError) throw dbError
      entries.value = (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        event: row.event,
        path: row.path,
        userAgent: row.user_agent,
        createdAt: row.created_at,
      }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load the log.'
    } finally {
      loading.value = false
    }
  }

  const clearEntries = async (): Promise<void> => {
    const { error: dbError } = await supabase
      .from('activity_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (dbError) throw dbError
    entries.value = []
  }

  return { entries, loading, error, fetchEntries, clearEntries }
}
