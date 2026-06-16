<script setup lang="ts">
import { computed } from 'vue'
import type { BookDetailDraft } from '@/types'
import Image from 'primevue/image'

const props = defineProps<{
  draft: BookDetailDraft
}>()

// A readable metadata line (Goodreads-style), e.g. "416 pages · ISBN 978…".
const metaLine = computed(() => {
  const parts: string[] = []
  if (props.draft.totalPages) parts.push(`${props.draft.totalPages} pages`)
  if (props.draft.isbn) parts.push(`ISBN ${props.draft.isbn}`)
  return parts.join('  ·  ')
})
</script>

<template>
  <section class="book-hero">
    <div class="book-hero__cover-frame">
      <Image
        v-if="draft.coverUrl"
        :src="draft.coverUrl"
        :alt="`Cover of ${draft.title}`"
        image-class="book-hero__cover-img"
        preview
      />
      <div v-else class="book-hero__cover-placeholder">
        <i class="pi pi-book" style="font-size: 2.75rem; opacity: 0.4" />
      </div>
    </div>

    <div class="book-hero__meta">
      <span v-if="draft.genre" class="book-hero__genre">{{ draft.genre }}</span>
      <h1 class="book-hero__title">{{ draft.title || 'Untitled' }}</h1>
      <p class="book-hero__author">{{ draft.author }}</p>
      <p v-if="metaLine" class="book-hero__detail">{{ metaLine }}</p>
    </div>
  </section>
</template>

<style scoped>
.book-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
}

.book-hero__cover-frame {
  width: 150px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}

.book-hero__cover-frame :deep(.p-image),
.book-hero__cover-frame :deep(.p-image img),
.book-hero__cover-img {
  display: block;
  width: 100%;
  height: auto;
}

.book-hero__cover-placeholder {
  width: 100%;
  height: 225px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
}

.book-hero__meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.book-hero__genre {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  margin-bottom: 0.15rem;
}

.book-hero__title {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  line-height: 1.25;
}

.book-hero__author {
  margin: 0;
  font-size: 0.95rem;
  color: var(--p-text-color);
  opacity: 0.85;
}

.book-hero__detail {
  margin: 0.1rem 0 0;
  font-size: 0.82rem;
  color: var(--p-text-muted-color);
}
</style>
