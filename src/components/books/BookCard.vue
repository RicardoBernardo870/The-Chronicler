<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useProgressStore } from '@/stores/progress'
import { useLoreCardsStore } from '@/stores/loreCards'
import Chip from 'primevue/chip'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  book: Book
  daysLeft?: VelocityResult
}>()

const router = useRouter()
const progressStore = useProgressStore()
const loreStore = useLoreCardsStore()

const percentage    = computed(() => progressStore.percentageForBook(props.book.id))
const currentPage   = computed(() => progressStore.progressForBook(props.book.id)?.currentPage ?? 0)
const hasNewLore    = computed(() => loreStore.hasUnseenLore(props.book.id))
const showPageCount = computed(() => currentPage.value > 0 && props.book.totalPages > 0)
const isImported = computed(() => props.book.source !== 'manual')        // 034
const pageCountEstimated = computed(() => props.book.pageCountEstimated)  // 034 / FR-007
const daysLeftLabel = computed(() => {
  if (props.daysLeft == null || percentage.value >= 100) return null
  return props.daysLeft === 'today' ? 'Finish today!' : `~${props.daysLeft} days left`
})

const initials = computed(() =>
  props.book.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)

const navigate = () => router.push({ name: 'book-detail', params: { id: props.book.id } })

// "New Lore" chip tap — stopPropagation, then navigate to book detail
// (markBookLoreSeen fires on BookDetailPage mount, clearing the chip)
const onNewLoreChip = (e: Event) => {
  e.stopPropagation()
  navigate()
}
</script>

<template>
  <article class="book-card glass-surface" role="button" tabindex="0" @click="navigate" @keydown.enter="navigate">
    <!-- "New Lore" chip (FR-026, FR-027) -->
    <button
      v-if="hasNewLore"
      class="book-card__new-lore-chip"
      aria-label="New lore unlocked — tap to view"
      @click="onNewLoreChip"
    >
      <i class="pi pi-sparkles" />
      New Lore
    </button>

    <div class="book-card__cover-wrap">
      <img
        v-if="book.coverUrl"
        :src="book.coverUrl"
        :alt="`Cover of ${book.title}`"
        class="book-card__cover"
        @error="coverFallback"
      />
      <div class="book-card__cover-placeholder" :class="{ 'book-card__cover-placeholder--hidden': book.coverUrl }">
        <span class="book-card__initials">{{ initials }}</span>
      </div>
    </div>

    <div class="book-card__body">
      <div class="book-card__tags">
        <Chip v-if="book.genre" :label="book.genre" class="book-card__genre" />
        <span v-if="isImported" class="book-card__imported">
          <i class="pi pi-file-import" /> Imported
        </span>
      </div>
      <h3 class="book-card__title">{{ book.title }}</h3>
      <p class="book-card__author">{{ book.author }}</p>

      <div class="book-card__progress">
        <div class="book-card__progress-track glass-track">
          <div class="book-card__progress-fill" :style="{ width: `${percentage}%` }" />
        </div>
        <span class="book-card__progress-pct">{{ percentage.toFixed(0) }}%</span>
      </div>

      <div v-if="showPageCount || daysLeftLabel || pageCountEstimated" class="book-card__meta">
        <span v-if="showPageCount" class="book-card__page-count">
          Page {{ currentPage }} of {{ book.totalPages }}
        </span>
        <span v-if="pageCountEstimated" class="book-card__page-fix">
          <i class="pi pi-exclamation-circle" /> Set page count
        </span>
        <span v-if="daysLeftLabel" class="book-card__days-left">
          {{ daysLeftLabel }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.book-card {
  position: relative;
  display: flex;
  gap: 1rem;
  padding: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.book-card:active { transform: scale(0.98); }

.book-card__cover-wrap {
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 92px;
}

.book-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.book-card__cover-placeholder {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-card__cover-placeholder--hidden { display: none; }

.book-card__initials {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--p-indigo-200);
  letter-spacing: -0.02em;
}

.book-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.book-card__tags {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.15rem;
}

.book-card__genre {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
}

.book-card__imported {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  opacity: 0.7;
}

.book-card__imported .pi {
  font-size: 0.6rem;
}

.book-card__page-fix {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--p-amber-400, #fbbf24);
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.book-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card__author {
  margin: 0;
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.5rem;
}

.book-card__progress-track {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
}

.book-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--p-indigo-400), var(--p-violet-400, #a78bfa));
  border-radius: 999px;
  transition: width 0.4s ease;
}

.book-card__progress-pct {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 32px;
  text-align: right;
}

.book-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.2rem;
  flex-wrap: wrap;
}

.book-card__page-count {
  font-size: 0.7rem;
  opacity: 0.55;
  font-weight: 500;
}

.book-card__days-left {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--p-indigo-300);
}

/* ── New Lore chip (FR-026) ───────────────────────────────────────────────── */

.book-card__new-lore-chip {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.25rem 0.55rem 0.25rem 0.45rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(167, 139, 250, 0.85));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition: opacity 0.15s, transform 0.15s;
}

.book-card__new-lore-chip:hover {
  opacity: 0.9;
  transform: scale(1.04);
}

.book-card__new-lore-chip .pi {
  font-size: 0.65rem;
}
</style>
