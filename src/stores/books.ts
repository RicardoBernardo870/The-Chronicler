import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapBook, type Book, type BookRow } from '@/types'
import { useAuthStore } from '@/stores/auth'

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchLibrary() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      books.value = (data as BookRow[]).map(mapBook)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load library'
    } finally {
      loading.value = false
    }
  }

  function bookById(id: string): Book | undefined {
    return books.value.find(b => b.id === id)
  }

  async function addBook(input: Omit<Book, 'id' | 'userId' | 'createdAt'>): Promise<Book> {
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
    return book
  }

  async function updateBook(id: string, changes: Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl'>>) {
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
  }

  async function removeBook(id: string) {
    const { error: err } = await supabase.from('books').delete().eq('id', id)
    if (err) throw err
    books.value = books.value.filter(b => b.id !== id)
  }

  return { books, loading, error, fetchLibrary, bookById, addBook, updateBook, removeBook }
})
