<script setup lang="ts">
import Carousel from 'primevue/carousel'
import CompletedRecapImageSlide from '@/components/recap/CompletedRecapImageSlide.vue'
import type { Recap } from '@/types'

defineProps<{
  recaps: Recap[]
}>()
</script>

<template>
  <section v-if="recaps.length > 0" class="completed-recap-carousel glass-surface" aria-labelledby="completed-recap-carousel-title">
    <div class="completed-recap-carousel__header">
      <h2 id="completed-recap-carousel-title" class="completed-recap-carousel__title">
        Recap Gallery
      </h2>
      <span class="completed-recap-carousel__count">{{ recaps.length }}</span>
    </div>

    <Carousel
      :value="recaps"
      :num-visible="1"
      :num-scroll="1"
      :circular="recaps.length > 1"
      :show-indicators="recaps.length > 1"
      class="completed-recap-carousel__carousel"
    >
      <template #item="{ data }">
        <CompletedRecapImageSlide :recap="data" />
      </template>
    </Carousel>
  </section>
</template>

<style scoped>
.completed-recap-carousel {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.completed-recap-carousel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.completed-recap-carousel__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.completed-recap-carousel__count {
  min-width: 1.75rem;
  height: 1.75rem;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
  color: var(--p-primary-color);
  font-size: 0.8rem;
  font-weight: 700;
}

.completed-recap-carousel__carousel {
  --p-carousel-indicator-width: 0.5rem;
  --p-carousel-indicator-height: 0.5rem;
}

.completed-recap-carousel :deep(.p-carousel-content) {
  gap: 0.75rem;
}

.completed-recap-carousel :deep(.p-carousel-item) {
  padding: 0 0.15rem;
}

.completed-recap-carousel :deep(.p-carousel-prev-button),
.completed-recap-carousel :deep(.p-carousel-next-button) {
  width: 2rem;
  height: 2rem;
}
</style>
