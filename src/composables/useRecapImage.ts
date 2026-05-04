import { computed, onUnmounted, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { supabase } from '@/services/supabase'
import type { RecapImageStatus } from '@/types'

interface UseRecapImageInput {
  recapId: MaybeRefOrGetter<string>
  imageStatus: MaybeRefOrGetter<RecapImageStatus>
  imagePath: MaybeRefOrGetter<string | null>
}

export const useRecapImage = (input: UseRecapImageInput) => {
  const currentStatus = ref<RecapImageStatus>(toValue(input.imageStatus))
  const currentPath = ref<string | null>(toValue(input.imagePath))
  const signedUrl = ref<string | null>(null)
  const isLoading = computed(() => currentStatus.value === 'pending')
  let channel: ReturnType<typeof supabase.channel> | null = null
  let pollTimer: ReturnType<typeof window.setTimeout> | null = null

  const clearPoll = () => {
    if (!pollTimer) return
    window.clearTimeout(pollTimer)
    pollTimer = null
  }

  const refreshSignedUrl = async () => {
    if (currentStatus.value !== 'succeeded' || !currentPath.value) {
      signedUrl.value = null
      return
    }

    const { data, error } = await supabase.storage
      .from('recap-images')
      .createSignedUrl(currentPath.value, 60)

    if (error) {
      signedUrl.value = null
      return
    }
    signedUrl.value = data.signedUrl
  }

  const applyRowState = (row: { image_status?: RecapImageStatus | null; image_path?: string | null }) => {
    currentStatus.value = row.image_status ?? 'skipped'
    currentPath.value = row.image_path ?? null
    refreshSignedUrl().catch(() => {
      signedUrl.value = null
    })
  }

  const refreshFromDatabase = async (recapId: string) => {
    const { data, error } = await supabase
      .from('recaps')
      .select('image_status,image_path')
      .eq('id', recapId)
      .single()

    if (error || !data) return
    applyRowState(data as { image_status: RecapImageStatus | null; image_path: string | null })
  }

  const schedulePendingPoll = (recapId: string) => {
    clearPoll()
    if (currentStatus.value !== 'pending') return

    pollTimer = window.setTimeout(async () => {
      await refreshFromDatabase(recapId)
      schedulePendingPoll(recapId)
    }, 2000)
  }

  const unsubscribe = () => {
    if (!channel) return
    supabase.removeChannel(channel)
    channel = null
  }

  watch(
    () => [toValue(input.imageStatus), toValue(input.imagePath)] as const,
    ([status, path]) => {
      currentStatus.value = status
      currentPath.value = path
      refreshSignedUrl().catch(() => {
        signedUrl.value = null
      })
    },
    { immediate: true },
  )

  watch(
    () => toValue(input.recapId),
    (recapId) => {
      unsubscribe()
      clearPoll()
      channel = supabase
        .channel(`recap-image:${recapId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'recaps', filter: `id=eq.${recapId}` },
          (payload) => {
            applyRowState(payload.new as { image_status?: RecapImageStatus | null; image_path?: string | null })
            schedulePendingPoll(recapId)
          },
        )
        .subscribe()
      refreshFromDatabase(recapId).then(() => {
        schedulePendingPoll(recapId)
      }).catch(() => {
        schedulePendingPoll(recapId)
      })
    },
    { immediate: true },
  )

  onUnmounted(() => {
    clearPoll()
    unsubscribe()
  })

  return {
    imageStatus: computed(() => currentStatus.value),
    imagePath: computed(() => currentPath.value),
    signedUrl,
    isLoading,
  }
}
