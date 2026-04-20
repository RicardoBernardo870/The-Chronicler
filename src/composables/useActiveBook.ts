import { ref, computed, readonly } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { useBooksStore } from '@/stores/books'
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

export const useActiveBook = () => {
  const progressStore = useProgressStore()
  const booksStore = useBooksStore()

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

  /**
   * Explicitly swap the hero to a different book.
   * No-op when the book is already the active hero (prevents reactive thrash).
   */
  const setActive = (bookId: string) => {
    if (bookId === activeBookId.value) return
    activeBookId.value = bookId
  }

  /**
   * Called when a book is marked complete.
   * Only promotes to next in-progress book if the COMPLETED book IS the hero.
   * Completion of any other book is ignored (explicit swap wins).
   */
  const onBookCompleted = (bookId: string) => {
    if (bookId !== activeBookId.value) return
    const next = upNext.value[0]
    activeBookId.value = next?.id ?? null
  }

  /**
   * Seed the hero on first Dashboard mount (or after a reload cleared the ref).
   * If a hero is already selected, this is a no-op.
   */
  const initializeIfNeeded = () => {
    if (activeBookId.value !== null) return
    const first = progressStore.inProgressBooks[0]
    activeBookId.value = first?.book.id ?? null
  }

  return {
    /** Exposed as readonly — mutate only via setActive / onBookCompleted. */
    activeBookId: readonly(activeBookId),
    activeBook,
    upNext,
    setActive,
    onBookCompleted,
    initializeIfNeeded,
  }
}
