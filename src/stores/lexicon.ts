import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapLexiconEntry, type LexiconEntry, type LexiconEntryRow, type LexiconEntryType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLeitner } from '@/composables/useLeitner'
import {
  swrStatus,
  swrRun,
  swrTouch,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 60_000 // 60 s

// localStorage key for daily Word of the Day cache
const wotdCacheKey = (userId: string) => `bookhero_wotd_${userId}`

export const useLexiconStore = defineStore('lexicon', () => {
  const entriesByBook = ref<Record<string, LexiconEntry[]>>({})

  // ── Word of the Day state ─────────────────────────────────────────────────
  const _wotdEntryId = ref<string | null>(null)
  const _wotdIsPreview = ref(false)

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const _fetcherForBook = (bookId: string) => async () => {
    const { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
    if (error) throw error
    entriesByBook.value[bookId] = (data as LexiconEntryRow[]).map(mapLexiconEntry)
  }

  const _fetcherAllBooks = (userId: string) => async () => {
    const { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    const grouped: Record<string, LexiconEntry[]> = {}
    for (const row of data as LexiconEntryRow[]) {
      const entry = mapLexiconEntry(row)
      if (!grouped[entry.bookId]) grouped[entry.bookId] = []
      grouped[entry.bookId].push(entry)
    }
    entriesByBook.value = grouped
  }

  // ── SWR-aware fetch methods (T007) ─────────────────────────────────────────

  const fetchEntriesForBook = async (bookId: string) => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.lexicon(authStore.user.id, bookId)
    const fetcher = _fetcherForBook(bookId)
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  const fetchEntriesForAllBooks = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const uid = authStore.user.id
    const key = cacheKeys.lexiconAll(uid)
    const fetcher = _fetcherAllBooks(uid)
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, fetcher).catch(() => {}); return }
    await swrRun(key, fetcher)
  }

  // ── Mutations (T013) ───────────────────────────────────────────────────────

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
    const uid = authStore.user.id

    // T013: update both per-book and all-books caches directly
    if (!entriesByBook.value[input.bookId]) entriesByBook.value[input.bookId] = []
    entriesByBook.value[input.bookId].unshift(entry)
    swrTouch(cacheKeys.lexicon(uid, input.bookId))
    swrTouch(cacheKeys.lexiconAll(uid))

    return entry
  }

  // ── Word of the Day ────────────────────────────────────────────────────────

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

  // ── Optimistic Leitner update (T013 + T020) ────────────────────────────────

  const updateLeitner = async (entryId: string, action: 'advance' | 'reset') => {
    const authStore = useAuthStore()
    const { advanceBox, resetBox } = useLeitner()

    // Locate entry across all books
    let entry: LexiconEntry | undefined
    let bookId: string | undefined
    for (const [bId, bEntries] of Object.entries(entriesByBook.value)) {
      entry = bEntries.find(e => e.id === entryId)
      if (entry) { bookId = bId; break }
    }
    if (!entry || !bookId) return

    const update = action === 'advance' ? advanceBox(entry) : resetBox(entry)

    // T020: snapshot for rollback
    const snapshotEntry = { ...entry }
    const snapshotIdx = entriesByBook.value[bookId].findIndex(e => e.id === entryId)

    // Optimistic: apply update immediately
    const optimistic = { ...entry, leitnerBox: update.leitnerBox, nextReviewAt: update.nextReviewAt }
    if (snapshotIdx !== -1) entriesByBook.value[bookId][snapshotIdx] = optimistic

    try {
      const { error } = await supabase
        .from('lexicon_entries')
        .update({ leitner_box: update.leitnerBox, next_review_at: update.nextReviewAt })
        .eq('id', entryId)
      if (error) throw error

      // Server confirmed — touch both caches
      if (authStore.user) {
        swrTouch(cacheKeys.lexicon(authStore.user.id, bookId))
        swrTouch(cacheKeys.lexiconAll(authStore.user.id))
      }
    } catch (e) {
      // T020: rollback on server error
      if (snapshotIdx !== -1) entriesByBook.value[bookId][snapshotIdx] = snapshotEntry
      throw e
    }

    // After advancing/resetting the current WotD, clear today's cache and re-pick
    if (_wotdEntryId.value === entryId) {
      if (authStore.user) {
        try { localStorage.removeItem(wotdCacheKey(authStore.user.id)) } catch { /* non-fatal */ }
        resolveWordOfTheDay(authStore.user.id)
      }
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

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
