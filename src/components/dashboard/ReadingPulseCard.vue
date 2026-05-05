<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { useRetentionSummary } from '@/composables/useRetentionSummary'
import { useProgressStore } from '@/stores/progress'
import type { RetentionSummary } from '@/types'
import {
  getReadingPulseCelebration,
  getReadingPulseState,
  readingPulseErrorState,
  readingPulseLoadingState,
  type ReadingPulseCelebration,
} from '@/domain/retention/rules'

const emit = defineEmits<{
  continueReading: []
}>()

const {
  summary,
  loading,
  error,
  fetchRetentionSummary,
} = useRetentionSummary()
const progressStore = useProgressStore()
const previousSummary = ref<RetentionSummary | null>(null)
const celebration = ref<ReadingPulseCelebration | null>(null)
const dismissedCelebrationIds = ref(new Set<string>())

const state = computed(() => {
  if (loading.value && !summary.value) return readingPulseLoadingState()
  if (error.value && !summary.value) return readingPulseErrorState()
  return getReadingPulseState(summary.value)
})

onMounted(() => {
  fetchRetentionSummary().catch(() => {})
})

watch(summary, (next) => {
  const nextCelebration = getReadingPulseCelebration(
    previousSummary.value,
    next,
    progressStore.lastSessionEnded !== null,
  )
  previousSummary.value = next ? { ...next } : null

  if (!nextCelebration || dismissedCelebrationIds.value.has(nextCelebration.id)) return
  celebration.value = nextCelebration
})

const dismissCelebration = () => {
  if (celebration.value) dismissedCelebrationIds.value.add(celebration.value.id)
  celebration.value = null
}
</script>

<template>
  <section class="reading-pulse glass-surface" :class="`reading-pulse--${state.tone}`">
    <Transition name="reading-pulse__celebration">
      <div v-if="celebration" class="reading-pulse__celebration" role="status">
        <div>
          <p class="reading-pulse__celebration-title">{{ celebration.title }}</p>
          <p class="reading-pulse__celebration-body">{{ celebration.body }}</p>
        </div>
        <button
          class="reading-pulse__celebration-dismiss"
          type="button"
          aria-label="Dismiss Reading Pulse celebration"
          @click="dismissCelebration"
        >
          <i class="pi pi-times" />
        </button>
      </div>
    </Transition>

    <div class="reading-pulse__header">
      <span class="reading-pulse__eyebrow">
        <i class="pi pi-wave-pulse" />
        Reading Pulse
      </span>
      <span class="reading-pulse__count">{{ state.sessionsLabel }}</span>
    </div>

    <div class="reading-pulse__body">
      <div class="reading-pulse__copy">
        <h3 class="reading-pulse__title">{{ state.title }}</h3>
        <p class="reading-pulse__text">{{ state.body }}</p>
      </div>

      <Button
        class="reading-pulse__action"
        :label="state.nextActionLabel"
        icon="pi pi-book"
        size="small"
        text
        @click="emit('continueReading')"
      />
    </div>

    <div class="reading-pulse__progress-row">
      <ProgressBar
        :value="state.progressValue"
        :show-value="false"
        class="reading-pulse__progress"
      />
      <span class="reading-pulse__progress-label">{{ state.progressLabel }}</span>
    </div>
  </section>
</template>

<style scoped>
.reading-pulse {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.reading-pulse:hover {
  transform: translateY(-1px);
}

.reading-pulse--goal-met {
  border-color: color-mix(in srgb, var(--p-green-400) 38%, transparent) !important;
}

.reading-pulse--comeback {
  border-color: color-mix(in srgb, var(--p-primary-color) 38%, transparent) !important;
}

.reading-pulse--error {
  border-color: color-mix(in srgb, var(--p-orange-400) 35%, transparent) !important;
}

.reading-pulse__celebration {
  border-radius: 12px;
  padding: 0.75rem 0.85rem;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--p-primary-color) 24%, transparent);
}

.reading-pulse__celebration-title,
.reading-pulse__celebration-body {
  margin: 0;
}

.reading-pulse__celebration-title {
  font-size: 0.82rem;
  font-weight: 800;
}

.reading-pulse__celebration-body {
  margin-top: 0.15rem;
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
  line-height: 1.4;
}

.reading-pulse__celebration-dismiss {
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 8px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.55;
}

.reading-pulse__celebration-dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.06);
}

.reading-pulse__celebration-dismiss:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: 2px;
}

.reading-pulse__header,
.reading-pulse__body,
.reading-pulse__progress-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.reading-pulse__header {
  justify-content: space-between;
}

.reading-pulse__eyebrow,
.reading-pulse__count,
.reading-pulse__progress-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.reading-pulse__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.reading-pulse__body {
  justify-content: space-between;
  align-items: flex-end;
}

.reading-pulse__copy {
  min-width: 0;
}

.reading-pulse__title {
  margin: 0;
  font-size: 1rem;
  line-height: 1.25;
}

.reading-pulse__text {
  margin: 0.25rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.86rem;
  line-height: 1.45;
}

.reading-pulse__action {
  flex-shrink: 0;
}

.reading-pulse__progress {
  flex: 1;
  min-width: 0;
}

.reading-pulse__progress-label {
  min-width: 5.5rem;
  text-align: right;
}

@media (max-width: 520px) {
  .reading-pulse__body {
    align-items: stretch;
    flex-direction: column;
  }

  .reading-pulse__action {
    align-self: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reading-pulse {
    transition: none;
  }

  .reading-pulse__celebration-enter-active,
  .reading-pulse__celebration-leave-active {
    transition: none;
  }

  .reading-pulse:hover {
    transform: none;
  }
}

.reading-pulse__celebration-enter-active,
.reading-pulse__celebration-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.reading-pulse__celebration-enter-from,
.reading-pulse__celebration-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
