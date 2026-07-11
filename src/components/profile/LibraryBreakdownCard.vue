<script setup lang="ts">
// 017 — Library breakdown: genres, author count, status counts. PrimeVue primitives only.
import { computed } from "vue";
import { Message } from "primevue";
import { useLibraryBreakdown } from "@/composables/useLibraryBreakdown";

const { breakdown } = useLibraryBreakdown();

// Segmented genre bar — top genres + an "Other" bucket, indigo-family ramp.
const GENRE_COLORS = ["#6366f1", "#a78bfa", "#818cf8", "#c4b5fd", "#4f46e5"];
const OTHER_COLOR = "rgba(148, 148, 178, 0.35)";
const MAX_SEGMENTS = 4;

const genreSegments = computed(() => {
  const dist = breakdown.value?.genreDistribution ?? [];
  if (dist.length === 0) return [];
  const top = dist.slice(0, MAX_SEGMENTS).map((g, i) => ({
    genre: g.genre,
    percentage: g.percentage,
    color: GENRE_COLORS[i % GENRE_COLORS.length],
  }));
  const rest = dist.slice(MAX_SEGMENTS);
  if (rest.length > 0) {
    top.push({
      genre: `Other (${rest.length})`,
      percentage: rest.reduce((sum, g) => sum + g.percentage, 0),
      color: OTHER_COLOR,
    });
  }
  return top;
});
</script>

<template>
  <section class="library-breakdown glass-surface">
    <h2 class="library-breakdown__title">
      <i class="pi pi-th-large" />
      Library Breakdown
    </h2>

    <Message
      v-if="!breakdown || breakdown.genreDistribution.length === 0"
      severity="info"
      class="library-breakdown__empty"
    >
      Add a book to see your library breakdown.
    </Message>

    <template v-else>
      <!-- Genre distribution — segmented bar + legend -->
      <div v-if="genreSegments.length > 0" class="library-breakdown__section">
        <div class="library-breakdown__genre-bar" aria-hidden="true">
          <span
            v-for="seg in genreSegments"
            :key="seg.genre"
            class="library-breakdown__genre-seg"
            :style="{ width: `${seg.percentage}%`, background: seg.color }"
          />
        </div>
        <ul class="library-breakdown__genre-legend">
          <li v-for="seg in genreSegments" :key="seg.genre">
            <span
              class="library-breakdown__genre-dot"
              :style="{ background: seg.color }"
              aria-hidden="true"
            />
            {{ seg.genre }}
            <span class="library-breakdown__genre-pct">{{ Math.round(seg.percentage) }}%</span>
          </li>
        </ul>
      </div>

      <!-- Author count -->
      <div class="library-breakdown__section library-breakdown__authors">
        <i class="pi pi-user library-breakdown__author-icon" />
        <span class="library-breakdown__author-label">
          {{ breakdown.authorsCount }}
          {{ breakdown.authorsCount === 1 ? "author" : "authors" }}
        </span>
      </div>

      <!-- Status counts -->
      <div class="library-breakdown__section library-breakdown__status-row">
        <div class="library-breakdown__stat">
          <span class="library-breakdown__stat-value">{{ breakdown.booksFinished }}</span>
          <span class="library-breakdown__stat-label">finished</span>
        </div>
        <div class="library-breakdown__stat">
          <span class="library-breakdown__stat-value">{{ breakdown.booksInProgress }}</span>
          <span class="library-breakdown__stat-label">reading</span>
        </div>
        <div class="library-breakdown__stat">
          <span class="library-breakdown__stat-value">{{ breakdown.booksUnstarted }}</span>
          <span class="library-breakdown__stat-label">unstarted</span>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.library-breakdown {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.library-breakdown__title {
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

.library-breakdown__title .pi {
  font-size: 0.8rem;
}

.library-breakdown__empty {
  width: 100%;
}

.library-breakdown__genre-bar {
  display: flex;
  gap: 2px;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
}

.library-breakdown__genre-seg {
  display: block;
  min-width: 4px;
  border-radius: 2px;
}

.library-breakdown__genre-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin: 0.6rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
  opacity: 0.85;
}

.library-breakdown__genre-legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.library-breakdown__genre-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.library-breakdown__genre-pct {
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}

.library-breakdown__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.library-breakdown__heading {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
}

/* Genre pills */
.library-breakdown__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.library-breakdown__genre-tag {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-indigo-300);
  background: rgba(99, 102, 241, 0.15);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

/* Author count */
.library-breakdown__authors {
  flex-direction: row !important;
  align-items: center;
  gap: 0.45rem;
}

.library-breakdown__author-icon {
  font-size: 0.85rem;
  opacity: 0.5;
}

.library-breakdown__author-label {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--p-indigo-300);
}

/* Status counts */
.library-breakdown__status-row {
  flex-direction: row !important;
  gap: 1.5rem;
}

.library-breakdown__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.library-breakdown__stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-indigo-300);
}

.library-breakdown__stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
}
</style>
