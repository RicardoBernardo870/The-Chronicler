<script setup lang="ts">
// Compact Reading DNA strip: mood tone + emoji signature on one row; the full
// personality analysis opens in a bottom sheet. Replaces the tall
// ReadingDnaCard on the profile page (suggestions moved to the scroller).
import { computed, ref } from 'vue'
import { Dialog, Message, ProgressBar, Skeleton } from 'primevue'
import MoodSignature from './MoodSignature.vue'
import { useReadingDnaStore } from '@/stores/readingDna'
import { useReadingProfile } from '@/composables/useReadingProfile'

const FINISHED_THRESHOLD = 2

const dnaStore = useReadingDnaStore()
const { booksFinished } = useReadingProfile()

const expanded = ref(false)

const belowThreshold = computed(
  () => booksFinished.value < FINISHED_THRESHOLD && !dnaStore.dna,
)
const thresholdPercent = computed(() =>
  Math.round((booksFinished.value / FINISHED_THRESHOLD) * 100),
)
const isGenerating = computed(() => dnaStore.status === 'generating')
const isError = computed(() => dnaStore.status === 'error' && !dnaStore.dna)
</script>

<template>
  <section class="dna-strip glass-surface" aria-label="Your Reading DNA">
    <!-- Below threshold: compact onboarding state -->
    <div v-if="belowThreshold" class="dna-strip__threshold">
      <div class="dna-strip__threshold-row">
        <i class="pi pi-sparkles dna-strip__icon" aria-hidden="true" />
        <p class="dna-strip__threshold-copy">
          Finish {{ FINISHED_THRESHOLD - booksFinished }} more
          {{ FINISHED_THRESHOLD - booksFinished === 1 ? 'book' : 'books' }}
          to unlock your Reading DNA.
        </p>
      </div>
      <ProgressBar
        :value="thresholdPercent"
        :show-value="false"
        class="dna-strip__progress"
      />
    </div>

    <!-- First generation in flight -->
    <div v-else-if="isGenerating && !dnaStore.dna" class="dna-strip__loading">
      <Skeleton width="55%" height="1.4rem" />
      <Skeleton width="35%" height="1rem" />
    </div>

    <!-- Error with nothing to show -->
    <Message v-else-if="isError" severity="secondary" class="dna-strip__error">
      Your Reading DNA couldn't be generated. We'll try again later.
    </Message>

    <!-- Populated: one-row signature, tap to expand -->
    <button
      v-else-if="dnaStore.dna"
      type="button"
      class="dna-strip__row"
      aria-label="Open your full Reading DNA analysis"
      @click="expanded = true"
    >
      <i class="pi pi-sparkles dna-strip__icon" aria-hidden="true" />
      <MoodSignature
        :tone="dnaStore.dna.moodSignature.tone"
        :emojis="dnaStore.dna.moodSignature.emojis"
      />
      <i class="pi pi-chevron-right dna-strip__chevron" aria-hidden="true" />
    </button>

    <Dialog
      v-model:visible="expanded"
      modal
      position="bottom"
      :draggable="false"
      :dismissable-mask="true"
      class="dna-strip__sheet"
      header="Your Reading DNA"
    >
      <template v-if="dnaStore.dna">
        <MoodSignature
          :tone="dnaStore.dna.moodSignature.tone"
          :emojis="dnaStore.dna.moodSignature.emojis"
        />
        <p class="dna-strip__personality">{{ dnaStore.dna.personality }}</p>
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.dna-strip {
  padding: 0.9rem 1rem;
}

.dna-strip__row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.dna-strip__row:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 4px;
  border-radius: 8px;
}

.dna-strip__icon {
  flex: none;
  color: var(--p-primary-color);
  font-size: 1rem;
}

.dna-strip__chevron {
  flex: none;
  margin-left: auto;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.dna-strip__threshold {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.dna-strip__threshold-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.dna-strip__threshold-copy {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.85;
}

.dna-strip__progress {
  height: 6px;
}

.dna-strip__loading {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dna-strip__error {
  width: 100%;
}

.dna-strip__personality {
  margin: 1rem 0 0;
  font-size: 1rem;
  line-height: 1.55;
  opacity: 0.9;
}
</style>
