<script setup lang="ts">
import type { Book } from '@/types'
import Chip from 'primevue/chip'
import { coverFallback } from '@/utils/coverFallback'

defineProps<{ book: Book }>()

const emit = defineEmits<{ coverError: [] }>()
</script>

<template>
  <section class="book-header glass-surface">
    <div class="book-header__cover-wrap">
      <img
        v-if="book.coverUrl"
        :src="book.coverUrl"
        :alt="`Cover of ${book.title}`"
        class="book-header__cover"
        @error="(e) => { coverFallback(e); emit('coverError') }"
      />
      <div v-else class="book-header__cover-placeholder">
        <i class="pi pi-book" style="font-size: 3rem; opacity: 0.4" />
      </div>
    </div>

    <div class="book-header__meta">
      <Chip v-if="book.genre" :label="book.genre" class="book-header__genre" />
      <h1 class="book-header__title">{{ book.title }}</h1>
      <p class="book-header__author">{{ book.author }}</p>
      <p class="book-header__pages">{{ book.totalPages }} pages</p>
    </div>
  </section>
</template>

<style scoped>
.book-header {
  display: flex;
  gap: 1.25rem;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  align-items: flex-start;
}

.book-header__cover-wrap { flex-shrink: 0; }

.book-header__cover {
  width: 96px;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.book-header__cover-placeholder {
  width: 96px;
  height: 140px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
}

.book-header__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-header__genre {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
  margin-bottom: 0.25rem;
}

.book-header__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.3;
}

.book-header__author { margin: 0; font-size: 0.9rem; }
.book-header__pages  { margin: 0; font-size: 0.8rem; opacity: 0.7; }
</style>
