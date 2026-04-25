import { computed } from 'vue'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapProgressHistory, type ProgressHistory, type ProgressHistoryRow } from '@/types'
import { diffInDays, formatISODate } from '@/utils/date'

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
   * Continuity score — decays 15 points per day since last recorded session.
   * DashboardPage shows the "it's been a while" warning when score < 40.
   */
  const continuityScore = computed((): number => {
    if (history.value.length === 0) return 100
    const last = history.value[history.value.length - 1]
    const daysSince = diffInDays(new Date(), last.recordedAt)
    return Math.max(0, Math.round(100 - daysSince * 15))
  })

  /**
   * Reading streak — consecutive calendar days with at least one progress save.
   * Counts today AND yesterday as "active" so saving later today doesn't break the chain.
   */
  const streak = computed((): number => {
    if (history.value.length === 0) return 0

    const todayStr = formatISODate(new Date())
    const daySet = new Set(
      history.value.map(r => formatISODate(new Date(r.recordedAt)))
    )

    // Streak requires at least today or yesterday to be active
    if (!daySet.has(todayStr)) {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      if (!daySet.has(formatISODate(yesterday))) return 0
    }

    let count = 0
    const check = new Date()
    while (true) {
      const dayStr = formatISODate(check)
      if (!daySet.has(dayStr)) break
      count++
      check.setDate(check.getDate() - 1)
    }

    return count
  })

  return {
    fetchHistory,
    continuityScore,
    streak,
  }
}
