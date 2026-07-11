<script setup lang="ts">
// Trophy Room — the analytical half of the profile, one tap deep. Quest ring
// hero, reader level, the reading calendar, lifetime stats, and the library
// breakdown. Orchestration only (Constitution VI).
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton } from 'primevue'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useReadingQuestStore } from '@/stores/readingQuest'
import { useReadingProfile } from '@/composables/useReadingProfile'
import { useLibraryBreakdown } from '@/composables/useLibraryBreakdown'

import QuestGoalHero from '@/components/profile/QuestGoalHero.vue'
import ReaderLevelStrip from '@/components/profile/ReaderLevelStrip.vue'
import MonthlyReadingChart from '@/components/profile/MonthlyReadingChart.vue'
import ReadingCalendarCard from '@/components/profile/ReadingCalendarCard.vue'
import LifetimeStatsGrid from '@/components/profile/LifetimeStatsGrid.vue'
import BookLengthCard from '@/components/profile/BookLengthCard.vue'
import LibraryBreakdownCard from '@/components/profile/LibraryBreakdownCard.vue'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const readingQuestStore = useReadingQuestStore()
const { fetchStats } = useReadingProfile()
const { fetchBreakdown } = useLibraryBreakdown()

const pageReady = ref(false)
const level = computed(() => readingQuestStore.summary?.level ?? null)

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
      readingQuestStore.fetchQuestSummary().catch(() => {}),
      fetchBreakdown(),
    ])
  } finally {
    pageReady.value = true
  }
})
</script>

<template>
  <section class="trophy-room">
    <header class="trophy-room__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back to profile"
        @click="goBack"
      />
      <h1 class="trophy-room__title">
        <i class="pi pi-trophy" aria-hidden="true" />
        Trophy Room
      </h1>
    </header>

    <div v-if="!pageReady" class="trophy-room__skeletons">
      <Skeleton height="16rem" border-radius="16px" />
      <Skeleton height="12rem" border-radius="16px" />
      <Skeleton height="8rem" border-radius="16px" />
    </div>

    <div v-else class="trophy-room__sections">
      <QuestGoalHero />
      <ReaderLevelStrip v-if="level" :level="level" />
      <MonthlyReadingChart />
      <ReadingCalendarCard />
      <LifetimeStatsGrid />
      <BookLengthCard />
      <LibraryBreakdownCard />
    </div>
  </section>
</template>

<style scoped>
.trophy-room {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.trophy-room__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.trophy-room__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.trophy-room__title .pi {
  color: var(--p-primary-color);
  font-size: 1.1rem;
}

.trophy-room__sections,
.trophy-room__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
</style>
