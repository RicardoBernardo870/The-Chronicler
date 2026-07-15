<script setup lang="ts">
// Personal records — best day, longest session, fastest finish (RPC) plus
// the all-time longest streak (already on get_reading_stats). Hidden until
// at least one record exists.
import { computed, onMounted } from 'vue'
import { useReadingRecords } from '@/composables/useReadingRecords'
import { useReadingProfile } from '@/composables/useReadingProfile'
import { formatShortDate } from '@/utils/date'

const { records, fetchRecords } = useReadingRecords()
const { longestStreak } = useReadingProfile()

onMounted(() => { void fetchRecords() })

const sessionLabel = computed(() => {
  const minutes = records.value?.longestSession?.minutes ?? 0
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
})

const hasAny = computed(() =>
  Boolean(
    records.value?.bestDay ||
    records.value?.longestSession ||
    records.value?.fastestFinish ||
    longestStreak.value > 0,
  ),
)
</script>

<template>
  <section v-if="hasAny" class="records glass-surface" aria-label="Personal records">
    <h2 class="records__title">
      <i class="pi pi-star" aria-hidden="true" /> Personal Records
    </h2>

    <div class="records__grid">
      <div v-if="records?.bestDay" class="records__tile glass-subtle">
        <span class="records__value">{{ records.bestDay.pages.toLocaleString() }} pages</span>
        <span class="records__label">Best day</span>
        <span class="records__meta">{{ formatShortDate(records.bestDay.date) }}</span>
      </div>

      <div v-if="records?.longestSession" class="records__tile glass-subtle">
        <span class="records__value">{{ sessionLabel }}</span>
        <span class="records__label">Longest session</span>
        <span class="records__meta">{{ formatShortDate(records.longestSession.date) }}</span>
      </div>

      <div v-if="records?.fastestFinish" class="records__tile glass-subtle">
        <span class="records__value">
          {{ records.fastestFinish.days }} {{ records.fastestFinish.days === 1 ? 'day' : 'days' }}
        </span>
        <span class="records__label">Fastest finish</span>
        <span class="records__meta records__meta--clamp">{{ records.fastestFinish.title }}</span>
      </div>

      <div v-if="longestStreak > 0" class="records__tile glass-subtle">
        <span class="records__value">{{ longestStreak }} {{ longestStreak === 1 ? 'day' : 'days' }}</span>
        <span class="records__label">Longest streak</span>
        <span class="records__meta">in a row</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.records {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.records__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.records__title .pi {
  color: var(--p-primary-color);
  font-size: 0.9rem;
}

.records__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.records__tile {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.8rem 0.85rem;
  border-radius: 14px;
  min-width: 0;
}

.records__value {
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1.15;
}

.records__label {
  color: var(--p-text-muted-color);
  font-size: 0.68rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.records__meta {
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
}

.records__meta--clamp {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
