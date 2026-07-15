import { ref, onUnmounted } from 'vue'

/**
 * Screen Wake Lock — keeps the display awake while focus mode is open so the
 * session timer stays visible beside the reader. Best-effort: on browsers
 * without the API (or when the request is denied) everything still works,
 * the screen just follows the device's normal sleep policy.
 *
 * The lock is auto-released by the OS when the tab is hidden; the
 * visibilitychange listener re-acquires it when the reader comes back.
 */
export const useWakeLock = () => {
  const active = ref(false)
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  let sentinel: WakeLockSentinel | null = null
  let holding = false

  const request = async (): Promise<void> => {
    if (!supported || !holding) return
    try {
      sentinel = await navigator.wakeLock.request('screen')
      active.value = true
      sentinel.addEventListener('release', () => { active.value = false })
    } catch {
      // Denied (e.g. battery saver) — silently fall back to normal sleep.
      active.value = false
    }
  }

  const handleVisibility = (): void => {
    if (document.visibilityState === 'visible') void request()
  }

  const enable = async (): Promise<void> => {
    if (holding) return
    holding = true
    document.addEventListener('visibilitychange', handleVisibility)
    await request()
  }

  const disable = async (): Promise<void> => {
    holding = false
    document.removeEventListener('visibilitychange', handleVisibility)
    try { await sentinel?.release() } catch { /* already released */ }
    sentinel = null
    active.value = false
  }

  onUnmounted(() => { void disable() })

  return { supported, active, enable, disable }
}
