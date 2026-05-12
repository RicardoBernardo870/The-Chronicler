<template>
  <section class="reading-quest-card glass-surface">
    <div class="quest-header">
      <div>
        <span class="card-kicker">Reading Quest</span>
        <h2>{{ title }}</h2>
      </div>
      <span v-if="quest" class="quest-percent" :aria-label="`${quest.progressPercent}% complete`">
        {{ quest.progressPercent }}%
      </span>
    </div>

    <div v-if="questStore.loading && !summary" class="quest-loading" aria-label="Loading reading quest">
      <Skeleton width="60%" height="1.5rem" />
      <Skeleton height="0.75rem" />
      <Skeleton height="5rem" />
    </div>

    <Message v-else-if="questStore.error" severity="warn" size="small">
      {{ questStore.error }}
    </Message>

    <template v-else-if="summary && !summary.goal">
      <p class="quest-copy">
        Choose a calm yearly target and BookHero will track your pace as you read.
      </p>
      <Button label="Set yearly goal" icon="pi pi-flag" @click="dialogOpen = true" />
      <ReaderLevelStrip :level="summary.level" />
    </template>

    <template v-else-if="summary && quest">
      <div v-if="quest.status !== 'no_goal'" class="quest-status-row">
        <Tag :value="quest.statusLabel" :severity="statusSeverity" rounded />
      </div>

      <div class="quest-progress-panel" aria-label="Quest progress">
        <div class="quest-progress-stat">
          <div>
            <strong>{{ quest.completedBooks }}</strong>
            <span>/ {{ quest.targetBooks }} books</span>
          </div>
        </div>

        <ProgressBar
          :value="quest.progressPercent"
          :show-value="false"
          class="quest-progress-bar"
          aria-label="Yearly reading goal progress"
        />

        <div class="quest-progress-labels">
          <span>{{ quest.completedBooks }} books read</span>
          <span>{{ booksToGo }} to go</span>
        </div>
      </div>

      <div class="quest-grid">
        <div class="quest-metric">
          <span>Pace needed</span>
          <strong>{{ formatMonthlyPace(quest.requiredBooksPerMonth) }}</strong>
        </div>
        <div class="quest-metric">
          <span>Current pace</span>
          <strong>{{ formatMonthlyPace(quest.currentBooksPerMonth) }}</strong>
        </div>
        <div class="quest-metric">
          <span>Forecast</span>
          <strong>{{ projectionText }}</strong>
        </div>
      </div>

      <p class="quest-copy">
        {{ questCopy }}
      </p>

      <div class="quest-actions">
        <Button
          label="Edit goal"
          icon="pi pi-pencil"
          outlined
          :disabled="questStore.saving"
          class="quest-edit-button"
          @click="dialogOpen = true"
        />
      </div>

      <ReaderLevelStrip :level="summary.level" />
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

<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import ReaderLevelStrip from '@/components/profile/ReaderLevelStrip.vue'
import ReadingGoalDialog from '@/components/profile/ReadingGoalDialog.vue'
import { useReadingQuestStore } from '@/stores/readingQuest'
import type { ReadingQuestStatus } from '@/types'

const questStore = useReadingQuestStore()
const dialogOpen = ref(false)

const summary = computed(() => questStore.summary)
const quest = computed(() => summary.value?.quest ?? null)

const title = computed(() => {
  if (!summary.value?.goal) return `Set a ${questStore.currentYear} goal`
  return `${quest.value?.completedBooks ?? 0} of ${summary.value.goal.targetBooks} books`
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

const statusSeverity = computed(() => quest.value ? severityByStatus[quest.value.status] : 'secondary')

const booksToGo = computed(() => {
  if (!quest.value?.targetBooks) return 0
  return Math.max(0, quest.value.targetBooks - quest.value.completedBooks)
})

const projectionText = computed(() => {
  if (!quest.value?.hasProjection || quest.value.projectedBooks === null) return 'Keep logging'
  return `${quest.value.projectedBooks} books`
})

const questCopy = computed(() => {
  if (quest.value?.status && quest.value.status !== 'no_goal') {
    return 'A steady pace keeps the quest alive — small sessions can still turn the ending.'
  }

  switch (quest.value?.status) {
    case 'complete':
      return 'Goal reached. Any extra books this year are victory laps.'
    case 'ahead':
      return 'Your current rhythm is carrying you past the goal.'
    case 'on_track':
      return 'Your pace lines up with the goal nicely.'
    case 'behind':
      return 'A small pace lift should bring the quest back into range.'
    case 'comeback':
      return 'The goal is still useful as a north star; short steady sessions can change the forecast.'
    case 'no_projection':
      return 'Keep logging progress to unlock pace projections.'
    default:
      return ''
  }
})

const formatMonthlyPace = (value: number | null): string => value === null ? 'Warming up' : `${value.toFixed(1)}/mo`

const saveGoal = async (targetBooks: number) => {
  await questStore.saveGoal(targetBooks)
  dialogOpen.value = false
}
</script>

<style scoped>
.reading-quest-card {
  display: grid;
  gap: 1.1rem;
  padding: 1.35rem;
}

.quest-header,
.quest-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.quest-header {
  align-items: flex-start;
}

.card-kicker {
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h2,
.quest-copy {
  margin: 0;
}

h2 {
  margin-top: 0.2rem;
  font-size: 1.45rem;
  line-height: 1.12;
}

.quest-percent {
  display: inline-grid;
  place-items: center;
  min-width: 3.2rem;
  min-height: 3.2rem;
  padding: 0.45rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 999px;
  background: color-mix(in srgb, var(--p-content-background) 68%, transparent);
  color: var(--p-text-color);
  font-size: 0.95rem;
  font-weight: 800;
  white-space: nowrap;
}

.quest-status-row {
  display: flex;
}

.quest-loading {
  display: grid;
  gap: 0.75rem;
}

.quest-progress-panel {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--p-content-background) 62%, transparent);
}

.quest-progress-stat {
  display: flex;
  justify-content: center;
  text-align: center;
}

.quest-progress-stat strong {
  font-size: 2.6rem;
  line-height: 1;
}

.quest-progress-stat span,
.quest-copy,
.quest-grid span {
  color: var(--p-text-muted-color);
}

.quest-progress-bar {
  min-height: 0.7rem;
  overflow: hidden;
  border-radius: 999px;
}

.quest-progress-labels {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: var(--p-text-muted-color);
  font-size: 0.82rem;
  font-weight: 650;
}

.quest-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
}

.quest-metric {
  display: grid;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.8rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  background: color-mix(in srgb, var(--p-content-background) 55%, transparent);
}

.quest-grid strong {
  overflow-wrap: anywhere;
  font-size: 1rem;
  line-height: 1.2;
}

.quest-copy {
  font-size: 0.92rem;
  line-height: 1.45;
}

.quest-edit-button {
  min-height: 2.45rem;
  border-radius: 999px;
}

.quest-edit-button:disabled {
  opacity: 0.72;
}

@media (max-width: 640px) {
  .quest-header,
  .quest-actions {
    align-items: stretch;
  }

  .quest-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quest-metric:last-child {
    grid-column: 1 / -1;
  }

  .quest-percent {
    min-width: auto;
    min-height: auto;
    padding: 0.35rem 0.65rem;
    justify-self: flex-start;
  }
}

@media (max-width: 420px) {
  .reading-quest-card {
    padding: 1.1rem;
  }

  h2 {
    font-size: 1.32rem;
  }
}
</style>
