<script setup lang="ts">
// Reading calendar — a month grid where each day the reader logged progress
// shows the cover of the book they read (a "+n" badge when several). Tapping
// a day opens its book list; tapping a book goes to the book detail page.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton } from 'primevue'
import {
  addMonths,
  format,
  getDaysInMonth,
  isSameMonth,
  startOfMonth,
} from 'date-fns'
import { useReadingCalendar } from '@/composables/useReadingCalendar'
import { coverFallback } from '@/utils/coverFallback'
import type { ReadingCalendarDay } from '@/types'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const router = useRouter()
const { fetchMonth, daysFor, hasMonth, loading } = useReadingCalendar()

const today = new Date()
const month = ref(startOfMonth(today))
const selectedDate = ref<string | null>(null)

const monthLabel = computed(() => format(month.value, 'MMMM yyyy'))
const isCurrentMonth = computed(() => isSameMonth(month.value, today))
const monthLoaded = computed(() => hasMonth(month.value))

const activityByDate = computed(() => {
  const map = new Map<string, ReadingCalendarDay>()
  for (const day of daysFor(month.value)) map.set(day.date, day)
  return map
})

interface CalendarCell {
  day: number
  date: string
  activity: ReadingCalendarDay | null
  isToday: boolean
  isFuture: boolean
}

const cells = computed<CalendarCell[]>(() => {
  const total = getDaysInMonth(month.value)
  const todayIso = format(today, 'yyyy-MM-dd')
  return Array.from({ length: total }, (_, i) => {
    const date = format(
      new Date(month.value.getFullYear(), month.value.getMonth(), i + 1),
      'yyyy-MM-dd',
    )
    return {
      day: i + 1,
      date,
      activity: activityByDate.value.get(date) ?? null,
      isToday: date === todayIso,
      isFuture: date > todayIso,
    }
  })
})

// Monday-first offset for the 1st of the month (getDay: 0 = Sunday).
const leadingBlanks = computed(() => (month.value.getDay() + 6) % 7)

const selectedDay = computed(() =>
  selectedDate.value ? (activityByDate.value.get(selectedDate.value) ?? null) : null,
)

const readingDaysCount = computed(() => daysFor(month.value).length)

const shiftMonth = (delta: number) => {
  month.value = startOfMonth(addMonths(month.value, delta))
  selectedDate.value = null
}

const selectDay = (cell: CalendarCell) => {
  if (!cell.activity) return
  selectedDate.value = selectedDate.value === cell.date ? null : cell.date
}

const openBook = (bookId: string) =>
  router.push({ name: 'book-detail', params: { id: bookId } })

const selectedDayLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  return format(new Date(y, m - 1, d), 'MMMM d')
})

onMounted(() => void fetchMonth(month.value))
watch(month, (m) => void fetchMonth(m))
</script>

<template>
  <section class="reading-calendar glass-surface" aria-label="Reading calendar">
    <header class="reading-calendar__header">
      <h2 class="reading-calendar__title">
        <i class="pi pi-calendar" aria-hidden="true" />
        {{ monthLabel }}
      </h2>
      <div class="reading-calendar__nav">
        <Button
          icon="pi pi-chevron-left"
          text
          rounded
          size="small"
          aria-label="Previous month"
          @click="shiftMonth(-1)"
        />
        <Button
          icon="pi pi-chevron-right"
          text
          rounded
          size="small"
          aria-label="Next month"
          :disabled="isCurrentMonth"
          @click="shiftMonth(1)"
        />
      </div>
    </header>

    <div class="reading-calendar__weekdays" aria-hidden="true">
      <span v-for="(w, i) in WEEKDAYS" :key="i">{{ w }}</span>
    </div>

    <div v-if="!monthLoaded && loading" class="reading-calendar__grid">
      <Skeleton v-for="i in 35" :key="i" class="reading-calendar__skeleton-cell" />
    </div>

    <div v-else class="reading-calendar__grid">
      <span
        v-for="i in leadingBlanks"
        :key="`blank-${i}`"
        class="reading-calendar__blank"
        aria-hidden="true"
      />
      <component
        :is="cell.activity ? 'button' : 'div'"
        v-for="cell in cells"
        :key="cell.date"
        :type="cell.activity ? 'button' : undefined"
        class="reading-calendar__cell"
        :class="{
          'reading-calendar__cell--active': cell.activity,
          'reading-calendar__cell--today': cell.isToday,
          'reading-calendar__cell--future': cell.isFuture,
          'reading-calendar__cell--selected': cell.date === selectedDate,
        }"
        :aria-label="
          cell.activity
            ? `${cell.date}: read ${cell.activity.books.map((b) => b.title).join(', ')}`
            : undefined
        "
        @click="selectDay(cell)"
      >
        <template v-if="cell.activity">
          <span class="reading-calendar__cover-wrap">
            <span class="reading-calendar__cover-fallback" aria-hidden="true">
              <i class="pi pi-book" />
            </span>
            <img
              v-if="cell.activity.books[0].coverUrl"
              :src="cell.activity.books[0].coverUrl"
              alt=""
              class="reading-calendar__cover"
              loading="lazy"
              @error="coverFallback"
            />
            <span
              v-if="cell.activity.books.length > 1"
              class="reading-calendar__more"
            >
              +{{ cell.activity.books.length - 1 }}
            </span>
          </span>
          <span class="reading-calendar__daynum reading-calendar__daynum--active">
            {{ cell.day }}
          </span>
        </template>
        <span v-else class="reading-calendar__daynum">{{ cell.day }}</span>
      </component>
    </div>

    <p v-if="monthLoaded && readingDaysCount === 0" class="reading-calendar__empty">
      No sessions logged this month{{ isCurrentMonth ? ' yet' : '' }}.
    </p>
    <p v-else-if="monthLoaded" class="reading-calendar__summary">
      {{ readingDaysCount }} reading
      {{ readingDaysCount === 1 ? 'day' : 'days' }} this month
    </p>

    <Transition name="reading-calendar__detail">
      <div v-if="selectedDay" class="reading-calendar__day-detail">
        <h3 class="reading-calendar__day-title">{{ selectedDayLabel }}</h3>
        <button
          v-for="book in selectedDay.books"
          :key="book.bookId"
          type="button"
          class="reading-calendar__book-row"
          @click="openBook(book.bookId)"
        >
          <span class="reading-calendar__book-cover-wrap">
            <span class="reading-calendar__cover-fallback" aria-hidden="true">
              <i class="pi pi-book" />
            </span>
            <img
              v-if="book.coverUrl"
              :src="book.coverUrl"
              alt=""
              class="reading-calendar__cover"
              @error="coverFallback"
            />
          </span>
          <span class="reading-calendar__book-meta">
            <span class="reading-calendar__book-title">{{ book.title }}</span>
            <span class="reading-calendar__book-page">reached p. {{ book.furthestPage }}</span>
          </span>
          <i class="pi pi-chevron-right reading-calendar__book-chevron" aria-hidden="true" />
        </button>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.reading-calendar {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1rem;
}

.reading-calendar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.reading-calendar__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.reading-calendar__title .pi {
  color: var(--p-primary-color);
  font-size: 0.85rem;
}

.reading-calendar__nav {
  display: flex;
  gap: 0.1rem;
}

.reading-calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.3rem;
  color: var(--p-text-muted-color);
  font-size: 0.66rem;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
}

.reading-calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.3rem;
}

.reading-calendar__skeleton-cell {
  aspect-ratio: 3 / 4;
  border-radius: 8px;
}

.reading-calendar__blank {
  aspect-ratio: 3 / 4;
}

.reading-calendar__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  aspect-ratio: 3 / 4;
  min-width: 0;
  margin: 0;
  padding: 0.15rem;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
}

.reading-calendar__cell--active {
  cursor: pointer;
  border-color: var(--p-content-border-color);
  background: color-mix(in srgb, var(--p-content-background) 55%, transparent);
}

.reading-calendar__cell--selected {
  border-color: var(--p-primary-color);
}

.reading-calendar__cell--today .reading-calendar__daynum {
  color: var(--p-primary-color);
  font-weight: 800;
}

.reading-calendar__cell--future {
  opacity: 0.4;
}

.reading-calendar__cell--active:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 2px;
}

.reading-calendar__cover-wrap {
  position: absolute;
  inset: 0 0 1.05rem 0;
  overflow: hidden;
  border-radius: 7px 7px 0 0;
}

.reading-calendar__cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.reading-calendar__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reading-calendar__more {
  position: absolute;
  top: 2px;
  right: 2px;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1.4;
}

.reading-calendar__daynum {
  color: var(--p-text-muted-color);
  font-size: 0.7rem;
  font-weight: 650;
  line-height: 1.5;
}

.reading-calendar__daynum--active {
  color: var(--p-text-color);
}

.reading-calendar__empty,
.reading-calendar__summary {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  text-align: center;
}

.reading-calendar__day-detail {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--p-content-border-color);
}

.reading-calendar__day-title {
  margin: 0 0 0.2rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.reading-calendar__book-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
  padding: 0.35rem 0.25rem;
  border: none;
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.reading-calendar__book-row:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 2px;
}

.reading-calendar__book-cover-wrap {
  position: relative;
  flex: none;
  width: 32px;
  height: 46px;
  overflow: hidden;
  border-radius: 5px;
  border: 1px solid var(--p-content-border-color);
}

.reading-calendar__book-meta {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  flex: 1;
}

.reading-calendar__book-title {
  overflow: hidden;
  font-size: 0.85rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reading-calendar__book-page {
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
}

.reading-calendar__book-chevron {
  flex: none;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}

.reading-calendar__detail-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.reading-calendar__detail-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .reading-calendar__detail-enter-active {
    transition: none;
  }
}
</style>
