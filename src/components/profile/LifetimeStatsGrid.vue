<script setup lang="ts">
// 016 — Lifetime Stats Grid: 7 StatTile instances inside a glass-surface section.
import { computed } from "vue";
import { Message } from "primevue";
import StatTile from "./StatTile.vue";
import { useReadingProfile } from "@/composables/useReadingProfile";

const {
  booksInProgress,
  totalPagesRead,
  totalReadingHours,
  allTimeVelocityPph,
  currentStreak,
  longestStreak,
  sessionsThisMonth,
} = useReadingProfile();

const isEmpty = computed(
  () =>
   sessionsThisMonth.value === 0 &&
    booksInProgress.value === 0 &&
    totalPagesRead.value === 0,
);
</script>

<template>
  <section class="lifetime-stats glass-surface">
    <h2 class="lifetime-stats__title">
      <i class="pi pi-chart-bar" />
      Lifetime Stats
    </h2>

    <Message v-if="isEmpty" severity="info" class="lifetime-stats__empty">
      Start your first session to see your stats.
    </Message>

    <div v-else class="lifetime-stats__grid">
      <StatTile
        icon="pi-check-circle"
        label="Sessions this month"
        class="glass-subtle"
        :value="sessionsThisMonth"
      />
      <StatTile
        icon="pi-book"
        label="In progress"
        class="glass-subtle"
        :value="booksInProgress"
      />
      <StatTile
        icon="pi-bookmark"
        label="Pages read"
        class="glass-subtle"
        :value="totalPagesRead"
      />
      <StatTile
        icon="pi-clock"
        label="Reading hours"
        class="glass-subtle"
        :value="totalReadingHours"
      />
      <StatTile
        icon="pi-bolt"
        label="Pages / hr"
        class="glass-subtle"
        :value="allTimeVelocityPph"
      />
      <StatTile
        icon="pi-calendar"
        label="Current streak"
        class="glass-subtle"
        :value="`${currentStreak}d`"
      />
      <StatTile
        icon="pi-star"
        label="Longest streak"
        class="glass-subtle"
        :value="`${longestStreak}d`"
      />
    </div>
  </section>
</template>

<style scoped>
.lifetime-stats {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.lifetime-stats__title {
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

.lifetime-stats__title .pi {
  font-size: 0.8rem;
}

.lifetime-stats__empty {
  width: 100%;
}

.lifetime-stats__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

@media (min-width: 600px) {
  .lifetime-stats__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 900px) {
  .lifetime-stats__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
