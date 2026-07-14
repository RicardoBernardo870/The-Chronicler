<script setup lang="ts">
import { computed } from 'vue'
import { useGlassToast } from '@/composables/useGlassToast'

const glassToast = useGlassToast()

const iconClass = computed(() => {
  switch (glassToast.variant.value) {
    case 'loading':
      return 'pi pi-spin pi-spinner glass-toast__icon--loading'
    case 'warn':
      return 'pi pi-exclamation-triangle glass-toast__icon--warn'
    default:
      return 'pi pi-check-circle glass-toast__icon--success'
  }
})
</script>

<template>
  <Transition name="glass-toast">
    <div
      v-if="glassToast.visible.value"
      class="glass-toast glass-surface"
      role="status"
      aria-live="polite"
      @click="glassToast.variant.value !== 'loading' && glassToast.dismiss()"
    >
      <i :key="glassToast.variant.value" class="glass-toast__icon" :class="iconClass" />
      <span class="glass-toast__text">
        <span class="glass-toast__summary">{{ glassToast.summary.value }}</span>
        <span v-if="glassToast.detail.value" class="glass-toast__detail">
          {{ glassToast.detail.value }}
        </span>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.glass-toast {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 0.85rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1210;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.75rem 1.3rem 0.75rem 1.05rem;
  border-radius: 999px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  max-width: calc(100vw - 2rem);
  cursor: pointer;
}

.glass-toast__icon {
  font-size: 1.35rem;
  flex-shrink: 0;
}

.glass-toast__icon--success {
  color: var(--p-green-400);
  animation: glass-toast-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glass-toast__icon--loading {
  color: var(--p-indigo-300);
}

.glass-toast__icon--warn {
  color: var(--p-amber-400);
  animation: glass-toast-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glass-toast__text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  line-height: 1.2;
  min-width: 0;
}

.glass-toast__summary {
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.glass-toast__detail {
  font-size: 0.78rem;
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 19rem;
}

@keyframes glass-toast-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.glass-toast-enter-active,
.glass-toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.glass-toast-enter-from,
.glass-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-0.5rem);
}
</style>
