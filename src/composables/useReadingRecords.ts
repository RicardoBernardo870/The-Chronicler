import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { type ReadingRecords } from '@/types'
import {
  swrStatus,
  swrRun,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

/**
 * Personal records via the get_reading_records RPC — best-day pages, longest
 * session, fastest finish, night-owl flag. Timezone-aware (same convention
 * as the reading calendar). Feeds the RecordsCard on the Stats page and the
 * record-based achievement conditions in the Trophy Room.
 */

const RECORDS_TTL = 120_000 // 120 s

// Module-level singleton refs — survive Vue component remounts so the SWR
// 'fresh' early-return doesn't leave a remounted component with a null ref.
const _records = ref<ReadingRecords | null>(null)
const _loaded = ref(false)

export const useReadingRecords = () => {
  const records = _records
  const loaded = _loaded

  const _recordsFetcher = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return
    const { data, error } = await supabase.rpc('get_reading_records', {
      p_user_id: authStore.user.id,
      p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (error) throw error
    records.value = data as ReadingRecords
    loaded.value = true
  }

  const fetchRecords = async () => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.readingRecords(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _recordsFetcher).catch(() => {}))

    const status = swrStatus(key, RECORDS_TTL)
    if (status === 'fresh') return

    if (status === 'background') {
      swrRun(key, _recordsFetcher).catch(() => { /* silent */ })
      return
    }

    // 'loading' — first fetch
    await swrRun(key, _recordsFetcher)
  }

  return { records, loaded, fetchRecords }
}
