import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { supabase } from '@/services/supabase'
import { requestRecapImage, streamRecap, type StreamRecapResult } from '@/services/recapService'
import { mapRecap, type Recap, type RecapRow, type RecapGenerationStatus, type RecapMode } from '@/types'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useAuthStore } from '@/stores/auth'
import { useCapturesStore } from '@/stores/captures'  // 015-corpus-recaps
// T010: SWR for fetchRecapsForBook (history metadata SELECT only).
// generateRecap and all streaming code are EXCLUDED from cache (FR-009).
import { swrStatus, swrRun, invalidate, registerRevalidator, cacheKeys } from '@/composables/useCache'

// 015-corpus-recaps: cap inline corpus payloads so a long reading gap does not
// flood the edge function with months of captured text.
const MAX_RECAP_CAPTURES = 3

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

  async function generateRecap(bookId: string, signal?: AbortSignal) {
    // First-run completed imports must not call this path automatically.
    // Generation stays bound to explicit UI actions such as "Get recap".
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

      // 015-corpus-recaps: select corpus or inferred mode.
      // Captures are sent inline in the request body when corpus mode triggers;
      // the edge function uses them to bypass the extraction stage entirely.
      // Context window spans 2 sessions back (Option A): the recap scope stays
      // anchored to fromPage, but captures from the previous session are also
      // included so the AI has richer grounding text.
      const capturesFromPage = recapsByBook[bookId]?.[1]?.pageSnapshot ?? 0
      const capturesStore = useCapturesStore()
      await capturesStore.fetchCapturesForBook(bookId).catch(() => {})
      const inRange = capturesStore.capturesInRange(bookId, capturesFromPage, currentPage)
      const latestCaptures = [...inRange]
        .sort((a, b) => b.page - a.page)
        .slice(0, MAX_RECAP_CAPTURES)
        .sort((a, b) => a.page - b.page)
      const useCorpus = latestCaptures.length >= 1 && currentPage > fromPage
      const selectedMode: RecapMode = useCorpus ? 'corpus' : 'inferred'

      const result: StreamRecapResult = await streamRecap(
        {
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          percentage,
          currentPage,
          totalPages: book.totalPages,
          from_page: fromPage > 0 ? fromPage : undefined,
          captures: useCorpus
            ? latestCaptures.map((c) => ({ page: c.page, text: c.text }))
            : undefined,
        },
        (token) => { streamingText.value += token },
        signal,
      )

      // Mid-stream dismiss: abort was called before completion — discard partial
      // content and do NOT persist to history (FR-007, 010-dashboard-ux-sync)
      if (result.aborted) {
        generationStatus.value = 'idle'
        streamingText.value = ''
        return
      }

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
          mode: selectedMode,  // 015-corpus-recaps
          image_status: 'pending',
        })
        .select()
        .single()
      if (insertErr) throw insertErr

      const newRecap = mapRecap(data as RecapRow)
      if (!recapsByBook[bookId]) recapsByBook[bookId] = []
      recapsByBook[bookId].unshift(newRecap)

      requestRecapImage({
        recapId: newRecap.id,
        title: book.title,
        author: book.author,
        genre: book.genre,
        memoryJogger: newRecap.memoryJogger,
        fromPage,
        currentPage,
      }).catch((imageErr) => {
        console.warn('Recap image generation request failed:', imageErr)
      })

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

  // 016 — flat list of every recap across the user's library; used by the
  // Profile page's Top Themes derivation. SWR-cached at the user level.
  async function fetchRecapsForAllBooks() {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = `recaps:all:${authStore.user.id}`
    const fetcher = async () => {
      const { data, error: err } = await supabase
        .from('recaps')
        .select('*')
        .eq('user_id', authStore.user!.id)
        .order('created_at', { ascending: false })
      if (err) throw err
      const grouped: Record<string, Recap[]> = {}
      for (const row of data as RecapRow[]) {
        const recap = mapRecap(row)
        if (!grouped[recap.bookId]) grouped[recap.bookId] = []
        grouped[recap.bookId].push(recap)
      }
      // Replace, don't merge — this is the source of truth for "all recaps".
      for (const k of Object.keys(recapsByBook)) delete recapsByBook[k]
      Object.assign(recapsByBook, grouped)
    }
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  return {
    recapsByBook,
    generationStatus,
    streamingText,
    error,
    fetchRecapsForBook,
    fetchRecapsForAllBooks,
    generateRecap,
    resetStatus,
    latestRecapForBook,
    recapHistoryForBook,
  }
})
