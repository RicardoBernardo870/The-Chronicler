import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import type { Book, LibraryBookEntry, ReadingProgress } from '@/types'

const singleMock = vi.hoisted(() => vi.fn())
const selectMock = vi.hoisted(() => vi.fn(() => ({ single: singleMock })))
const upsertMock = vi.hoisted(() => vi.fn(() => ({ select: selectMock })))
const fromMock = vi.hoisted(() => vi.fn(() => ({ upsert: upsertMock })))

vi.mock('@/services/supabase', () => ({
  supabase: {
    from: fromMock,
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

const book = (id: string, totalPages = 300): Book => ({
  id,
  userId: 'user-1',
  title: `Book ${id}`,
  author: 'Author',
  isbn: null,
  coverUrl: null,
  totalPages,
  genre: null,
  createdAt: '2026-01-01T00:00:00.000Z',
})

const entry = (b: Book, currentPage = 0, progressId: string | null = null): LibraryBookEntry => ({
  id: b.id,
  title: b.title,
  author: b.author,
  coverUrl: b.coverUrl,
  totalPages: b.totalPages,
  currentPage,
  percentage: b.totalPages > 0 ? (currentPage / b.totalPages) * 100 : 0,
  status: currentPage > 0 ? 'reading' : 'unread',
  lastReadAt: null,
  sessionStartAt: null,
  progressId,
  genre: b.genre,
  isbn: b.isbn,
})

describe('progress store startSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.user = { id: 'user-1', email: 'reader@example.com' }
  })

  it('creates page-zero progress when starting a session with no existing row', async () => {
    const b = book('new-book')
    const booksStore = useBooksStore()
    const progressStore = useProgressStore()
    booksStore.books = [b]
    booksStore.libraryEntries = [entry(b)]
    singleMock.mockResolvedValueOnce({
      data: {
        id: 'progress-1',
        book_id: b.id,
        user_id: 'user-1',
        current_page: 0,
        updated_at: '2026-05-17T12:00:00.000Z',
        session_start_at: '2026-05-17T12:00:00.000Z',
      },
      error: null,
    })

    await progressStore.startSession(b.id)

    expect(fromMock).toHaveBeenCalledWith('reading_progress')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        book_id: b.id,
        user_id: 'user-1',
        current_page: 0,
        session_start_at: expect.any(String),
      }),
      { onConflict: 'book_id,user_id' },
    )
    expect(progressStore.progressForBook(b.id)).toMatchObject({
      id: 'progress-1',
      currentPage: 0,
      sessionStartAt: '2026-05-17T12:00:00.000Z',
    })
    expect(progressStore.lastSessionEnded).toBeNull()
    expect(booksStore.libraryEntries[0]).toMatchObject({
      currentPage: 0,
      sessionStartAt: '2026-05-17T12:00:00.000Z',
      progressId: 'progress-1',
    })
  })

  it('preserves the existing current page when starting a session on an in-progress book', async () => {
    const b = book('existing-book')
    const booksStore = useBooksStore()
    const progressStore = useProgressStore()
    const existing: ReadingProgress = {
      id: 'progress-existing',
      bookId: b.id,
      userId: 'user-1',
      currentPage: 123,
      percentage: 41,
      updatedAt: '2026-05-16T12:00:00.000Z',
      sessionStartAt: null,
    }
    booksStore.books = [b]
    booksStore.libraryEntries = [entry(b, 123, existing.id)]
    progressStore.progress = { [b.id]: existing }
    singleMock.mockResolvedValueOnce({
      data: {
        id: existing.id,
        book_id: b.id,
        user_id: 'user-1',
        current_page: 123,
        updated_at: '2026-05-17T12:00:00.000Z',
        session_start_at: '2026-05-17T12:00:00.000Z',
      },
      error: null,
    })

    await progressStore.startSession(b.id)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ current_page: 123 }),
      { onConflict: 'book_id,user_id' },
    )
    expect(progressStore.progressForBook(b.id)).toMatchObject({
      currentPage: 123,
      sessionStartAt: '2026-05-17T12:00:00.000Z',
    })
  })
})
