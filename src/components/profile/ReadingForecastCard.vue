<script setup lang="ts">
import { computed } from 'vue'
import { Message } from 'primevue'
import { useReadingForecast } from '@/composables/useReadingForecast'

const {
  hasForecast,
  windowDays,
  averageBookPages,
  pagesPerMonth,
  booksPerMonth,
  booksPerYear,
} = useReadingForecast()

const yearlyLabel = computed(() => {
  const value = booksPerYear.value
  if (value >= 10) return Math.round(value).toString()
  return value.toFixed(1)
})

const monthlyLabel = computed(() => {
  const value = booksPerMonth.value
  if (value >= 10) return Math.round(value).toString()
  return value.toFixed(1)
})
</script>

<template>
  <section class="reading-forecast glass-surface">
    <div class="reading-forecast__header">
      <h2 class="reading-forecast__title">
        <i class="pi pi-compass" />
        Reading Forecast
      </h2>
      <span v-if="hasForecast" class="reading-forecast__window">
        {{ windowDays }}d pace
      </span>
    </div>

    <Message v-if="!hasForecast" severity="info" class="reading-forecast__empty">
      Keep logging page progress to unlock your reading forecast.
    </Message>

    <div v-else class="reading-forecast__content">
      <div class="reading-forecast__hero">
        <span class="reading-forecast__value">~{{ yearlyLabel }}</span>
        <span class="reading-forecast__unit">books / year</span>
      </div>

      <p class="reading-forecast__copy">
        At this pace, based on an average book length of {{ averageBookPages }} pages.
      </p>

      <div class="reading-forecast__metrics">
        <div class="reading-forecast__metric glass-subtle">
          <span class="reading-forecast__metric-value">{{ pagesPerMonth }}</span>
          <span class="reading-forecast__metric-label">pages / month</span>
        </div>
        <div class="reading-forecast__metric glass-subtle">
          <span class="reading-forecast__metric-value">~{{ monthlyLabel }}</span>
          <span class="reading-forecast__metric-label">books / month</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.reading-forecast {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reading-forecast__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.reading-forecast__title {
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

.reading-forecast__title .pi {
  font-size: 0.8rem;
}

.reading-forecast__window {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.16);
  border: 1px solid rgba(99, 102, 241, 0.22);
}

.reading-forecast__empty {
  width: 100%;
}

.reading-forecast__content {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.reading-forecast__hero {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.reading-forecast__value {
  font-size: 2rem;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0;
}

.reading-forecast__unit {
  font-size: 0.88rem;
  font-weight: 700;
  opacity: 0.65;
}

.reading-forecast__copy {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  opacity: 0.58;
}

.reading-forecast__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.reading-forecast__metric {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.reading-forecast__metric-value {
  font-size: 1.25rem;
  line-height: 1.1;
  font-weight: 750;
}

.reading-forecast__metric-label {
  font-size: 0.7rem;
  opacity: 0.55;
  font-weight: 500;
}

:root[data-p-theme='light'] .reading-forecast__window {
  color: var(--p-indigo-600);
  background: rgba(99, 102, 241, 0.1);
}
</style>
