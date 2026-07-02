<script setup lang="ts">
// Reader Profile — identity-first layout: avatar + goal ring header, compact
// Reading DNA strip, DNA recommendation scroller, and stat pills. The
// analytical cards (quest / lifetime stats / breakdown) live one tap deep on
// ProfileStatsPage. Orchestrates state and layout only; substantive UI is
// delegated to components under src/components/profile/. (Constitution VI.)
import { onMounted, ref } from "vue";
import { Skeleton } from "primevue";
import { useBooksStore } from "@/stores/books";
import { useProgressStore } from "@/stores/progress";
import { useReadingDnaStore } from "@/stores/readingDna";
import { useReadingQuestStore } from "@/stores/readingQuest";
import { useReadingProfile } from "@/composables/useReadingProfile";
import { useLibraryBreakdown } from "@/composables/useLibraryBreakdown";
import { useCommunityIdentity } from "@/composables/useCommunityIdentity";

import ProfileIdentityHeader from "@/components/profile/ProfileIdentityHeader.vue";
import DnaSignatureStrip from "@/components/profile/DnaSignatureStrip.vue";
import DnaRecommendationsScroller from "@/components/profile/DnaRecommendationsScroller.vue";
import ProfileStatsNav from "@/components/profile/ProfileStatsNav.vue";
import RecapImagesCarousel from "@/components/profile/RecapImagesCarousel.vue";

const booksStore = useBooksStore();
const progressStore = useProgressStore();
const dnaStore = useReadingDnaStore();
const readingQuestStore = useReadingQuestStore();
const { booksFinished, fetchStats } = useReadingProfile();
const { fetchBreakdown } = useLibraryBreakdown();
const { fetchIdentity } = useCommunityIdentity();
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
      readingQuestStore.fetchQuestSummary().catch(() => {}),
      fetchBreakdown(),
      fetchIdentity(),
    ]);
    // Keep the first profile paint stable: if DNA generation is needed, finish it
    // before rendering the lower sections so nothing gets pushed down afterward.
    await dnaStore.maybeGenerateDna(booksFinished.value);
  } finally {
    profileReady.value = true;
  }
});
</script>

<template>
  <section class="profile-page">
    <Transition name="profile-state" mode="out-in" appear>
      <div v-if="!profileReady" key="loading" class="profile-page__skeletons">
        <div class="profile-page__skeleton-identity">
          <Skeleton shape="circle" size="76px" />
          <div class="profile-page__skeleton-identity-meta">
            <Skeleton height="1.4rem" width="55%" />
            <Skeleton height="0.9rem" width="40%" />
          </div>
        </div>

        <section class="profile-page__skeleton-card glass-surface">
          <Skeleton height="1.5rem" width="70%" />
        </section>

        <div class="profile-page__skeleton-covers">
          <Skeleton v-for="i in 4" :key="i" width="92px" height="134px" border-radius="10px" />
        </div>

        <div class="profile-page__skeleton-pills">
          <Skeleton v-for="i in 4" :key="i" height="3.6rem" border-radius="14px" />
        </div>
      </div>

      <TransitionGroup
        v-else
        key="content"
        name="profile-section"
        tag="div"
        class="profile-page__sections"
        appear
      >
        <div key="identity" class="profile-page__section">
          <ProfileIdentityHeader />
        </div>
        <div key="dna" class="profile-page__section">
          <DnaSignatureStrip />
        </div>
        <div key="recs" class="profile-page__section">
          <DnaRecommendationsScroller />
        </div>
        <div key="stats" class="profile-page__section">
          <ProfileStatsNav />
        </div>
        <div key="recap-memories" class="profile-page__section">
          <RecapImagesCarousel />
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

.profile-page__sections,
.profile-page__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.profile-page__section {
  min-width: 0;
}

.profile-page__skeleton-identity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.profile-page__skeleton-identity-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.profile-page__skeleton-card {
  padding: 0.9rem 1rem;
}

.profile-page__skeleton-covers {
  display: flex;
  gap: 0.75rem;
  overflow: hidden;
}

.profile-page__skeleton-covers > * {
  flex: none;
}

.profile-page__skeleton-pills {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
