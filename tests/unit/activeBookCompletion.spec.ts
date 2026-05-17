import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useActiveBook } from '@/composables/useActiveBook'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import type { Book, ReadingProgress } from '@/types'

const makeBook = (id: string): Book => ({
  id,
  userId: 'user-1',
  title: id,
  author: 'Author',
  isbn: null,
  coverUrl: null,
  totalPages: 100,
  genre: null,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const makeProgress = (
  bookId: string,
  currentPage: number,
  sessionStartAt: string | null = null,
): ReadingProgress => ({
  id: `progress-${bookId}`,
  bookId,
  userId: 'user-1',
  currentPage,
  percentage: currentPage,
  updatedAt: '2026-05-17T12:00:00.000Z',
  sessionStartAt,
})

describe('active book completion handoff', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('can infer a page-zero active session after refresh', () => {
    const booksStore = useBooksStore()
    const progressStore = useProgressStore()
    const replacement = makeBook('replacement')
    booksStore.books = [replacement]
    progressStore.progress = {
      replacement: makeProgress('replacement', 0, '2026-05-17T12:00:00.000Z'),
    }

    const active = useActiveBook()
    active.initializeIfNeeded()

    expect(active.activeBookId.value).toBe('replacement')
    expect(active.activeBook.value?.id).toBe('replacement')
  })

  it('keeps an explicit replacement selected after another active book completes', () => {
    const booksStore = useBooksStore()
    const progressStore = useProgressStore()
    const completed = makeBook('completed')
    const replacement = makeBook('replacement')
    booksStore.books = [completed, replacement]
    progressStore.progress = {
      completed: makeProgress('completed', 100),
      replacement: makeProgress('replacement', 0, '2026-05-17T12:00:00.000Z'),
    }

    const active = useActiveBook()
    active.setActive('replacement')
    active.onBookCompleted('completed')

    expect(active.activeBookId.value).toBe('replacement')
  })
})
