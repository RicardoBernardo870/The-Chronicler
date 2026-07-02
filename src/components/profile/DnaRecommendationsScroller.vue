<script setup lang="ts">
// Reading DNA recommendation covers, fitted to one row — cards share the
// available width (no horizontal scrolling). A resolved cover opens the
// pre-filled add-book details page (030); an unresolved one falls back to the
// normal add-book search flow with the query pre-seeded.
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Skeleton } from 'primevue'
import { useReadingDnaStore } from '@/stores/readingDna'
import { useBookSearch } from '@/composables/useBookSearch'
import {
  useDnaRecommendations,
  type DnaRecommendation,
} from '@/composables/useDnaRecommendations'
import { coverFallback } from '@/utils/coverFallback'

const router = useRouter()
const dnaStore = useReadingDnaStore()
const { query: searchQuery } = useBookSearch()
const { recommendations, resolving } = useDnaRecommendations()

const visible = computed(
  () => dnaStore.dna !== null && recommendations.value.length > 0,
)

const openRecommendation = (rec: DnaRecommendation) => {
  if (rec.source && rec.key) {
    router.push({
      name: 'add-book-details',
      params: { source: rec.source, key: encodeURIComponent(rec.key) },
    })
    return
  }
  // No resolved volume — seed the singleton search and land on the normal
  // add-book flow, where the debounced watcher runs the query immediately.
  searchQuery.value = `${rec.title} ${rec.author}`
  router.push({ name: 'add-book' })
}
</script>

<template>
  <section
    v-if="visible"
    class="dna-recs"
    aria-label="Book recommendations from your Reading DNA"
  >
    <h2 class="dna-recs__heading">Your DNA suggests</h2>

    <div class="dna-recs__row">
      <button
        v-for="rec in recommendations"
        :key="`${rec.title}|${rec.author}`"
        type="button"
        class="dna-recs__card"
        :title="rec.reason"
        :aria-label="`Add ${rec.title} by ${rec.author} to your library`"
        @click="openRecommendation(rec)"
      >
        <div class="dna-recs__cover">
          <Skeleton
            v-if="resolving && !rec.coverUrl"
            width="100%"
            height="100%"
          />
          <template v-else>
            <span class="dna-recs__cover-fallback" aria-hidden="true">
              <i class="pi pi-book" />
            </span>
            <img
              v-if="rec.coverUrl"
              :src="rec.coverUrl"
              :alt="`Cover of ${rec.title}`"
              class="dna-recs__cover-img"
              loading="lazy"
              @error="coverFallback"
            />
          </template>
        </div>
        <p class="dna-recs__title">{{ rec.title }}</p>
        <p class="dna-recs__author">{{ rec.author }}</p>
      </button>
    </div>
  </section>
</template>

<style scoped>
.dna-recs {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.dna-recs__heading {
  margin: 0;
  padding: 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}

.dna-recs__row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.25rem;
}

.dna-recs__card {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dna-recs__card:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 3px;
  border-radius: 10px;
}

.dna-recs__cover {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 10px;
  background: color-mix(in srgb, var(--p-content-background) 70%, transparent);
  border: 1px solid var(--p-content-border-color);
}

.dna-recs__cover-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--p-text-muted-color);
  font-size: 1.4rem;
}

.dna-recs__cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s ease;
}

.dna-recs__card:hover .dna-recs__cover-img {
  transform: scale(1.03);
}

.dna-recs__title {
  margin: 0.4rem 0 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.76rem;
  font-weight: 650;
  line-height: 1.25;
}

.dna-recs__author {
  margin: 0.1rem 0 0;
  overflow: hidden;
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .dna-recs__cover-img {
    transition: none;
  }
}
</style>
