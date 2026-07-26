import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { useRecapLock } from '@/composables/useRecapLock'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import type { Book, Recap, ReadingProgress } from '@/types'

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

vi.mock('@/composables/useOfflineSync', () => ({
  useOfflineSync: () => ({
    enqueue: vi.fn(),
    flushQueue: vi.fn(),
    registerBackgroundSync: vi.fn(),
  }),
}))

const HOUR = 60 * 60 * 1000
const BOOK_ID = 'book-1'

const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()

const makeBook = (): Book => ({
  id: BOOK_ID,
  userId: 'user-1',
  title: 'Book',
  author: 'Author',
  isbn: null,
  coverUrl: null,
  totalPages: 300,
  genre: null,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const makeProgress = (currentPage: number, updatedAt: string): ReadingProgress => ({
  id: 'progress-1',
  bookId: BOOK_ID,
  userId: 'user-1',
  currentPage,
  percentage: Math.round((currentPage / 300) * 100),
  updatedAt,
  sessionStartAt: null,
})

const makeRecap = (pageSnapshot: number, createdAt: string): Recap => ({
  id: 'recap-1',
  bookId: BOOK_ID,
  userId: 'user-1',
  progressSnapshot: Math.round((pageSnapshot / 300) * 100),
  pageSnapshot,
  memoryJogger: 'jogger',
  conceptWatchlist: '',
  thematicBridge: '',
  mode: 'inferred',
  createdAt,
  imagePath: null,
  imageStatus: 'pending',
  imageGeneratedAt: null,
})

describe('useRecapLock idle unlock', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useBooksStore().books = [makeBook()]
  })

  it('unlocks after a long reading gap when no recent recap exists', () => {
    // 5 days since the last progress write, no recaps yet.
    useProgressStore().progress = { [BOOK_ID]: makeProgress(150, hoursAgo(120)) }

    const { recapLocked, recapUnlockedByIdleTime } = useRecapLock(ref(BOOK_ID))

    expect(recapUnlockedByIdleTime.value).toBe(true)
    expect(recapLocked.value).toBe(false)
  })

  it('re-locks once the idle unlock has produced a recap', () => {
    // Same long gap — generating a recap does NOT touch reading_progress, so
    // progress.updatedAt is still 5 days old. The lock must come back anyway.
    useProgressStore().progress = { [BOOK_ID]: makeProgress(150, hoursAgo(120)) }
    useRecapsStore().recapsByBook[BOOK_ID] = [makeRecap(150, new Date().toISOString())]

    const { recapLocked, recapUnlockedByIdleTime, recapLockedByPages } =
      useRecapLock(ref(BOOK_ID))

    expect(recapUnlockedByIdleTime.value).toBe(false)
    expect(recapLockedByPages.value).toBe(true)
    expect(recapLocked.value).toBe(true)
  })

  it('grants the idle unlock again once the cooldown on the last recap expires', () => {
    // Still idle, last recap is older than the 6h cooldown.
    useProgressStore().progress = { [BOOK_ID]: makeProgress(150, hoursAgo(120)) }
    useRecapsStore().recapsByBook[BOOK_ID] = [makeRecap(150, hoursAgo(7))]

    const { recapLocked, recapUnlockedByIdleTime } = useRecapLock(ref(BOOK_ID))

    expect(recapUnlockedByIdleTime.value).toBe(true)
    expect(recapLocked.value).toBe(false)
  })
})
