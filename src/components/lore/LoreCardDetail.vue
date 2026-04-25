<script setup lang="ts">
import type { LoreCard } from '@/types'
import { formatShortDate } from '@/utils/date'

defineProps<{ card: LoreCard }>()

const typeColour = (type: LoreCard['type']): string => {
  switch (type) {
    case 'History':    return 'type-history'
    case 'Culture':    return 'type-culture'
    case 'Geography':  return 'type-geography'
    case 'Technology': return 'type-technology'
    case 'Lore':       return 'type-lore'
    default:           return ''
  }
}

const formatDate = (iso: string): string => formatShortDate(iso)
</script>

<template>
  <div class="lore-detail">
    <div class="lore-detail__header">
      <h2 class="lore-detail__title">{{ card.title }}</h2>
      <span :class="['lore-detail__badge', typeColour(card.type)]">{{ card.type }}</span>
    </div>

    <p class="lore-detail__body">{{ card.content }}</p>

    <div v-if="card.linkedEntities.length > 0" class="lore-detail__entities">
      <span class="lore-detail__entities-label">Mentions:</span>
      <span
        v-for="entity in card.linkedEntities"
        :key="entity"
        class="lore-detail__entity-chip"
      >{{ entity }}</span>
    </div>

    <p class="lore-detail__footer">
      Unlocked on {{ formatDate(card.createdAt) }} at {{ card.unlockedAtMilestone }}%
    </p>
  </div>
</template>

<style scoped>
.lore-detail {
  padding: 1rem 0 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.lore-detail__header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.lore-detail__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  flex: 1;
}

.lore-detail__badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  flex-shrink: 0;
}

.type-history    { background: rgba(99, 102, 241, 0.18); color: var(--p-indigo-400); }
.type-culture    { background: rgba(245, 158, 11, 0.18); color: var(--p-amber-400); }
.type-geography  { background: rgba(16, 185, 129, 0.18); color: var(--p-emerald-400); }
.type-technology { background: rgba(6, 182, 212, 0.18);  color: var(--p-cyan-400); }
.type-lore       { background: rgba(167, 139, 250, 0.18); color: var(--p-violet-400); }

.lore-detail__body {
  margin: 0;
  font-size: 0.925rem;
  line-height: 1.6;
  max-width: 680px;
  opacity: 0.9;
}

.lore-detail__entities {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.lore-detail__entities-label {
  opacity: 0.55;
  font-weight: 500;
}

.lore-detail__entity-chip {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 0.15rem 0.45rem;
  font-size: 0.78rem;
}

html[data-p-theme='light'] .lore-detail__entity-chip {
  background: rgba(0, 0, 0, 0.06);
}

.lore-detail__footer {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.45;
}
</style>
