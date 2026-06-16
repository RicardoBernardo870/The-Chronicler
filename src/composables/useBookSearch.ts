import { ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { searchBooks, SEARCH_PAGE_SIZE } from '@/services/bookSearchService'
import type { BookSearchResult } from '@/types'

// ─────────────────────────────────────────────────────────────
// Book Search & Add (030) — module-singleton search state.
// Mirrors useGreatLibrarySearch: shared refs, debounced live query, abortable
// requests, and offset/page-based "load more". Results persist across the
// composable's lifetime so back-navigation from the details page restores them.
// ─────────────────────────────────────────────────────────────

const MIN_QUERY_LENGTH = 2

const _query = ref('')
const _results = ref<BookSearchResult[]>([])
const _loading = ref(false)
const _loadingMore = ref(false)
const _error = ref<string | null>(null)
const _hasMore = ref(false)
const _hasSearched = ref(false)
const _page = ref(1) // Open Library pages are 1-based

let _controller: AbortController | null = null

const _abortInFlight = () => {
  if (_controller) {
    _controller.abort()
    _controller = null
  }
}

const _reset = () => {
  _results.value = []
  _hasMore.value = false
  _hasSearched.value = false
  _error.value = null
  _loading.value = false
}

// ── Actions ───────────────────────────────────────────────────────────────────

const runSearch = async () => {
  const q = _query.value.trim()
  _abortInFlight()

  if (q.length < MIN_QUERY_LENGTH) {
    _reset()
    return
  }

  const controller = new AbortController()
  _controller = controller
  _loading.value = true
  _error.value = null
  _page.value = 1

  try {
    const rows = await searchBooks(q, 1, controller.signal)
    if (controller.signal.aborted) return
    _results.value = rows
    _hasMore.value = rows.length === SEARCH_PAGE_SIZE
    _hasSearched.value = true
  } catch {
    if (!controller.signal.aborted) {
      _error.value = 'Search failed. Check your connection and try again.'
      _results.value = []
      _hasMore.value = false
      _hasSearched.value = true
    }
  } finally {
    if (_controller === controller) {
      _loading.value = false
      _controller = null
    }
  }
}

const loadNextPage = async () => {
  if (!_hasMore.value || _loadingMore.value || _loading.value) return

  const q = _query.value.trim()
  if (q.length < MIN_QUERY_LENGTH) return

  const nextPage = _page.value + 1
  _loadingMore.value = true
  _error.value = null
  try {
    const rows = await searchBooks(q, nextPage)
    _results.value = [..._results.value, ...rows]
    _page.value = nextPage
    _hasMore.value = rows.length === SEARCH_PAGE_SIZE
  } catch {
    _error.value = 'Could not load more results. Please try again.'
  } finally {
    _loadingMore.value = false
  }
}

const retry = async () => {
  await runSearch()
}

// ── Watcher (registered once at module scope) ──────────────────────────────────

watchDebounced(_query, () => { runSearch() }, { debounce: 300, maxWait: 1000 })

// ── Exported composable ────────────────────────────────────────────────────────

export const useBookSearch = () => ({
  query: _query,
  results: _results,
  loading: _loading,
  loadingMore: _loadingMore,
  error: _error,
  hasMore: _hasMore,
  hasSearched: _hasSearched,
  loadNextPage,
  retry,
})
