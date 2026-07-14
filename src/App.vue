<template>
  <LoadingSpinner v-if="initializing" full-page label="Loading..." />
  <RouterView v-else />
  <ConfirmDialog :style="{ width: '90%' }" />
  <Toast position="bottom-center" :pt="{ root: { style: 'margin-bottom: var(--app-nav-bottom-clearance, 4rem); width: 280px' } }" />
  <LoreGenerationBanner />
  <GlassToast />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useProgressStore } from '@/stores/progress'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import LoreGenerationBanner from '@/components/lore/LoreGenerationBanner.vue'
import GlassToast from '@/components/shared/GlassToast.vue'

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
  // initialize() is idempotent — the router guard may have already resolved it;
  // this call returns the cached promise instantly in that case.
  await authStore.initialize()
  initializing.value = false
  progressStore.setupListeners()
  navigator.serviceWorker?.addEventListener('message', handleSwMessage)
})

onUnmounted(() => {
  authStore.dispose()
  progressStore.teardownListeners()
  navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
})
</script>
