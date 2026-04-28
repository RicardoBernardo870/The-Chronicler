import { ref, computed, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'
import { diffInSeconds } from '@/utils/date'

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
  velocityPph: number | null      // all-sessions average for the book; null when no valid sessions exist
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
 *       when session_start_at is non-null. Legacy rows fall back to "—".
 * T018: completionDelta and finishPredictionSessions are derived from page data +
 *       a rolling 3-session average velocity for the same book.
 *
 * velocityPph: aggregated across ALL valid sessions for the book (stable book-level
 *              reading speed), not just the last session.
 * finishPredictionSessions: still uses a rolling last-3-sessions window to reflect
 *                            current momentum rather than all-time average.
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
  // requiring a page reload.
  const progressStore = useProgressStore()
  watch(() => progressStore.lastSessionEnded, (event) => {
    if (event) fetchAllHistory()
  })

  // ── All-sessions velocity for a book ─────────────────────────────────────
  // Aggregates every valid session (session_start_at present, ≥60s, ≥1 page)
  // for the given bookId into a single stable pages-per-hour figure.
  // This is displayed as "Velocity" — a true book-level reading speed.
  const _allSessionsVelocity = (bookId: string): number | null => {
    const sameBookRows = allHistory.value.filter(r => r.bookId === bookId)
    let totalPages = 0
    let totalSeconds = 0

    for (let i = 0; i < sameBookRows.length; i++) {
      const row = sameBookRows[i]
      if (row.sessionStartAt === null) continue
      const priorRow = i > 0 ? sameBookRows[i - 1] : null
      const pageDelta = priorRow ? Math.max(0, row.page - priorRow.page) : Math.max(0, row.page)
      const durSec = diffInSeconds(row.recordedAt, row.sessionStartAt)
      if (durSec >= 60 && pageDelta >= 1) {
        totalPages += pageDelta
        totalSeconds += durSec
      }
    }

    if (totalPages === 0 || totalSeconds === 0) return null
    return Math.round(totalPages / (totalSeconds / 3600))
  }

  // ── Rolling average velocity (T018) ──────────────────────────────────────
  // Uses up to the last 3 progress_history rows with valid session_start_at
  // for the given bookId. Used exclusively for "At this pace" prediction to
  // reflect current reading momentum rather than all-time average.
  const _rollingAvgVelocity = (bookId: string): number | null => {
    const sameBookRows = allHistory.value.filter(r => r.bookId === bookId)
    const validRows = sameBookRows.filter(r => r.sessionStartAt !== null).slice(-3)

    if (validRows.length === 0) return null

    const velocities: number[] = []
    for (const row of validRows) {
      const rowIdx = sameBookRows.findIndex(r => r.id === row.id)
      const priorRow = rowIdx > 0 ? sameBookRows[rowIdx - 1] : null
      const pageDelta = priorRow ? Math.max(0, row.page - priorRow.page) : Math.max(0, row.page)
      const durSec = diffInSeconds(row.recordedAt, row.sessionStartAt!)
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
      ? diffInSeconds(lastRow.recordedAt, startedAt)
      : null

    // Velocity: all-sessions average for this book (stable book-level reading speed)
    const velocityPph = _allSessionsVelocity(lastRow.bookId)

    const booksStore = useBooksStore()
    const book = booksStore.bookById(lastRow.bookId)
    const totalPages = book?.totalPages ?? 0

    // T018: completion delta (% of book read this session)
    const completionDelta =
      totalPages > 0 && pagesDelta >= 0
        ? Math.round((pagesDelta / totalPages) * 1000) / 10  // 1 decimal place
        : null

    // T018: finish prediction — rolling last-3-sessions average × this session's duration
    let finishPredictionSessions: number | null = null
    if (totalPages > 0 && pagesDelta >= 1) {
      const pagesRemaining = Math.max(0, totalPages - endPage)
      if (pagesRemaining > 0) {
        const rollingAvg = _rollingAvgVelocity(lastRow.bookId)
        if (rollingAvg !== null && rollingAvg > 0) {
          // Estimate pages per a typical session using rolling velocity × this session's length.
          // Falls back to this session's raw pagesDelta when duration is unavailable (legacy rows).
          const estimatedPagesPerSession = durationSeconds
            ? rollingAvg * (durationSeconds / 3600)
            : pagesDelta > 0 ? pagesDelta : 1
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
