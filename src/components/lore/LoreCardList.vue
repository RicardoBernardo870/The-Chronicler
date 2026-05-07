<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { LoreCard } from '@/types'
import { useLoreCardsStore } from '@/stores/loreCards'
import LoreCardDetail from '@/components/lore/LoreCardDetail.vue'
import { sortDescByDate } from '@/utils/date'
import Skeleton from 'primevue/skeleton'
import Panel from 'primevue/panel'

const props = defineProps<{ bookId?: string }>()

const loreStore = useLoreCardsStore()
const loading = ref(true)
let requestId = 0

watch(
  () => props.bookId,
  async (bookId) => {
    const currentRequest = ++requestId
    loading.value = true
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

const collapsedState = ref<Record<string, boolean>>({})
const isCollapsed = (id: string) => collapsedState.value[id] ?? true
const toggleCard = (id: string) => { collapsedState.value[id] = !isCollapsed(id) }

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
    <Panel
      v-for="card in cards"
      :key="card.id"
      toggleable
      :collapsed="isCollapsed(card.id)"
      class="lore-list__panel"
      @update:collapsed="(v: boolean) => collapsedState[card.id] = v"
    >
      <template #header>
        <div class="lore-list__panel-header" @click="toggleCard(card.id)">
          <div class="lore-list__item-meta">
            <span :class="['lore-list__badge', typeColour(card.type)]">{{ card.type }}</span>
            <span class="lore-list__milestone">Unlocked at {{ card.unlockedAtMilestone }}%</span>
          </div>
          <h3 class="lore-list__item-title">{{ card.title }}</h3>
        </div>
      </template>

      <LoreCardDetail :card="card" />
    </Panel>
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

/* ── Panel overrides to match glass-surface style ── */
.lore-list__panel {
  border-radius: 14px !important;
  border: 1px solid rgba(167, 139, 250, 0.2) !important;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(167, 139, 250, 0.08)) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

html[data-p-theme='light'] .lore-list__panel {
  border-color: rgba(99, 102, 241, 0.18) !important;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(167, 139, 250, 0.06)) !important;
  color: rgba(0, 0, 0, 0.85) !important;
}

:deep(.p-panel-header) {
  background: transparent !important;
  border: none !important;
  padding: 1rem 1.1rem !important;
  cursor: pointer;
}

:deep(.p-panel-content) {
  background: transparent !important;
  border: none !important;
  padding: 0 1.1rem 1rem !important;
}

:deep(.p-panel-toggle-icon) {
  color: rgba(255, 255, 255, 0.6) !important;
  font-size: 0.75rem;
}

html[data-p-theme='light'] :deep(.p-panel-toggle-icon) {
  color: rgba(0, 0, 0, 0.45) !important;
}

.lore-list__panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
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

.lore-list__item-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.p-collapsible-enter-active),
  :deep(.p-collapsible-leave-active) {
    transition: none !important;
  }
}
</style>
