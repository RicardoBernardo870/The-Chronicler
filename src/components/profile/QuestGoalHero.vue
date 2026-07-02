<script setup lang="ts">
// Trophy Room hero — the yearly quest as a large progress ring with the pace
// metrics as a quiet inline row, replacing the old full-width quest card.
// Goal editing reuses ReadingGoalDialog.
import { computed, ref } from 'vue'
import { Button, Message, Skeleton, Tag } from 'primevue'
import ReadingGoalDialog from '@/components/profile/ReadingGoalDialog.vue'
import { useReadingQuestStore } from '@/stores/readingQuest'
import type { ReadingQuestStatus } from '@/types'

const RING_RADIUS = 62
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const questStore = useReadingQuestStore()
const dialogOpen = ref(false)

const summary = computed(() => questStore.summary)
const quest = computed(() => summary.value?.quest ?? null)

const ringPercent = computed(() => {
  if (!quest.value?.targetBooks) return 0
  return Math.min(100, Math.max(0, quest.value.progressPercent))
})

const ringDash = computed(() => {
  const filled = (ringPercent.value / 100) * RING_CIRCUMFERENCE
  return `${filled} ${RING_CIRCUMFERENCE}`
})

const severityByStatus: Record<ReadingQuestStatus, 'success' | 'info' | 'warn' | 'secondary'> = {
  no_goal: 'secondary',
  no_projection: 'info',
  ahead: 'success',
  on_track: 'success',
  behind: 'warn',
  comeback: 'info',
  complete: 'success',
}

const statusSeverity = computed(() =>
  quest.value ? severityByStatus[quest.value.status] : 'secondary',
)

const booksToGo = computed(() => {
  if (!quest.value?.targetBooks) return 0
  return Math.max(0, quest.value.targetBooks - quest.value.completedBooks)
})

const formatPace = (value: number | null): string =>
  value === null ? '—' : `${value.toFixed(1)}/mo`

const forecastText = computed(() => {
  if (!quest.value?.hasProjection || quest.value.projectedBooks === null) return '—'
  return `${quest.value.projectedBooks}`
})

const saveGoal = async (targetBooks: number) => {
  await questStore.saveGoal(targetBooks)
  dialogOpen.value = false
}
</script>

<template>
  <section class="quest-hero glass-surface" aria-label="Reading quest">
    <div v-if="questStore.loading && !summary" class="quest-hero__loading">
      <Skeleton shape="circle" size="9rem" />
      <Skeleton width="60%" height="1.2rem" />
    </div>

    <Message v-else-if="questStore.error" severity="warn" size="small">
      {{ questStore.error }}
    </Message>

    <!-- No goal yet -->
    <template v-else-if="summary && !summary.goal">
      <div class="quest-hero__empty">
        <i class="pi pi-flag quest-hero__empty-icon" aria-hidden="true" />
        <p class="quest-hero__empty-copy">
          Choose a calm yearly target and BookHero will track your pace as you
          read.
        </p>
        <Button
          label="Set yearly goal"
          icon="pi pi-flag"
          rounded
          @click="dialogOpen = true"
        />
      </div>
    </template>

    <!-- Goal set -->
    <template v-else-if="summary && quest">
      <div class="quest-hero__top">
        <Tag :value="quest.statusLabel" :severity="statusSeverity" rounded />
        <Button
          icon="pi pi-pencil"
          text
          rounded
          size="small"
          aria-label="Edit yearly goal"
          :disabled="questStore.saving"
          @click="dialogOpen = true"
        />
      </div>

      <div class="quest-hero__ring-wrap">
        <svg class="quest-hero__ring" viewBox="0 0 140 140" aria-hidden="true">
          <circle class="quest-hero__ring-track" cx="70" cy="70" :r="RING_RADIUS" />
          <circle
            class="quest-hero__ring-progress"
            cx="70"
            cy="70"
            :r="RING_RADIUS"
            :stroke-dasharray="ringDash"
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div class="quest-hero__ring-center">
          <span class="quest-hero__count">
            {{ quest.completedBooks }}<span class="quest-hero__target">/{{ quest.targetBooks }}</span>
          </span>
          <span class="quest-hero__count-label">
            {{ quest.status === 'complete' ? 'quest complete' : `${booksToGo} to go` }}
          </span>
        </div>
      </div>

      <dl class="quest-hero__pace-row">
        <div class="quest-hero__pace">
          <dt>Pace needed</dt>
          <dd>{{ formatPace(quest.requiredBooksPerMonth) }}</dd>
        </div>
        <div class="quest-hero__pace">
          <dt>Your pace</dt>
          <dd>{{ formatPace(quest.currentBooksPerMonth) }}</dd>
        </div>
        <div class="quest-hero__pace">
          <dt>Forecast</dt>
          <dd>{{ forecastText }}</dd>
        </div>
      </dl>
    </template>

    <ReadingGoalDialog
      v-model:visible="dialogOpen"
      :year="questStore.currentYear"
      :current-target="summary?.goal?.targetBooks ?? null"
      :saving="questStore.saving"
      :error="questStore.error"
      @save="saveGoal"
    />
  </section>
</template>

<style scoped>
.quest-hero {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.1rem 1.25rem 1.35rem;
}

.quest-hero__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 0.5rem 0;
}

.quest-hero__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quest-hero__ring-wrap {
  position: relative;
  align-self: center;
  width: 150px;
  height: 150px;
}

.quest-hero__ring {
  width: 150px;
  height: 150px;
}

.quest-hero__ring-track,
.quest-hero__ring-progress {
  fill: none;
  stroke-width: 9;
}

.quest-hero__ring-track {
  stroke: var(--p-content-border-color);
}

.quest-hero__ring-progress {
  stroke: var(--p-primary-color);
  stroke-linecap: round;
  transition: stroke-dasharray 0.7s ease;
}

.quest-hero__ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
}

.quest-hero__count {
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
}

.quest-hero__target {
  color: var(--p-text-muted-color);
  font-size: 1.15rem;
  font-weight: 700;
}

.quest-hero__count-label {
  color: var(--p-text-muted-color);
  font-size: 0.74rem;
  font-weight: 650;
}

.quest-hero__pace-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
}

.quest-hero__pace {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  text-align: center;
}

.quest-hero__pace dt {
  color: var(--p-text-muted-color);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quest-hero__pace dd {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.quest-hero__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0;
  text-align: center;
}

.quest-hero__empty-icon {
  color: var(--p-primary-color);
  font-size: 1.4rem;
}

.quest-hero__empty-copy {
  margin: 0;
  max-width: 30ch;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .quest-hero__ring-progress {
    transition: none;
  }
}
</style>
