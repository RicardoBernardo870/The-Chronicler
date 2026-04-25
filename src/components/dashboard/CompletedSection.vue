<script setup lang="ts">
import type { Book, ReadingProgress } from '@/types'
import Tag from 'primevue/tag'
import { coverFallback } from '@/utils/coverFallback'

defineProps<{
  books: Array<{ book: Book; progress: ReadingProgress }>
  overflow: number
}>()

const emit = defineEmits<{
  viewBook: [bookId: string]
  viewLibrary: []
}>()
</script>

<template>
  <section class="completed glass-surface">
    <h3 class="completed__title">
      <i class="pi pi-check-circle" /> Completed
    </h3>
    <ul class="completed__list">
      <li
        v-for="item in books"
        :key="item.book.id"
        class="completed__item glass-subtle"
        @click="emit('viewBook', item.book.id)"
      >
        <img
          v-if="item.book.coverUrl"
          :src="item.book.coverUrl"
          :alt="item.book.title"
          class="completed__thumb"
          @error="coverFallback"
        />
        <div v-else class="completed__thumb completed__thumb--placeholder">
          <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
        </div>
        <div class="completed__info">
          <span class="completed__book-title">{{ item.book.title }}</span>
          <span class="completed__book-author">{{ item.book.author }}</span>
          <Tag severity="success" value="Finished" class="completed__badge" />
        </div>
      </li>
    </ul>

    <p v-if="overflow > 0" class="completed__overflow">
      <i class="pi pi-info-circle" />
      and {{ overflow }} more —
      <button class="completed__overflow-link" @click="emit('viewLibrary')">
        check your Library
      </button>
    </p>
  </section>
</template>

<style scoped>
.completed {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.completed__title {
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

.completed__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.completed__item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.completed__item:hover { opacity: 0.85; }

.completed__thumb {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.completed__thumb--placeholder {
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.completed__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.completed__book-title {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.completed__book-author {
  font-size: 0.78rem;
  opacity: 0.6;
}

.completed__badge {
  font-size: 0.72rem;
  font-weight: 600;
  margin-top: 0.2rem;
  align-self: flex-start;
}

.completed__overflow {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.completed__overflow-link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--p-indigo-300);
  font-size: inherit;
  font-weight: 600;
  text-decoration: underline;
}
</style>
