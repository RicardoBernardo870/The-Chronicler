import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'

/**
 * Year-by-year monthly reading totals via the get_monthly_reading RPC.
 * Fetched years are cached for the session (history doesn't change behind
 * the reader's back; the current year refetches on the next visit).
 */

export interface MonthlyReadingPoint {
  month: number // 1–12
  pages: number
  booksFinished: number
}

const _years = ref(new Map<number, MonthlyReadingPoint[]>())
const _loading = ref(false)
let _cachedForUserId: string | null = null

export const useMonthlyReading = () => {
  const authStore = useAuthStore()

  const fetchYear = async (year: number): Promise<void> => {
    if (!authStore.user) return
    if (_cachedForUserId !== authStore.user.id) {
      _years.value = new Map()
      _cachedForUserId = authStore.user.id
    }
    if (_years.value.has(year)) return

    _loading.value = true
    try {
      const { data, error } = await supabase.rpc('get_monthly_reading', {
        p_user_id: authStore.user.id,
        p_year: year,
        p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (error) throw error
      const next = new Map(_years.value)
      next.set(year, (data ?? []) as MonthlyReadingPoint[])
      _years.value = next
    } catch (err) {
      console.warn('[monthlyReading] fetch failed', err)
    } finally {
      _loading.value = false
    }
  }

  const pointsFor = (year: number): MonthlyReadingPoint[] =>
    _years.value.get(year) ?? []

  const hasYear = (year: number): boolean => _years.value.has(year)

  return { fetchYear, pointsFor, hasYear, loading: _loading }
}
