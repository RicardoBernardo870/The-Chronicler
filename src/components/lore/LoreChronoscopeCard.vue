<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLoreCardsStore } from '@/stores/loreCards'
import type { LoreCard } from '@/types'
import Skeleton from 'primevue/skeleton'
import LoreCardDetail from '@/components/lore/LoreCardDetail.vue'

const props = defineProps<{
  bookId: string
  /** When true, renders as a click-to-expand card (same pattern as LoreCardList). */
  collapsible?: boolean
  /** Only consulted when collapsible is true — renders collapsed on first paint. */
  initialCollapsed?: boolean
}>()

const router    = useRouter()
const loreStore = useLoreCardsStore()

const initialLoading = ref(true)

// ── Reactivity (FR-018, 010-dashboard-ux-sync) ────────────────────────────
const currentCardIndex = ref<number>(0)

const cards = computed(() => loreStore.loreForBook(props.bookId))
const hasMultiple = computed(() => cards.value.length > 1)
const hasLore     = computed(() => cards.value.length > 0)

const currentCard = computed<LoreCard | null>(() => {
  const all = cards.value
  if (all.length === 0) return null
  const clamped = Math.min(Math.max(currentCardIndex.value, 0), all.length - 1)
  return all[clamped]
})

onMounted(async () => {
  await loreStore.fetchLoreForBook(props.bookId)
  if (cards.value.length > 0) currentCardIndex.value = cards.value.length - 1
  initialLoading.value = false
})

// Jump to newly arrived card (FR-018, 010-dashboard-ux-sync)
watch(
  () => cards.value.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) currentCardIndex.value = newLen - 1
  },
)

// ── Collapsible expand state ───────────────────────────────────────────────
// Starts expanded unless initialCollapsed is explicitly true
const isExpanded = ref<boolean>(!(props.initialCollapsed ?? false))

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
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

// Cycle to a random different card
const onRefresh = (e: Event): void => {
  e.stopPropagation()
  if (!hasMultiple.value) return
  const available = cards.value
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.id !== currentCard.value?.id)
  if (available.length === 0) return
  const chosen = available[Math.floor(Math.random() * available.length)]
  currentCardIndex.value = chosen.i
  // Expand when cycling so the new card is immediately visible
  isExpanded.value = true
}

// Non-collapsible card click: navigate to Great Library lore tab
const onCardClick = (): void => {
  router.push({ name: 'lexicon', query: { bookId: props.bookId, tab: 'lore' } })
}
</script>

<template>
  <!-- Skeleton: only on first load -->
  <template v-if="initialLoading">
    <div class="lore-card-skeleton glass-surface">
      <Skeleton width="40%" height="0.75rem" border-radius="6px" />
      <Skeleton width="100%" height="0.85rem" border-radius="6px" style="margin-top: 0.5rem" />
      <Skeleton width="80%" height="0.85rem" border-radius="6px" />
    </div>
  </template>

  <!-- Collapsible mode: same card pattern as LoreCardList (lines 68-86) -->
  <template v-else-if="collapsible && hasLore && currentCard">
    <div
      class="lore-card glass-surface"
      @click="toggleExpand"
    >
      <!-- Header (always visible) — mirrors LoreCardList item-header -->
      <div class="lore-card__header">
        <div class="lore-card__meta">
          <span :class="['lore-card__badge', typeColour(currentCard.type)]">{{ currentCard.type }}</span>
          <span class="lore-card__milestone">Unlocked at {{ currentCard.unlockedAtMilestone }}%</span>
        </div>
        <div class="lore-card__controls">
          <!-- Cycle button (only when multiple cards exist) -->
          <button
            v-if="hasMultiple"
            class="lore-card__cycle"
            :title="`Card ${currentCardIndex + 1} of ${cards.length} — click to cycle`"
            @click.stop="onRefresh"
          >
            <i class="pi pi-refresh" />
          </button>
          <i :class="['pi', isExpanded ? 'pi-chevron-up' : 'pi-chevron-down', 'lore-card__chevron']" />
        </div>
      </div>

      <!-- Title (always visible) -->
      <h3 class="lore-card__title">{{ currentCard.title }}</h3>

      <!-- Excerpt when collapsed -->
      <p v-if="!isExpanded" class="lore-card__excerpt">
        {{ excerpt(currentCard.content) }}
      </p>

      <!-- Expanded detail — same component used by LoreCardList -->
      <Transition name="expand">
        <LoreCardDetail v-if="isExpanded" :card="currentCard" />
      </Transition>
    </div>
  </template>

  <!-- Non-collapsible mode: original compact card (click → Great Library) -->
  <template v-else-if="hasLore && currentCard">
    <div
      class="lore-card-compact glass-surface"
      role="button"
      tabindex="0"
      aria-label="Lore Chronoscope — tap to open Great Library"
      @click="onCardClick"
      @keydown.enter="onCardClick"
      @keydown.space.prevent="onCardClick"
    >
      <div class="lore-card-compact__header">
        <div class="lore-card-compact__label-row">
          <i class="pi pi-sparkles lore-card-compact__icon" />
          <span class="lore-card-compact__label">Lore Chronoscope</span>
          <span :class="['lore-card__badge', typeColour(currentCard.type)]">{{ currentCard.type }}</span>
        </div>
        <button
          class="lore-card__cycle"
          :disabled="!hasMultiple"
          :title="hasMultiple ? 'Show another lore card' : 'Only one lore card unlocked'"
          @click.stop="onRefresh"
        >
          <i class="pi pi-refresh" />
        </button>
      </div>
      <h3 class="lore-card__title">{{ currentCard.title }}</h3>
      <p class="lore-card__excerpt">{{ excerpt(currentCard.content) }}</p>
    </div>
  </template>

  <template v-else />
</template>

<style scoped>
/* ── Skeleton ─────────────────────────────────────────────────────────── */
.lore-card-skeleton {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

/* ── Collapsible card (LoreCardList pattern) ────────────────────────── */
.lore-card {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: opacity 0.15s;
}

.lore-card:hover {
  opacity: 0.88;
}

.lore-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lore-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lore-card__badge {
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

.lore-card__milestone {
  font-size: 0.72rem;
  opacity: 0.5;
  font-weight: 500;
}

.lore-card__controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.lore-card__chevron {
  font-size: 0.75rem;
  opacity: 0.45;
  flex-shrink: 0;
}

.lore-card__cycle {
  padding: 0.25rem 0.35rem;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  opacity: 0.4;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lore-card__cycle:hover:not(:disabled) {
  opacity: 0.9;
}

.lore-card__cycle:disabled {
  opacity: 0.15;
  cursor: default;
}

.lore-card__cycle .pi {
  font-size: 0.8rem;
}

.lore-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.lore-card__excerpt {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.65;
  line-height: 1.5;
}

/* Expand/collapse transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
}

/* ── Non-collapsible compact card (unchanged behaviour) ─────────────── */
.lore-card-compact {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: opacity 0.15s;
  user-select: none;
}

.lore-card-compact:hover { opacity: 0.88; }

.lore-card-compact__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lore-card-compact__label-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.lore-card-compact__icon {
  font-size: 0.8rem;
  opacity: 0.5;
}

.lore-card-compact__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.5;
}
</style>
