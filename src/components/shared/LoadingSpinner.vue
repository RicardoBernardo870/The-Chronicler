<template>
  <div class="loading-spinner" :class="{ 'loading-spinner--fullpage': fullPage }">
    <ProgressSpinner
      :style="{ width: size, height: size }"
      stroke-width="3"
      animation-duration=".8s"
    />
    <p v-if="label" class="loading-spinner__label">{{ label }}</p>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'

withDefaults(defineProps<{
  size?: string
  label?: string
  fullPage?: boolean
}>(), {
  size: '40px',
  label: '',
  fullPage: false,
})
</script>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
}

.loading-spinner--fullpage {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.loading-spinner__label {
  font-size: 0.875rem;
  opacity: 0.6;
  letter-spacing: 0.02em;
}
</style>
