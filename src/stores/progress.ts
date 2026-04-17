import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapReadingProgress, type ReadingProgress, type ReadingProgressRow } from '@/types'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { useBookPassportStore } from '@/stores/bookPassport'
import {
  swrStatus,
  swrRun,
  swrTouch,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 30_000 // 30 s — progress is more volatile than books

export const useProgressStore = defineStore('progress', () => {
  // Keyed by bookId
  const progress = ref<Record<string, ReadingProgress>>({})
  const pendingSync = ref(false)

  const { enqueue, flushQueue, registerBackgroundSync } = useOfflineSync()

  // ── Supabase sync helper ───────────────────────────────────────────────────

  const syncToSupabase = async (bookId: string, currentPage: number): Promise<void> => {
    const authStore = useAuthStore()
    const booksStore = useBooksStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('reading_progress')
      .upsert(
        { book_id: bookId, user_id: authStore.user.id, current_page: currentPage },
        { onConflict: 'book_id,user_id' }
      )
      .select()
      .single()
    if (error) throw error

    const book = booksStore.bookById(bookId)
    if (book) {
      progress.value[bookId] = mapReadingProgress(data as ReadingProgressRow, book.totalPages)
    }
  }

  const drainQueue = async (): Promise<void> => {
    await flushQueue(syncToSupabase)
    pendingSync.value = false
  }

  const handleOnline = () => { drainQueue() }

  const setupListeners = () => {
    window.addEventListener('online', handleOnline)
    registerBackgroundSync()
  }

  const teardownListeners = () => {
    window.removeEventListener('online', handleOnline)
  }

  // ── Fetcher ────────────────────────────────────────────────────────────────

  const _fetcher = async () => {
    const booksStore = useBooksStore()
    const { data, error } = await supabase.from('reading_progress').select('*')
    if (error) throw error

    const map: Record<string, ReadingProgress> = {}
    for (const row of data as ReadingProgressRow[]) {
      const book = booksStore.bookById(row.book_id)
      if (book) map[row.book_id] = mapReadingProgress(row, book.totalPages)
    }
    progress.value = map

    if (navigator.onLine) await drainQueue()
  }

  // ── SWR-aware fetchProgress (T006) ─────────────────────────────────────────

  const fetchProgress = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.progress(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _fetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first fetch
    await swrRun(key, _fetcher)
  }

  // ── Optimistic updateProgress (T014 + T019) ────────────────────────────────
  // 1. Snapshot current state for rollback.
  // 2. Apply optimistic update immediately (<50ms UI response).
  // 3. Persist to Supabase.
  // 4. On success: touch cache so next SWR check sees 'fresh'.
  // 5. On error: roll back to snapshot and rethrow.

  const updateProgress = async (bookId: string, currentPage: number) => {
    const booksStore = useBooksStore()
    const authStore = useAuthStore()
    const book = booksStore.bookById(bookId)
    if (!book) throw new Error('Book not found')
    if (!authStore.user) throw new Error('Not authenticated')

    const prevPct = progress.value[bookId]?.percentage ?? 0
    const newPct = book.totalPages > 0
      ? Math.round((currentPage / book.totalPages) * 10000) / 100
      : 0

    // Snapshot for rollback
    const snapshot = progress.value[bookId]

    // Optimistic update — reflects in UI before network round-trip
    progress.value[bookId] = {
      id: progress.value[bookId]?.id ?? '',
      bookId,
      userId: authStore.user.id,
      currentPage,
      percentage: newPct,
      updatedAt: new Date().toISOString(),
    }

    if (navigator.onLine) {
      try {
        await syncToSupabase(bookId, currentPage)
        // T014: mark progress cache fresh with server-confirmed data
        swrTouch(cacheKeys.progress(authStore.user.id))

        // Fire-and-forget: log to progress_history
        supabase.from('progress_history').insert({
          book_id: bookId,
          user_id: authStore.user.id,
          page: currentPage,
          recorded_at: new Date().toISOString(),
        }).then(() => {})

        // Fire-and-forget: auto-generate Book Passport on first completion
        if (newPct >= 100 && prevPct < 100) {
          const passportStore = useBookPassportStore()
          passportStore.fetchPassport(bookId).then(() => {
            if (!passportStore.passportFor(bookId)) {
              passportStore.generatePassport(bookId, book.title, book.author, book.totalPages, book.isbn)
            }
          })
        }
      } catch (e) {
        // T019: rollback optimistic update on server error
        if (snapshot !== undefined) {
          progress.value[bookId] = snapshot
        } else {
          delete progress.value[bookId]
        }
        throw e
      }
    } else {
      // Offline: queue for later sync
      await enqueue({
        type: 'progress_update',
        payload: { bookId, currentPage, updatedAt: new Date().toISOString() },
      })
      pendingSync.value = true
      await registerBackgroundSync()
    }
  }

  // ── Read helpers ───────────────────────────────────────────────────────────

  const progressForBook = (bookId: string): ReadingProgress | undefined =>
    progress.value[bookId]

  const percentageForBook = (bookId: string): number =>
    progress.value[bookId]?.percentage ?? 0

  const inProgressBooks = computed(() => {
    const booksStore = useBooksStore()
    return Object.values(progress.value)
      .filter(p => p.percentage > 0 && p.percentage < 100)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(p => ({ book: booksStore.bookById(p.bookId) ?? null, progress: p }))
      .filter((item): item is { book: NonNullable<typeof item.book>; progress: ReadingProgress } =>
        item.book !== null
      )
  })

  const completedBooks = computed(() => {
    const booksStore = useBooksStore()
    return Object.values(progress.value)
      .filter(p => p.percentage >= 100)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(p => ({ book: booksStore.bookById(p.bookId) ?? null, progress: p }))
      .filter((item): item is { book: NonNullable<typeof item.book>; progress: ReadingProgress } =>
        item.book !== null
      )
  })

  return {
    progress,
    pendingSync,
    inProgressBooks,
    completedBooks,
    fetchProgress,
    updateProgress,
    progressForBook,
    percentageForBook,
    setupListeners,
    teardownListeners,
    drainQueue,
  }
})
