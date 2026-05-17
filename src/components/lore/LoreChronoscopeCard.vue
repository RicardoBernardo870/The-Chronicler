<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useLoreCardsStore } from "@/stores/loreCards";
import type { LoreCard } from "@/types";
import Skeleton from "primevue/skeleton";
import Panel from "primevue/panel";
import LoreCardDetail from "@/components/lore/LoreCardDetail.vue";
import { Button } from "primevue";

const props = defineProps<{
  bookId: string;
  collapsible?: boolean;
  initialCollapsed?: boolean;
}>();

const router = useRouter();
const loreStore = useLoreCardsStore();

const initialLoading = ref(true);

const currentCardIndex = ref<number>(0);

const cards = computed(() => loreStore.loreForBook(props.bookId));
const hasMultiple = computed(() => cards.value.length > 1);
const hasLore = computed(() => cards.value.length > 0);

const currentCard = computed<LoreCard | null>(() => {
  const all = cards.value;
  if (all.length === 0) return null;
  const clamped = Math.min(Math.max(currentCardIndex.value, 0), all.length - 1);
  return all[clamped];
});

onMounted(async () => {
  await loreStore.fetchLoreForBook(props.bookId);
  if (cards.value.length > 0) currentCardIndex.value = cards.value.length - 1;
  initialLoading.value = false;
});

watch(
  () => cards.value.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) currentCardIndex.value = newLen - 1;
  },
);

const panelCollapsed = ref(props.initialCollapsed ?? true);
const togglePanel = () => {
  panelCollapsed.value = !panelCollapsed.value;
};

const typeColour = (type: LoreCard["type"]): string => {
  switch (type) {
    case "History":
      return "type-history";
    case "Culture":
      return "type-culture";
    case "Geography":
      return "type-geography";
    case "Technology":
      return "type-technology";
    case "Lore":
      return "type-lore";
    default:
      return "";
  }
};

const onRefresh = (e: Event): void => {
  e.stopPropagation();
  if (!hasMultiple.value) return;
  const available = cards.value
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.id !== currentCard.value?.id);
  if (available.length === 0) return;
  const chosen = available[Math.floor(Math.random() * available.length)];
  currentCardIndex.value = chosen.i;
  panelCollapsed.value = false;
};

const onCardClick = (): void => {
  router.push({
    name: "lexicon",
    query: { bookId: props.bookId, tab: "lore" },
  });
};
</script>

<template>
  <!-- Skeleton: only on first load -->
  <template v-if="initialLoading">
    <div class="lore-card-skeleton glass-surface">
      <Skeleton width="40%" height="0.75rem" border-radius="6px" />
      <Skeleton
        width="100%"
        height="0.85rem"
        border-radius="6px"
        style="margin-top: 0.5rem"
      />
      <Skeleton width="80%" height="0.85rem" border-radius="6px" />
    </div>
  </template>

  <!-- Collapsible mode: PrimeVue Panel -->
  <template v-else-if="collapsible && hasLore && currentCard">
    <Panel
      v-model:collapsed="panelCollapsed"
      toggleable
      class="lore-chronoscope__panel"
    >
      <template #header>
        <div class="lore-chronoscope__panel-header" @click="togglePanel">
          <div class="lore-chronoscope__meta">
            <span
              :class="['lore-chronoscope__badge', typeColour(currentCard.type)]"
              >{{ currentCard.type }}</span
            >
            <span class="lore-chronoscope__milestone"
              >Unlocked at {{ currentCard.unlockedAtMilestone }}%</span
            >
          </div>
          <h3 class="lore-chronoscope__title">{{ currentCard.title }}</h3>
        </div>

        <button
          v-if="hasMultiple"
          class="lore-chronoscope__cycle"
          :title="`Card ${currentCardIndex + 1} of ${cards.length} — click to cycle`"
          @click.stop="onRefresh"
        >
          <i class="pi pi-refresh" />
        </button>
      </template>

      <LoreCardDetail :card="currentCard" />
    </Panel>
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
          <span
            :class="['lore-chronoscope__badge', typeColour(currentCard.type)]"
            >{{ currentCard.type }}</span
          >
        </div>
        <Button
          class="lore-chronoscope__cycle"
          :disabled="!hasMultiple"
          :title="
            hasMultiple
              ? 'Show another lore card'
              : 'Only one lore card unlocked'
          "
          @click.stop="onRefresh"
        >
          <i class="pi pi-refresh" />
        </Button>
      </div>
      <h3 class="lore-chronoscope__title">{{ currentCard.title }}</h3>
      <p class="lore-chronoscope__excerpt">
        {{
          currentCard.content.length > 120
            ? currentCard.content.slice(0, 120).trimEnd() + "…"
            : currentCard.content
        }}
      </p>
    </div>
  </template>

  <div v-else class="lore-chronoscope__empty" aria-hidden="true" />
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

/* ── Panel overrides to match glass-surface style ── */
.lore-chronoscope__panel {
  border-radius: 14px !important;
  border: 1px solid rgba(167, 139, 250, 0.2) !important;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(167, 139, 250, 0.08)) !important;
  color: rgba(255, 255, 255, 0.9) !important;
}

html[data-p-theme="light"] .lore-chronoscope__panel {
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

html[data-p-theme="light"] :deep(.p-panel-toggle-icon) {
  color: rgba(0, 0, 0, 0.45) !important;
}

.lore-chronoscope__panel-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.lore-chronoscope__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.lore-chronoscope__badge {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 5px;
}

.type-history {
  background: rgba(99, 102, 241, 0.18);
  color: var(--p-indigo-400);
}
.type-culture {
  background: rgba(245, 158, 11, 0.18);
  color: var(--p-amber-400);
}
.type-geography {
  background: rgba(16, 185, 129, 0.18);
  color: var(--p-emerald-400);
}
.type-technology {
  background: rgba(6, 182, 212, 0.18);
  color: var(--p-cyan-400);
}
.type-lore {
  background: rgba(167, 139, 250, 0.18);
  color: var(--p-violet-400);
}

.lore-chronoscope__milestone {
  font-size: 0.72rem;
  opacity: 0.5;
  font-weight: 500;
}

.lore-chronoscope__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.lore-chronoscope__excerpt {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.65;
  line-height: 1.5;
}

.lore-chronoscope__cycle {
  padding: 0.25rem 0.35rem;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  border-radius: 6px;
  opacity: 0.4;
  transition: opacity 0.15s;
  margin-right: 13px;
  margin-top: 3px;
}

.lore-chronoscope__cycle:hover:not(:disabled) {
  opacity: 0.9;
}

.lore-chronoscope__cycle:disabled {
  opacity: 0.15;
  cursor: default;
}

.lore-chronoscope__cycle .pi {
  font-size: 0.8rem;
}

/* ── Non-collapsible compact card ─────────────────────────────────────── */
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

.lore-card-compact:hover {
  opacity: 0.88;
}

.lore-chronoscope__empty {
  display: none;
}

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

@media (prefers-reduced-motion: reduce) {
  :deep(.p-collapsible-enter-active),
  :deep(.p-collapsible-leave-active) {
    transition: none !important;
  }
}
</style>
