<script setup lang="ts">
import type { Recap } from '@/types'

const props = defineProps<{
  recap: Recap
}>()

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
</script>

<template>
  <article class="recap-card glass-surface">
    <header class="recap-card__header">
      <span class="recap-card__progress">
        <i class="pi pi-chart-bar" />
        {{ recap.progressSnapshot }}% through
      </span>
      <time class="recap-card__date" :datetime="recap.createdAt">
        {{ formatDate(recap.createdAt) }}
      </time>
    </header>

    <div class="recap-card__sections">
      <div class="recap-card__section glass-subtle">
        <span class="recap-card__section-label recap-card__section-label--memory">
          <i class="pi pi-book" /> Memory Jogger
        </span>
        <p class="recap-card__section-body">{{ recap.memoryJogger }}</p>
      </div>

      <div class="recap-card__section glass-subtle">
        <span class="recap-card__section-label recap-card__section-label--concepts">
          <i class="pi pi-list" /> Concept Watchlist
        </span>
        <div class="recap-card__chips">
          <span
            v-for="item in recap.conceptWatchlist.split(',').map(s => s.trim()).filter(Boolean)"
            :key="item"
            class="recap-chip"
          >{{ item }}</span>
        </div>
      </div>

      <div class="recap-card__section glass-subtle">
        <span class="recap-card__section-label recap-card__section-label--bridge">
          <i class="pi pi-compass" /> Thematic Bridge
        </span>
        <p class="recap-card__section-body">{{ recap.thematicBridge }}</p>
      </div>
    </div>
  </article>
</template>

<style scoped>
.recap-card {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.recap-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.recap-card__progress {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--p-indigo-300);
}

.recap-card__date {
  font-size: 0.75rem;
  opacity: 0.55;
}

.recap-card__sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.recap-card__section {
  border-radius: var(--p-border-radius-lg, 12px);
  padding: 0.875rem 1rem;
}

.recap-card__section-label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
}

.recap-card__section-label--memory {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}

.recap-card__section-label--concepts {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
}

.recap-card__section-label--bridge {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
}

.recap-card__section-body {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  opacity: 0.90;
}

.recap-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.recap-chip {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  opacity: 0.90;
  border: 1px solid rgba(99, 102, 241, 0.20);
}
</style>
