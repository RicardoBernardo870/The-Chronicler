import { ref } from 'vue'
import type { Book, ImportFailure, ImportPhase, ImportRow, ImportSummary } from '@/types'
import { detectImportSource } from '@/utils/import/csvFormat'
import { parseGoodreadsRow, type ParsedRow, type RowResult } from '@/utils/import/goodreadsParser'
import { parseStorygraphRow } from '@/utils/import/storygraphParser'
import { useBooksStore } from '@/stores/books'
import { useIsbn } from '@/composables/useIsbn'
import { searchBooks } from '@/services/bookSearchService'

// Orchestrates a CSV library import (034): offline guard → parse (papaparse, lazy) →
// detect format → map rows → quiet bulk insert → best-effort background enrichment.
// Reactive phase/progress drive the dialog; enrichment never blocks or fails the import.

const ENRICH_CONCURRENCY = 3
const ENRICH_DELAY_MS = 150

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Google Books genres arrive like "Fiction / Fantasy"; keep the first segment.
const firstGenre = (raw: string | null): string | null => {
  const first = raw?.split('/')[0]?.trim()
  return first ? first : null
}

export const useLibraryImport = () => {
  const phase = ref<ImportPhase>('idle')
  const processed = ref(0)
  const total = ref(0)
  const summary = ref<ImportSummary | null>(null)
  const errorMessage = ref<string | null>(null)

  const booksStore = useBooksStore()
  const { lookup } = useIsbn()

  const reset = (): void => {
    phase.value = 'idle'
    processed.value = 0
    total.value = 0
    summary.value = null
    errorMessage.value = null
  }

  const parseCsv = (file: File): Promise<{ rows: ParsedRow[]; headers: string[] }> =>
    new Promise((resolve, reject) => {
      void import('papaparse').then(({ default: Papa }) => {
        Papa.parse<ParsedRow>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => resolve({ rows: res.data, headers: res.meta.fields ?? [] }),
          error: (err: unknown) => reject(err instanceof Error ? err : new Error('parse-failed')),
        })
      })
    })

  const enrichOne = async (book: Book): Promise<void> => {
    try {
      let meta = book.isbn ? await lookup(book.isbn) : null
      if (!meta) {
        const results = await searchBooks(`${book.title} ${book.author}`.trim(), 1)
        const hit = results[0]
        if (hit?.isbn) meta = await lookup(hit.isbn)
        else if (hit?.coverUrl) {
          meta = { title: book.title, author: book.author, coverUrl: hit.coverUrl, totalPages: null, genre: null, description: null }
        }
      }
      if (!meta) return

      const changes: Parameters<typeof booksStore.updateBook>[1] = {}
      if (!book.coverUrl && meta.coverUrl) changes.coverUrl = meta.coverUrl
      if (!book.genre && meta.genre) changes.genre = firstGenre(meta.genre)
      if (book.pageCountEstimated && meta.totalPages) changes.totalPages = meta.totalPages
      if (Object.keys(changes).length > 0) await booksStore.updateBook(book.id, changes)
    } catch {
      // best-effort — leave the book with whatever the CSV provided (FR-006)
    }
  }

  const enrichBooks = async (ids: string[]): Promise<void> => {
    const targets = ids
      .map((id) => booksStore.bookById(id))
      .filter((b): b is Book => !!b && (!b.coverUrl || !b.genre || b.pageCountEstimated))

    total.value = targets.length
    processed.value = 0
    for (let i = 0; i < targets.length; i += ENRICH_CONCURRENCY) {
      const batch = targets.slice(i, i + ENRICH_CONCURRENCY)
      await Promise.all(batch.map(enrichOne))
      processed.value = Math.min(targets.length, i + batch.length)
      if (i + ENRICH_CONCURRENCY < targets.length) await delay(ENRICH_DELAY_MS)
    }
  }

  const startImport = async (file: File): Promise<void> => {
    reset()

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      phase.value = 'error'
      errorMessage.value = 'You are offline. Reconnect to import your library.'
      return
    }

    try {
      phase.value = 'parsing'
      const { rows: rawRows, headers } = await parseCsv(file)

      const source = detectImportSource(headers)
      if (!source) {
        phase.value = 'error'
        errorMessage.value = 'Unrecognized file. Upload a Goodreads or StoryGraph CSV export.'
        return
      }

      const parseRow = source === 'goodreads' ? parseGoodreadsRow : parseStorygraphRow
      const rows: ImportRow[] = []
      const failed: ImportFailure[] = []
      rawRows.forEach((raw, i) => {
        const res: RowResult = parseRow(raw)
        if (res.ok) rows.push(res.row)
        else failed.push({ row: i + 2, title: (raw['Title'] ?? '').trim() || null, reason: res.reason })
      })

      if (rows.length === 0) {
        phase.value = 'error'
        errorMessage.value =
          failed.length > 0
            ? 'No usable rows — every row was missing a title.'
            : 'No book rows found in this file.'
        return
      }

      total.value = rows.length
      processed.value = 0
      phase.value = 'importing'
      const { insertedIds, summary: s } = await booksStore.importBooks(rows)
      processed.value = insertedIds.length

      // Fold parse failures into the summary and correct the data-row total.
      s.failed = failed
      s.total = rawRows.length
      summary.value = s

      phase.value = 'enriching'
      await enrichBooks(insertedIds)

      phase.value = 'done'
    } catch (e) {
      phase.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Import failed.'
    }
  }

  return { phase, processed, total, summary, errorMessage, startImport, reset }
}
