import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import {
  mapBook,
  type AddBookInput,
  type Book,
  type BookRow,
  type BookStatus,
  type ImportRow,
  type ImportSummary,
  type LibraryBookEntry,
} from '@/types'
import { cleanIsbn, makeDedupeKey } from '@/utils/import/shared'
import { useAuthStore } from '@/stores/auth'
import {
  swrStatus,
  swrRun,
  swrTouch,
  invalidate,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

const TTL = 60_000 // 60 s

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const libraryEntries = ref<LibraryBookEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Fetcher shared between first-load and background revalidation ───────────

  const _fetcher = async () => {
    const { data, error: err } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) throw err
    books.value = (data as BookRow[]).map(mapBook)
  }

  // ── SWR-aware fetchLibrary (T005) ──────────────────────────────────────────
  // - 'fresh'      → return immediately; no network call, no spinner
  // - 'background' → serve cached books instantly, revalidate silently
  // - 'loading'    → first visit; show skeleton until data arrives

  const fetchLibrary = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.books(authStore.user.id)
    // Ensure visibility revalidator is registered for this user (T017/T018)
    registerRevalidator(key, () => swrRun(key, _fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _fetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — true first load
    loading.value = true
    error.value = null
    try {
      await swrRun(key, _fetcher)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
    } finally {
      loading.value = false
    }
  }

  // ── RPC: get_library_with_progress (017) ──────────────────────────────────
  // Single round-trip replacing fetchLibrary + progressStore.fetchProgress pair.
  // Eliminates the race condition on Profile → Dashboard navigation.

  const LIBRARY_TTL = 60_000 // 60 s

  const _libraryFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error: err } = await supabase.rpc('get_library_with_progress', {
      p_user_id: authStore.user.id,
    })
    if (err) throw err
    const entries = (data as LibraryBookEntry[]) ?? []
    libraryEntries.value = entries
    books.value = entries.map(e => ({
      id: e.id,
      userId: authStore.user!.id,
      title: e.title,
      author: e.author,
      isbn: e.isbn ?? null,      // 019 — was hardcoded null; now from RPC
      coverUrl: e.coverUrl,
      totalPages: e.totalPages,
      genre: e.genre ?? null,   // 019 — was hardcoded null; now from RPC
      description: e.description ?? null,  // 030 — from RPC
      source: e.source ?? 'manual',                  // 034
      pageCountEstimated: e.pageCountEstimated ?? false,  // 034
      createdAt: '',
    }))
  }

  const fetchLibraryWithProgress = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.library(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _libraryFetcher).catch(() => {}))

    const status = swrStatus(key, LIBRARY_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _libraryFetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first visit
    loading.value = true
    error.value = null
    try {
      await swrRun(key, _libraryFetcher)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
    } finally {
      loading.value = false
    }
  }

  // ── Read helpers ───────────────────────────────────────────────────────────

  const bookById = (id: string): Book | undefined => books.value.find(b => b.id === id)

  const applyProgressSnapshot = (
    bookId: string,
    snapshot: {
      currentPage: number
      percentage: number
      updatedAt: string
      sessionStartAt: string | null
      progressId?: string | null
    },
  ) => {
    const idx = libraryEntries.value.findIndex(entry => entry.id === bookId)
    if (idx === -1) return

    const status: BookStatus = snapshot.percentage >= 100
      ? 'finished'
      : snapshot.currentPage > 0
        ? 'reading'
        : 'unread'

    libraryEntries.value[idx] = {
      ...libraryEntries.value[idx],
      currentPage: snapshot.currentPage,
      percentage: snapshot.percentage,
      status,
      lastReadAt: snapshot.updatedAt,
      sessionStartAt: snapshot.sessionStartAt,
      progressId: snapshot.progressId ?? libraryEntries.value[idx].progressId,
    }
  }

  const replaceLibraryEntry = (entry: LibraryBookEntry) => {
    const idx = libraryEntries.value.findIndex(item => item.id === entry.id)
    if (idx !== -1) libraryEntries.value[idx] = entry
  }

  // ── Mutations (T012) ───────────────────────────────────────────────────────

  const addBook = async (input: Omit<Book, 'id' | 'userId' | 'createdAt' | 'source' | 'pageCountEstimated'>): Promise<Book> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error: err } = await supabase
      .from('books')
      .insert({
        user_id: authStore.user.id,
        title: input.title,
        author: input.author,
        isbn: input.isbn,
        cover_url: input.coverUrl,
        total_pages: input.totalPages,
        genre: input.genre,
        description: input.description,
      })
      .select()
      .single()
    if (err) throw err

    const book = mapBook(data as BookRow)
    books.value.unshift(book)
    const uid = authStore.user.id
    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.library(uid))
    invalidate(cacheKeys.libraryBreakdown(uid))
    invalidate(cacheKeys.readingQuest(uid), { prefix: true })
    return book
  }

  const normalizeInitialPage = (input: AddBookInput): number => {
    if (input.initialStatus === 'queued') return 0
    if (input.initialStatus === 'completed') return input.totalPages

    const requestedPage = input.currentPage ?? 1
    const lastInProgressPage = Math.max(0, input.totalPages - 1)
    return Math.max(1, Math.min(requestedPage, lastInProgressPage))
  }

  const addBookWithInitialStatus = async (input: AddBookInput): Promise<Book> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const book = await addBook(input)
    const uid = authStore.user.id

    if (input.initialStatus !== 'queued') {
      const { useProgressStore } = await import('@/stores/progress')
      const progressStore = useProgressStore()
      await progressStore.setInitialProgress(book.id, normalizeInitialPage(input))
    }

    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.progress(uid))
    invalidate(cacheKeys.library(uid))
    invalidate(cacheKeys.readingStats(uid))
    invalidate(cacheKeys.libraryBreakdown(uid))
    invalidate(cacheKeys.readingQuest(uid), { prefix: true })
    invalidate(cacheKeys.velocity(uid))

    return book
  }

  // ── Bulk import (034) ──────────────────────────────────────────────────────
  // Quiet, idempotent bulk insert for CSV library import. De-dupes against the
  // existing library + within the batch, chunks the inserts, and writes completed
  // status through a batched reading_progress upsert — never updateProgress — so no
  // progress_history / recap / lore / quest / passport side effects fire (FR-005).

  const IMPORT_CHUNK = 100
  const PLACEHOLDER_PAGES = 100 // small, clearly-flagged value the reader can fix (FR-007)

  const importBooks = async (
    rows: ImportRow[],
  ): Promise<{ insertedIds: string[]; summary: ImportSummary }> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')
    const uid = authStore.user.id

    const total = rows.length

    // Dedupe: seed with existing-library keys, then collapse within the file.
    const seen = new Set<string>()
    for (const b of books.value) {
      seen.add(makeDedupeKey(cleanIsbn(b.isbn), b.title, b.author))
    }

    const toInsert: ImportRow[] = []
    let skippedDuplicate = 0
    for (const r of rows) {
      if (seen.has(r.dedupeKey)) {
        skippedDuplicate++
        continue
      }
      seen.add(r.dedupeKey)
      toInsert.push(r)
    }

    const insertedIds: string[] = []
    const completedProgress: {
      book_id: string
      user_id: string
      current_page: number
      session_start_at: null
    }[] = []
    let estimatedPageCounts = 0

    for (let i = 0; i < toInsert.length; i += IMPORT_CHUNK) {
      const chunk = toInsert.slice(i, i + IMPORT_CHUNK)
      const payload = chunk.map((r) => {
        const estimated = r.totalPages == null
        if (estimated) estimatedPageCounts++
        return {
          user_id: uid,
          title: r.title,
          author: r.author,
          isbn: r.isbn,
          cover_url: null,
          total_pages: r.totalPages ?? PLACEHOLDER_PAGES,
          genre: null,
          description: null,
          source: r.source,
          page_count_estimated: estimated,
        }
      })

      const { data, error: err } = await supabase
        .from('books')
        .insert(payload)
        .select('id, total_pages')
      if (err) throw err

      // PostgREST returns rows in insertion order, so positional mapping is safe.
      const inserted = data as { id: string; total_pages: number }[]
      inserted.forEach((row, idx) => {
        insertedIds.push(row.id)
        if (chunk[idx].initialStatus === 'completed') {
          completedProgress.push({
            book_id: row.id,
            user_id: uid,
            current_page: row.total_pages,
            session_start_at: null,
          })
        }
      })
    }

    // Quiet completed-status write — batched, no progress_history.
    for (let i = 0; i < completedProgress.length; i += IMPORT_CHUNK) {
      const slice = completedProgress.slice(i, i + IMPORT_CHUNK)
      const { error: err } = await supabase
        .from('reading_progress')
        .upsert(slice, { onConflict: 'book_id,user_id' })
      if (err) throw err
    }

    // Invalidate once, then rehydrate the library so the UI reflects the import.
    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.progress(uid))
    invalidate(cacheKeys.library(uid))
    invalidate(cacheKeys.libraryBreakdown(uid))
    invalidate(cacheKeys.readingStats(uid))
    invalidate(cacheKeys.readingQuest(uid), { prefix: true })
    invalidate(cacheKeys.velocity(uid))
    await fetchLibraryWithProgress()

    return {
      insertedIds,
      summary: {
        imported: insertedIds.length,
        skippedDuplicate,
        failed: [],
        total,
        estimatedPageCounts,
      },
    }
  }

  const updateBook = async (
    id: string,
    changes: Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl' | 'isbn' | 'description'>>
  ) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error: err } = await supabase
      .from('books')
      .update({
        ...(changes.title !== undefined && { title: changes.title }),
        ...(changes.author !== undefined && { author: changes.author }),
        // Setting a real page count clears the imported-placeholder flag (034 / FR-007).
        ...(changes.totalPages !== undefined && {
          total_pages: changes.totalPages,
          page_count_estimated: false,
        }),
        ...(changes.genre !== undefined && { genre: changes.genre }),
        ...(changes.coverUrl !== undefined && { cover_url: changes.coverUrl }),
        ...(changes.isbn !== undefined && { isbn: changes.isbn }),  // 019 — was missing
        ...(changes.description !== undefined && { description: changes.description }),  // 030
      })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err

    const updated = mapBook(data as BookRow)
    const idx = books.value.findIndex(b => b.id === id)
    if (idx !== -1) books.value[idx] = updated
    const uid = authStore.user.id
    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.library(uid))
    invalidate(cacheKeys.libraryBreakdown(uid))
    invalidate(cacheKeys.readingQuest(uid), { prefix: true })
  }

  const removeBook = async (id: string) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { error: err } = await supabase.from('books').delete().eq('id', id)
    if (err) throw err

    books.value = books.value.filter(b => b.id !== id)
    libraryEntries.value = libraryEntries.value.filter(entry => entry.id !== id)
    const uid = authStore.user.id
    const { useProgressStore } = await import('@/stores/progress')
    useProgressStore().removeLocalProgress(id)

    // Touch books + broad invalidation of all per-book keys
    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.progress(uid))
    invalidate(cacheKeys.library(uid))
    invalidate(cacheKeys.libraryBreakdown(uid))
    invalidate(cacheKeys.readingQuest(uid), { prefix: true })
    invalidate(`lexicon:${uid}`, { prefix: true })
    invalidate(cacheKeys.recaps(uid, id))
    invalidate(cacheKeys.bookPassport(uid, id))
  }

  return {
    books, libraryEntries, loading, error,
    fetchLibrary, fetchLibraryWithProgress,
    applyProgressSnapshot, replaceLibraryEntry,
    bookById, addBook, addBookWithInitialStatus, updateBook, removeBook,
    importBooks,
  }
})
