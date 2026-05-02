import { ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  type LexiconEntryRow,
  type LexiconSearchResult,
  type BookFilterOption,
  mapSearchResult,
} from '@/types'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ─────────────────────────────────────────────────────────────
// Module-level reactive state (shared across all callers)
// ─────────────────────────────────────────────────────────────

const _entries = ref<LexiconSearchResult[]>([])
const _loading = ref(true)
const _loadingMore = ref(false)
const _error = ref<string | null>(null)
const _hasLoaded = ref(false)
const _hasMore = ref(true)
const _searchQuery = ref('')
const _typeFilter = ref<'all' | 'dictionary' | 'lore'>('all')
const _bookFilter = ref<string | null>(null)
const _bookOptions = ref<BookFilterOption[]>([])
const _currentPage = ref(0)
const _lastFailedPage = ref(0)

type SearchCacheEntry = {
  entries: LexiconSearchResult[]
  currentPage: number
  hasMore: boolean
}

const _resultsCache = new Map<string, SearchCacheEntry>()
const _bookOptionsFetchedForUser = ref<string | null>(null)
const _activeCacheKey = ref<string | null>(null)

// ─────────────────────────────────────────────────────────────
// Private helpers (module-scope — no duplicate instances)
// ─────────────────────────────────────────────────────────────

const _searchCacheKey = (uid: string) => {
  const query = _searchQuery.value.trim().toLocaleLowerCase()
  const type = _typeFilter.value
  const book = _bookFilter.value ?? 'all'
  return `${uid}:${query}:${type}:${book}`
}

const _rememberActiveResults = () => {
  if (!_activeCacheKey.value) return
  _resultsCache.set(_activeCacheKey.value, {
    entries: [..._entries.value],
    currentPage: _currentPage.value,
    hasMore: _hasMore.value,
  })
}

const _restoreCachedResults = (key: string): boolean => {
  const cached = _resultsCache.get(key)
  if (!cached) return false
  _activeCacheKey.value = key
  _entries.value = [...cached.entries]
  _currentPage.value = cached.currentPage
  _hasMore.value = cached.hasMore
  _error.value = null
  _loading.value = false
  _hasLoaded.value = true
  return true
}

const _fetchBookOptions = async (uid: string, force = false) => {
  if (!force && _bookOptionsFetchedForUser.value === uid) return

  const { data } = await supabase
    .from('lexicon_entries')
    .select('book_id, books(title)')
    .eq('user_id', uid)

  if (!data) return

  const seen = new Set<string>()
  const opts: BookFilterOption[] = []
  for (const row of data) {
    const bookId = row.book_id as string
    if (!seen.has(bookId)) {
      seen.add(bookId)
      opts.push({
        bookId,
        bookTitle: (row.books as any)?.title ?? 'Unknown Book',
      })
    }
  }
  _bookOptions.value = opts
  _bookOptionsFetchedForUser.value = uid
}

const _fetch = async (page: number): Promise<LexiconSearchResult[]> => {
  const authStore = useAuthStore()
  const uid = authStore.user?.id
  if (!uid) return []

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('lexicon_entries')
    .select('*, books(title)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })

  const q = _searchQuery.value.trim()
  if (q) {
    query = query.or(`term.ilike.%${q}%,definition.ilike.%${q}%`)
  }
  if (_typeFilter.value !== 'all') {
    query = query.eq('entry_type', _typeFilter.value)
  }
  if (_bookFilter.value !== null) {
    query = query.eq('book_id', _bookFilter.value)
  }

  query = query.range(from, to)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as (LexiconEntryRow & { books: { title: string } | null })[]
  _hasMore.value = rows.length === PAGE_SIZE
  return rows.map(mapSearchResult)
}

// ─────────────────────────────────────────────────────────────
// Actions (module-scope — registered once)
// ─────────────────────────────────────────────────────────────

const search = async (options: { force?: boolean } = {}) => {
  const authStore = useAuthStore()
  const uid = authStore.user?.id
  if (!uid) return

  if (_bookOptionsFetchedForUser.value !== null && _bookOptionsFetchedForUser.value !== uid) {
    _resultsCache.clear()
    _bookOptionsFetchedForUser.value = null
    _bookOptions.value = []
    _entries.value = []
  }

  const key = _searchCacheKey(uid)
  if (!options.force && _restoreCachedResults(key)) return

  _loading.value = true
  _currentPage.value = 0
  _entries.value = []
  _error.value = null
  _hasMore.value = true
  _activeCacheKey.value = key
  try {
    await _fetchBookOptions(uid, options.force)
    const rows = await _fetch(0)
    _entries.value = rows
    _rememberActiveResults()
  } catch (e) {
    _error.value = e instanceof Error ? e.message : 'Failed to load entries'
    _lastFailedPage.value = 0
  } finally {
    _loading.value = false
    _hasLoaded.value = true
  }
}

const loadNextPage = async () => {
  if (!_hasMore.value || _loadingMore.value || _loading.value) return
  const nextPage = _currentPage.value + 1
  _loadingMore.value = true
  _error.value = null
  try {
    const rows = await _fetch(nextPage)
    _entries.value = [..._entries.value, ...rows]
    _currentPage.value = nextPage
    _rememberActiveResults()
  } catch (e) {
    _error.value = e instanceof Error ? e.message : 'Failed to load more entries'
    _lastFailedPage.value = nextPage
  } finally {
    _loadingMore.value = false
  }
}

const retry = async () => {
  const page = _lastFailedPage.value
  _error.value = null
  if (page === 0) {
    await search({ force: true })
    return
  }
  _loadingMore.value = true
  try {
    const rows = await _fetch(page)
    _entries.value = [..._entries.value, ...rows]
    _currentPage.value = page
    _rememberActiveResults()
  } catch (e) {
    _error.value = e instanceof Error ? e.message : 'Failed to load entries'
  } finally {
    _loadingMore.value = false
  }
}

// ─────────────────────────────────────────────────────────────
// Watchers (module-scope — registered once, never duplicated)
// ─────────────────────────────────────────────────────────────

// 300ms debounce on search query — resets to page 1
watchDebounced(
  _searchQuery,
  () => { search() },
  { debounce: 300, maxWait: 1000 },
)

// Immediate re-fetch on filter changes, batched when both filters change together.
watch([_typeFilter, _bookFilter], () => { search() })

// ─────────────────────────────────────────────────────────────
// Exported composable
// ─────────────────────────────────────────────────────────────

export const useGreatLibrarySearch = () => ({
  entries: _entries,
  loading: _loading,
  loadingMore: _loadingMore,
  hasLoaded: _hasLoaded,
  error: _error,
  hasMore: _hasMore,
  searchQuery: _searchQuery,
  typeFilter: _typeFilter,
  bookFilter: _bookFilter,
  bookOptions: _bookOptions,
  search,
  loadNextPage,
  retry,
})
