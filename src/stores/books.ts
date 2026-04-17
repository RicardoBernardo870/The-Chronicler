import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapBook, type Book, type BookRow } from '@/types'
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

  // ── Read helpers ───────────────────────────────────────────────────────────

  const bookById = (id: string): Book | undefined => books.value.find(b => b.id === id)

  // ── Mutations (T012) ───────────────────────────────────────────────────────

  const addBook = async (input: Omit<Book, 'id' | 'userId' | 'createdAt'>): Promise<Book> => {
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
      })
      .select()
      .single()
    if (err) throw err

    const book = mapBook(data as BookRow)
    books.value.unshift(book)
    swrTouch(cacheKeys.books(authStore.user.id))
    return book
  }

  const updateBook = async (
    id: string,
    changes: Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl'>>
  ) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error: err } = await supabase
      .from('books')
      .update({
        ...(changes.title !== undefined && { title: changes.title }),
        ...(changes.author !== undefined && { author: changes.author }),
        ...(changes.totalPages !== undefined && { total_pages: changes.totalPages }),
        ...(changes.genre !== undefined && { genre: changes.genre }),
        ...(changes.coverUrl !== undefined && { cover_url: changes.coverUrl }),
      })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err

    const updated = mapBook(data as BookRow)
    const idx = books.value.findIndex(b => b.id === id)
    if (idx !== -1) books.value[idx] = updated
    swrTouch(cacheKeys.books(authStore.user.id))
  }

  const removeBook = async (id: string) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { error: err } = await supabase.from('books').delete().eq('id', id)
    if (err) throw err

    books.value = books.value.filter(b => b.id !== id)
    const uid = authStore.user.id

    // Touch books + broad invalidation of all per-book keys
    swrTouch(cacheKeys.books(uid))
    invalidate(cacheKeys.progress(uid))
    invalidate(`lexicon:${uid}`, { prefix: true })
    invalidate(cacheKeys.recaps(uid, id))
    invalidate(cacheKeys.bookPassport(uid, id))
  }

  return { books, loading, error, fetchLibrary, bookById, addBook, updateBook, removeBook }
})
