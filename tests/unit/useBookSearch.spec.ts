import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import type { BookSearchResult } from '@/types'

const searchBooksMock = vi.fn()

vi.mock('@/services/bookSearchService', () => ({
  searchBooks: (...args: unknown[]) => searchBooksMock(...args),
  SEARCH_PAGE_SIZE: 20,
}))

// Imported after the mock so the composable binds to the mocked service.
import { useBookSearch } from '@/composables/useBookSearch'

const flush = async () => {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

const makeResults = (n: number): BookSearchResult[] =>
  Array.from({ length: n }, (_, i) => ({
    source: 'openlibrary' as const,
    key: `/works/OL${i}W`,
    title: `Title ${i}`,
    author: null,
    coverUrl: null,
    firstPublishYear: null,
    isbn: null,
  }))

const search = useBookSearch()

describe('useBookSearch', () => {
  beforeEach(() => {
    // Fake timers keep the 300ms debounce watcher from firing mid-test; we drive
    // searches explicitly via retry()/loadNextPage().
    vi.useFakeTimers()
    searchBooksMock.mockReset()
    search.query.value = ''
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs a search and flags hasMore when a full page returns', async () => {
    searchBooksMock.mockResolvedValueOnce(makeResults(20))
    search.query.value = 'hobbit'
    await search.retry()
    await flush()

    expect(searchBooksMock).toHaveBeenCalledWith('hobbit', 1, expect.anything())
    expect(search.results.value).toHaveLength(20)
    expect(search.hasMore.value).toBe(true)
    expect(search.hasSearched.value).toBe(true)
  })

  it('appends on loadNextPage and clears hasMore on a short final page', async () => {
    searchBooksMock.mockResolvedValueOnce(makeResults(20))
    search.query.value = 'hobbit'
    await search.retry()
    await flush()

    searchBooksMock.mockResolvedValueOnce(makeResults(5))
    await search.loadNextPage()
    await flush()

    expect(search.results.value).toHaveLength(25)
    expect(search.hasMore.value).toBe(false)
  })

  it('skips searches for queries shorter than two characters', async () => {
    search.query.value = 'a'
    await search.retry()
    await flush()

    expect(searchBooksMock).not.toHaveBeenCalled()
    expect(search.results.value).toHaveLength(0)
    expect(search.hasSearched.value).toBe(false)
  })
})
