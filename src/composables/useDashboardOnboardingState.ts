import { computed } from 'vue'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import type { Book, BookStatus, DashboardFirstRunState } from '@/types'

export const deriveReadingState = (
  book: Book,
  percentage: number,
): BookStatus => {
  if (percentage >= 100) return 'finished'
  if (percentage > 0 && book.totalPages > 0) return 'reading'
  return 'unread'
}

export const useDashboardOnboardingState = () => {
  const booksStore = useBooksStore()
  const progressStore = useProgressStore()

  const inProgressBooks = computed(() => progressStore.inProgressBooks.map(item => item.book))
  const completedBooks = computed(() => progressStore.completedBooks.map(item => item.book))
  const queuedBooks = computed(() =>
    booksStore.books.filter(book =>
      !progressStore.progressForBook(book.id)?.dnfAt &&
      deriveReadingState(book, progressStore.percentageForBook(book.id)) === 'unread',
    ),
  )

  const state = computed<DashboardFirstRunState>(() => {
    const hasBooks = booksStore.books.length > 0
    const activeBookCount = inProgressBooks.value.length
    const queuedBookCount = queuedBooks.value.length
    const completedBookCount = completedBooks.value.length
    const recentCompletedBooks = completedBooks.value.slice(0, 3)
    const singleQueuedBook = queuedBookCount === 1 ? queuedBooks.value[0] : null

    if (!hasBooks) {
      return {
        kind: 'empty',
        hasBooks,
        activeBookCount,
        queuedBookCount,
        completedBookCount,
        singleQueuedBook: null,
        recentCompletedBooks,
      }
    }

    if (activeBookCount === 1 && queuedBookCount === 0) {
      return {
        kind: 'oneInProgress',
        hasBooks,
        activeBookCount,
        queuedBookCount,
        completedBookCount,
        singleQueuedBook: null,
        recentCompletedBooks,
      }
    }

    if (activeBookCount === 0 && queuedBookCount === 1 && completedBookCount === 0) {
      return {
        kind: 'oneQueued',
        hasBooks,
        activeBookCount,
        queuedBookCount,
        completedBookCount,
        singleQueuedBook,
        recentCompletedBooks,
      }
    }

    if (activeBookCount === 0 && queuedBookCount === 0 && completedBookCount > 0) {
      return {
        kind: 'completedOnly',
        hasBooks,
        activeBookCount,
        queuedBookCount,
        completedBookCount,
        singleQueuedBook: null,
        recentCompletedBooks,
      }
    }

    return {
      kind: 'standard',
      hasBooks,
      activeBookCount,
      queuedBookCount,
      completedBookCount,
      singleQueuedBook,
      recentCompletedBooks,
    }
  })

  return {
    state,
    queuedBooks,
    inProgressBooks,
    completedBooks,
  }
}
