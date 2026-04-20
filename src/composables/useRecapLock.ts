import { computed, toValue, type Ref } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import { useBooksStore } from '@/stores/books'

const RECAP_TIME_UNLOCK_DAYS = 3

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
    if (!book.value || lastRecapPct.value === 0) return 0
    return Math.ceil((lastRecapPct.value + 5) / 100 * book.value.totalPages)
  })

  const recapLockedByPages = computed(
    () => lastRecapPct.value > 0 && (progress.value?.currentPage ?? 0) < unlockPage.value,
  )

  const daysSinceLastSession = computed(() => {
    const updatedAt = progress.value?.updatedAt
    if (!updatedAt) return 0
    return (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  })

  const recapLocked = computed(
    () => recapLockedByPages.value && daysSinceLastSession.value < RECAP_TIME_UNLOCK_DAYS,
  )

  const pagesUntilUnlock = computed(
    () => Math.max(0, unlockPage.value - (progress.value?.currentPage ?? 0)),
  )

  return {
    recapLocked,
    recapLockedByPages,
    pagesUntilUnlock,
    daysSinceLastSession,
  }
}
