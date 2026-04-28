import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { mapPageCapture, type PageCapture, type PageCaptureRow } from '@/types'

/**
 * Page Captures store (015-corpus-recaps).
 *
 * Caches captures per book. Provides a single write path (`saveCapture`) that
 * upserts on (user_id, book_id, page) and refreshes the local list.
 *
 * Coverage helpers feed the recap engine's mode selection (≥30% delta coverage
 * triggers corpus mode).
 */
export const useCapturesStore = defineStore('captures', () => {
  const capturesByBook = reactive<Record<string, PageCapture[]>>({})
  const loadedBookIds = ref<Set<string>>(new Set())
  const saving = ref(false)
  const lastError = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────────────────────────
  const capturesForBook = (bookId: string): PageCapture[] =>
    capturesByBook[bookId] ?? []

  const capturesInRange = (bookId: string, fromPage: number, toPage: number): PageCapture[] =>
    (capturesByBook[bookId] ?? []).filter((c) => c.page > fromPage && c.page <= toPage)

  /**
   * Fraction of integer pages in (fromPage, toPage] that have a capture.
   * Returns 0 when the range is non-positive.
   */
  const coverageInRange = (bookId: string, fromPage: number, toPage: number): number => {
    const range = toPage - fromPage
    if (range <= 0) return 0
    return capturesInRange(bookId, fromPage, toPage).length / range
  }

  const pageHasCapture = (bookId: string, page: number): boolean =>
    (capturesByBook[bookId] ?? []).some((c) => c.page === page)

  // Reactive coverage helper — recomputes when capturesByBook changes.
  const coverageRef = (bookId: string, fromPage: number, toPage: number) =>
    computed(() => coverageInRange(bookId, fromPage, toPage))

  // ── Actions ──────────────────────────────────────────────────────────
  const fetchCapturesForBook = async (bookId: string): Promise<void> => {
    if (loadedBookIds.value.has(bookId)) return

    const authStore = useAuthStore()
    if (!authStore.user) return

    const { data, error } = await supabase
      .from('page_captures')
      .select('id, user_id, book_id, page, text, word_count, confidence, captured_at, source')
      .eq('book_id', bookId)
      .order('page', { ascending: true })

    if (error) {
      lastError.value = error.message
      throw error
    }

    capturesByBook[bookId] = (data as PageCaptureRow[]).map(mapPageCapture)
    loadedBookIds.value.add(bookId)
  }

  interface SaveCaptureInput {
    bookId: string
    page: number
    text: string
    confidence: number
    wordCount: number
  }

  const saveCapture = async (input: SaveCaptureInput): Promise<PageCapture> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    saving.value = true
    lastError.value = null
    try {
      const { data, error } = await supabase
        .from('page_captures')
        .upsert(
          {
            user_id: authStore.user.id,
            book_id: input.bookId,
            page: input.page,
            text: input.text,
            word_count: input.wordCount,
            confidence: input.confidence,
            source: 'ocr',
          },
          { onConflict: 'user_id,book_id,page' },
        )
        .select()
        .single()

      if (error) throw error

      const mapped = mapPageCapture(data as PageCaptureRow)

      // Refresh local cache: replace the existing entry for this page or append
      const list = capturesByBook[input.bookId] ?? []
      const idx = list.findIndex((c) => c.page === input.page)
      if (idx >= 0) list[idx] = mapped
      else list.push(mapped)
      list.sort((a, b) => a.page - b.page)
      capturesByBook[input.bookId] = list
      loadedBookIds.value.add(input.bookId)

      return mapped
    } catch (e: unknown) {
      lastError.value = e instanceof Error ? e.message : 'Failed to save capture'
      throw e
    } finally {
      saving.value = false
    }
  }

  const clearCachedCaptures = (bookId?: string): void => {
    if (bookId) {
      delete capturesByBook[bookId]
      loadedBookIds.value.delete(bookId)
    } else {
      Object.keys(capturesByBook).forEach((k) => delete capturesByBook[k])
      loadedBookIds.value.clear()
    }
  }

  return {
    capturesByBook,
    saving,
    lastError,
    capturesForBook,
    capturesInRange,
    coverageInRange,
    coverageRef,
    pageHasCapture,
    fetchCapturesForBook,
    saveCapture,
    clearCachedCaptures,
  }
})
