<script setup lang="ts">
// 016 - Reader Profile Page
// Orchestrates state and layout only; substantive UI is delegated to
// components under src/components/profile/. (Constitution VI.)
import { onMounted, ref } from "vue";
import { Skeleton } from "primevue";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useReadingDnaStore } from "@/stores/readingDna";
import { useReadingProfile } from "@/composables/useReadingProfile";
import { useLibraryBreakdown } from "@/composables/useLibraryBreakdown";

import ReadingDnaCard from "@/components/profile/ReadingDnaCard.vue";
import LifetimeStatsGrid from "@/components/profile/LifetimeStatsGrid.vue";
import LibraryBreakdownCard from "@/components/profile/LibraryBreakdownCard.vue";

const booksStore = useBooksStore();
const progressStore = useProgressStore();
const dnaStore = useReadingDnaStore();
const { booksFinished, fetchStats } = useReadingProfile();
const { fetchBreakdown } = useLibraryBreakdown();
const profileReady = ref(false);

onMounted(async () => {
  try {
    // 017: fetchLibraryWithProgress replaces the sequential fetchLibrary +
    // fetchProgress pair. A single RPC call returns books joined with progress;
    // progressStore.fetchProgress() then hydrates from the in-memory entries.
    await booksStore.fetchLibraryWithProgress();
    await Promise.all([
      progressStore.fetchProgress(),
      dnaStore.fetchDna(),
      fetchStats(),
      fetchBreakdown(),
    ]);
    // Keep the first profile paint stable: if DNA generation is needed, finish it
    // before rendering the lower cards so nothing gets pushed down afterward.
    await dnaStore.maybeGenerateDna(booksFinished.value);
  } finally {
    profileReady.value = true;
  }
});
</script>

<template>
  <section class="profile-page">
    <header class="profile-page__header">
      <h1 class="profile-page__title">Profile</h1>
    </header>

    <Transition name="profile-state" mode="out-in" appear>
      <div v-if="!profileReady" key="loading" class="profile-page__skeletons">
        <section class="profile-page__skeleton-card glass-surface profile-page__skeleton-card--dna">
          <Skeleton height="1rem" width="42%" />
          <Skeleton height="4rem" width="100%" />
          <Skeleton height="1.25rem" width="55%" />
          <Skeleton height="3.75rem" width="100%" />
          <Skeleton height="3.75rem" width="100%" />
        </section>

        <section class="profile-page__skeleton-card glass-surface">
          <Skeleton height="1rem" width="38%" />
          <div class="profile-page__skeleton-grid">
            <Skeleton v-for="i in 6" :key="i" height="4.75rem" />
          </div>
        </section>

        <section class="profile-page__skeleton-card glass-surface">
          <Skeleton height="1rem" width="44%" />
          <Skeleton height="2rem" width="80%" />
          <Skeleton height="3.5rem" width="100%" />
        </section>
      </div>

      <TransitionGroup
        v-else
        key="content"
        name="profile-section"
        tag="div"
        class="profile-page__sections"
        appear
      >
        <div key="dna" class="profile-page__section">
          <ReadingDnaCard />
        </div>
        <div key="stats" class="profile-page__section">
          <LifetimeStatsGrid />
        </div>
        <div key="breakdown" class="profile-page__section">
          <LibraryBreakdownCard />
        </div>
      </TransitionGroup>
    </Transition>
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

.profile-page__sections,
.profile-page__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-page__section {
  min-width: 0;
}

.profile-page__skeleton-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-page__skeleton-card--dna {
  min-height: 21rem;
}

.profile-page__skeleton-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.profile-state-enter-active,
.profile-state-leave-active,
.profile-section-enter-active,
.profile-section-leave-active,
.profile-section-move {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.profile-state-enter-from,
.profile-state-leave-to,
.profile-section-enter-from,
.profile-section-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.profile-section-leave-active {
  position: absolute;
  width: calc(100% - 2rem);
  max-width: 680px;
}

@media (min-width: 600px) {
  .profile-page__skeleton-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .profile-page__skeleton-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .profile-state-enter-active,
  .profile-state-leave-active,
  .profile-section-enter-active,
  .profile-section-leave-active,
  .profile-section-move {
    transition: none;
  }

  .profile-state-enter-from,
  .profile-state-leave-to,
  .profile-section-enter-from,
  .profile-section-leave-to {
    transform: none;
  }
}
</style>
