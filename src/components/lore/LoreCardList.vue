<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { LoreCard } from '@/types'
import { useLoreCardsStore } from '@/stores/loreCards'
import LoreCardDetail from '@/components/lore/LoreCardDetail.vue'
import { sortDescByDate } from '@/utils/date'
import Skeleton from 'primevue/skeleton'

const props = defineProps<{ bookId?: string }>()

const loreStore = useLoreCardsStore()
const expandedIds = ref<Set<string>>(new Set())
const loading = ref(true)
let requestId = 0

watch(
  () => props.bookId,
  async (bookId) => {
    const currentRequest = ++requestId
    loading.value = true
    expandedIds.value = new Set()
    try {
      if (bookId) {
        await loreStore.fetchLoreForBook(bookId)
      } else {
        await loreStore.fetchLoreForAllBooks()
      }
    } finally {
      if (currentRequest === requestId) {
        loading.value = false
      }
    }
  },
  { immediate: true },
)

// Sorted by createdAt descending (most recent first, FR-015)
const cards = computed<LoreCard[]>(() => {
  const raw = props.bookId
    ? loreStore.loreForBook(props.bookId)
    : loreStore.allLore

  return sortDescByDate(raw, 'createdAt')
})

const toggleExpand = (id: string) => {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

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

const excerpt = (text: string): string =>
  text.length > 120 ? text.slice(0, 120).trimEnd() + '…' : text
</script>

<template>
  <!-- Skeleton loading -->
  <div v-if="loading" class="lore-list__skeleton-list">
    <Skeleton v-for="i in 3" :key="i" height="104px" border-radius="14px" />
  </div>

  <!-- Empty state (FR-017) -->
  <div v-else-if="cards.length === 0" class="lore-list__empty glass-surface">
    <i class="pi pi-book" style="font-size: 2rem; opacity: 0.25; margin-bottom: 0.5rem" />
    <p>Keep reading to unlock your first lore card.</p>
    <p style="font-size: 0.85rem; opacity: 0.55">
      Lore cards unlock at every 10% reading milestone.
    </p>
  </div>

  <!-- Card list -->
  <div v-else class="lore-list">
    <div
      v-for="card in cards"
      :key="card.id"
      class="lore-list__item glass-surface"
      @click="toggleExpand(card.id)"
    >
      <!-- Collapsed header (always visible) -->
      <div class="lore-list__item-header">
        <div class="lore-list__item-meta">
          <span :class="['lore-list__badge', typeColour(card.type)]">{{ card.type }}</span>
          <span class="lore-list__milestone">Unlocked at {{ card.unlockedAtMilestone }}%</span>
        </div>
        <i :class="['pi', expandedIds.has(card.id) ? 'pi-chevron-up' : 'pi-chevron-down', 'lore-list__chevron']" />
      </div>

      <h3 class="lore-list__item-title">{{ card.title }}</h3>

      <Transition name="collapse">
        <p v-if="!expandedIds.has(card.id)" class="lore-list__excerpt">
          {{ excerpt(card.content) }}
        </p>
      </Transition>

      <!-- Expanded detail (inline, no modal) -->
      <Transition name="expand">
        <LoreCardDetail v-if="expandedIds.has(card.id)" :card="card" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.lore-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 16px;
  gap: 0.25rem;
}

.lore-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.lore-list__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.lore-list__item {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: opacity 0.15s;
}

.lore-list__item:hover {
  opacity: 0.88;
}

.lore-list__item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lore-list__item-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lore-list__badge {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
}

.type-history    { background: rgba(99, 102, 241, 0.18);  color: var(--p-indigo-400); }
.type-culture    { background: rgba(245, 158, 11, 0.18);  color: var(--p-amber-400); }
.type-geography  { background: rgba(16, 185, 129, 0.18);  color: var(--p-emerald-400); }
.type-technology { background: rgba(6, 182, 212, 0.18);   color: var(--p-cyan-400); }
.type-lore       { background: rgba(167, 139, 250, 0.18); color: var(--p-violet-400); }

.lore-list__milestone {
  font-size: 0.72rem;
  opacity: 0.5;
  font-weight: 500;
}

.lore-list__chevron {
  font-size: 0.75rem;
  opacity: 0.45;
  flex-shrink: 0;
}

.lore-list__item-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.lore-list__excerpt {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.65;
  line-height: 1.5;
}

/* Inline expand transition — content fades then container collapses */
.expand-enter-active {
  transition: max-height 0.3s ease, opacity 0.2s ease 0.1s;
  overflow: hidden;
}
.expand-leave-active {
  transition: opacity 0.15s ease, max-height 0.25s ease 0.15s;
  overflow: hidden;
}
.expand-enter-from {
  max-height: 0;
  opacity: 0;
}
.expand-enter-to {
  max-height: 600px;
  opacity: 1;
}
.expand-leave-from {
  max-height: 600px;
  opacity: 1;
}
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Collapsed excerpt — fade + height */
.collapse-enter-active {
  transition: max-height 0.25s ease, opacity 0.2s ease 0.1s;
  overflow: hidden;
}
.collapse-leave-active {
  transition: opacity 0.15s ease, max-height 0.2s ease 0.15s;
  overflow: hidden;
}
.collapse-enter-from {
  max-height: 0;
  opacity: 0;
}
.collapse-enter-to {
  max-height: 100px;
  opacity: 1;
}
.collapse-leave-from {
  max-height: 100px;
  opacity: 1;
}
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .expand-enter-active,
  .expand-leave-active,
  .collapse-enter-active,
  .collapse-leave-active {
    transition: none;
  }
}
</style>
