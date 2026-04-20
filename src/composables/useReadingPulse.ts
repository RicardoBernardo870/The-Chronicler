import { ref, computed, watch } from 'vue'
import { supabase } from '@/services/supabase'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'

const MS_PER_HOUR = 1000 * 60 * 60
const MS_PER_DAY = MS_PER_HOUR * 24

const formatDuration = (hours: number): string => {
  // 🔥 smoother UX: round to 30min steps
  const rounded = Math.round(hours * 2) / 2

  const h = Math.floor(rounded)
  const m = Math.round((rounded - h) * 60)

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

  /**
   * 🔥 STEP 1: RAW VELOCITY (delta-based but FIXED)
   * - avoids idle time using dynamic clamp
   * - adapts to pages read
   */
  const rawVelocity = computed((): number | null => {
    const rows = history.value
    if (rows.length < 2) return null

    // realistic reading bounds
    const MIN_PPH = 10
    const MAX_PPH = 40

    const pphs: number[] = []

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const curr = rows[i]

      const pages = curr.page - prev.page
      let hours =
        (new Date(curr.recordedAt).getTime() -
          new Date(prev.recordedAt).getTime()) / MS_PER_HOUR

      if (pages <= 0 || hours <= 0) continue

      // 🔥 dynamic clamp (THIS fixes your main issue)
      const minHours = pages / MAX_PPH
      const maxHours = pages / MIN_PPH

      hours = Math.min(hours, maxHours)
      hours = Math.max(hours, minHours)

      const v = pages / hours

      if (isFinite(v)) {
        pphs.push(v)
      }
    }

    if (pphs.length === 0) return null

    // take last 3 values (recent behavior)
    const recent = pphs.slice(-3)

    return recent.reduce((a, b) => a + b, 0) / recent.length
  })

  /**
   * 🔥 STEP 2: SMOOTHED VELOCITY (EMA)
   * - removes jumpiness
   */
  const smoothedVelocity = ref<number | null>(null)

  watch(rawVelocity, (newV) => {
    if (!newV) return

    const alpha = 0.4 // 🔥 tweak this (0.2–0.4 ideal)

    if (smoothedVelocity.value === null) {
      smoothedVelocity.value = newV
    } else {
      smoothedVelocity.value =
        alpha * newV + (1 - alpha) * smoothedVelocity.value
    }
  })

  /**
   * Expose final velocity (smoothed)
   */
  const velocity = computed(() => smoothedVelocity.value)

  /**
   * 🔥 STEP 3: STABLE PREDICTION
   */
  const finishPrediction = (totalPages: number, currentPage: number): string | null => {
    const v = velocity.value

    if (!v || currentPage >= totalPages || totalPages <= 0) return null

    const remaining = totalPages - currentPage
    const hours = remaining / v

    return formatDuration(hours)
  }

  /**
   * continuity score (unchanged)
   */
  const continuityScore = computed((): number => {
    if (history.value.length === 0) return 100

    const last = history.value[history.value.length - 1]
    const daysSince =
      (Date.now() - new Date(last.recordedAt).getTime()) / MS_PER_DAY

    return Math.max(0, Math.round(100 - daysSince * 15))
  })

  /**
   * streak (unchanged)
   */
  const streak = computed((): number => {
    if (history.value.length === 0) return 0

    const todayStr = new Date().toISOString().split('T')[0]

    const daySet = new Set(
      history.value.map(r =>
        new Date(r.recordedAt).toISOString().split('T')[0]
      )
    )

    if (!daySet.has(todayStr)) {
      const yesterday = new Date(Date.now() - MS_PER_DAY)
        .toISOString()
        .split('T')[0]

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

  return {
    fetchHistory,
    velocity, // ✅ now smoothed
    finishPrediction,
    continuityScore,
    streak,
    history
  }
}
