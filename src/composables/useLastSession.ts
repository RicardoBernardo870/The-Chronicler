import { ref, computed, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'

// T016 (013) — extended LastSession interface
export interface LastSession {
  bookId: string
  bookTitle: string
  endedAt: Date
  startedAt: Date | null          // null for legacy rows (no session_start_at)
  pagesDelta: number
  startPage: number               // page at session start
  endPage: number                 // page at session end (= current row's page)
  durationSeconds: number | null  // null for legacy rows
  velocityPph: number | null      // null when: legacy, duration < 60s, or 0 pages
  completionDelta: number | null  // null when totalPages unknown or 0
  finishPredictionSessions: number | null  // null when velocity unavailable or done
  sessionNote: string | null      // 013 optional end-of-session note
}

/**
 * Composable that surfaces the reader's most recent session across the ENTIRE
 * library (not filtered to the hero book — it is a habit/momentum signal).
 *
 * "Session" is defined as the last recorded progress_history row.
 *
 * T017: durationSeconds is now precise — computed from session_start_at → recorded_at
 *       when session_start_at is non-null.  Legacy rows fall back to "—".
 * T018: completionDelta and finishPredictionSessions are derived from page data +
 *       a rolling 3-session average velocity for the same book.
 */
export const useLastSession = () => {
  const allHistory = ref<ProgressHistory[]>([])
  const loaded = ref(false)

  const fetchAllHistory = async (): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase
      .from('progress_history')
      .select('id, book_id, user_id, page, recorded_at, session_start_at, session_note')
      .order('recorded_at', { ascending: true })
    if (error) return
    allHistory.value = (data as ProgressHistoryRow[]).map(mapProgressHistory)
    loaded.value = true
  }

  // Re-fetch whenever a session ends so the card updates immediately without
  // requiring a page reload. lastSessionEnded changes each time updateProgress
  // completes with an active session_start_at.
  const progressStore = useProgressStore()
  watch(() => progressStore.lastSessionEnded, (event) => {
    if (event) fetchAllHistory()
  })

  // ── Rolling average velocity (T018) ──────────────────────────────────────
  // Uses up to the last 3 progress_history rows with non-null session_start_at
  // for the given bookId (excluding the current "last" row which is already
  // factored in by the caller).
  const _rollingAvgVelocity = (bookId: string, excludeRowId: string): number | null => {
    const rows = allHistory.value
      .filter(r => r.bookId === bookId && r.sessionStartAt !== null && r.id !== excludeRowId)
      .slice(-3)  // last 3 rows

    if (rows.length === 0) return null

    const velocities: number[] = []
    for (const row of rows) {
      const sameBook = allHistory.value.filter(r => r.bookId === bookId)
      const rowIdx = sameBook.findIndex(r => r.id === row.id)
      const priorRow = rowIdx > 0 ? sameBook[rowIdx - 1] : null
      const pageDelta = priorRow ? Math.max(0, row.page - priorRow.page) : Math.max(0, row.page)
      const durSec = (new Date(row.recordedAt).getTime() - new Date(row.sessionStartAt!).getTime()) / 1000
      if (durSec >= 60 && pageDelta >= 1) {
        velocities.push(pageDelta / (durSec / 3600))
      }
    }

    if (velocities.length === 0) return null
    return velocities.reduce((sum, v) => sum + v, 0) / velocities.length
  }

  const lastSession = computed((): LastSession | null => {
    const rows = allHistory.value
    if (rows.length === 0) return null

    // Most recent row across the library
    const lastRow = rows[rows.length - 1]

    // Find the prior row for the same book to derive pagesDelta + startPage
    const sameBookRows = rows.filter(r => r.bookId === lastRow.bookId)
    const lastIdx = sameBookRows.length - 1
    const priorRow = lastIdx > 0 ? sameBookRows[lastIdx - 1] : null

    const endPage = lastRow.page
    const startPage = priorRow ? priorRow.page : 0
    const pagesDelta = Math.max(0, endPage - startPage)

    // T017: precise duration when session_start_at is present
    const startedAt = lastRow.sessionStartAt ? new Date(lastRow.sessionStartAt) : null
    const durationSeconds = startedAt
      ? (new Date(lastRow.recordedAt).getTime() - startedAt.getTime()) / 1000
      : null

    // Velocity: requires ≥60s duration AND ≥1 page read
    const velocityPph =
      durationSeconds !== null && durationSeconds >= 60 && pagesDelta >= 1
        ? Math.round(pagesDelta / (durationSeconds / 3600))
        : null

    const booksStore = useBooksStore()
    const book = booksStore.bookById(lastRow.bookId)
    const totalPages = book?.totalPages ?? 0

    // T018: completion delta (% of book read this session)
    const completionDelta =
      totalPages > 0 && pagesDelta >= 0
        ? Math.round((pagesDelta / totalPages) * 1000) / 10  // 1 decimal place
        : null

    // T018: finish prediction — rolling average of last 3 sessions
    let finishPredictionSessions: number | null = null
    if (totalPages > 0 && pagesDelta >= 1) {
      const pagesRemaining = Math.max(0, totalPages - endPage)
      if (pagesRemaining > 0) {
        // Include current session's velocity in rolling average
        const rollingAvg = velocityPph !== null
          ? (() => {
              const priorAvg = _rollingAvgVelocity(lastRow.bookId, lastRow.id)
              if (priorAvg === null) return velocityPph
              // Average current session with prior rolling avg
              const priorRows = allHistory.value
                .filter(r => r.bookId === lastRow.bookId && r.sessionStartAt !== null && r.id !== lastRow.id)
                .slice(-3).length
              return (velocityPph + priorAvg * Math.min(priorRows, 2)) / (Math.min(priorRows, 2) + 1)
            })()
          : _rollingAvgVelocity(lastRow.bookId, lastRow.id)

        if (rollingAvg !== null && rollingAvg > 0) {
          // One "session" = the average session duration (use 60 min as baseline if unknown)
          const avgPagesPerSession = pagesDelta > 0 ? pagesDelta : 1
          const avgSessionVelocity = rollingAvg
          // Estimate pages per session from pph × 1 hour (normalise to 1-hour session)
          const estimatedPagesPerSession = avgSessionVelocity > 0
            ? (durationSeconds ? (avgSessionVelocity * (durationSeconds / 3600)) : avgPagesPerSession)
            : avgPagesPerSession

          if (estimatedPagesPerSession > 0) {
            finishPredictionSessions = Math.ceil(pagesRemaining / estimatedPagesPerSession)
          }
        }
      }
    }

    return {
      bookId: lastRow.bookId,
      bookTitle: book?.title ?? 'Unknown Book',
      endedAt: new Date(lastRow.recordedAt),
      startedAt,
      pagesDelta,
      startPage,
      endPage,
      durationSeconds,
      velocityPph,
      completionDelta,
      finishPredictionSessions,
      sessionNote: lastRow.sessionNote,
    }
  })

  return { lastSession, fetchAllHistory, loaded }
}
