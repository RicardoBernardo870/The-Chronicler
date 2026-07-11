<script setup lang="ts">
// "Your year" — 12 bars of pages read per month with a year selector.
// Tap a bar for that month's detail (pages + books finished). Hand-rolled
// bars (no chart lib): divs sized against the year's max, indigo on glass.
import { computed, onMounted, ref, watch } from 'vue'
import { Button, Skeleton } from 'primevue'
import { useMonthlyReading } from '@/composables/useMonthlyReading'

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const { fetchYear, pointsFor, hasYear, loading } = useMonthlyReading()

const currentYear = new Date().getFullYear()
const year = ref(currentYear)
const selectedMonth = ref<number | null>(null)

const points = computed(() => pointsFor(year.value))
const maxPages = computed(() =>
  Math.max(1, ...points.value.map((p) => p.pages)),
)
const totalPages = computed(() =>
  points.value.reduce((sum, p) => sum + p.pages, 0),
)
const totalBooks = computed(() =>
  points.value.reduce((sum, p) => sum + p.booksFinished, 0),
)
const yearLoaded = computed(() => hasYear(year.value))

const selected = computed(() =>
  selectedMonth.value === null
    ? null
    : (points.value.find((p) => p.month === selectedMonth.value) ?? null),
)

const barHeight = (pages: number): string =>
  pages === 0 ? '3px' : `${Math.max(6, Math.round((pages / maxPages.value) * 100))}%`

const shiftYear = (delta: number) => {
  year.value += delta
  selectedMonth.value = null
}

const selectMonth = (month: number) => {
  selectedMonth.value = selectedMonth.value === month ? null : month
}

onMounted(() => void fetchYear(year.value))
watch(year, (y) => void fetchYear(y))
</script>

<template>
  <section class="monthly-chart glass-surface" aria-label="Pages read per month">
    <header class="monthly-chart__header">
      <h2 class="monthly-chart__title">
        <i class="pi pi-chart-bar" aria-hidden="true" />
        {{ year }}
      </h2>
      <div class="monthly-chart__nav">
        <Button
          icon="pi pi-chevron-left"
          text
          rounded
          size="small"
          aria-label="Previous year"
          @click="shiftYear(-1)"
        />
        <Button
          icon="pi pi-chevron-right"
          text
          rounded
          size="small"
          aria-label="Next year"
          :disabled="year >= currentYear"
          @click="shiftYear(1)"
        />
      </div>
    </header>

    <div v-if="!yearLoaded && loading" class="monthly-chart__skeleton">
      <Skeleton height="8rem" border-radius="10px" />
    </div>

    <template v-else>
      <div class="monthly-chart__bars">
        <button
          v-for="p in points"
          :key="p.month"
          type="button"
          class="monthly-chart__col"
          :aria-label="`${MONTH_NAMES[p.month - 1]}: ${p.pages} pages, ${p.booksFinished} books finished`"
          @click="selectMonth(p.month)"
        >
          <span class="monthly-chart__bar-track">
            <span
              class="monthly-chart__bar"
              :class="{ 'monthly-chart__bar--selected': p.month === selectedMonth }"
              :style="{ height: barHeight(p.pages) }"
            />
          </span>
          <span
            class="monthly-chart__month"
            :class="{ 'monthly-chart__month--selected': p.month === selectedMonth }"
          >
            {{ MONTH_LABELS[p.month - 1] }}
          </span>
        </button>
      </div>

      <p v-if="selected" class="monthly-chart__detail">
        <span class="monthly-chart__detail-month">{{ MONTH_NAMES[selected.month - 1] }}</span>
        · {{ selected.pages.toLocaleString() }} {{ selected.pages === 1 ? 'page' : 'pages' }}
        · {{ selected.booksFinished }} {{ selected.booksFinished === 1 ? 'book finished' : 'books finished' }}
      </p>
      <p v-else class="monthly-chart__summary">
        {{ totalPages.toLocaleString() }} pages · {{ totalBooks }}
        {{ totalBooks === 1 ? 'book finished' : 'books finished' }} in {{ year }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.monthly-chart {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1rem;
}

.monthly-chart__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.monthly-chart__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.monthly-chart__title .pi {
  color: var(--p-primary-color);
  font-size: 0.85rem;
}

.monthly-chart__nav {
  display: flex;
  gap: 0.1rem;
}

.monthly-chart__bars {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 0.25rem;
  height: 8.5rem;
}

.monthly-chart__col {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.3rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.monthly-chart__col:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
  border-radius: 6px;
}

.monthly-chart__bar-track {
  flex: 1;
  display: flex;
  align-items: flex-end;
}

.monthly-chart__bar {
  display: block;
  width: 100%;
  border-radius: 4px 4px 2px 2px;
  background: rgba(99, 102, 241, 0.35);
  transition: height 0.3s ease, background 0.15s ease;
}

.monthly-chart__bar--selected {
  background: var(--p-primary-color);
}

.monthly-chart__month {
  font-size: 0.6rem;
  font-weight: 700;
  text-align: center;
  opacity: 0.45;
}

.monthly-chart__month--selected {
  color: var(--p-indigo-300);
  opacity: 1;
}

.monthly-chart__detail,
.monthly-chart__summary {
  margin: 0;
  font-size: 0.78rem;
  text-align: center;
  color: var(--p-text-muted-color);
}

.monthly-chart__detail-month {
  font-weight: 700;
  color: var(--p-text-color);
}

@media (prefers-reduced-motion: reduce) {
  .monthly-chart__bar {
    transition: none;
  }
}
</style>
