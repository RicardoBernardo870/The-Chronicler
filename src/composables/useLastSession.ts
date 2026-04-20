import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'

export interface LastSession {
  bookId: string
  bookTitle: string
  endedAt: Date
  pagesDelta: number
  durationSeconds: number | null
  velocityPph: number | null
}

/**
 * Composable that surfaces the reader's most recent session across the ENTIRE
 * library (not filtered to the hero book — it is a habit/momentum signal).
 *
 * "Session" is defined as the last recorded progress_history row.
 * pagesDelta = delta from the prior row for the same book (floor 0).
 * velocityPph is null when: no prior row, duration < 60s, or pagesDelta < 1.
 */
export const useLastSession = () => {
  const allHistory = ref<ProgressHistory[]>([])
  const loaded = ref(false)

  const fetchAllHistory = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase
      .from('progress_history')
      .select('*')
      .order('recorded_at', { ascending: true })
    if (error) return
    allHistory.value = (data as ProgressHistoryRow[]).map(mapProgressHistory)
    loaded.value = true
  }

  const lastSession = computed((): LastSession | null => {
    const rows = allHistory.value
    if (rows.length === 0) return null

    // Most recent row across the library
    const lastRow = rows[rows.length - 1]

    // Find the prior row for the same book to derive delta + duration
    const sameBookRows = rows.filter(r => r.bookId === lastRow.bookId)
    const lastIdx = sameBookRows.length - 1
    const priorRow = lastIdx > 0 ? sameBookRows[lastIdx - 1] : null

    const pagesDelta = priorRow
      ? Math.max(0, lastRow.page - priorRow.page)
      : Math.max(0, lastRow.page) // first-ever row: pages from start

    const durationSeconds = priorRow
      ? (new Date(lastRow.recordedAt).getTime() - new Date(priorRow.recordedAt).getTime()) / 1000
      : null

    // Velocity requires: ≥ 60s duration, ≥ 1 page read
    const velocityPph =
      durationSeconds !== null && durationSeconds >= 60 && pagesDelta >= 1
        ? pagesDelta / (durationSeconds / 3600)
        : null

    const booksStore = useBooksStore()
    const book = booksStore.bookById(lastRow.bookId)

    return {
      bookId: lastRow.bookId,
      bookTitle: book?.title ?? 'Unknown Book',
      endedAt: new Date(lastRow.recordedAt),
      pagesDelta,
      durationSeconds,
      velocityPph,
    }
  })

  return { lastSession, fetchAllHistory, loaded }
}
