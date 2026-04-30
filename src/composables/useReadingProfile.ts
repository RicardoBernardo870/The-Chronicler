import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'
import { diffInSeconds } from '@/utils/date'

/**
 * 016 — Reader Profile lifetime stats.
 *
 * Aggregates lifetime reading metrics from existing stores + a one-shot
 * progress_history fetch. All computation is client-side; no new tables.
 *
 * Streaks use local-timezone yyyy-MM-dd day buckets so a session ending at
 * 23:55 local time counts toward today, not tomorrow-UTC. (research.md D7)
 */
export const useReadingProfile = () => {
  const booksStore = useBooksStore()
  const progressStore = useProgressStore()

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

  // Books finished / in progress — straight from progress store
  const booksFinished = computed(() => progressStore.completedBooks.length)
  const booksInProgress = computed(() => progressStore.inProgressBooks.length)

  // Total pages read = sum of current pages across all books (matches DB truth).
  const totalPagesRead = computed(() => {
    let sum = 0
    for (const p of Object.values(progressStore.progress)) sum += p.currentPage ?? 0
    return sum
  })

  // Total reading hours + all-time velocity from valid sessions across the
  // entire library. A "valid" session matches the rules used by useLastSession:
  // session_start_at present, ≥60s, ≥1 page delta against prior row for same book.
  const _aggregates = computed(() => {
    let totalSeconds = 0
    let totalPages = 0

    // Group history rows by book to compute per-book deltas
    const byBook = new Map<string, ProgressHistory[]>()
    for (const row of allHistory.value) {
      if (!byBook.has(row.bookId)) byBook.set(row.bookId, [])
      byBook.get(row.bookId)!.push(row)
    }

    for (const rows of byBook.values()) {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (row.sessionStartAt === null) continue
        const prior = i > 0 ? rows[i - 1] : null
        const pageDelta = prior ? Math.max(0, row.page - prior.page) : Math.max(0, row.page)
        const durSec = diffInSeconds(row.recordedAt, row.sessionStartAt)
        if (durSec >= 60 && pageDelta >= 1) {
          totalSeconds += durSec
          totalPages += pageDelta
        }
      }
    }

    return { totalSeconds, totalPages }
  })

  const totalReadingHours = computed(() => Math.round(_aggregates.value.totalSeconds / 3600))
  const allTimeVelocityPph = computed(() => {
    const { totalPages, totalSeconds } = _aggregates.value
    if (totalPages === 0 || totalSeconds === 0) return 0
    return Math.round(totalPages / (totalSeconds / 3600))
  })

  // Streak math — local-timezone yyyy-MM-dd buckets
  const _localDayKey = (iso: string): string => {
    const d = new Date(iso)
    // en-CA → yyyy-MM-dd in local TZ
    return d.toLocaleDateString('en-CA')
  }

  const _readingDays = computed((): Set<string> => {
    const set = new Set<string>()
    for (const r of allHistory.value) set.add(_localDayKey(r.recordedAt))
    return set
  })

  const currentStreak = computed((): number => {
    const days = _readingDays.value
    if (days.size === 0) return 0
    let streak = 0
    const cursor = new Date()
    // If the user hasn't read today, start counting from yesterday so we
    // don't punish them mid-day.
    if (!days.has(cursor.toLocaleDateString('en-CA'))) {
      cursor.setDate(cursor.getDate() - 1)
    }
    while (days.has(cursor.toLocaleDateString('en-CA'))) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    }
    return streak
  })

  const longestStreak = computed((): number => {
    const days = [..._readingDays.value].sort()
    if (days.length === 0) return 0
    let longest = 1
    let current = 1
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1])
      const cur = new Date(days[i])
      const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000)
      if (diffDays === 1) {
        current++
        if (current > longest) longest = current
      } else {
        current = 1
      }
    }
    return longest
  })

  // Auto-fetch history once on first composable use
  void fetchAllHistory()

  // Touch booksStore so downstream composables can rely on titles being available
  void booksStore.fetchLibrary()

  return {
    booksFinished,
    booksInProgress,
    totalPagesRead,
    totalReadingHours,
    allTimeVelocityPph,
    currentStreak,
    longestStreak,
    fetchAllHistory,
  }
}
