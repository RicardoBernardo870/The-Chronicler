<template>
  <section class="level-strip" aria-label="Reader level">
    <div class="level-header">
      <span class="level-kicker">Level {{ level.level }}</span>
      <strong>{{ level.totalXp.toLocaleString() }} XP</strong>
    </div>

    <h3>{{ level.title }}</h3>

    <ProgressBar
      :value="level.progressPercent"
      :show-value="false"
      class="level-progress"
      aria-label="Reader level progress"
    />

    <p>
      <template v-if="level.xpToNextLevel > 0">
        {{ level.xpToNextLevel.toLocaleString() }} XP to {{ nextTitle }}
      </template>
      <template v-else>
        Library Legend status secured.
      </template>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProgressBar from 'primevue/progressbar'
import { LEVEL_TITLES } from '@/stores/readingQuest'
import type { ReaderXpSummary } from '@/types'

const props = defineProps<{
  level: ReaderXpSummary
}>()

const nextTitle = computed(() => LEVEL_TITLES[props.level.level + 1] ?? 'the next level')
</script>

<style scoped>
.level-strip {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 16px;
  background: color-mix(in srgb, var(--p-content-background) 62%, transparent);
}

.level-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.level-kicker {
  color: var(--p-text-muted-color);
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

h3,
p {
  margin: 0;
}

h3 {
  font-size: 1.1rem;
  line-height: 1.15;
}

strong {
  color: var(--p-text-color);
  font-size: 0.95rem;
  white-space: nowrap;
}

.level-progress {
  min-height: 0.62rem;
  overflow: hidden;
  border-radius: 999px;
}

p {
  color: var(--p-text-muted-color);
  font-size: 0.88rem;
  font-weight: 650;
}

@media (max-width: 420px) {
  .level-strip {
    padding: 0.9rem;
  }
}
</style>
