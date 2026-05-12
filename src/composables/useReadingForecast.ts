import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import {
  swrStatus,
  swrRun,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

interface ForecastHistoryRow {
  book_id: string
  page: number
  recorded_at: string
}

const FORECAST_TTL = 120_000
const FALLBACK_AVERAGE_BOOK_PAGES = 320
const RECENT_WINDOW_DAYS = 30
const FALLBACK_WINDOW_DAYS = 90

const _pagesPerDay = ref(0)
const _windowDays = ref(RECENT_WINDOW_DAYS)
const _loaded = ref(false)

const cutoffIso = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

const sumPositiveDeltas = (rows: ForecastHistoryRow[], windowDays: number): number => {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const byBook = new Map<string, ForecastHistoryRow[]>()

  for (const row of rows) {
    if (new Date(row.recorded_at).getTime() < cutoff) continue
    const existing = byBook.get(row.book_id) ?? []
    existing.push(row)
    byBook.set(row.book_id, existing)
  }

  let pages = 0
  for (const bookRows of byBook.values()) {
    bookRows.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    for (let i = 1; i < bookRows.length; i += 1) {
      pages += Math.max(0, bookRows[i].page - bookRows[i - 1].page)
    }
  }

  return pages
}

export const useReadingForecast = () => {
  const booksStore = useBooksStore()
  const progressStore = useProgressStore()

  const averageBookPages = computed(() => {
    const completedPages = progressStore.completedBooks
      .map(({ book }) => book.totalPages)
      .filter((pages) => pages > 0)

    const source = completedPages.length > 0
      ? completedPages
      : booksStore.books.map((book) => book.totalPages).filter((pages) => pages > 0)

    if (source.length === 0) return FALLBACK_AVERAGE_BOOK_PAGES
    return Math.round(source.reduce((sum, pages) => sum + pages, 0) / source.length)
  })

  const _forecastFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const { data, error } = await supabase
      .from('progress_history')
      .select('book_id, page, recorded_at')
      .eq('user_id', authStore.user.id)
      .gte('recorded_at', cutoffIso(FALLBACK_WINDOW_DAYS))
      .order('book_id', { ascending: true })
      .order('recorded_at', { ascending: true })

    if (error) throw error

    const rows = (data ?? []) as ForecastHistoryRow[]
    const recentPages = sumPositiveDeltas(rows, RECENT_WINDOW_DAYS)
    if (recentPages > 0) {
      _pagesPerDay.value = recentPages / RECENT_WINDOW_DAYS
      _windowDays.value = RECENT_WINDOW_DAYS
    } else {
      const fallbackPages = sumPositiveDeltas(rows, FALLBACK_WINDOW_DAYS)
      _pagesPerDay.value = fallbackPages / FALLBACK_WINDOW_DAYS
      _windowDays.value = FALLBACK_WINDOW_DAYS
    }
    _loaded.value = true
  }

  const fetchForecast = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.readingForecast(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _forecastFetcher).catch(() => {}))

    const status = swrStatus(key, FORECAST_TTL)
    if (status === 'fresh') return
    if (status === 'background') {
      swrRun(key, _forecastFetcher).catch(() => {
        _loaded.value = true
      })
      return
    }

    await swrRun(key, _forecastFetcher)
  }

  const pagesPerMonth = computed(() => Math.round(_pagesPerDay.value * 30))
  const booksPerMonth = computed(() => {
    if (_pagesPerDay.value <= 0 || averageBookPages.value <= 0) return 0
    return (_pagesPerDay.value * 30) / averageBookPages.value
  })
  const booksPerYear = computed(() => {
    if (_pagesPerDay.value <= 0 || averageBookPages.value <= 0) return 0
    return (_pagesPerDay.value * 365) / averageBookPages.value
  })
  const hasForecast = computed(() => booksPerYear.value > 0)

  void fetchForecast()

  return {
    loaded: _loaded,
    fetchForecast,
    hasForecast,
    windowDays: _windowDays,
    averageBookPages,
    pagesPerMonth,
    booksPerMonth,
    booksPerYear,
  }
}
