import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { supabase } from '@/services/supabase'
import { streamRecap } from '@/services/recapService'
import { mapRecap, type Recap, type RecapRow, type RecapGenerationStatus } from '@/types'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useAuthStore } from '@/stores/auth'
// T010: SWR for fetchRecapsForBook (history metadata SELECT only).
// generateRecap and all streaming code are EXCLUDED from cache (FR-009).
import { swrStatus, swrRun, invalidate, registerRevalidator, cacheKeys } from '@/composables/useCache'

const TTL = 60_000 // 60 s

export const useRecapsStore = defineStore('recaps', () => {
  const recapsByBook = reactive<Record<string, Recap[]>>({})
  const generationStatus = ref<RecapGenerationStatus>('idle')
  const streamingText = ref('')
  const error = ref<string | null>(null)

  // T010: SWR-aware history list fetch — ONLY this function uses the cache.
  // Streaming, generationStatus, and streamingText are NOT cached (FR-009).
  async function fetchRecapsForBook(bookId: string) {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.recaps(authStore.user.id, bookId)
    const fetcher = async () => {
      const { data, error: err } = await supabase
        .from('recaps')
        .select('*')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
      if (err) throw err
      recapsByBook[bookId] = (data as RecapRow[]).map(mapRecap)
    }
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  async function generateRecap(bookId: string) {
    // Lockout guard: prevent duplicate requests while streaming (FR-010)
    if (generationStatus.value === 'streaming') return

    const authStore = useAuthStore()
    const booksStore = useBooksStore()
    const progressStore = useProgressStore()

    if (!authStore.user) throw new Error('Not authenticated')

    const book = booksStore.bookById(bookId)
    if (!book) throw new Error('Book not found in library')

    const prog = progressStore.progressForBook(bookId)
    const percentage = prog?.percentage ?? 0
    const currentPage = prog?.currentPage ?? 0

    generationStatus.value = 'streaming'
    streamingText.value = ''
    error.value = null

    try {
      // Incremental recap: cover only pages since the last recap (Decision 3)
      const fromPage = recapsByBook[bookId]?.[0]?.pageSnapshot ?? 0

      const result = await streamRecap(
        {
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          percentage,
          currentPage,
          totalPages: book.totalPages,
          from_page: fromPage > 0 ? fromPage : undefined,
        },
        (token) => { streamingText.value += token },
      )

      // Persist to Supabase
      const { data, error: insertErr } = await supabase
        .from('recaps')
        .insert({
          book_id: bookId,
          user_id: authStore.user.id,
          progress_snapshot: percentage,
          page_snapshot: currentPage,
          memory_jogger: result.memoryJogger,
          concept_watchlist: result.conceptWatchlist,
          thematic_bridge: result.thematicBridge,
        })
        .select()
        .single()
      if (insertErr) throw insertErr

      const newRecap = mapRecap(data as RecapRow)
      if (!recapsByBook[bookId]) recapsByBook[bookId] = []
      recapsByBook[bookId].unshift(newRecap)

      // T015: invalidate the history cache so the Recap History page refetches
      // on next visit. Only the history list key — streaming paths untouched.
      if (authStore.user) invalidate(cacheKeys.recaps(authStore.user.id, bookId))

      generationStatus.value = 'complete'
    } catch (e: unknown) {
      generationStatus.value = 'error'
      error.value = e instanceof Error ? e.message : 'Failed to generate recap'
      streamingText.value = ''
    }
  }

  function resetStatus() {
    generationStatus.value = 'idle'
    streamingText.value = ''
    error.value = null
  }

  function latestRecapForBook(bookId: string): Recap | undefined {
    return recapsByBook[bookId]?.[0]
  }

  function recapHistoryForBook(bookId: string): Recap[] {
    return recapsByBook[bookId] ?? []
  }

  return {
    recapsByBook,
    generationStatus,
    streamingText,
    error,
    fetchRecapsForBook,
    generateRecap,
    resetStatus,
    latestRecapForBook,
    recapHistoryForBook,
  }
})
