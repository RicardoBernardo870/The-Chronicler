<script setup lang="ts">
import type { BookSearchResult } from '@/types'
import Image from 'primevue/image'

// A selectable result row. Implemented as a native <button> (a structural
// primitive with no dedicated PrimeVue equivalent for a custom media row);
// covers Constitution VI's "no PrimeVue component covers the requirement".
const props = defineProps<{
  result: BookSearchResult
}>()

const emit = defineEmits<{
  select: [result: BookSearchResult]
}>()
</script>

<template>
  <button type="button" class="result-card glass-subtle" @click="emit('select', props.result)">
    <div class="result-card__cover">
      <Image
        v-if="result.coverUrl"
        :src="result.coverUrl"
        :alt="`Cover of ${result.title}`"
        :preview="false"
        image-class="result-card__cover-img"
      />
      <i v-else class="pi pi-book result-card__cover-placeholder" />
    </div>

    <div class="result-card__meta">
      <span class="result-card__title">{{ result.title }}</span>
      <span v-if="result.author" class="result-card__author">{{ result.author }}</span>
      <span v-if="result.firstPublishYear" class="result-card__year">
        {{ result.firstPublishYear }}
      </span>
    </div>

    <i class="pi pi-chevron-right result-card__chevron" />
  </button>
</template>

<style scoped>
.result-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.75rem;
  border: 0;
  border-radius: 12px;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.result-card__cover {
  flex: 0 0 auto;
  width: 44px;
  height: 64px;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
}

.result-card__cover :deep(.p-image),
.result-card__cover :deep(.p-image img),
.result-card__cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.result-card__cover-placeholder {
  font-size: 1.25rem;
  opacity: 0.4;
}

.result-card__meta {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.result-card__title {
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-card__author {
  font-size: 0.82rem;
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-card__year {
  font-size: 0.75rem;
  opacity: 0.5;
}

.result-card__chevron {
  flex: 0 0 auto;
  opacity: 0.4;
  font-size: 0.8rem;
}
</style>
