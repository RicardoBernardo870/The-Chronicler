import type { ImportSource } from '@/types'

// Detect which export a CSV came from by its header signature, so the reader never
// has to tell us (034 / FR-002). Returns null for anything we don't recognize.

export const detectImportSource = (headers: string[]): ImportSource | null => {
  const set = new Set(headers.map((h) => h.trim()))
  const has = (k: string): boolean => set.has(k)

  // Goodreads export: has a numeric Book Id + the Exclusive Shelf status column.
  if (has('Book Id') && has('Exclusive Shelf') && has('My Rating')) return 'goodreads'

  // StoryGraph export: Read Status + Star Rating, and no Goodreads-only columns.
  if (has('Read Status') && has('Star Rating') && !has('Exclusive Shelf')) return 'storygraph'

  return null
}
