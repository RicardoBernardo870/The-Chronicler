import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { formatISODate } from '@/utils/date'
import type { ReadingCalendarDay } from '@/types'

/**
 * Month-by-month reading activity via the get_reading_calendar RPC. Days are
 * bucketed in the reader's own timezone server-side. Fetched months are
 * cached for the session — history doesn't change behind the reader's back,
 * and the current month simply refetches on the next profile visit.
 */

const _months = ref(new Map<string, ReadingCalendarDay[]>())
const _loading = ref(false)
let _cachedForUserId: string | null = null

const monthKey = (monthStart: Date): string =>
  `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

export const useReadingCalendar = () => {
  const authStore = useAuthStore()

  const fetchMonth = async (monthStart: Date): Promise<void> => {
    if (!authStore.user) return
    const userId = authStore.user.id
    if (_cachedForUserId !== userId) {
      _months.value = new Map()
      _cachedForUserId = userId
    }

    const key = monthKey(monthStart)
    if (_months.value.has(key)) return

    _loading.value = true
    try {
      const { data, error } = await supabase.rpc('get_reading_calendar', {
        p_user_id: userId,
        p_month_start: formatISODate(monthStart),
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (error) throw error
      const next = new Map(_months.value)
      next.set(key, (data ?? []) as ReadingCalendarDay[])
      _months.value = next
    } catch (err) {
      console.warn('[readingCalendar] fetch failed', err)
    } finally {
      _loading.value = false
    }
  }

  const daysFor = (monthStart: Date): ReadingCalendarDay[] =>
    _months.value.get(monthKey(monthStart)) ?? []

  const hasMonth = (monthStart: Date): boolean =>
    _months.value.has(monthKey(monthStart))

  return { fetchMonth, daysFor, hasMonth, loading: _loading }
}
