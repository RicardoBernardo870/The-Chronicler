<script setup lang="ts">
import { useGlassToast } from '@/composables/useGlassToast'

const glassToast = useGlassToast()
</script>

<template>
  <Transition name="glass-toast">
    <div
      v-if="glassToast.visible.value"
      class="glass-toast glass-surface"
      role="status"
      aria-live="polite"
      @click="glassToast.dismiss"
    >
      <i class="pi pi-check-circle glass-toast__icon" />
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
  top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1210;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 1.05rem 0.55rem 0.85rem;
  border-radius: 999px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  max-width: calc(100vw - 2rem);
  cursor: pointer;
}

.glass-toast__icon {
  font-size: 1.05rem;
  color: var(--p-green-400);
  flex-shrink: 0;
  animation: glass-toast-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glass-toast__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.glass-toast__summary {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.glass-toast__detail {
  font-size: 0.7rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 16rem;
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
