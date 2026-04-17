import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapRecapFragment, type RecapFragment, type RecapFragmentRow } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { extractFragment } from '@/services/recapService'

export const useRecapFragmentsStore = defineStore('recapFragments', () => {
  const fragmentsByBook = ref<Record<string, RecapFragment[]>>({})

  const fetchFragmentsForBook = async (bookId: string) => {
    const { data, error } = await supabase
      .from('recap_fragments')
      .select('*')
      .eq('book_id', bookId)
      .order('percentage_at_extraction', { ascending: true })
    if (error) throw error
    fragmentsByBook.value[bookId] = (data as RecapFragmentRow[]).map(mapRecapFragment)
  }

  const saveFragment = async (
    bookId: string,
    page: number,
    percentage: number,
    json: Record<string, unknown>
  ) => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase
      .from('recap_fragments')
      .insert({
        book_id: bookId,
        user_id: authStore.user.id,
        page_at_extraction: page,
        percentage_at_extraction: percentage,
        extracted_json: json,
      })
      .select()
      .single()
    if (error) return // silent fail — fire-and-forget safe
    const fragment = mapRecapFragment(data as RecapFragmentRow)
    if (!fragmentsByBook.value[bookId]) fragmentsByBook.value[bookId] = []
    fragmentsByBook.value[bookId].push(fragment)
    fragmentsByBook.value[bookId].sort((a, b) => a.percentageAtExtraction - b.percentageAtExtraction)
  }

  // Fire-and-forget: call edge function in extract_only mode, cache result
  const triggerExtraction = (
    bookId: string,
    page: number,
    percentage: number,
    bookTitle: string,
    bookAuthor: string,
    totalPages: number,
    isbn?: string | null
  ) => {
    extractFragment({ bookId, bookTitle, bookAuthor, isbn, currentPage: page, totalPages, percentage })
      .then(json => {
        if (json) saveFragment(bookId, page, percentage, json)
      })
      .catch(() => { /* silent fail */ })
  }

  const fragmentsForBook = (bookId: string): RecapFragment[] =>
    fragmentsByBook.value[bookId] ?? []

  return { fragmentsByBook, fetchFragmentsForBook, saveFragment, triggerExtraction, fragmentsForBook }
})
