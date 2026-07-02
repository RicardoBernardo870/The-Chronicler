<script setup lang="ts">
// Up Next shelf — horizontal covers, tap to make a book the active read.
// Queue reordering lives on the Library page.
import type { Book } from '@/types'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  books: Book[]
}>()

const emit = defineEmits<{
  select: [bookId: string]
}>()
</script>

<template>
  <section class="up-next glass-surface">
    <h3 class="up-next__title">
      <i class="pi pi-clock" /> Up Next
      <span class="up-next__count">{{ props.books.length }}</span>
    </h3>

    <div class="up-next__shelf">
      <button
        v-for="book in props.books"
        :key="book.id"
        type="button"
        class="up-next__shelf-item"
        :aria-label="`Make ${book.title} the active read`"
        @click="emit('select', book.id)"
      >
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="book.title"
          class="up-next__shelf-cover"
          loading="lazy"
          @error="coverFallback"
        />
        <div v-else class="up-next__shelf-cover up-next__shelf-cover--placeholder">
          <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
        </div>
        <span class="up-next__shelf-title">{{ book.title }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.up-next {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
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

.up-next__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.up-next__shelf {
  display: flex;
  gap: 0.625rem;
  overflow-x: auto;
  padding: 0.125rem 0.125rem 0.375rem;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.up-next__shelf::-webkit-scrollbar {
  display: none;
}

.up-next__shelf-item {
  flex: none;
  width: 76px;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  scroll-snap-align: start;
}

.up-next__shelf-item:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
  border-radius: 7px;
}

.up-next__shelf-cover {
  display: block;
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 7px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.up-next__shelf-cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
}

.up-next__shelf-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.25;
  opacity: 0.8;
}

:root[data-p-theme="light"] .up-next__count {
  background: rgba(99, 102, 241, 0.1);
  color: var(--p-indigo-600);
}
</style>
