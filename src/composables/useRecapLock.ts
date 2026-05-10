import { computed, toValue, watch, type Ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import { useBooksStore } from '@/stores/books'

const RECAP_PAGE_THRESHOLD_PERCENT = 5
const RECAP_COOLDOWN_HOURS = 6
const RECAP_IDLE_UNLOCK_HOURS = 72

/**
 * Shared recap lock composable (FR-013, 010-dashboard-ux-sync).
 * Returns reactive lock state derived from progress + recaps stores.
 * Accepts either a plain string or a Ref<string> for bookId.
 * The composable does NOT trigger any fetches — callers must hydrate stores.
 */
export const useRecapLock = (bookId: Ref<string> | string) => {
  const progressStore = useProgressStore()
  const recapsStore  = useRecapsStore()
  const booksStore   = useBooksStore()

  const id = computed(() => toValue(bookId))

  watch(
    id,
    (bookId) => {
      if (!bookId) return
      progressStore.fetchLastPageSavedAt(bookId).catch(() => {
        /* Lock can still fall back to recap/page rules if history hydration fails. */
      })
    },
    { immediate: true },
  )

  const progress = computed(() => progressStore.progressForBook(id.value))
  const book     = computed(() => booksStore.bookById(id.value))

  const latestRecap = computed(
    () => recapsStore.latestRecapForBook(id.value),
  )

  const lastRecapPct = computed(
    () => latestRecap.value?.progressSnapshot ?? 0,
  )

  const unlockPage = computed(() => {
    if (!book.value) return 0
    const targetPct = Math.min(100, lastRecapPct.value + RECAP_PAGE_THRESHOLD_PERCENT)
    return Math.max(1, Math.ceil((targetPct / 100) * book.value.totalPages))
  })

  const recapLockedByPages = computed(
    () => (progress.value?.currentPage ?? 0) < unlockPage.value,
  )

  // Hours since last progress update (used for idle-unlock and daysSinceLastSession)
  const hoursSinceLastSession = computed(() => {
    const updatedAt = progress.value?.updatedAt
    if (!updatedAt) return 0
    return (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60)
  })

  const daysSinceLastSession = computed(() => hoursSinceLastSession.value / 24)

  // ── Option B cooldown anchor ──────────────────────────────────────────────
  // Cooldown is based on max(lastRecap.createdAt, lastPageSave) — the most
  // recent meaningful event. This prevents:
  //  - Recap spam (just got a recap → 6h wait)
  //  - Instant recap after reading (just saved pages → 6h wait)
  // While ignoring noise (store hydration, session start/stop, etc.)

  const hoursSinceLastRecap = computed(() => {
    const createdAt = latestRecap.value?.createdAt
    if (!createdAt) return Infinity
    return (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  })

  const hoursSinceLastPageSave = computed(() => {
    const savedAt = progressStore.lastPageSavedAt[id.value]
    if (!savedAt) return Infinity
    return (Date.now() - new Date(savedAt).getTime()) / (1000 * 60 * 60)
  })

  /** Hours since the most recent meaningful event (recap or page save). */
  const hoursSinceMeaningfulEvent = computed(() =>
    Math.min(hoursSinceLastRecap.value, hoursSinceLastPageSave.value),
  )

  const recapUnlockedByIdleTime = computed(
    () => hoursSinceLastSession.value >= RECAP_IDLE_UNLOCK_HOURS,
  )

  const recapLockedByCooldown = computed(
    () =>
      !recapLockedByPages.value &&
      !recapUnlockedByIdleTime.value &&
      hoursSinceMeaningfulEvent.value < RECAP_COOLDOWN_HOURS,
  )

  const recapLocked = computed(
    () =>
      !recapUnlockedByIdleTime.value &&
      (recapLockedByPages.value || recapLockedByCooldown.value),
  )

  const pagesUntilUnlock = computed(
    () => Math.max(0, unlockPage.value - (progress.value?.currentPage ?? 0)),
  )

  const hoursUntilUnlock = computed(() =>
    Math.max(0, Math.ceil(RECAP_COOLDOWN_HOURS - hoursSinceMeaningfulEvent.value)),
  )

  const recapLockLabel = computed(() => {
    if (recapLockedByPages.value) {
      const pages = pagesUntilUnlock.value
      return `${pages} more ${pages === 1 ? 'page' : 'pages'}`
    }

    if (recapLockedByCooldown.value) {
      const hours = hoursUntilUnlock.value
      return `Recap in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
    }

    return ''
  })

  return {
    recapLocked,
    recapLockedByPages,
    recapLockedByCooldown,
    recapUnlockedByIdleTime,
    pagesUntilUnlock,
    hoursUntilUnlock,
    hoursSinceLastSession,
    daysSinceLastSession,
    recapLockLabel,
  }
}
