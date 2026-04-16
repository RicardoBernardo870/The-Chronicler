import { defineStore } from 'pinia'
import { ref } from 'vue'
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

  function progressForBook(bookId: string): ReadingProgress | undefined {
    return progress.value[bookId]
  }

  function percentageForBook(bookId: string): number {
    return progress.value[bookId]?.percentage ?? 0
  }

  return {
    progress,
    pendingSync,
    fetchProgress,
    updateProgress,
    progressForBook,
    percentageForBook,
    setupListeners,
    teardownListeners,
    drainQueue,
  }
})
