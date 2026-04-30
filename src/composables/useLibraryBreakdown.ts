import { computed } from 'vue'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'

/**
 * 016 — Library breakdown view model for the Profile page.
 *
 * - Genre distribution from the existing books.genre column (FR-004).
 * - Unique author count.
 * - Per-book pace comparison (label + normalized 0-100 value for ProgressBar).
 *
 * Pure client-side derivation; no new tables (FR-006).
 */

export interface GenreCount {
  name: string
  count: number
}

export interface PaceRow {
  bookId: string
  bookTitle: string
  paceLabel: string         // e.g. "12 pages/hr"
  paceNormalized: number    // 0–100 for ProgressBar
}

export interface LibraryBreakdown {
  genres: GenreCount[]
  uniqueAuthors: number
  paceComparison: PaceRow[]
}

export const useLibraryBreakdown = () => {
  const booksStore = useBooksStore()
  const progressStore = useProgressStore()

  const breakdown = computed((): LibraryBreakdown => {
    const books = booksStore.books

    // Genre distribution
    const genreCounts = new Map<string, number>()
    const authors = new Set<string>()
    for (const b of books) {
      const g = b.genre?.trim() || 'Uncategorized'
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1)
      if (b.author) authors.add(b.author.trim().toLowerCase())
    }
    const genres = [...genreCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    // Pace comparison — label uses currentPage / sessions hint; for now use
    // currentPage as a proxy for "how far you've gotten" normalized against
    // book length. The Profile spec calls this "pace comparison across books".
    const paceRows: PaceRow[] = []
    for (const b of books) {
      const p = progressStore.progress[b.id]
      if (!p || !b.totalPages) continue
      const pct = Math.min(100, Math.round((p.currentPage / b.totalPages) * 100))
      paceRows.push({
        bookId: b.id,
        bookTitle: b.title,
        paceLabel: `${pct}% read · p. ${p.currentPage} / ${b.totalPages}`,
        paceNormalized: pct,
      })
    }
    paceRows.sort((a, b) => b.paceNormalized - a.paceNormalized)

    return {
      genres,
      uniqueAuthors: authors.size,
      paceComparison: paceRows,
    }
  })

  return { breakdown }
}
