<script setup lang="ts">
import { computed } from 'vue'
import type { Recap } from '@/types'
import { formatShortDate } from '@/utils/date'
import RecapImagePanel from '@/components/recap/RecapImagePanel.vue'

// History journal entry — same story layout as RecapDialog (image, byline,
// arc prose, watchlist chips, open-thread quote), no accordions.
const props = defineProps<{
  recap: Recap
  // Journal framing (both derived from the chronologically previous recap;
  // omitted for standalone usage — the chip falls back to a single page).
  fromPage?: number | null
  daysSinceLast?: number | null
}>()

const formatDate = (iso: string): string => formatShortDate(iso)

// Delta ranges are (fromPage, toPage] — display starts at fromPage + 1.
// A regenerated same-range recap degenerates to a single page label.
const rangeLabel = computed(() => {
  const to = props.recap.pageSnapshot
  if (to == null) return 'page —'
  const from = Math.max(0, props.fromPage ?? 0) + 1
  return from >= to ? `page ${to}` : `pages ${from}–${to}`
})

const bylineText = computed(() => {
  const parts: string[] = []
  if (props.recap.mode === 'corpus') parts.push('From your captures')
  const days = props.daysSinceLast
  if (days != null && days >= 1) parts.push(days === 1 ? '1 day later' : `${days} days later`)
  return parts.join(' · ')
})

const watchlistItems = computed(() =>
  props.recap.conceptWatchlist
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
</script>

<template>
  <article class="recap-card glass-surface">
    <header class="recap-card__header">
      <span class="recap-card__progress">
        <i class="pi pi-chart-bar" />
        {{ rangeLabel }} · {{ recap.progressSnapshot }}%
      </span>
      <time class="recap-card__date" :datetime="recap.createdAt">
        {{ formatDate(recap.createdAt) }}
      </time>
    </header>

    <RecapImagePanel
      :recap-id="recap.id"
      :image-status="recap.imageStatus"
      :image-path="recap.imagePath"
    />

    <p v-if="bylineText" class="recap-card__byline">
      <i v-if="recap.mode === 'corpus'" class="pi pi-camera" aria-hidden="true" />
      {{ bylineText }}
    </p>

    <p class="recap-card__prose">{{ recap.memoryJogger }}</p>

    <template v-if="watchlistItems.length">
      <p class="recap-card__chips-label">Keep an eye on</p>
      <div class="recap-card__chips">
        <span v-for="item in watchlistItems" :key="item" class="recap-card__chip">
          {{ item }}
        </span>
      </div>
    </template>

    <p v-if="recap.thematicBridge" class="recap-card__thread">
      {{ recap.thematicBridge }}
    </p>
  </article>
</template>

<style scoped>
.recap-card {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
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

/* Stretch the shared image panel edge-to-edge inside the card */
.recap-card :deep(.recap-image-panel) {
  max-width: none;
}

.recap-card__byline {
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--p-emerald-300, #6ee7b7);
}

.recap-card__byline .pi { font-size: 0.75rem; }

.recap-card__prose {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  opacity: 0.9;
}

.recap-card__chips-label {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.5;
}

.recap-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.recap-card__chip {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  opacity: 0.9;
}

.recap-card__thread {
  margin: 0.15rem 0 0;
  padding-left: 0.75rem;
  border-left: 2px solid var(--p-indigo-300);
  font-size: 0.85rem;
  font-style: italic;
  opacity: 0.8;
}

[data-p-theme='light'] .recap-card__progress {
  color: var(--p-primary-700, #4338ca);
}

[data-p-theme='light'] .recap-card__byline {
  color: var(--p-emerald-600, #059669);
}
</style>
