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
  durationSeconds: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

// ── Recording (tracked accounts) ──────────────────────────────────────────────

// One row per page load per user — a reload is a new "use", but auth-state
// churn within a running session shouldn't spam the table.
const loggedThisPageLoad = new Set<string>()
let watching = false

const recordActivity = async (userId: string, event: string): Promise<string | null> => {
  try {
    const { data } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        event,
        path: window.location.pathname,
        user_agent: navigator.userAgent,
      })
      .select('id')
      .single()
    return (data as { id: string } | null)?.id ?? null
  } catch {
    /* best-effort — never let telemetry break the app */
    return null
  }
}

// ── Navigation (route_view) ───────────────────────────────────────────────────
// One row per screen the tracked account lands on, written from router.afterEach.
// path is the full path (incl. query); metadata.name is the matched route name
// so the log stays readable when the path is a bare UUID. Consecutive duplicates
// (guard redirects, scroll-only re-navigations) are collapsed.

let lastRouteViewPath: string | null = null

export const logRouteView = (path: string, name?: string): void => {
  const authStore = useAuthStore()
  const id = authStore.user?.id
  if (!id || !TRACKED_USER_IDS.has(id)) return
  if (path === lastRouteViewPath) return
  lastRouteViewPath = path
  void supabase
    .from('activity_logs')
    .insert({
      user_id: id,
      event: 'route_view',
      path,
      user_agent: navigator.userAgent,
      metadata: name ? { name } : null,
    })
    .then(
      () => {},
      () => {}, // best-effort — never let telemetry break the app
    )
}

// ── Session duration (foreground time only) ───────────────────────────────────
// The app_open row is written on load; we then patch its duration_seconds with
// the time the app has actually been in the foreground. Backgrounded time —
// swiping into the app switcher, locking the screen, switching tabs — does NOT
// count: on `visibilitychange → hidden` we bank the elapsed foreground span and
// stop the clock, resuming it only when the app comes back to the front.
//
// The heartbeat is what makes the final value reliable: a write dispatched
// during unload often never lands, so while foregrounded we keep the row within
// DURATION_HEARTBEAT_MS of the truth all along.

const DURATION_HEARTBEAT_MS = 15_000

let openRowId: string | null = null
let activeMs = 0 // foreground time banked from completed visible spans
let visibleSince: number | null = null // start of the current visible span, or null when hidden
let durationTimer: ReturnType<typeof setInterval> | null = null
let durationListenersBound = false

const currentDurationSeconds = (): number => {
  const liveMs = visibleSince !== null ? Date.now() - visibleSince : 0
  return Math.max(0, Math.round((activeMs + liveMs) / 1000))
}

const persistDuration = (): void => {
  if (!openRowId) return
  void supabase
    .from('activity_logs')
    .update({ duration_seconds: currentDurationSeconds() })
    .eq('id', openRowId)
    .then(
      () => {},
      () => {}, // best-effort — never let telemetry break the app
    )
}

const handleVisibility = (): void => {
  if (document.visibilityState === 'visible') {
    // Back in the foreground — restart the live clock (no double-counting).
    if (visibleSince === null) visibleSince = Date.now()
  } else {
    // Backgrounded — bank the foreground span, stop counting, and persist.
    if (visibleSince !== null) {
      activeMs += Date.now() - visibleSince
      visibleSince = null
    }
    persistDuration()
  }
}

const trackSessionDuration = (rowId: string): void => {
  openRowId = rowId
  activeMs = 0
  visibleSince = document.visibilityState === 'visible' ? Date.now() : null

  if (durationTimer) clearInterval(durationTimer)
  // Only writes while foregrounded; background timers are frozen on mobile
  // anyway, and currentDurationSeconds() would ignore the hidden span regardless.
  durationTimer = setInterval(() => {
    if (visibleSince !== null) persistDuration()
  }, DURATION_HEARTBEAT_MS)

  if (durationListenersBound) return
  durationListenersBound = true
  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('pagehide', persistDuration)
}

/**
 * Call once from App.vue. Watches the signed-in user and records an
 * `app_open` event whenever a tracked account starts using the app
 * (cold start with a persisted session, or a fresh sign-in), then keeps
 * that row's duration_seconds up to date for as long as the app stays open.
 */
export const setupActivityLogging = (): void => {
  if (watching) return
  watching = true
  const authStore = useAuthStore()
  watch(
    () => authStore.user?.id,
    async (id) => {
      if (!id || !TRACKED_USER_IDS.has(id)) return
      if (loggedThisPageLoad.has(id)) return
      loggedThisPageLoad.add(id)
      const rowId = await recordActivity(id, 'app_open')
      if (rowId) trackSessionDuration(rowId)
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
        .select('id, user_id, event, path, user_agent, duration_seconds, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT)
      if (dbError) throw dbError
      entries.value = (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        event: row.event,
        path: row.path,
        userAgent: row.user_agent,
        durationSeconds: row.duration_seconds,
        metadata: row.metadata,
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
