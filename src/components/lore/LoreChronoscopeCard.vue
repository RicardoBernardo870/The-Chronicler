<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLoreCardsStore } from '@/stores/loreCards'
import type { LoreCard } from '@/types'
import Skeleton from 'primevue/skeleton'

const props = defineProps<{ bookId: string }>()

const router     = useRouter()
const loreStore  = useLoreCardsStore()

// Track whether this is the initial loading state (skeleton only shown once)
const initialLoading = ref(true)
const currentCard    = ref<LoreCard | null>(null)

// Returns the most recently created card for this book
const latestCard = (): LoreCard | null => {
  const all = loreStore.loreForBook(props.bookId)
  if (all.length === 0) return null
  return [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
}

onMounted(async () => {
  await loreStore.fetchLoreForBook(props.bookId)
  currentCard.value = latestCard()
  initialLoading.value = false
})

const cards = computed(() => loreStore.loreForBook(props.bookId))
const hasMultiple = computed(() => cards.value.length > 1)
const hasLore     = computed(() => cards.value.length > 0)

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

// T027 — refresh cycles to a different card (stopPropagation, FR-022)
// On first refresh, revert to the latest card if we're already showing it — otherwise pick randomly from the rest
const onRefresh = (e: Event): void => {
  e.stopPropagation()
  if (!hasMultiple.value) return

  const available = cards.value.filter(c => c.id !== currentCard.value?.id)
  if (available.length === 0) return
  currentCard.value = available[Math.floor(Math.random() * available.length)]
}

// T028 — card body click navigates to Great Library lore tab (FR-023)
const onCardClick = (): void => {
  router.push({ name: 'lexicon', query: { bookId: props.bookId, tab: 'lore' } })
}
</script>

<template>
  <!-- Skeleton: only on first load when there is no cached data -->
  <template v-if="initialLoading">
    <div class="chronoscope-skeleton glass-surface">
      <Skeleton width="40%" height="0.75rem" border-radius="6px" />
      <Skeleton width="100%" height="0.85rem" border-radius="6px" style="margin-top: 0.5rem" />
      <Skeleton width="80%" height="0.85rem" border-radius="6px" />
    </div>
  </template>

  <!-- Hidden if no lore exists (FR-024) -->
  <template v-else-if="hasLore && currentCard">
    <div
      class="chronoscope glass-surface"
      role="button"
      tabindex="0"
      aria-label="Lore Chronoscope — tap to open Great Library"
      @click="onCardClick"
      @keydown.enter="onCardClick"
      @keydown.space.prevent="onCardClick"
    >
      <!-- Header row -->
      <div class="chronoscope__header">
        <div class="chronoscope__label-row">
          <i class="pi pi-sparkles chronoscope__icon" />
          <span class="chronoscope__label">Lore Chronoscope</span>
          <span :class="['chronoscope__badge', typeColour(currentCard.type)]">
            {{ currentCard.type }}
          </span>
        </div>

        <!-- Refresh icon (T027 / FR-022) -->
        <button
          class="chronoscope__refresh"
          :disabled="!hasMultiple"
          :aria-disabled="!hasMultiple"
          :title="hasMultiple ? 'Show another lore card' : 'Only one lore card unlocked'"
          @click="onRefresh"
        >
          <i class="pi pi-refresh" />
        </button>
      </div>

      <!-- Title -->
      <h3 class="chronoscope__title">{{ currentCard.title }}</h3>

      <!-- Excerpt -->
      <p class="chronoscope__excerpt">{{ excerpt(currentCard.content) }}</p>
    </div>
  </template>

  <!-- No lore: render nothing (fully hidden per ui-contracts.md) -->
  <template v-else />
</template>

<style scoped>
.chronoscope-skeleton {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.chronoscope {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  transition: opacity 0.15s;
  user-select: none;
}

.chronoscope:hover {
  opacity: 0.88;
}

.chronoscope__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chronoscope__label-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.chronoscope__icon {
  font-size: 0.8rem;
  opacity: 0.5;
}

.chronoscope__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.5;
}

.chronoscope__badge {
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

.chronoscope__refresh {
  padding: 0.3rem;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  opacity: 0.45;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chronoscope__refresh:hover:not(:disabled) {
  opacity: 0.9;
}

.chronoscope__refresh:disabled {
  opacity: 0.2;
  cursor: default;
}

.chronoscope__refresh .pi {
  font-size: 0.85rem;
}

.chronoscope__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.chronoscope__excerpt {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.65;
  line-height: 1.5;
}
</style>
