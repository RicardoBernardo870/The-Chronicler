<script setup lang="ts">
// Compact "Completed" row — count, a small fan of recent covers, and a
// chevron into the Library archive. A destination link, not a daily surface.
import { computed } from 'vue'
import type { Book, ReadingProgress } from '@/types'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  books: Array<{ book: Book; progress: ReadingProgress }>
  overflow: number
}>()

const emit = defineEmits<{
  viewBook: [bookId: string]
  viewLibrary: []
}>()

const totalCount = computed(() => props.books.length + props.overflow)
</script>

<template>
  <button
    type="button"
    class="completed-row glass-surface"
    :aria-label="`${totalCount} completed ${totalCount === 1 ? 'book' : 'books'}. Open library.`"
    @click="emit('viewLibrary')"
  >
    <h3 class="completed-row__title">
      <i class="pi pi-check-circle" /> Completed
      <span class="completed-row__count">{{ totalCount }}</span>
    </h3>

    <span class="completed-row__covers" aria-hidden="true">
      <template v-for="item in books.slice(0, 3)" :key="item.book.id">
        <img
          v-if="item.book.coverUrl"
          :src="item.book.coverUrl"
          alt=""
          class="completed-row__cover"
          loading="lazy"
          @error="coverFallback"
        />
        <span v-else class="completed-row__cover completed-row__cover--placeholder">
          <i class="pi pi-book" style="font-size: 0.7rem; opacity: 0.35" />
        </span>
      </template>
    </span>

    <i class="pi pi-chevron-right completed-row__chevron" aria-hidden="true" />
  </button>
</template>

<style scoped>
.completed-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  margin: 0;
  padding: 0.85rem 1.25rem;
  border-radius: var(--p-border-radius-xl, 16px);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.completed-row:hover {
  opacity: 0.92;
}

.completed-row:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.completed-row__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 0;
}

.completed-row__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.completed-row__covers {
  display: flex;
  flex: none;
}

.completed-row__cover {
  width: 24px;
  height: 34px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.completed-row__cover:not(:first-child) {
  margin-left: -8px;
}

.completed-row__cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
}

.completed-row__chevron {
  flex: none;
  font-size: 0.75rem;
  opacity: 0.45;
}

:root[data-p-theme="light"] .completed-row__count {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.45);
  border-color: rgba(0, 0, 0, 0.08);
}

:root[data-p-theme="light"] .completed-row__cover {
  border-color: rgba(0, 0, 0, 0.1);
}

@media (prefers-reduced-motion: reduce) {
  .completed-row {
    transition: none;
  }
}
</style>
