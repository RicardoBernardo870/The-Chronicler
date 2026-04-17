import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { mapLexiconEntry, type LexiconEntry, type LexiconEntryRow, type LexiconEntryType } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useLeitner } from '@/composables/useLeitner'

export const useLexiconStore = defineStore('lexicon', () => {
  const entriesByBook = ref<Record<string, LexiconEntry[]>>({})

  const fetchEntriesForBook = async (bookId: string) => {
    const { data, error } = await supabase
      .from('lexicon_entries')
      .select('*')
      .eq('book_id', bookId)
      .order('created_at', { ascending: false })
    if (error) throw error
    entriesByBook.value[bookId] = (data as LexiconEntryRow[]).map(mapLexiconEntry)
  }

  const addEntry = async (input: {
    bookId: string
    term: string
    definition: string
    entryType: LexiconEntryType
    contextSentence?: string | null
    pageFound?: number | null
  }) => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('lexicon_entries')
      .insert({
        user_id: authStore.user.id,
        book_id: input.bookId,
        term: input.term,
        definition: input.definition,
        entry_type: input.entryType,
        context_sentence: input.contextSentence ?? null,
        page_found: input.pageFound ?? null,
      })
      .select()
      .single()
    if (error) throw error

    const entry = mapLexiconEntry(data as LexiconEntryRow)
    if (!entriesByBook.value[input.bookId]) entriesByBook.value[input.bookId] = []
    entriesByBook.value[input.bookId].unshift(entry)
    return entry
  }

  const updateLeitner = async (entryId: string, action: 'advance' | 'reset') => {
    const { advanceBox, resetBox } = useLeitner()

    // Find the entry across all books
    let entry: LexiconEntry | undefined
    let bookId: string | undefined
    for (const [bId, entries] of Object.entries(entriesByBook.value)) {
      entry = entries.find(e => e.id === entryId)
      if (entry) { bookId = bId; break }
    }
    if (!entry || !bookId) return

    const update = action === 'advance' ? advanceBox(entry) : resetBox(entry)

    const { error } = await supabase
      .from('lexicon_entries')
      .update({ leitner_box: update.leitnerBox, next_review_at: update.nextReviewAt })
      .eq('id', entryId)
    if (error) throw error

    // Update local state
    const idx = entriesByBook.value[bookId].findIndex(e => e.id === entryId)
    if (idx !== -1) {
      entriesByBook.value[bookId][idx] = {
        ...entriesByBook.value[bookId][idx],
        leitnerBox: update.leitnerBox,
        nextReviewAt: update.nextReviewAt,
      }
    }
  }

  const wordOfTheDay = computed(() => {
    const all = Object.values(entriesByBook.value).flat()
    return useLeitner().getDueWord(all)
  })

  const allEntries = computed(() => Object.values(entriesByBook.value).flat())

  return { entriesByBook, allEntries, wordOfTheDay, fetchEntriesForBook, addEntry, updateLeitner }
})
