import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapBookPassport, type BookPassport, type BookPassportRow } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { swrStatus, swrRun, swrTouch, registerRevalidator, cacheKeys } from '@/composables/useCache'

const TTL = 60_000 // 60 s

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recap`

type BookPassportStats = {
  totalDays: number | null
  peakDay: string | null
  peakDayPages: number | null
  vocabularyCount: number
}

const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const fetchPassportStats = async (bookId: string): Promise<BookPassportStats> => {
  const authStore = useAuthStore()
  if (!authStore.user) {
    return { totalDays: null, peakDay: null, peakDayPages: null, vocabularyCount: 0 }
  }

  const { data, error } = await supabase.rpc('get_book_passport_stats', {
    p_book_id: bookId,
    p_time_zone: browserTimeZone(),
    p_user_id: authStore.user.id,
  })

  if (error) throw error

  const stats = data as Partial<BookPassportStats> | null
  return {
    totalDays: stats?.totalDays ?? null,
    peakDay: stats?.peakDay ?? null,
    peakDayPages: stats?.peakDayPages ?? null,
    vocabularyCount: stats?.vocabularyCount ?? 0,
  }
}

export const useBookPassportStore = defineStore('bookPassport', () => {
  const passportByBook = ref<Record<string, BookPassport>>({})
  const generating = ref<Record<string, boolean>>({})
  const streamingText = ref<Record<string, string>>({})

  const refreshPassportStats = async (bookId: string, passport: BookPassport) => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const stats = await fetchPassportStats(bookId)
    if (
      stats.totalDays === passport.totalDays &&
      stats.peakDay === passport.peakDay &&
      stats.peakDayPages === passport.peakDayPages &&
      stats.vocabularyCount === passport.vocabularyCount
    ) return

    const { data, error } = await supabase
      .from('book_passports')
      .update({
        total_days: stats.totalDays,
        peak_day: stats.peakDay,
        peak_day_pages: stats.peakDayPages,
        vocabulary_count: stats.vocabularyCount,
      })
      .eq('id', passport.id)
      .eq('user_id', authStore.user.id)
      .select()
      .single()

    if (error) throw error
    passportByBook.value[bookId] = mapBookPassport(data as BookPassportRow)
    swrTouch(cacheKeys.bookPassport(authStore.user.id, bookId))
  }

  const fetchPassport = async (bookId: string) => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.bookPassport(authStore.user.id, bookId)
    const fetcher = async () => {
      const { data, error } = await supabase
        .from('book_passports')
        .select('*')
        .eq('book_id', bookId)
        .maybeSingle()
      if (error) throw error
      if (data) {
        const passport = mapBookPassport(data as BookPassportRow)
        passportByBook.value[bookId] = passport
        refreshPassportStats(bookId, passport).catch((error) => {
          console.warn('Book passport stat refresh failed:', error)
        })
      }
    }
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  const generatePassport = async (
    bookId: string,
    bookTitle: string,
    bookAuthor: string,
    totalPages: number,
    isbn?: string | null,
  ) => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    if (generating.value[bookId]) return

    generating.value[bookId] = true
    streamingText.value[bookId] = ''

    try {
      const stats = await fetchPassportStats(bookId)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: bookTitle,
          author: bookAuthor,
          isbn: isbn ?? null,
          percentage: 100,
          currentPage: totalPages,
          totalPages,
          mode: 'passport_summary',
        }),
      })

      if (!response.ok) throw new Error(`AI error: ${response.status}`)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let aiSummary = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          aiSummary += chunk
          streamingText.value[bookId] = aiSummary
        }
      }

      const { data, error } = await supabase
        .from('book_passports')
        .upsert({
          book_id: bookId,
          user_id: authStore.user.id,
          total_days: stats.totalDays,
          peak_day: stats.peakDay,
          peak_day_pages: stats.peakDayPages,
          vocabulary_count: stats.vocabularyCount,
          ai_summary: aiSummary,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'book_id' })
        .select()
        .single()

      if (!error && data) {
        passportByBook.value[bookId] = mapBookPassport(data as BookPassportRow)
        swrTouch(cacheKeys.bookPassport(authStore.user.id, bookId))
      }
    } catch (e) {
      console.error('Passport generation failed:', e)
    } finally {
      generating.value[bookId] = false
    }
  }

  const passportFor = (bookId: string): BookPassport | undefined => passportByBook.value[bookId]
  const isGenerating = (bookId: string): boolean => generating.value[bookId] ?? false
  const streamFor = (bookId: string): string => streamingText.value[bookId] ?? ''

  return { passportByBook, fetchPassport, generatePassport, passportFor, isGenerating, streamFor }
})
