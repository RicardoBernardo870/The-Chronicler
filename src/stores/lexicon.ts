import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapLexiconEntry, type LexiconEntry, type LexiconEntryRow, type LexiconEntryType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLeitner } from '@/composables/useLeitner'

// localStorage key for daily Word of the Day cache
const wotdCacheKey = (userId: string) => `bookhero_wotd_${userId}`

export const useLexiconStore = defineStore('lexicon', () => {
  const entriesByBook = ref<Record<string, LexiconEntry[]>>({})

  // ── Word of the Day state ─────────────────────────────────────────────────
  const _wotdEntryId = ref<string | null>(null)
  const _wotdIsPreview = ref(false)

  const fetchEntriesForBook = async (bookId: string) => {
    const { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
    if (error) throw error
    entriesByBook.value[bookId] = (data as LexiconEntryRow[]).map(mapLexiconEntry)
  }

  // Single query for all the user's entries — used by Dashboard to power WordOfTheDay
  const fetchEntriesForAllBooks = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('user_id', authStore.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    // Group by book_id, replacing any previously loaded per-book entries
    const grouped: Record<string, LexiconEntry[]> = {}
    for (const row of data as LexiconEntryRow[]) {
      const entry = mapLexiconEntry(row)
      if (!grouped[entry.bookId]) grouped[entry.bookId] = []
      grouped[entry.bookId].push(entry)
    }
    entriesByBook.value = grouped
  }

  const addEntry = async (input: {
    bookId: string
    term: string
    definition: string
    entryType: LexiconEntryType
    contextSentence?: string | null
    pageFound?: number | null
  }) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('lexicon_entries')
      .insert({
        user_id: authStore.user.id,
        book_id: input.bookId,
        term: input.term,
        definition: input.definition,
        entry_type: input.entryType,
        context_sentence: input.contextSentence ?? null,
        page_found: input.pageFound ?? null,
      })
      .select()
      .single()
    if (error) throw error

    const entry = mapLexiconEntry(data as LexiconEntryRow)
    if (!entriesByBook.value[input.bookId]) entriesByBook.value[input.bookId] = []
    entriesByBook.value[input.bookId].unshift(entry)
    return entry
  }

  // Resolve which entry to show as Word of the Day.
  // Deterministic per calendar day — reads/writes localStorage cache.
  const resolveWordOfTheDay = (userId: string) => {
    const today = new Date().toISOString().split('T')[0]
    const key = wotdCacheKey(userId)

    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const cache = JSON.parse(raw) as { date: string; entryId: string; isPreview: boolean }
        if (cache.date === today) {
          _wotdEntryId.value = cache.entryId
          _wotdIsPreview.value = cache.isPreview ?? false
          return
        }
      }
    } catch {
      // malformed cache — ignore
    }

    const all = Object.values(entriesByBook.value).flat()
    if (!all.length) {
      _wotdEntryId.value = null
      _wotdIsPreview.value = false
      return
    }

    const { getDueWord } = useLeitner()
    let pick = getDueWord(all)
    let isPreview = false

    if (!pick) {
      // Fallback: show the entry with the soonest upcoming review date
      pick = all.slice().sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))[0]
      isPreview = true
    }

    _wotdEntryId.value = pick?.id ?? null
    _wotdIsPreview.value = isPreview

    if (pick) {
      try {
        localStorage.setItem(key, JSON.stringify({ date: today, entryId: pick.id, isPreview }))
      } catch {
        // storage full or unavailable — non-fatal
      }
    }
  }

  const updateLeitner = async (entryId: string, action: 'advance' | 'reset') => {
    const { advanceBox, resetBox } = useLeitner()

    // Find the entry across all books
    let entry: LexiconEntry | undefined
    let bookId: string | undefined
    for (const [bId, entries] of Object.entries(entriesByBook.value)) {
      entry = entries.find(e => e.id === entryId)
      if (entry) { bookId = bId; break }
    }
    if (!entry || !bookId) return

    const update = action === 'advance' ? advanceBox(entry) : resetBox(entry)

    const { error } = await supabase
      .from('lexicon_entries')
      .update({ leitner_box: update.leitnerBox, next_review_at: update.nextReviewAt })
      .eq('id', entryId)
    if (error) throw error

    // Update local state
    const idx = entriesByBook.value[bookId].findIndex(e => e.id === entryId)
    if (idx !== -1) {
      entriesByBook.value[bookId][idx] = {
        ...entriesByBook.value[bookId][idx],
        leitnerBox: update.leitnerBox,
        nextReviewAt: update.nextReviewAt,
      }
    }

    // After advancing/resetting the current WotD, clear today's cache and re-pick
    if (_wotdEntryId.value === entryId) {
      const authStore = useAuthStore()
      if (authStore.user) {
        try { localStorage.removeItem(wotdCacheKey(authStore.user.id)) } catch { /* non-fatal */ }
        resolveWordOfTheDay(authStore.user.id)
      }
    }
  }

  // Word of the Day — resolves from cached entryId (stable per day)
  const wordOfTheDay = computed(() => {
    if (!_wotdEntryId.value) return null
    return Object.values(entriesByBook.value).flat().find(e => e.id === _wotdEntryId.value) ?? null
  })

  const isWordOfTheDayPreview = computed(() => _wotdIsPreview.value)

  const allEntries = computed(() => Object.values(entriesByBook.value).flat())

  return {
    entriesByBook,
    allEntries,
    wordOfTheDay,
    isWordOfTheDayPreview,
    fetchEntriesForBook,
    fetchEntriesForAllBooks,
    addEntry,
    updateLeitner,
    resolveWordOfTheDay,
  }
})
