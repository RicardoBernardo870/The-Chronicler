<template>
  <LoadingSpinner v-if="initializing" full-page label="Loading..." />
  <RouterView v-else />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const authStore = useAuthStore()
const initializing = ref(true)

onMounted(async () => {
  await authStore.initialize()
  initializing.value = false
})
</script>
