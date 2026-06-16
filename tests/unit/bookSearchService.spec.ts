import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapGoogleVolume, type GoogleVolume } from '@/types'
import { searchBooks, getBookDetail } from '@/services/bookSearchService'

const okJson = (data: unknown) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapGoogleVolume', () => {
  it('maps a Google Books volume into a BookSearchResult', () => {
    const volume: GoogleVolume = {
      id: 'zyTCAlFPjgYC',
      volumeInfo: {
        title: 'The Lord of the Rings',
        authors: ['J.R.R. Tolkien'],
        publishedDate: '1954-07-29',
        imageLinks: { thumbnail: 'http://books.google.com/cover.jpg' },
        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780261102385' }],
      },
    }
    expect(mapGoogleVolume(volume)).toEqual({
      source: 'googlebooks',
      key: 'zyTCAlFPjgYC',
      title: 'The Lord of the Rings',
      author: 'J.R.R. Tolkien',
      coverUrl: 'https://books.google.com/cover.jpg', // http→https
      firstPublishYear: 1954,
      isbn: '9780261102385',
    })
  })
})

describe('searchBooks', () => {
  it('uses startIndex/maxResults pagination and de-duplicates by id', async () => {
    const fetchMock = vi.fn(() =>
      okJson({
        items: [
          { id: 'a', volumeInfo: { title: 'A' } },
          { id: 'a', volumeInfo: { title: 'A dup' } },
          { id: 'b', volumeInfo: { title: 'B' } },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchBooks('hobbit', 2)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('startIndex=20')
    expect(url).toContain('maxResults=20')
    expect(results.map((r) => r.key)).toEqual(['a', 'b'])
  })

  it('returns [] for blank queries without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await searchBooks('   ', 1)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('getBookDetail', () => {
  it('uses Google Books as primary, cleans the description, and skips gap-fill when complete', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('openlibrary.org')) throw new Error('Open Library should not be called')
      return okJson({
        id: 'gb1',
        volumeInfo: {
          title: 'My Book',
          authors: ['Jane Doe'],
          pageCount: 320,
          categories: ['Fiction / Science Fiction'],
          description: '<p>A <b>great</b> read.</p>',
          imageLinks: { thumbnail: 'http://img/cover.jpg' },
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9991112223334' }],
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await getBookDetail('googlebooks', 'gb1')
    expect(draft).toEqual({
      title: 'My Book',
      author: 'Jane Doe',
      coverUrl: 'https://img/cover.jpg',
      totalPages: 320,
      genre: 'Fiction', // chip stays general
      description: 'A great read.', // HTML stripped
      isbn: '9991112223334',
      subjects: ['Science Fiction'], // specific subject drives recommendations
    })
  })

  it('gap-fills missing cover/pages/genre from Open Library by ISBN', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('openlibrary.org')) {
        return okJson({
          'ISBN:9991112223334': {
            cover: { medium: 'https://ol/cover.jpg' },
            number_of_pages: 410,
            subjects: [{ name: 'Adventure' }],
          },
        })
      }
      return okJson({
        id: 'gb2',
        volumeInfo: {
          title: 'Sparse Book',
          authors: ['Jane Doe'],
          industryIdentifiers: [{ type: 'ISBN_13', identifier: '9991112223334' }],
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const draft = await getBookDetail('googlebooks', 'gb2')
    expect(draft.coverUrl).toBe('https://ol/cover.jpg')
    expect(draft.totalPages).toBe(410)
    expect(draft.genre).toBe('Adventure')
  })
})
