import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapUpNextOrder, type UpNextOrder, type UpNextOrderRow } from '@/types'
import { useAuthStore } from '@/stores/auth'

export const useUpNextStore = defineStore('upNext', () => {
  const upNextOrder = ref<UpNextOrder[]>([])

  const fetchOrder = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase
      .from('up_next_order')
      .select('*')
      .eq('user_id', authStore.user.id)
      .order('sort_position', { ascending: true })
    if (error) throw error
    upNextOrder.value = (data as UpNextOrderRow[]).map(mapUpNextOrder)
  }

  const saveOrder = async (bookIds: string[]) => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const rows = bookIds.map((bookId, index) => ({
      user_id: authStore.user!.id,
      book_id: bookId,
      sort_position: index,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('up_next_order')
      .upsert(rows, { onConflict: 'user_id,book_id' })
    if (error) throw error
    // Optimistic local update
    await fetchOrder()
  }

  const sortedBookIds = () => upNextOrder.value.map(o => o.bookId)

  return { upNextOrder, fetchOrder, saveOrder, sortedBookIds }
})
