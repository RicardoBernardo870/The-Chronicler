import { ref, computed, readonly } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { useBooksStore } from '@/stores/books'
import { useUpNextStore } from '@/stores/upNext'
import type { Book } from '@/types'

/**
 * Module-scoped singleton ref — one hero bookId shared across all Dashboard
 * consumers. Ephemeral: cleared on full page reload (per spec Assumption).
 *
 * Promotion-vs-swap rule (Clarification Q1):
 *   - Auto-promotion fires ONLY if the completed book IS the current hero.
 *   - Explicit user swap (setActive) always wins.
 *
 * Hero-exclusion invariant:
 *   - upNext never contains activeBookId.
 */
const activeBookId = ref<string | null>(null)
const selectionSource = ref<'explicit' | 'inferred' | null>(null)

export const useActiveBook = () => {
  const progressStore = useProgressStore()
  const booksStore = useBooksStore()
  const upNextStore = useUpNextStore()

  /** The currently-active hero Book object, or null if none selected. */
  const activeBook = computed((): Book | null => {
    if (!activeBookId.value) return null
    return booksStore.bookById(activeBookId.value) ?? null
  })

  /**
   * All in-progress books (1–99%) EXCLUDING the active hero.
   * These are the swap candidates shown in the "In Progress" section.
   * Hero-exclusion invariant is enforced here.
   */
  const upNext = computed((): Book[] =>
    progressStore.inProgressBooks
      .filter(item => item.book.id !== activeBookId.value)
      .map(item => item.book)
  )

  const sortedInProgress = computed(() => {
    const orderedIds = upNextStore.sortedBookIds()
    return [...progressStore.inProgressBooks].sort((a, b) => {
      const aOrder = orderedIds.indexOf(a.book.id)
      const bOrder = orderedIds.indexOf(b.book.id)
      const aKnown = aOrder !== -1
      const bKnown = bOrder !== -1

      if (aKnown && bKnown) return aOrder - bOrder
      if (aKnown) return -1
      if (bKnown) return 1

      return new Date(b.progress.updatedAt).getTime() - new Date(a.progress.updatedAt).getTime()
    })
  })

  const inferActiveBookId = (): string | null => sortedInProgress.value[0]?.book.id ?? null

  /**
   * Explicitly swap the hero to a different book.
   * No-op when the book is already the active hero (prevents reactive thrash).
   */
  const setActive = (bookId: string) => {
    if (bookId === activeBookId.value) return
    activeBookId.value = bookId
    selectionSource.value = 'explicit'
  }

  /**
   * Called when a book is marked complete.
   * Only promotes to next in-progress book if the COMPLETED book IS the hero.
   * Completion of any other book is ignored (explicit swap wins).
   */
  const onBookCompleted = (bookId: string) => {
    if (bookId !== activeBookId.value) return
    activeBookId.value = null
    selectionSource.value = null
    initializeIfNeeded()
  }

  /**
   * Seed the hero on first Dashboard mount (or after a reload cleared the ref).
   * If a hero is already selected, this is a no-op.
   */
  const initializeIfNeeded = () => {
    const activeProgress = activeBookId.value ? progressStore.progressForBook(activeBookId.value) : null
    const activeStillReadable = activeBookId.value
      ? booksStore.bookById(activeBookId.value) !== undefined
        && (selectionSource.value === 'explicit'
          ? (activeProgress?.percentage ?? 0) < 100
          : progressStore.inProgressBooks.some(item => item.book.id === activeBookId.value))
      : false

    if (activeStillReadable && selectionSource.value === 'explicit') return
    if (activeStillReadable && selectionSource.value === 'inferred') return

    if (activeBookId.value && !activeStillReadable) {
      activeBookId.value = null
      selectionSource.value = null
    }

    const nextId = inferActiveBookId()
    activeBookId.value = nextId
    selectionSource.value = nextId ? 'inferred' : null
  }

  return {
    /** Exposed as readonly — mutate only via setActive / onBookCompleted. */
    activeBookId: readonly(activeBookId),
    selectionSource: readonly(selectionSource),
    activeBook,
    upNext,
    setActive,
    onBookCompleted,
    initializeIfNeeded,
  }
}
