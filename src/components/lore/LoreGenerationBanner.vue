<script setup lang="ts">
import { computed } from 'vue'
import { useLoreCardsStore } from '@/stores/loreCards'
import { useBooksStore } from '@/stores/books'

const loreStore  = useLoreCardsStore()
const booksStore = useBooksStore()

// Pick the first generating book's title (usually only one at a time).
const bookTitle = computed<string | null>(() => {
  // Pinia setup stores auto-unwrap ref<Set>; iterate directly.
  const iter = loreStore.generatingBookIds?.values()
  const first = iter?.next().value
  if (!first) return null
  const book = booksStore.bookById(first)
  return book?.title ?? null
})
</script>

<template>
  <Transition name="lore-banner">
    <div v-if="loreStore.isGenerating" class="lore-banner glass-surface" role="status" aria-live="polite">
      <span class="lore-banner__dot" />
      <span class="lore-banner__text">
        <span class="lore-banner__label">Chronicler is weaving new lore</span>
        <span v-if="bookTitle" class="lore-banner__book">{{ bookTitle }}</span>
      </span>
      <i class="pi pi-sparkles lore-banner__icon" />
    </div>
  </Transition>
</template>

<style scoped>
.lore-banner {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 0.75rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.95rem;
  border-radius: 999px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  max-width: calc(100vw - 2rem);
  pointer-events: none;
}

.lore-banner__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--p-violet-400);
  box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55);
  animation: lore-pulse 1.6s ease-out infinite;
  flex-shrink: 0;
}

.lore-banner__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
  min-width: 0;
}

.lore-banner__label {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.lore-banner__book {
  font-size: 0.7rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 16rem;
}

.lore-banner__icon {
  font-size: 0.85rem;
  opacity: 0.7;
  color: var(--p-violet-400);
  flex-shrink: 0;
}

@keyframes lore-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0.55); }
  70%  { box-shadow: 0 0 0 10px rgba(167, 139, 250, 0); }
  100% { box-shadow: 0 0 0 0 rgba(167, 139, 250, 0); }
}

.lore-banner-enter-active,
.lore-banner-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.lore-banner-enter-from,
.lore-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-0.5rem);
}
</style>
