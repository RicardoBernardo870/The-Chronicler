<script setup lang="ts">
// Book hero — centered cover with details below (mirrors the add-book search
// detail layout) and a brief description clamped under the meta.
import { ref } from 'vue'
import type { Book } from '@/types'
import Chip from 'primevue/chip'
import { coverFallback } from '@/utils/coverFallback'

defineProps<{ book: Book }>()

const emit = defineEmits<{ coverError: [] }>()

const descExpanded = ref(false)
</script>

<template>
  <section class="book-header">
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
      <h1 class="book-header__title">{{ book.title }}</h1>
      <p class="book-header__author">{{ book.author }}</p>
      <div class="book-header__chips">
        <Chip v-if="book.genre" :label="book.genre" class="book-header__genre" />
        <span class="book-header__pages">{{ book.totalPages }} pages</span>
      </div>
    </div>

    <div v-if="book.description" class="book-header__desc-wrap">
      <p
        class="book-header__desc"
        :class="{ 'book-header__desc--clamped': !descExpanded }"
      >
        {{ book.description }}
      </p>
      <button
        type="button"
        class="book-header__desc-toggle"
        @click="descExpanded = !descExpanded"
      >
        {{ descExpanded ? 'Show less' : 'Read more' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.book-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 0.5rem 0.25rem 0;
}

.book-header__cover-wrap { flex-shrink: 0; }

.book-header__cover {
  width: 128px;
  height: 188px;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
}

.book-header__cover-placeholder {
  width: 128px;
  height: 188px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
}

.book-header__meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  text-align: center;
  min-width: 0;
}

.book-header__chips {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.2rem;
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
}

.book-header__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.3;
}

.book-header__author { margin: 0; font-size: 0.9rem; opacity: 0.8; }
.book-header__pages  { margin: 0; font-size: 0.8rem; opacity: 0.7; }

.book-header__desc-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
}

.book-header__desc {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.55;
  opacity: 0.75;
  text-align: left;
  white-space: pre-line;
}

.book-header__desc--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-header__desc-toggle {
  align-self: flex-start;
  padding-left: 0;
  margin: 0;
  padding: 0.15rem 0.5rem;
  border: none;
  background: none;
  color: var(--p-indigo-300);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
}

.book-header__desc-toggle:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
  border-radius: 6px;
}
</style>
