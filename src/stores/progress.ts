import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapReadingProgress, type ReadingProgress, type ReadingProgressRow } from '@/types'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { useBookPassportStore } from '@/stores/bookPassport'
import { useLoreCardsStore } from '@/stores/loreCards'
import { detectCrossedMilestone } from '@/utils/milestoneDetect'
import {
  swrStatus,
  swrRun,
  swrTouch,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 30_000 // 30 s — progress is more volatile than books

// ── Session-ended event payload (T013) ──────────────────────────────────────
export interface SessionEndedEvent {
  bookId: string
  historyRowId: string
  sessionStartAt: string
}

export const useProgressStore = defineStore('progress', () => {
  // Keyed by bookId
  const progress = ref<Record<string, ReadingProgress>>({})
  const pendingSync = ref(false)

  // T013 (013): reactive slot for the most recent session-ended event.
  // Components watch this ref; a new value means a new session just ended.
  const lastSessionEnded = ref<SessionEndedEvent | null>(null)

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
      .select('id, book_id, user_id, current_page, updated_at, session_start_at')
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
    // T008 (013): select session_start_at so active sessions survive fetch
    const { data, error } = await supabase
      .from('reading_progress')
      .select('id, book_id, user_id, current_page, updated_at, session_start_at')
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

  // ── startSession (T011, 013) ───────────────────────────────────────────────
  // Writes session_start_at = NOW() to reading_progress on the server, then
  // updates local Pinia state. Throws on failure so the composable can surface
  // an error and roll back any optimistic state.

  const startSession = async (bookId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('reading_progress')
      .update({ session_start_at: now })
      .match({ book_id: bookId, user_id: authStore.user.id })
    if (error) throw error

    // Update local Pinia state optimistically after confirmed server write
    if (progress.value[bookId]) {
      progress.value[bookId] = { ...progress.value[bookId], sessionStartAt: now }
    }
  }

  // ── clearSession (013) ────────────────────────────────────────────────────
  // Resets session_start_at to null. Used by the composable for manual-cancel
  // and exposed as a test/utility escape hatch.

  const clearSession = async (bookId: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('reading_progress')
      .update({ session_start_at: null })
      .match({ book_id: bookId, user_id: authStore.user.id })
    if (error) throw error

    if (progress.value[bookId]) {
      progress.value[bookId] = { ...progress.value[bookId], sessionStartAt: null }
    }
  }

  // ── saveSessionNote (T021, 013) ────────────────────────────────────────────
  // Fire-and-forget PATCH on progress_history. Errors are logged silently.

  const saveSessionNote = async (historyRowId: string, note: string): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const { error } = await supabase
      .from('progress_history')
      .update({ session_note: note })
      .match({ id: historyRowId, user_id: authStore.user.id })

    if (error) {
      console.error('[progress] saveSessionNote failed', error)
    }
  }

  // ── Optimistic updateProgress (T014 + T019, updated for T012/T013) ────────
  // 1. Snapshot current state for rollback.
  // 2. Capture session_start_at before it is cleared.
  // 3. Apply optimistic update immediately (<50ms UI response).
  // 4. Persist to Supabase.
  // 5. Insert progress_history row (with session_start_at if present).
  // 6. If session was active, clear session_start_at on reading_progress and
  //    emit sessionEnded event.
  // 7. On error: roll back to snapshot and rethrow.

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

    // Capture session_start_at BEFORE the optimistic update clears it
    const capturedSessionStartAt = progress.value[bookId]?.sessionStartAt ?? null

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
      sessionStartAt: progress.value[bookId]?.sessionStartAt ?? null,
    }

    if (navigator.onLine) {
      try {
        await syncToSupabase(bookId, currentPage)
        // Mark progress cache fresh with server-confirmed data
        swrTouch(cacheKeys.progress(authStore.user.id))

        // T012 (013): insert progress_history with session_start_at
        const now = new Date().toISOString()
        let historyRowId: string | null = null
        try {
          const { data: histData, error: histError } = await supabase
            .from('progress_history')
            .insert({
              book_id: bookId,
              user_id: authStore.user.id,
              page: currentPage,
              recorded_at: now,
              session_start_at: capturedSessionStartAt, // null for legacy saves
            })
            .select('id')
            .single()
          if (!histError && histData) historyRowId = (histData as { id: string }).id
        } catch {
          // History insert failure is non-critical — don't block the save
        }

        // T012/T013 (013): if a session was active, clear it and emit sessionEnded
        if (capturedSessionStartAt) {
          // Clear session_start_at on reading_progress (fire-and-forget — server already confirmed save above)
          supabase
            .from('reading_progress')
            .update({ session_start_at: null })
            .match({ book_id: bookId, user_id: authStore.user.id })
            .then(() => {})

          // Update local Pinia state to reflect cleared session
          if (progress.value[bookId]) {
            progress.value[bookId] = { ...progress.value[bookId], sessionStartAt: null }
          }

          // Emit sessionEnded event so SessionNoteField can appear
          if (historyRowId) {
            lastSessionEnded.value = {
              bookId,
              historyRowId,
              sessionStartAt: capturedSessionStartAt,
            }
          }
        }

        // Fire-and-forget: auto-generate Book Passport on first completion
        if (newPct >= 100 && prevPct < 100) {
          const passportStore = useBookPassportStore()
          passportStore.fetchPassport(bookId).then(() => {
            if (!passportStore.passportFor(bookId)) {
              passportStore.generatePassport(bookId, book.title, book.author, book.totalPages, book.isbn)
            }
          })
        }

        // Fire-and-forget: check if a lore milestone was crossed (FR-001, FR-009, FR-010).
        const crossedMilestone = detectCrossedMilestone(prevPct, newPct)
        if (crossedMilestone !== null) {
          const loreStore = useLoreCardsStore()
          loreStore.maybeUnlockForMilestone(bookId, crossedMilestone, currentPage)
            .catch(() => { /* maybeUnlockForMilestone already swallows all errors */ })
        }
      } catch (e) {
        // Rollback optimistic update on server error
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
    lastSessionEnded,
    inProgressBooks,
    completedBooks,
    fetchProgress,
    updateProgress,
    startSession,
    clearSession,
    saveSessionNote,
    progressForBook,
    percentageForBook,
    setupListeners,
    teardownListeners,
    drainQueue,
  }
})
