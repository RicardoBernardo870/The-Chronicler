<script setup lang="ts">
// 016 — Reader Profile Page
// Orchestrates state and layout only; substantive UI is delegated to
// components under src/components/profile/. (Constitution VI.)
import { onMounted } from "vue";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useReadingDnaStore } from "@/stores/readingDna";
import { useReadingProfile } from "@/composables/useReadingProfile";

import ReadingDnaCard from "@/components/profile/ReadingDnaCard.vue";
import LifetimeStatsGrid from "@/components/profile/LifetimeStatsGrid.vue";
import LibraryBreakdownCard from "@/components/profile/LibraryBreakdownCard.vue";

const booksStore = useBooksStore();
const progressStore = useProgressStore();
const dnaStore = useReadingDnaStore();
const { booksFinished } = useReadingProfile();

onMounted(async () => {
  // 017 — fetchLibraryWithProgress replaces the sequential fetchLibrary +
  // fetchProgress pair. A single RPC call returns books joined with progress;
  // progressStore.fetchProgress() then hydrates from the in-memory entries
  // (< 1 ms, no network), eliminating the race condition on Profile → Dashboard.
  await booksStore.fetchLibraryWithProgress()
  await Promise.all([
    progressStore.fetchProgress(),
    dnaStore.fetchDna(),
  ]);
  // Threshold-gated DNA generation — never on page load unless eligible.
  await dnaStore.maybeGenerateDna(booksFinished.value);
});
</script>

<template>
  <section class="profile-page">
    <header class="profile-page__header">
      <h1 class="profile-page__title">Profile</h1>
    </header>

    <ReadingDnaCard />
    <LifetimeStatsGrid />
    <LibraryBreakdownCard />
  </section>
</template>

<style scoped>
.profile-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.25rem;
}

.profile-page__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}
</style>
