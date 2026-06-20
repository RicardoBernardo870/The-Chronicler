import {
  type BookSearchResult,
  type BookDetailDraft,
  type BookSearchSource,
  type Recommendation,
  type GoogleVolume,
  mapGoogleVolume,
  googleVolumeCover,
  googleVolumeIsbn,
} from '@/types'
import { cleanDescription } from '@/utils/cleanDescription'

// ─────────────────────────────────────────────────────────────
// Book Search & Add (030) — Google Books (primary) + Open Library (gap-fill).
// All functions are abortable and degrade gracefully: search surfaces genuine
// network failures for retry, while detail/recommendations resolve partial/[]
// so they never block the page (FR-015).
// ─────────────────────────────────────────────────────────────

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'
const OL_API_BOOKS = 'https://openlibrary.org/api/books'

export const SEARCH_PAGE_SIZE = 20

const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined
const keyParam = (leading: '?' | '&') => (apiKey ? `${leading}key=${apiKey}` : '')

// Restrict results to the user's browser language so Google Books doesn't fall
// back to IP geolocation (which surfaces local-market editions, e.g. Portuguese).
const browserLang =
  typeof navigator !== 'undefined' && navigator.language
    ? navigator.language.slice(0, 2)
    : 'en'
const langParam = `&langRestrict=${browserLang}`

// A bare ISBN-10/13 (digits, optional hyphens/spaces, trailing X allowed on ISBN-10).
const isIsbnQuery = (raw: string): boolean =>
  /^(?:\d{9}[\dX]|\d{13})$/i.test(raw.replace(/[-\s]/g, ''))

// Google Books categories arrive like "Fiction / Fantasy / General"; keep just
// the first, most general label so the genre chip shows a single value.
const primaryGenre = (raw: string | null | undefined): string | null => {
  const first = raw?.split('/')[0]?.trim()
  return first ? first : null
}

// Subjects too generic to drive useful recommendations — they all return the
// same bestsellers.
const GENERIC_SUBJECTS = new Set([
  'fiction',
  'nonfiction',
  'non-fiction',
  'general',
  'literature',
  'books',
  'ebook',
  'juvenile fiction',
  'juvenile nonfiction',
  'young adult fiction',
])

/**
 * Build a specific→general subject list for recommendations from Google Books
 * category strings ("Fiction / Science Fiction / Space Opera") and Open Library
 * subjects. Deepest segments come first; generic/duplicate labels are dropped.
 */
const deriveSubjects = (
  googleCategories: string[] | undefined,
  openLibrarySubjects: string[] = [],
): string[] => {
  const segments: string[] = []
  // Google categories are hierarchical: reverse each so the deepest is first.
  for (const category of googleCategories ?? []) {
    const parts = category.split('/').map((p) => p.trim()).filter(Boolean)
    segments.push(...parts.reverse())
  }
  segments.push(...openLibrarySubjects.map((s) => s.trim()).filter(Boolean))

  const seen = new Set<string>()
  const result: string[] = []
  for (const subject of segments) {
    const key = subject.toLocaleLowerCase()
    if (GENERIC_SUBJECTS.has(key) || seen.has(key)) continue
    seen.add(key)
    result.push(subject)
  }
  return result
}

// ── Search (Google Books) ─────────────────────────────────────────────────────

/** Search Google Books by free text (title, author, or ISBN). `page` is 1-based. */
export const searchBooks = async (
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<BookSearchResult[]> => {
  const q = query.trim()
  if (!q) return []

  try {
    const startIndex = (page - 1) * SEARCH_PAGE_SIZE
    // An ISBN identifies one specific edition in one language — query it with the
    // `isbn:` operator and skip langRestrict, which would otherwise filter out
    // editions whose language doesn't match the browser (matching the scan path).
    const isbn = isIsbnQuery(q)
    const queryParam = isbn ? `isbn:${q.replace(/[-\s]/g, '')}` : q
    const url =
      `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(queryParam)}` +
      `&startIndex=${startIndex}&maxResults=${SEARCH_PAGE_SIZE}&printType=books${isbn ? '' : langParam}${keyParam('&')}`
    const res = await fetch(url, { signal })
    if (!res.ok) return []

    const json = await res.json()
    const items = (json.items ?? []) as GoogleVolume[]

    // De-duplicate by volume id (Google occasionally repeats across pages).
    const seen = new Set<string>()
    const results: BookSearchResult[] = []
    for (const item of items) {
      if (!item.id || seen.has(item.id)) continue
      seen.add(item.id)
      results.push(mapGoogleVolume(item))
    }
    return results
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return []
    throw e
  }
}

// ── Detail (Google Books volume ⊕ Open Library gap-fill) ──────────────────────

/**
 * Fetch a full, editable draft for a selected book. Google Books is primary;
 * Open Library gap-fills missing cover/page-count/genre by ISBN. Refresh-safe:
 * derived from `key` alone. Aborts propagate; other failures degrade.
 */
export const getBookDetail = async (
  _source: BookSearchSource,
  key: string,
  signal?: AbortSignal,
): Promise<BookDetailDraft> => {
  const draft: BookDetailDraft = {
    title: '',
    author: 'Unknown Author',
    coverUrl: null,
    totalPages: null,
    genre: null,
    description: null,
    isbn: null,
  }

  try {
    const res = await fetch(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(key)}${keyParam('?')}`, {
      signal,
    })
    if (res.ok) {
      const volume = (await res.json()) as GoogleVolume
      const info = volume.volumeInfo ?? {}
      draft.title = info.title ?? ''
      draft.author = info.authors?.[0] ?? 'Unknown Author'
      draft.coverUrl = googleVolumeCover(info)
      draft.totalPages = info.pageCount ?? null
      draft.genre = primaryGenre(info.categories?.[0])
      draft.description = cleanDescription(info.description)
      draft.isbn = googleVolumeIsbn(info)
      draft.subjects = deriveSubjects(info.categories)
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    // Otherwise return whatever partial draft we have; fields stay editable.
  }

  return fillDetailGapsFromOpenLibrary(draft, signal)
}

// ── Gap-fill (Open Library by ISBN, secondary) ────────────────────────────────

const isDraftIncomplete = (d: BookDetailDraft): boolean =>
  !d.coverUrl || !d.totalPages || !d.genre || d.author === 'Unknown Author'

// Also consult Open Library when Google gave no usable (specific) subjects, so
// recommendations have something better than a generic "Fiction" to work with.
const needsOpenLibrary = (d: BookDetailDraft): boolean =>
  isDraftIncomplete(d) || (d.subjects?.length ?? 0) === 0

/** Fill missing cover/pages/genre/author + enrich subjects from Open Library. Google values win. */
const fillDetailGapsFromOpenLibrary = async (
  draft: BookDetailDraft,
  signal?: AbortSignal,
): Promise<BookDetailDraft> => {
  if (!needsOpenLibrary(draft) || !draft.isbn) return draft

  try {
    const url = `${OL_API_BOOKS}?bibkeys=ISBN:${draft.isbn}&format=json&jscmd=data`
    const res = await fetch(url, { signal })
    if (!res.ok) return draft

    const json = await res.json()
    const book = json[`ISBN:${draft.isbn}`]
    if (!book) return draft

    const olSubjects: string[] = Array.isArray(book.subjects)
      ? book.subjects.map((s: { name?: string }) => s.name ?? '').filter(Boolean)
      : []

    return {
      ...draft,
      author:
        draft.author !== 'Unknown Author'
          ? draft.author
          : (book.authors?.[0]?.name ?? draft.author),
      coverUrl:
        draft.coverUrl ?? (book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null),
      totalPages: draft.totalPages ?? (book.number_of_pages ?? null),
      genre: draft.genre ?? primaryGenre(book.subjects?.[0]?.name),
      subjects: deriveSubjects(undefined, [...(draft.subjects ?? []), ...olSubjects]),
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return draft
  }
}

// ── Recommendations (best-effort, Google Books) ───────────────────────────────

const REC_LIMIT = 12

const normalizeTitle = (title: string): string => title.trim().toLocaleLowerCase()

/**
 * Best-effort similar titles: Google Books search by the draft's genre/subject,
 * **excluding the same author** so the list surfaces comparable books by *other*
 * authors. Falls back to an author search only when no genre is known. Drops the
 * current book, duplicate titles, and cover-less entries. Resolves [] on any
 * failure (FR-013).
 */
export const getRecommendations = async (
  draft: BookDetailDraft,
  excludeKey: string,
  signal?: AbortSignal,
): Promise<Recommendation[]> => {
  const author = draft.author && draft.author !== 'Unknown Author' ? draft.author : null
  const excludeAuthor = author?.toLocaleLowerCase() ?? null

  // Query candidates, most specific first: each distinct subject, then the
  // general genre, then (last resort) the author. We stop as soon as we have
  // enough, so most books need just one request.
  const subjectQueries = (draft.subjects ?? []).slice(0, 3).map((s) => ({
    q: `subject:"${s}"`,
    dropAuthor: excludeAuthor,
  }))
  const queries = [...subjectQueries]
  if (queries.length === 0 && draft.genre?.trim()) {
    queries.push({ q: `subject:"${draft.genre.trim()}"`, dropAuthor: excludeAuthor })
  }
  if (queries.length === 0 && author) {
    queries.push({ q: `inauthor:"${author}"`, dropAuthor: null })
  }
  if (queries.length === 0) return []

  const seenTitles = new Set<string>([normalizeTitle(draft.title)])
  const recs: Recommendation[] = []

  for (const { q, dropAuthor } of queries) {
    if (recs.length >= REC_LIMIT) break
    try {
      // A small random offset varies the set between visits so it doesn't feel static.
      const offset = Math.floor(Math.random() * 8)
      const url =
        `${GOOGLE_BOOKS_URL}?q=${encodeURIComponent(q)}` +
        `&startIndex=${offset}&maxResults=${REC_LIMIT + 12}&printType=books&orderBy=relevance${langParam}${keyParam('&')}`
      const res = await fetch(url, { signal })
      if (!res.ok) continue

      const json = await res.json()
      const items = (json.items ?? []) as GoogleVolume[]
      for (const item of items) {
        if (recs.length >= REC_LIMIT) break
        const rec = mapGoogleVolume(item)
        const title = normalizeTitle(rec.title)
        if (rec.key === excludeKey || !rec.coverUrl || seenTitles.has(title)) continue
        if (dropAuthor && rec.author?.toLocaleLowerCase() === dropAuthor) continue
        seenTitles.add(title)
        recs.push(rec)
      }
    } catch {
      // Try the next query (or give up gracefully).
    }
  }
  return recs
}
