import { useGlassToast } from '@/composables/useGlassToast'

/**
 * One shared "something didn't load" warning.
 *
 * Both the Data API fetch wrapper (services/supabase.ts) and the dashboard
 * mount sequence can detect a failed load, and a single bad cold start trips
 * several of them at once. Routing every caller through this module keeps a
 * burst to one pill instead of a stack of identical ones.
 */

const COOLDOWN_MS = 30_000

let lastNotifiedAt = 0

export const notifyLoadFailure = (): void => {
  const now = Date.now()
  if (now - lastNotifiedAt < COOLDOWN_MS) return
  lastNotifiedAt = now
  useGlassToast().showWarn(
    "Some things didn't load",
    'Reopen the app or refresh the page to try again.',
  )
}
