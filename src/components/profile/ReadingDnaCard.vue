<script setup lang="ts">
// 016 — Reading DNA hero card. Renders one of: threshold-progress placeholder,
// loading skeleton, populated DNA, or generation-failure placeholder.
// Constitution VI compliant: every visible element is a PrimeVue primitive.
import { computed } from 'vue'
import { Message, ProgressBar, Skeleton } from "primevue";
import MoodSignature from './MoodSignature.vue'
import BookSuggestionItem from './BookSuggestionItem.vue'
import { useReadingDnaStore } from '@/stores/readingDna'
import { useReadingProfile } from '@/composables/useReadingProfile'

const dnaStore = useReadingDnaStore()
const { booksFinished } = useReadingProfile()

const FINISHED_THRESHOLD = 2

const belowThreshold = computed(() => booksFinished.value < FINISHED_THRESHOLD && !dnaStore.dna)
const thresholdPercent = computed(() => Math.round((booksFinished.value / FINISHED_THRESHOLD) * 100))

const isGenerating = computed(() => dnaStore.status === 'generating')
const isError = computed(() => dnaStore.status === 'error' && !dnaStore.dna)
</script>

<template>
  <section class="dna-card glass-surface">
    <h2 class="dna-card__title">
      <i class="pi pi-sparkles" />
      Your Reading DNA
    </h2>

    <Transition name="dna-card__content" mode="out-in" appear>
      <!-- Below threshold and no DNA yet -->
      <div v-if="belowThreshold" key="threshold" class="dna-card__threshold">
        <Message severity="info" class="dna-card__inline-msg">
          Finish {{ FINISHED_THRESHOLD - booksFinished }} more
          {{ FINISHED_THRESHOLD - booksFinished === 1 ? 'book' : 'books' }} to unlock your Reading DNA.
        </Message>
        <p class="dna-card__threshold-label">
          {{ booksFinished }} of {{ FINISHED_THRESHOLD }} books finished
        </p>
        <ProgressBar :value="thresholdPercent" :show-value="false" class="dna-card__progress" />
      </div>

      <!-- Generating (first time or regeneration with no prior DNA visible) -->
      <div v-else-if="isGenerating && !dnaStore.dna" key="loading" class="dna-card__loading">
        <Skeleton width="100%" height="3.5rem" class="dna-card__skel" />
        <Skeleton width="40%" height="1.25rem" class="dna-card__skel" />
        <div class="dna-card__suggestion-skeletons">
          <Skeleton width="100%" height="4rem" />
          <Skeleton width="100%" height="4rem" />
          <Skeleton width="100%" height="4rem" />
        </div>
      </div>

      <!-- Error path with no prior DNA -->
      <Message v-else-if="isError" key="error" severity="warn">
        We'll try again later.
      </Message>

      <!-- Populated DNA -->
      <div v-else-if="dnaStore.dna" key="dna" class="dna-card__body">
        <p class="dna-card__personality">{{ dnaStore.dna.personality }}</p>
        <MoodSignature
          :tone="dnaStore.dna.moodSignature.tone"
          :emojis="dnaStore.dna.moodSignature.emojis"
        />
        <div class="dna-card__suggestions">
          <h3 class="dna-card__heading">Books for you</h3>
          <BookSuggestionItem
            v-for="(s, i) in dnaStore.dna.suggestions"
            :key="i"
            :title="s.title"
            :author="s.author"
            :reason="s.reason"
          />
        </div>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.dna-card {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dna-card__title {
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

.dna-card__title .pi {
  font-size: 0.8rem;
}

.dna-card__threshold { display: flex; flex-direction: column; gap: 0.5rem; }
.dna-card__inline-msg { width: 100%; }
.dna-card__threshold-label {
  font-size: 0.85rem;
  opacity: 0.75;
}
.dna-card__progress { height: 6px; }

.dna-card__loading { display: flex; flex-direction: column; gap: 0.5rem; }
.dna-card__skel { margin-bottom: 0.25rem; }
.dna-card__suggestion-skeletons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dna-card__body { display: flex; flex-direction: column; gap: 0.85rem; }
.dna-card__personality {
  margin: 0;
  font-size: 1rem;
  line-height: 1.55;
  font-weight: 400;
  opacity: 0.9;
}
.dna-card__heading {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
}
.dna-card__suggestions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dna-card__content-enter-active,
.dna-card__content-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.dna-card__content-enter-from,
.dna-card__content-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .dna-card__content-enter-active,
  .dna-card__content-leave-active {
    transition: none;
  }

  .dna-card__content-enter-from,
  .dna-card__content-leave-to {
    transform: none;
  }
}
</style>
