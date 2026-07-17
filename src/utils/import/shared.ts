// Shared helpers for CSV library import (034). Pure functions, unit-tested.

/** Strip Goodreads' Excel guard (`="9780…"`) and keep ISBN digits + a trailing X. */
export const cleanIsbn = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  // Goodreads wraps ISBNs as `="9780261102354"` (or `=""` when absent).
  const unguarded = raw.replace(/^="?/, '').replace(/"?$/, '').trim()
  const digits = unguarded.replace(/[^0-9Xx]/g, '').toUpperCase()
  return digits.length >= 10 ? digits : null
}

/** Parse a page count; blank / non-positive → null (triggers placeholder on import). */
export const parsePages = (raw: string | null | undefined): number | null => {
  if (!raw) return null
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Read-status → BookHero initial status. "read" completes, DNF shelves; everything else queues. */
export const mapStatusToInitial = (
  raw: string | null | undefined,
): 'completed' | 'queued' | 'dnf' => {
  const status = (raw ?? '').trim().toLowerCase()
  if (status === 'read') return 'completed'
  // StoryGraph native "did-not-finish"; Goodreads has no native DNF shelf, so
  // also match the common custom-shelf spellings.
  if (status === 'did-not-finish' || status === 'did not finish' || status === 'dnf') return 'dnf'
  return 'queued'
}

/** Stable dedupe key: ISBN digits when present, else `lower(title) lower(author)`. */
export const makeDedupeKey = (
  isbn: string | null,
  title: string,
  author: string,
): string =>
  isbn
    ? `isbn:${isbn}`
    : `ta:${title.trim().toLowerCase()} ${author.trim().toLowerCase()}`

/** First author from a comma/semicolon-separated list (StoryGraph `Authors`). */
export const firstAuthor = (raw: string | null | undefined): string => {
  const first = (raw ?? '').split(/[,;]/)[0]?.trim()
  return first || 'Unknown Author'
}
