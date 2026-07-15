<script setup lang="ts">
// Achievements — the actual trophies in the Trophy Room. Earned badges are
// lit with the primary color (+ earned date when persisted); locked ones
// stay dimmed with their unlock hint visible, so the wall doubles as a
// quest board.
import { useAchievements } from '@/composables/useAchievements'
import { formatShortDate } from '@/utils/date'

const { list, earnedCount, totalCount } = useAchievements()
</script>

<template>
  <section class="achievements glass-surface" aria-label="Achievements">
    <div class="achievements__header">
      <h2 class="achievements__title">
        <i class="pi pi-shield" aria-hidden="true" /> Achievements
      </h2>
      <span class="achievements__count">{{ earnedCount }} of {{ totalCount }}</span>
    </div>

    <div class="achievements__grid">
      <div
        v-for="a in list"
        :key="a.key"
        class="achievements__badge glass-subtle"
        :class="{ 'achievements__badge--locked': !a.earned }"
      >
        <span class="achievements__icon-wrap">
          <i :class="`pi ${a.earned ? a.icon : 'pi-lock'}`" aria-hidden="true" />
        </span>
        <span class="achievements__name">{{ a.title }}</span>
        <span class="achievements__desc">{{ a.description }}</span>
        <span v-if="a.earned && a.earnedAt" class="achievements__date">
          {{ formatShortDate(a.earnedAt) }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.achievements {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.achievements__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.achievements__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.achievements__title .pi {
  color: var(--p-primary-color);
  font-size: 0.9rem;
}

.achievements__count {
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
  font-weight: 650;
  white-space: nowrap;
}

.achievements__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}

.achievements__badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.3rem;
  padding: 0.85rem 0.5rem;
  border-radius: 14px;
  min-width: 0;
}

.achievements__icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 18%, transparent);
}

.achievements__icon-wrap .pi {
  color: var(--p-primary-color);
  font-size: 1rem;
}

.achievements__name {
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.2;
}

.achievements__desc {
  color: var(--p-text-muted-color);
  font-size: 0.66rem;
  line-height: 1.35;
}

.achievements__date {
  color: var(--p-primary-color);
  font-size: 0.62rem;
  font-weight: 650;
}

.achievements__badge--locked {
  opacity: 0.55;
}

.achievements__badge--locked .achievements__icon-wrap {
  background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
}

.achievements__badge--locked .achievements__icon-wrap .pi {
  color: var(--p-text-muted-color);
}
</style>
