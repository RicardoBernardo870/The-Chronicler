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

  // ── saveOrder — optimistic update (019) ───────────────────────────────────
  // Apply the new order locally FIRST so the UI settles instantly (no snap-back),
  // then persist to Supabase in the background. On failure, revert to previousOrder
  // and re-throw so the caller can show a toast.

  const saveOrder = async (bookIds: string[]) => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    // Snapshot for revert on failure
    const previousOrder = [...upNextOrder.value]

    // Optimistic update — apply new order immediately to reactive state
    upNextOrder.value = bookIds.map((bookId, index) => {
      const existing = previousOrder.find(o => o.bookId === bookId)
      return existing
        ? { ...existing, sortPosition: index }
        : {
            id: '',
            userId: authStore.user!.id,
            bookId,
            sortPosition: index,
            updatedAt: new Date().toISOString(),
          }
    })

    const rows = bookIds.map((bookId, index) => ({
      user_id: authStore.user!.id,
      book_id: bookId,
      sort_position: index,
      updated_at: new Date().toISOString(),
    }))

    try {
      const { error } = await supabase
        .from('up_next_order')
        .upsert(rows, { onConflict: 'user_id,book_id' })
      if (error) throw error

      // Success — touch cache so next SWR cycle uses this order
      swrTouch(cacheKeys.upNext(authStore.user.id))
    } catch (err) {
      // Revert to previous order and propagate so caller shows a toast
      upNextOrder.value = previousOrder
      throw err
    }
  }

  const sortedBookIds = () => upNextOrder.value.map(o => o.bookId)

  return { upNextOrder, fetchOrder, saveOrder, sortedBookIds }
})
