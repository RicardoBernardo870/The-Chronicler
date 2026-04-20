import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24
const SESSION_GAP_MS = 2 * MS_PER_HOUR // gap > 2h = new session

const formatDuration = (hours: number): string => {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `~${m}m to finish`
  if (m === 0) return `~${h}h to finish`
  return `~${h}h ${m}m to finish`
}

export const useReadingPulse = (bookId: string) => {
  const history = ref<ProgressHistory[]>([])

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('progress_history')
      .select('*')
      .eq('book_id', bookId)
      .order('recorded_at', { ascending: true })
    if (error) return
    history.value = (data as ProgressHistoryRow[]).map(mapProgressHistory)
  }

  // Group into sessions (gap > 2h = new session boundary)
  const sessions = computed(() => {
    const rows = history.value
    if (rows.length < 2) return []

    const result: Array<{ pages: number; durationHours: number }> = []
    let sessionStart = rows[0]
    let sessionPrev = rows[0]

    for (let i = 1; i < rows.length; i++) {
      const curr = rows[i]
      const gap = new Date(curr.recordedAt).getTime() - new Date(sessionPrev.recordedAt).getTime()

      if (gap > SESSION_GAP_MS) {
        // Close previous session if it had meaningful duration
        const dur = (new Date(sessionPrev.recordedAt).getTime() - new Date(sessionStart.recordedAt).getTime()) / MS_PER_HOUR
        const pages = sessionPrev.page - sessionStart.page
        // Minimum 60 seconds (1/60 hours) required — guards against near-zero denominators
        if (dur >= 1 / 60 && pages > 0) result.push({ pages, durationHours: dur })
        sessionStart = curr
      }
      sessionPrev = curr
    }

    // Close final open session
    const dur = (new Date(sessionPrev.recordedAt).getTime() - new Date(sessionStart.recordedAt).getTime()) / MS_PER_HOUR

    const pages = sessionPrev.page - sessionStart.page
    // Minimum 60 seconds (1/60 hours) required — guards against near-zero denominators
    if (dur >= 1 / 60 && pages > 0) result.push({ pages, durationHours: dur })

    return result
  })

  // Average PPH of last 3 sessions, excluding outliers.
  // Requires at least 1 qualifying session (was previously 2 — too strict for new users).
  const velocity = computed((): number | null => {
    const s = sessions.value
    if (s.length < 1) return null
    const last3 = s.slice(-3)
    const pphs = last3
      .map(s => s.pages / s.durationHours)
      .filter(v => v >= 1 && v <= 200)
    if (pphs.length === 0) return null
    return pphs.reduce((a, b) => a + b, 0) / pphs.length
  })

  const finishPrediction = (totalPages: number, currentPage: number): string | null => {
    const v = velocity.value
    if (!v || currentPage >= totalPages) return null
    return formatDuration((totalPages - currentPage) / v)
  }

  const continuityScore = computed((): number => {
    if (history.value.length === 0) return 100
    const last = history.value[history.value.length - 1]
    const daysSince = (Date.now() - new Date(last.recordedAt).getTime()) / MS_PER_DAY
    return Math.max(0, Math.round(100 - daysSince * 15))
  })

  const streak = computed((): number => {
    if (history.value.length === 0) return 0

    const todayStr = new Date().toISOString().split('T')[0]
    const daySet = new Set(
      history.value.map(r => new Date(r.recordedAt).toISOString().split('T')[0])
    )

    // Streak must end today or yesterday to be "active"
    if (!daySet.has(todayStr)) {
      const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().split('T')[0]
      if (!daySet.has(yesterday)) return 0
    }

    let count = 0
    let check = new Date()
    while (true) {
      const dayStr = check.toISOString().split('T')[0]
      if (!daySet.has(dayStr)) break
      count++
      check = new Date(check.getTime() - MS_PER_DAY)
    }
    return count
  })

  return { fetchHistory, velocity, finishPrediction, continuityScore, streak, history }
}
