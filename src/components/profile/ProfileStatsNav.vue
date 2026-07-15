<script setup lang="ts">
// Compact stat pills (books / pages / hours / streak) + the two detail-page
// cards, side by side: Trophy Room (quest goal + reader level) and Reading
// Stats (charts, calendar, lifetime records). Pills open the stats page —
// that's where their full numbers live.
import { useRouter } from 'vue-router'
import { useReadingProfile } from '@/composables/useReadingProfile'

const router = useRouter()
const { booksFinished, totalPagesRead, totalReadingHours, currentStreak } =
  useReadingProfile()

const compact = (value: number): string => {
  if (value >= 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return value.toLocaleString()
}

const openTrophyRoom = () => router.push({ name: 'trophy-room' })
const openStats = () => router.push({ name: 'profile-stats' })
</script>

<template>
  <section class="stats-nav" aria-label="Reading stats">
    <div class="stats-nav__pills">
      <button type="button" class="stats-nav__pill glass-subtle" @click="openStats">
        <span class="stats-nav__value">{{ booksFinished }}</span>
        <span class="stats-nav__label">Books</span>
      </button>
      <button type="button" class="stats-nav__pill glass-subtle" @click="openStats">
        <span class="stats-nav__value">{{ compact(totalPagesRead) }}</span>
        <span class="stats-nav__label">Pages</span>
      </button>
      <button type="button" class="stats-nav__pill glass-subtle" @click="openStats">
        <span class="stats-nav__value">{{ compact(totalReadingHours) }}</span>
        <span class="stats-nav__label">Hours</span>
      </button>
      <button type="button" class="stats-nav__pill glass-subtle" @click="openStats">
        <span class="stats-nav__value">{{ currentStreak }}d</span>
        <span class="stats-nav__label">Streak</span>
      </button>
    </div>

    <div class="stats-nav__cards">
      <button type="button" class="stats-nav__card glass-surface" @click="openTrophyRoom">
        <i class="pi pi-trophy stats-nav__card-icon" aria-hidden="true" />
        <span class="stats-nav__card-meta">
          <span class="stats-nav__card-title">Trophy room</span>
          <span class="stats-nav__card-sub">Quest goal and level</span>
        </span>
      </button>

      <button type="button" class="stats-nav__card glass-surface" @click="openStats">
        <i class="pi pi-chart-bar stats-nav__card-icon" aria-hidden="true" />
        <span class="stats-nav__card-meta">
          <span class="stats-nav__card-title">Stats</span>
          <span class="stats-nav__card-sub">Charts, calendar, records</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.stats-nav {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.stats-nav__pills {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.stats-nav__pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  margin: 0;
  padding: 0.7rem 0.25rem;
  border: none;
  border-radius: 14px;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.stats-nav__pill:focus-visible,
.stats-nav__card:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 2px;
}

.stats-nav__value {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.1;
}

.stats-nav__label {
  color: var(--p-text-muted-color);
  font-size: 0.68rem;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-nav__cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.stats-nav__card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0;
  padding: 0.9rem 0.85rem;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}

.stats-nav__card-icon {
  flex: none;
  color: var(--p-primary-color);
  font-size: 1.1rem;
}

.stats-nav__card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.stats-nav__card-title {
  font-size: 0.92rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stats-nav__card-sub {
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
}
</style>
