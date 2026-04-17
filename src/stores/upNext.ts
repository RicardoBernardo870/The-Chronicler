import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { mapUpNextOrder, type UpNextOrder, type UpNextOrderRow } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { swrStatus, swrRun, swrTouch, registerRevalidator, cacheKeys } from '@/composables/useCache'

const TTL = 60_000 // 60 s

export const useUpNextStore = defineStore('upNext', () => {
  const upNextOrder = ref<UpNextOrder[]>([])

  const _fetcher = async () => {
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

  // ── SWR-aware fetchOrder (T009) ────────────────────────────────────────────

  const fetchOrder = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.upNext(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _fetcher).catch(() => {}))

    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') { swrRun(key, _fetcher).catch(() => {}); return }
    await swrRun(key, _fetcher)
  }

  // ── saveOrder with cache touch (T016) ─────────────────────────────────────

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

    // T016: refetch to get canonical server order + touch cache
    await _fetcher()
    swrTouch(cacheKeys.upNext(authStore.user.id))
  }

  const sortedBookIds = () => upNextOrder.value.map(o => o.bookId)

  return { upNextOrder, fetchOrder, saveOrder, sortedBookIds }
})
