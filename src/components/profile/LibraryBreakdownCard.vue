<script setup lang="ts">
// 016 — Library breakdown: genres, author count, pace bars. PrimeVue primitives only.
import { Message, ProgressBar } from "primevue";
import { useLibraryBreakdown } from "@/composables/useLibraryBreakdown";

const { breakdown } = useLibraryBreakdown();
</script>

<template>
  <section class="library-breakdown glass-surface">
    <h2 class="library-breakdown__title">
      <i class="pi pi-th-large" />
      Library Breakdown
    </h2>

    <Message
      v-if="
        breakdown.genres.length === 0 && breakdown.paceComparison.length === 0
      "
      severity="info"
      class="library-breakdown__empty"
    >
      Add a book to see your library breakdown.
    </Message>

    <template v-else>
      <!-- Genre distribution -->
      <div
        v-if="breakdown.genres.length > 0"
        class="library-breakdown__section"
      >
        <h3 class="library-breakdown__heading">Genres</h3>
        <div class="library-breakdown__tags">
          <span
            v-for="g in breakdown.genres"
            :key="g.name"
            class="library-breakdown__genre-tag"
          >
            {{ g.name }} · {{ g.count }}
          </span>
        </div>
      </div>

      <!-- Author count -->
      <div class="library-breakdown__section library-breakdown__authors">
        <i class="pi pi-user library-breakdown__author-icon" />
        <span class="library-breakdown__author-label">
          {{ breakdown.uniqueAuthors }}
          {{ breakdown.uniqueAuthors === 1 ? "author" : "authors" }}
        </span>
      </div>

      <!-- Pace comparison -->
      <div
        v-if="breakdown.paceComparison.length > 0"
        class="library-breakdown__section"
      >
        <h3 class="library-breakdown__heading">Pace comparison</h3>
        <div class="library-breakdown__pace-list">
          <div
            v-for="row in breakdown.paceComparison"
            :key="row.bookId"
            class="library-breakdown__pace-row"
          >
            <div class="library-breakdown__pace-label">
              <span class="library-breakdown__pace-title">{{
                row.bookTitle
              }}</span>
              <span class="library-breakdown__pace-meta">{{
                row.paceLabel
              }}</span>
            </div>
            <ProgressBar
              :value="row.paceNormalized"
              :show-value="false"
              class="library-breakdown__pace-bar"
            />
          </div>
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

/* Pace bars */
.library-breakdown__pace-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.library-breakdown__pace-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  margin-bottom: 0.2rem;
}

.library-breakdown__pace-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60%;
}

.library-breakdown__pace-meta {
  opacity: 0.55;
  font-size: 0.75rem;
}

.library-breakdown__pace-bar {
  height: 6px;
}
</style>
