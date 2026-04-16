import type { BookMetadata } from '@/types'

const OPEN_LIBRARY_URL = 'https://openlibrary.org/api/books'
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes'

// ── Open Library ──────────────────────────────────────────────────────────────

const fetchFromOpenLibrary = async (isbn: string): Promise<BookMetadata | null> => {
  try {
    const url = `${OPEN_LIBRARY_URL}?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    const res = await fetch(url)
    if (!res.ok) return null

    const json = await res.json()
    const book = json[`ISBN:${isbn}`]
    if (!book) return null

    const author = book.authors?.[0]?.name ?? 'Unknown Author'
    const totalPages = book.number_of_pages ?? null
    const coverUrl = book.cover?.large ?? book.cover?.medium ?? book.cover?.small ?? null
    const genre = book.subjects?.[0]?.name ?? null

    return { title: book.title, author, coverUrl, totalPages, genre }
  } catch {
    return null
  }
}

// ── Google Books (fallback) ────────────────────────────────────────────────────

const fetchFromGoogleBooks = async (isbn: string): Promise<BookMetadata | null> => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY
    const url = `${GOOGLE_BOOKS_URL}?q=isbn:${isbn}${apiKey ? `&key=${apiKey}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return null

    const json = await res.json()
    const item = json.items?.[0]
    if (!item) return null

    const info = item.volumeInfo
    const author = info.authors?.[0] ?? 'Unknown Author'
    const totalPages = info.pageCount ?? null
    const coverUrl = info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null
    const genre = info.categories?.[0] ?? null

    return { title: info.title, author, coverUrl, totalPages, genre }
  } catch {
    return null
  }
}

// ── Public composable ─────────────────────────────────────────────────────────

export const useIsbn = () => {
  const lookup = async (isbn: string): Promise<BookMetadata | null> => {
    const clean = isbn.replace(/[^0-9X]/gi, '')
    const result = await fetchFromOpenLibrary(clean)
    if (result) return result
    return fetchFromGoogleBooks(clean)
  }

  return { lookup }
}
