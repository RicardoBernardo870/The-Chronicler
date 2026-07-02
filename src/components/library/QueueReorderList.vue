<script setup lang="ts">
// Queue reorder list — vertical drag list with handles, shared by the
// Library list and grid views' reorder modes. Same row anatomy the old
// dashboard Up Next list used (handle, thumb, title/author).
import draggable from 'vuedraggable'
import { coverFallback } from '@/utils/coverFallback'

export interface ReorderableBook {
  id: string
  title: string
  author: string | null
  coverUrl: string | null
}

const props = defineProps<{
  books: ReorderableBook[]
}>()

const emit = defineEmits<{
  'update:books': [newOrder: ReorderableBook[]]
}>()
</script>

<template>
  <draggable
    :model-value="props.books"
    item-key="id"
    handle=".queue-reorder__handle"
    :animation="150"
    ghost-class="queue-reorder__item--ghost"
    chosen-class="queue-reorder__item--chosen"
    tag="ul"
    class="queue-reorder"
    @update:model-value="(v: ReorderableBook[]) => emit('update:books', v)"
  >
    <template #item="{ element: book }">
      <li class="queue-reorder__item glass-subtle">
        <span class="queue-reorder__handle" title="Drag to reorder">⠿</span>
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="book.title"
          class="queue-reorder__thumb"
          @error="coverFallback"
        />
        <div v-else class="queue-reorder__thumb queue-reorder__thumb--placeholder">
          <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
        </div>
        <div class="queue-reorder__info">
          <span class="queue-reorder__title">{{ book.title }}</span>
          <span class="queue-reorder__author">{{ book.author }}</span>
        </div>
      </li>
    </template>
  </draggable>
</template>

<style scoped>
.queue-reorder {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.queue-reorder__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 12px;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.queue-reorder__item--chosen {
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
}

.queue-reorder__item--ghost {
  opacity: 0.45;
  transform: scale(0.985);
}

.queue-reorder__handle {
  font-size: 1.1rem;
  cursor: grab;
  opacity: 0.45;
  padding: 0 0.25rem;
  flex-shrink: 0;
  min-width: 28px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  /* Only the handle disables native touch gestures so the list itself
     remains scrollable on mobile. */
  touch-action: none;
}

.queue-reorder__handle:active { cursor: grabbing; }

.queue-reorder__handle:hover {
  opacity: 0.75;
}

.queue-reorder__thumb {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.queue-reorder__thumb--placeholder {
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.queue-reorder__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.queue-reorder__title {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-reorder__author {
  font-size: 0.78rem;
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .queue-reorder__item {
    transition: none;
  }

  .queue-reorder__item--ghost {
    transform: none;
  }
}
</style>
