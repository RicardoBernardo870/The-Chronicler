import type { Book } from '@/types'

// Client-side, non-blocking duplicate detection for the search-and-add flow.
// A candidate matches the library when its normalized ISBN matches, or (when it
// has no ISBN) its case-insensitive title + author match an existing book.

const normalizeIsbn = (isbn: string | null | undefined): string =>
  (isbn ?? '').replace(/[^0-9X]/gi, '').toUpperCase()

const normalizeText = (value: string | null | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase()

export const isDuplicateBook = (
  candidate: { isbn: string | null; title: string; author: string },
  books: Book[],
): boolean => {
  const candidateIsbn = normalizeIsbn(candidate.isbn)
  if (candidateIsbn && books.some((b) => normalizeIsbn(b.isbn) === candidateIsbn)) {
    return true
  }

  const candidateTitle = normalizeText(candidate.title)
  if (!candidateTitle) return false
  const candidateAuthor = normalizeText(candidate.author)

  return books.some(
    (b) => normalizeText(b.title) === candidateTitle && normalizeText(b.author) === candidateAuthor,
  )
}
