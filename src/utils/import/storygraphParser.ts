import { cleanIsbn, firstAuthor, makeDedupeKey, mapStatusToInitial, parsePages } from './shared'
import type { ParsedRow, RowResult } from './goodreadsParser'

// Map one parsed StoryGraph CSV row → ImportRow. Same contract as the Goodreads
// parser: returns a reason when the row is unusable.

export const parseStorygraphRow = (raw: ParsedRow): RowResult => {
  const title = (raw['Title'] ?? '').trim()
  if (!title) return { ok: false, reason: 'no title' }

  const author = firstAuthor(raw['Authors'])
  const isbn = cleanIsbn(raw['ISBN/UID'])
  const totalPages = parsePages(raw['Number of Pages'])
  // StoryGraph statuses: read / to-read / currently-reading / did-not-finish.
  const initialStatus = mapStatusToInitial(raw['Read Status'])

  return {
    ok: true,
    row: {
      title,
      author,
      isbn,
      totalPages,
      initialStatus,
      source: 'storygraph',
      dedupeKey: makeDedupeKey(isbn, title, author),
    },
  }
}
