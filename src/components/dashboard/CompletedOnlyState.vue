<script setup lang="ts">
import type { Book } from '@/types'
import Button from 'primevue/button'

const props = defineProps<{
  books: Book[]
  count: number
}>()

const emit = defineEmits<{
  addBook: []
  viewBook: [bookId: string]
  viewLibrary: []
}>()
</script>

<template>
  <section class="completed-only glass-surface">
    <div class="completed-only__header">
      <div class="completed-only__icon">
        <i class="pi pi-check-circle" />
      </div>
      <div>
        <p class="completed-only__eyebrow">Library started</p>
        <h2 class="completed-only__title">
          {{ props.count }} completed {{ props.count === 1 ? 'book' : 'books' }}
        </h2>
      </div>
    </div>

    <p class="completed-only__description">
      Your archive is in place. Add a current read when you are ready to track sessions and recaps.
    </p>

    <ul v-if="props.books.length" class="completed-only__list">
      <li v-for="book in props.books" :key="book.id">
        <button type="button" class="completed-only__book" @click="emit('viewBook', book.id)">
          <span>{{ book.title }}</span>
          <i class="pi pi-arrow-right" />
        </button>
      </li>
    </ul>

    <div class="completed-only__actions">
      <Button label="Add current read" icon="pi pi-plus" @click="emit('addBook')" />
      <Button label="View library" icon="pi pi-list" outlined @click="emit('viewLibrary')" />
    </div>
  </section>
</template>

<style scoped>
.completed-only {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.completed-only__header {
  display: flex;
  gap: 0.85rem;
  align-items: center;
}

.completed-only__icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: var(--p-green-400);
  background: color-mix(in srgb, var(--p-green-400) 14%, transparent);
  flex-shrink: 0;
}

.completed-only__eyebrow,
.completed-only__description {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.completed-only__eyebrow {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
}

.completed-only__title {
  margin: 0.15rem 0 0;
  font-size: 1.2rem;
}

.completed-only__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.completed-only__book {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.045);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.completed-only__book span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.completed-only__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
</style>
