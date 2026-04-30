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
  velocityPph: number | null      // GLOBAL all-sessions average across every book; null when no valid sessions exist
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
 * T017: durationSeconds is precise — computed from session_start_at → recorded_at
 *       when session_start_at is non-null. Legacy rows fall back to "—".
 *
 * velocityPph: GLOBAL all-sessions average — every valid session across every
 *              book the reader has ever opened. Reflects total reading pace,
 *              not book-specific speed.
 * finishPredictionSessions: still a per-book figure (pages remaining in the
 *                            *current* book) but uses the GLOBAL rolling 3-session
 *                            momentum velocity to answer "at my pace, how many more
 *                            sessions until this book is done?"
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

  // ── Valid sessions across the entire library ─────────────────────────────
  // Iterates all history rows in chronological order, tracking the prior page
  // PER BOOK so pageDelta is computed within each book (jumping between books
  // doesn't fabricate fake deltas). A session is "valid" when it has
  // session_start_at, lasted ≥60 s, and advanced ≥1 page.
  const _validSessions = (): { pageDelta: number; durSec: number }[] => {
    const lastPageByBook: Record<string, number> = {}
    const out: { pageDelta: number; durSec: number }[] = []
    for (const row of allHistory.value) {
      const prevPage = lastPageByBook[row.bookId] ?? 0
      if (row.sessionStartAt !== null) {
        const pageDelta = Math.max(0, row.page - prevPage)
        const durSec = diffInSeconds(row.recordedAt, row.sessionStartAt)
        if (durSec >= 60 && pageDelta >= 1) {
          out.push({ pageDelta, durSec })
        }
      }
      lastPageByBook[row.bookId] = row.page
    }
    return out
  }

  // ── Global all-sessions velocity ─────────────────────────────────────────
  // Sums totalPages / totalSeconds across every valid session of every book.
  // Stable lifetime reading speed in pages/hour.
  const _globalAllSessionsVelocity = (): number | null => {
    const sessions = _validSessions()
    let totalPages = 0
    let totalSeconds = 0
    for (const s of sessions) {
      totalPages += s.pageDelta
      totalSeconds += s.durSec
    }
    if (totalPages === 0 || totalSeconds === 0) return null
    return Math.round(totalPages / (totalSeconds / 3600))
  }

  // ── Global rolling momentum velocity ─────────────────────────────────────
  // Mean velocity of the last 3 valid sessions across every book — reflects
  // current habit, not all-time average. Used for "At this pace" prediction.
  const _globalRollingAvgVelocity = (): number | null => {
    const sessions = _validSessions().slice(-3)
    if (sessions.length === 0) return null
    const sum = sessions.reduce(
      (acc, s) => acc + s.pageDelta / (s.durSec / 3600),
      0,
    )
    return sum / sessions.length
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

    // Velocity: GLOBAL all-sessions average across every book the reader owns.
    const velocityPph = _globalAllSessionsVelocity()

    const booksStore = useBooksStore()
    const book = booksStore.bookById(lastRow.bookId)
    const totalPages = book?.totalPages ?? 0

    // T018: completion delta (% of book read this session)
    const completionDelta =
      totalPages > 0 && pagesDelta >= 0
        ? Math.round((pagesDelta / totalPages) * 1000) / 10  // 1 decimal place
        : null

    // T018: finish prediction — uses GLOBAL rolling 3-session velocity to project
    // how many more sessions until *this* book is complete.
    let finishPredictionSessions: number | null = null
    if (totalPages > 0 && pagesDelta >= 1) {
      const pagesRemaining = Math.max(0, totalPages - endPage)
      if (pagesRemaining > 0) {
        const rollingAvg = _globalRollingAvgVelocity()
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
