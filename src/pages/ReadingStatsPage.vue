<script setup lang="ts">
// Reading Stats — the analytical half of the profile, one tap deep: the
// monthly "Your year" chart, reading calendar, lifetime stats, book lengths,
// and library breakdown. Goals (quest ring + level) live on TrophyRoomPage.
// Orchestration only (Constitution VI).
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton } from 'primevue'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useReadingProfile } from '@/composables/useReadingProfile'
import { useLibraryBreakdown } from '@/composables/useLibraryBreakdown'

import MonthlyReadingChart from '@/components/profile/MonthlyReadingChart.vue'
import ReadingCalendarCard from '@/components/profile/ReadingCalendarCard.vue'
import LifetimeStatsGrid from '@/components/profile/LifetimeStatsGrid.vue'
import BookLengthCard from '@/components/profile/BookLengthCard.vue'
import LibraryBreakdownCard from '@/components/profile/LibraryBreakdownCard.vue'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const { fetchStats } = useReadingProfile()
const { fetchBreakdown } = useLibraryBreakdown()

const pageReady = ref(false)

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'profile' })
}

onMounted(async () => {
  try {
    // Deep-link safe: same data pipeline as ProfilePage (all SWR-cached, so
    // arriving from the profile costs zero extra network).
    await booksStore.fetchLibraryWithProgress()
    await Promise.all([
      progressStore.fetchProgress(),
      fetchStats(),
      fetchBreakdown(),
    ])
  } finally {
    pageReady.value = true
  }
})
</script>

<template>
  <section class="reading-stats">
    <header class="reading-stats__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back to profile"
        @click="goBack"
      />
      <h1 class="reading-stats__title">
        <i class="pi pi-chart-bar" aria-hidden="true" />
        Reading Stats
      </h1>
    </header>

    <div v-if="!pageReady" class="reading-stats__skeletons">
      <Skeleton height="14rem" border-radius="16px" />
      <Skeleton height="12rem" border-radius="16px" />
      <Skeleton height="8rem" border-radius="16px" />
    </div>

    <div v-else class="reading-stats__sections">
      <MonthlyReadingChart />
      <ReadingCalendarCard />
      <LifetimeStatsGrid />
      <BookLengthCard />
      <LibraryBreakdownCard />
    </div>
  </section>
</template>

<style scoped>
.reading-stats {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.reading-stats__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.reading-stats__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.reading-stats__title .pi {
  color: var(--p-primary-color);
  font-size: 1.1rem;
}

.reading-stats__sections,
.reading-stats__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
