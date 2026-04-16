<template>
  <LoadingSpinner v-if="initializing" full-page label="Loading..." />
  <RouterView v-else />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const authStore = useAuthStore()
const progressStore = useProgressStore()
const initializing = ref(true)

// Flush offline queue when the service worker signals reconnect
function handleSwMessage(event: MessageEvent) {
  if (event.data?.type === 'FLUSH_PROGRESS_QUEUE') {
    progressStore.drainQueue()
  }
}

onMounted(async () => {
  await authStore.initialize()
  initializing.value = false
  progressStore.setupListeners()
  navigator.serviceWorker?.addEventListener('message', handleSwMessage)
})

onUnmounted(() => {
  progressStore.teardownListeners()
  navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
})
</script>
