<script setup lang="ts">
import type { Book } from '@/types'
import draggable from 'vuedraggable'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  books: Book[]
}>()

const emit = defineEmits<{
  'update:books': [newOrder: Book[]]
  select: [bookId: string]
}>()
</script>

<template>
  <section class="up-next glass-surface">
    <h3 class="up-next__title">
      <i class="pi pi-clock" /> Up Next
    </h3>
    <draggable
      :model-value="props.books"
      item-key="id"
      handle=".up-next__handle"
      :animation="150"
      ghost-class="up-next__item--ghost"
      chosen-class="up-next__item--chosen"
      tag="ul"
      class="up-next__list"
      @update:model-value="(v: Book[]) => emit('update:books', v)"
    >
      <template #item="{ element: book }">
        <li
          class="up-next__item glass-subtle"
          role="button"
          tabindex="0"
          :aria-label="`Make ${book.title} the active read`"
          @click="emit('select', book.id)"
          @keydown.enter="emit('select', book.id)"
        >
          <span class="up-next__handle" @click.stop title="Drag to reorder">⠿</span>
          <img
            v-if="book.coverUrl"
            :src="book.coverUrl"
            :alt="book.title"
            class="up-next__thumb"
            @error="coverFallback"
          />
          <div v-else class="up-next__thumb up-next__thumb--placeholder">
            <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
          </div>
          <div class="up-next__info">
            <span class="up-next__book-title">{{ book.title }}</span>
            <span class="up-next__book-author">{{ book.author }}</span>
          </div>
        </li>
      </template>
    </draggable>
  </section>
</template>

<style scoped>
.up-next {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 434px;
  overflow: auto;
}

.up-next__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.up-next__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.up-next__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.up-next__item:hover {
  opacity: 0.92;
  transform: translateX(2px);
}

.up-next__item:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.up-next__item--chosen {
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
}

.up-next__item--ghost {
  opacity: 0.45;
  transform: scale(0.985);
}

.up-next__handle {
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
  /* Only the handle disables native touch gestures so the card itself
     remains scrollable on mobile. */
  touch-action: none;
}

.up-next__handle:active { cursor: grabbing; }

.up-next__handle:hover {
  opacity: 0.75;
}

.up-next__thumb {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.up-next__thumb--placeholder {
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.up-next__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.up-next__book-title {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.up-next__book-author {
  font-size: 0.78rem;
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .up-next__item {
    transition: none;
  }

  .up-next__item:hover,
  .up-next__item--ghost {
    transform: none;
  }
}
</style>
