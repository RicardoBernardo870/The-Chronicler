import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapBookPassport, type BookPassport, type BookPassportRow } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLexiconStore } from '@/stores/lexicon'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recap`

export const useBookPassportStore = defineStore('bookPassport', () => {
  const passportByBook = ref<Record<string, BookPassport>>({})
  const generating = ref<Record<string, boolean>>({})
  const streamingText = ref<Record<string, string>>({})

  const fetchPassport = async (bookId: string) => {
    const { data, error } = await supabase
      .from('book_passports')
      .select('*')
      .eq('book_id', bookId)
      .maybeSingle()
    if (error) throw error
    if (data) passportByBook.value[bookId] = mapBookPassport(data as BookPassportRow)
  }

  const generatePassport = async (
    bookId: string,
    bookTitle: string,
    bookAuthor: string,
    totalPages: number,
    isbn?: string | null
  ) => {
    const authStore = useAuthStore()
    const lexiconStore = useLexiconStore()
    if (!authStore.user) return
    if (generating.value[bookId]) return // already in progress

    generating.value[bookId] = true
    streamingText.value[bookId] = ''

    try {
      // ── Compute stats from progress_history ──────────────────────
      const { data: histRows } = await supabase
        .from('progress_history')
        .select('page, recorded_at')
        .eq('book_id', bookId)
        .order('recorded_at', { ascending: true })

      let totalDays: number | null = null
      let peakDay: string | null = null
      let peakDayPages: number | null = null

      if (histRows && histRows.length >= 2) {
        const first = new Date(histRows[0].recorded_at)
        const last = new Date(histRows[histRows.length - 1].recorded_at)
        totalDays = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24)))

        // Pages per calendar day
        const byDay: Record<string, number[]> = {}
        for (const row of histRows) {
          const day = new Date(row.recorded_at).toISOString().split('T')[0]
          if (!byDay[day]) byDay[day] = []
          byDay[day].push(row.page)
        }
        let maxPages = 0
        for (const [day, pages] of Object.entries(byDay)) {
          const dayPages = Math.max(...pages) - Math.min(...pages)
          if (dayPages > maxPages) {
            maxPages = dayPages
            peakDay = day
            peakDayPages = dayPages
          }
        }
      }

      // ── Vocab count from lexicon ──────────────────────────────────
      await lexiconStore.fetchEntriesForBook(bookId)
      const vocabularyCount = lexiconStore.entriesByBook[bookId]?.length ?? 0

      // ── Stream AI summary (full_summary mode) ────────────────────
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
          isbn,
          percentage: 100,
          currentPage: totalPages,
          totalPages,
          mode: 'full_summary',
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

      // ── Persist passport ─────────────────────────────────────────
      const { data, error } = await supabase
        .from('book_passports')
        .upsert({
          book_id: bookId,
          user_id: authStore.user.id,
          total_days: totalDays,
          peak_day: peakDay,
          peak_day_pages: peakDayPages,
          vocabulary_count: vocabularyCount,
          ai_summary: aiSummary,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'book_id' })
        .select()
        .single()

      if (!error && data) {
        passportByBook.value[bookId] = mapBookPassport(data as BookPassportRow)
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
