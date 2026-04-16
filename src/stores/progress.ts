import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapReadingProgress, type ReadingProgress, type ReadingProgressRow } from '@/types'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { useOfflineSync } from '@/composables/useOfflineSync'

export const useProgressStore = defineStore('progress', () => {
  // Keyed by bookId
  const progress = ref<Record<string, ReadingProgress>>({})
  // True when IndexedDB queue has unsynced mutations
  const pendingSync = ref(false)

  const { enqueue, flushQueue, registerBackgroundSync } = useOfflineSync()

  /** Sync a single mutation directly to Supabase (used by flushQueue) */
  async function syncToSupabase(bookId: string, currentPage: number): Promise<void> {
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

  async function drainQueue(): Promise<void> {
    await flushQueue(syncToSupabase)
    pendingSync.value = false
  }

  // Flush on reconnect (fallback for browsers without Background Sync)
  function handleOnline() { drainQueue() }

  function setupListeners() {
    window.addEventListener('online', handleOnline)
    registerBackgroundSync()
  }

  function teardownListeners() {
    window.removeEventListener('online', handleOnline)
  }

  async function fetchProgress() {
    const booksStore = useBooksStore()
    const { data, error } = await supabase.from('reading_progress').select('*')
    if (error) throw error

    const map: Record<string, ReadingProgress> = {}
    for (const row of data as ReadingProgressRow[]) {
      const book = booksStore.bookById(row.book_id)
      if (book) {
        map[row.book_id] = mapReadingProgress(row, book.totalPages)
      }
    }
    progress.value = map

    // Also flush any queued mutations that arrived while offline
    if (navigator.onLine) await drainQueue()
  }

  async function updateProgress(bookId: string, currentPage: number) {
    const booksStore = useBooksStore()
    const authStore = useAuthStore()
    const book = booksStore.bookById(bookId)
    if (!book) throw new Error('Book not found')
    if (!authStore.user) throw new Error('Not authenticated')

    // Always apply optimistic update immediately
    progress.value[bookId] = {
      id: progress.value[bookId]?.id ?? '',
      bookId,
      userId: authStore.user.id,
      currentPage,
      percentage: Math.round((currentPage / book.totalPages) * 10000) / 100,
      updatedAt: new Date().toISOString(),
    }

    if (navigator.onLine) {
      // Online: persist synchronously
      await syncToSupabase(bookId, currentPage)
      // Fire-and-forget: log to progress_history — never blocks UI, silent on error
      supabase.from('progress_history').insert({
        book_id: bookId,
        user_id: authStore.user.id,
        page: currentPage,
        recorded_at: new Date().toISOString(),
      })
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

  const progressForBook = (bookId: string): ReadingProgress | undefined =>
    progress.value[bookId]

  const percentageForBook = (bookId: string): number =>
    progress.value[bookId]?.percentage ?? 0

  /** Books with 0 < percentage < 100, sorted by most recently updated */
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

  /** Books at exactly 100%, sorted by most recently completed */
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
