<script setup lang="ts">
import type { Recommendation } from '@/types'
import Image from 'primevue/image'

const props = withDefaults(
  defineProps<{
    recommendations: Recommendation[]
    heading?: string
  }>(),
  { heading: 'You might also like' },
)

const emit = defineEmits<{
  select: [recommendation: Recommendation]
}>()
</script>

<template>
  <section v-if="props.recommendations.length > 0" class="rec-scroller">
    <h2 class="rec-scroller__title">{{ props.heading }}</h2>

    <!-- Horizontal side-scroller (Goodreads-style). A native scroll container is
         the right primitive here; no PrimeVue component covers it. -->
    <div class="rec-scroller__track">
      <button
        v-for="rec in props.recommendations"
        :key="rec.key"
        type="button"
        class="rec-poster"
        @click="emit('select', rec)"
      >
        <div class="rec-poster__cover">
          <Image
            v-if="rec.coverUrl"
            :src="rec.coverUrl"
            :alt="`Cover of ${rec.title}`"
            :preview="false"
            image-class="rec-poster__cover-img"
          />
          <i v-else class="pi pi-book rec-poster__cover-placeholder" />
        </div>
        <span class="rec-poster__title">{{ rec.title }}</span>
        <span v-if="rec.author" class="rec-poster__author">{{ rec.author }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.rec-scroller {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.rec-scroller__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.rec-scroller__track {
  display: flex;
  gap: 0.85rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.rec-scroller__track::-webkit-scrollbar {
  height: 6px;
}

.rec-scroller__track::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
}

.rec-poster {
  flex: 0 0 auto;
  width: 104px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  scroll-snap-align: start;
}

.rec-poster__cover {
  width: 104px;
  height: 156px;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.rec-poster:hover .rec-poster__cover {
  transform: translateY(-3px);
}

.rec-poster__cover :deep(.p-image),
.rec-poster__cover :deep(.p-image img),
.rec-poster__cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rec-poster__cover-placeholder {
  font-size: 1.5rem;
  opacity: 0.35;
}

.rec-poster__title {
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rec-poster__author {
  font-size: 0.72rem;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
