<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useProgressStore } from '@/stores/progress'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{
  book: Book
  daysLeft?: VelocityResult
}>()

const router = useRouter()
const progressStore = useProgressStore()

const percentage  = computed(() => progressStore.percentageForBook(props.book.id))
const currentPage = computed(() => progressStore.progressForBook(props.book.id)?.currentPage ?? 0)

const initials = computed(() =>
  props.book.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)

const daysLeftLabel = computed(() => {
  if (props.daysLeft == null || percentage.value >= 100) return null
  return props.daysLeft === 'today' ? 'Finish today!' : `~${props.daysLeft}d left`
})

const navigate = () => router.push({ name: 'book-detail', params: { id: props.book.id } })
</script>

<template>
  <article
    class="reading-wide-card glass-surface"
    role="button"
    tabindex="0"
    @click="navigate"
    @keydown.enter="navigate"
  >
    <div class="reading-wide-card__cover-wrap">
      <img
        v-if="book.coverUrl"
        :src="book.coverUrl"
        :alt="`Cover of ${book.title}`"
        class="reading-wide-card__cover"
        @error="coverFallback"
      />
      <div v-else class="reading-wide-card__placeholder">
        <span class="reading-wide-card__initials">{{ initials }}</span>
      </div>
    </div>

    <div class="reading-wide-card__body">
      <span v-if="book.genre" class="reading-wide-card__genre">{{ book.genre }}</span>
      <p class="reading-wide-card__title">{{ book.title }}</p>
      <p class="reading-wide-card__author">{{ book.author }}</p>

      <div class="reading-wide-card__progress">
        <div class="reading-wide-card__track glass-track">
          <div class="reading-wide-card__fill" :style="{ width: `${percentage}%` }" />
        </div>
        <span class="reading-wide-card__pct">{{ percentage.toFixed(0) }}%</span>
      </div>

      <div v-if="currentPage > 0 && book.totalPages" class="reading-wide-card__meta">
        <span class="reading-wide-card__page-count">
          p. {{ currentPage }} / {{ book.totalPages }}
        </span>
        <span v-if="daysLeftLabel" class="reading-wide-card__days">
          {{ daysLeftLabel }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.reading-wide-card {
  display: flex;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 16px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(167, 139, 250, 0.08));
  border: 1px solid rgba(99, 102, 241, 0.26) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.12), 0 1px 0 rgba(255, 255, 255, 0.05) inset;
}

.reading-wide-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.2);
}

.reading-wide-card:active { transform: scale(0.98); }

.reading-wide-card__cover-wrap {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 75px;
}

.reading-wide-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

.reading-wide-card__placeholder {
  position: absolute;
  inset: 0;
  border-radius: 5px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
}

.reading-wide-card__initials {
  font-size: 1rem;
  font-weight: 700;
  color: var(--p-indigo-200);
  letter-spacing: -0.02em;
}

.reading-wide-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.reading-wide-card__genre {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
}

.reading-wide-card__title {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reading-wide-card__author {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reading-wide-card__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 0.4rem;
}

.reading-wide-card__track {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  overflow: hidden;
}

.reading-wide-card__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--p-indigo-400), var(--p-violet-400, #a78bfa));
  border-radius: 999px;
  transition: width 0.4s ease;
}

.reading-wide-card__pct {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 28px;
  text-align: right;
}

.reading-wide-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.reading-wide-card__page-count {
  font-size: 0.67rem;
  opacity: 0.45;
}

.reading-wide-card__days {
  font-size: 0.67rem;
  font-weight: 700;
  color: var(--p-indigo-300);
}

:root[data-p-theme="light"] .reading-wide-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(167, 139, 250, 0.04));
  border-color: rgba(99, 102, 241, 0.2) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
}
</style>
