import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapLexiconEntry, type LexiconEntry, type LexiconEntryRow, type LexiconEntryType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLeitner } from '@/composables/useLeitner'
import { formatISODate } from '@/utils/date'
import {
  swrStatus,
  swrRun,
  swrTouch,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 60_000 // 60 s

// 032 — daily review limit: at most this many words are surfaced for review per day.
export const DAILY_REVIEW_LIMIT = 20

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

    // 032 — pick from today's capped set; when it's empty, preview the soonest
    // upcoming non-mastered word ("caught up" — today or entirely).
    let pick: LexiconEntry | null = activeReviewWords.value[0] ?? null
    let isPreview = false

    if (!pick) {
      pick = all
        .filter(e => !e.mastered)
        .slice()
        .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt))[0] ?? null
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
    const nowIso = new Date().toISOString() // 032 — stamp the review time for the daily tally

    // T020: snapshot for rollback
    const snapshotEntry = { ...entry }
    const snapshotIdx = entriesByBook.value[bookId].findIndex(e => e.id === entryId)

    // Optimistic: apply update immediately
    const optimistic = { ...entry, leitnerBox: update.leitnerBox, nextReviewAt: update.nextReviewAt, lastReviewedAt: nowIso }
    if (snapshotIdx !== -1) entriesByBook.value[bookId][snapshotIdx] = optimistic

    try {
      const { error } = await supabase
        .from('lexicon_entries')
        .update({ leitner_box: update.leitnerBox, next_review_at: update.nextReviewAt, last_reviewed_at: nowIso })
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

  // ── Master a word (031) — terminal state; removes it from all review queues ──
  // Mirrors updateLeitner's optimistic-apply → UPDATE → cache-touch → rollback.

  const masterWord = async (entryId: string) => {
    const authStore = useAuthStore()

    // Locate entry across all books
    let entry: LexiconEntry | undefined
    let bookId: string | undefined
    for (const [bId, bEntries] of Object.entries(entriesByBook.value)) {
      entry = bEntries.find(e => e.id === entryId)
      if (entry) { bookId = bId; break }
    }
    if (!entry || !bookId) return

    const nowIso = new Date().toISOString() // 032 — mastering also counts toward today's tally
    const snapshotEntry = { ...entry }
    const snapshotIdx = entriesByBook.value[bookId].findIndex(e => e.id === entryId)

    // Optimistic: mark mastered immediately
    if (snapshotIdx !== -1) {
      entriesByBook.value[bookId][snapshotIdx] = { ...entry, mastered: true, lastReviewedAt: nowIso }
    }

    try {
      const { error } = await supabase
        .from('lexicon_entries')
        .update({ mastered: true, last_reviewed_at: nowIso })
        .eq('id', entryId)
      if (error) throw error

      if (authStore.user) {
        swrTouch(cacheKeys.lexicon(authStore.user.id, bookId))
        swrTouch(cacheKeys.lexiconAll(authStore.user.id))
      }
    } catch (e) {
      // Rollback on server error
      if (snapshotIdx !== -1) entriesByBook.value[bookId][snapshotIdx] = snapshotEntry
      throw e
    }

    // If the mastered word was the current WotD, clear today's cache and re-pick
    if (_wotdEntryId.value === entryId) {
      if (authStore.user) {
        try { localStorage.removeItem(wotdCacheKey(authStore.user.id)) } catch { /* non-fatal */ }
        resolveWordOfTheDay(authStore.user.id)
      }
    }
  }

  // Undo support (Anki review): write a snapshotted entry state back — reverses
  // masterWord / updateLeitner('reset') after a misswipe.
  const restoreEntryState = async (snapshot: LexiconEntry) => {
    const authStore = useAuthStore()
    const list = entriesByBook.value[snapshot.bookId]
    const idx = list?.findIndex(e => e.id === snapshot.id) ?? -1
    const current = idx !== -1 ? { ...list[idx] } : null

    if (idx !== -1) entriesByBook.value[snapshot.bookId][idx] = { ...snapshot }
    try {
      const { error } = await supabase
        .from('lexicon_entries')
        .update({
          leitner_box: snapshot.leitnerBox,
          next_review_at: snapshot.nextReviewAt,
          mastered: snapshot.mastered,
          last_reviewed_at: snapshot.lastReviewedAt,
        })
        .eq('id', snapshot.id)
      if (error) throw error
      if (authStore.user) {
        swrTouch(cacheKeys.lexicon(authStore.user.id, snapshot.bookId))
        swrTouch(cacheKeys.lexiconAll(authStore.user.id))
      }
    } catch (e) {
      if (idx !== -1 && current) entriesByBook.value[snapshot.bookId][idx] = current
      throw e
    }
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const wordOfTheDay = computed(() => {
    if (!_wotdEntryId.value) return null
    return Object.values(entriesByBook.value).flat().find(e => e.id === _wotdEntryId.value) ?? null
  })

  const isWordOfTheDayPreview = computed(() => _wotdIsPreview.value)

  const allEntries = computed(() => Object.values(entriesByBook.value).flat())

  // 031 — count of non-mastered words due today (drives the Word of the Day
  // remaining-count; recomputes as words are advanced/mastered out of "due").
  // Quotes are keepsakes — excluded from every review surface (WotD, Anki, due counts).
  const reviewableEntries = computed(() =>
    allEntries.value.filter(e => e.entryType !== 'quote'),
  )

  const dueTodayCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return reviewableEntries.value.filter(e => !e.mastered && e.nextReviewAt <= today).length
  })

  // ── Daily review limit & today's set (032) ─────────────────────────────────
  // Soft, non-destructive cap. "Review more" grants another batch of the daily
  // limit (so the surfaced set — and its count — stays capped and counts down,
  // rather than dumping the whole backlog at once).
  const extraAllotment = ref(0)
  const enableReviewMore = () => {
    extraAllotment.value += DAILY_REVIEW_LIMIT
    // Clear today's cached Word of the Day so it re-picks from the new batch;
    // otherwise the daily cache would keep returning the "caught up" preview.
    const authStore = useAuthStore()
    if (authStore.user) {
      try { localStorage.removeItem(wotdCacheKey(authStore.user.id)) } catch { /* non-fatal */ }
      resolveWordOfTheDay(authStore.user.id)
    }
  }

  const _startOfTodayLocal = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }

  const _reviewedToday = (e: LexiconEntry, startOfToday: Date) =>
    Boolean(e.lastReviewedAt) && new Date(e.lastReviewedAt as string) >= startOfToday

  // Words reviewed today (across the WotD card and the Anki session) — the tally.
  const reviewedTodayCount = computed(() => {
    const startOfToday = _startOfTodayLocal()
    return allEntries.value.filter(e => _reviewedToday(e, startOfToday)).length
  })

  // Remaining in the current allotment = base daily limit (+ any "review more"
  // batches) minus what's already been reviewed today.
  const dailyRemaining = computed(() =>
    Math.max(0, DAILY_REVIEW_LIMIT + extraAllotment.value - reviewedTodayCount.value),
  )

  // Due, non-mastered, not-yet-reviewed-today words, most fragile first
  // (lowest Leitner box, ties broken by most overdue).
  const eligibleReviewWords = computed(() => {
    const today = formatISODate(new Date())
    const startOfToday = _startOfTodayLocal()
    return reviewableEntries.value
      .filter(e => !e.mastered && e.nextReviewAt <= today && !_reviewedToday(e, startOfToday))
      .sort((a, b) => a.leitnerBox - b.leitnerBox || a.nextReviewAt.localeCompare(b.nextReviewAt))
  })

  // The capped set actually surfaced today — always bounded by the allotment, so
  // the count stays small and counts down even after "review more".
  const todaysReviewSet = computed(() => eligibleReviewWords.value.slice(0, dailyRemaining.value))
  const activeReviewWords = todaysReviewSet
  // Are there eligible words waiting behind the current cap?
  const extraAvailable = computed(() => eligibleReviewWords.value.length > todaysReviewSet.value.length)

  // 016 — invalidate the SWR cache so the next read re-fetches. Used by the
  // auto-vocabulary path after the edge function inserts new entries server-side.
  const invalidateAll = () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    swrTouch(cacheKeys.lexiconAll(authStore.user.id))
  }

  return {
    entriesByBook,
    allEntries,
    dueTodayCount,
    reviewedTodayCount,
    dailyRemaining,
    eligibleReviewWords,
    todaysReviewSet,
    activeReviewWords,
    extraAvailable,
    enableReviewMore,
    wordOfTheDay,
    isWordOfTheDayPreview,
    fetchEntriesForBook,
    fetchEntriesForAllBooks,
    invalidateAll,
    addEntry,
    updateLeitner,
    masterWord,
    restoreEntryState,
    resolveWordOfTheDay,
  }
})
