import type { ImportRow } from '@/types'
import { cleanIsbn, makeDedupeKey, mapStatusToInitial, parsePages } from './shared'

// Map one parsed Goodreads CSV row → ImportRow. Returns a reason string when the
// row is unusable (e.g. no title) so the import can report it without aborting (FR-009).

export type ParsedRow = Record<string, string>

export type RowResult =
  | { ok: true; row: ImportRow }
  | { ok: false; reason: string }

export const parseGoodreadsRow = (raw: ParsedRow): RowResult => {
  const title = (raw['Title'] ?? '').trim()
  if (!title) return { ok: false, reason: 'no title' }

  const author = (raw['Author'] ?? raw['Author l-f'] ?? '').trim() || 'Unknown Author'
  const isbn = cleanIsbn(raw['ISBN13']) ?? cleanIsbn(raw['ISBN'])
  const totalPages = parsePages(raw['Number of Pages'])
  const initialStatus = mapStatusToInitial(raw['Exclusive Shelf'])

  return {
    ok: true,
    row: {
      title,
      author,
      isbn,
      totalPages,
      initialStatus,
      source: 'goodreads',
      dedupeKey: makeDedupeKey(isbn, title, author),
    },
  }
}
