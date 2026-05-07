import { computed, toValue, type Ref } from 'vue'
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

  const progress = computed(() => progressStore.progressForBook(id.value))
  const book     = computed(() => booksStore.bookById(id.value))

  const lastRecapPct = computed(
    () => recapsStore.latestRecapForBook(id.value)?.progressSnapshot ?? 0,
  )

  const unlockPage = computed(() => {
    if (!book.value) return 0
    const targetPct = Math.min(100, lastRecapPct.value + RECAP_PAGE_THRESHOLD_PERCENT)
    return Math.max(1, Math.ceil((targetPct / 100) * book.value.totalPages))
  })

  const recapLockedByPages = computed(
    () => (progress.value?.currentPage ?? 0) < unlockPage.value,
  )

  const hoursSinceLastSession = computed(() => {
    const updatedAt = progress.value?.updatedAt
    if (!updatedAt) return 0
    return (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60)
  })

  const daysSinceLastSession = computed(() => hoursSinceLastSession.value / 24)

  const recapUnlockedByIdleTime = computed(
    () => hoursSinceLastSession.value >= RECAP_IDLE_UNLOCK_HOURS,
  )

  const recapLockedByCooldown = computed(
    () =>
      !recapLockedByPages.value &&
      !recapUnlockedByIdleTime.value &&
      hoursSinceLastSession.value < RECAP_COOLDOWN_HOURS,
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
    Math.max(0, Math.ceil(RECAP_COOLDOWN_HOURS - hoursSinceLastSession.value)),
  )

  const recapLockLabel = computed(() => {
    if (recapLockedByPages.value) {
      const pages = pagesUntilUnlock.value
      return `Read ${pages} more ${pages === 1 ? 'page' : 'pages'}`
    }

    if (recapLockedByCooldown.value) {
      const hours = hoursUntilUnlock.value
      return `Available in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
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
