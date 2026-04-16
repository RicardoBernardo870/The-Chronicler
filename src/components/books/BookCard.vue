<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@/types'
import { useProgressStore } from '@/stores/progress'

const props = defineProps<{
  book: Book
}>()

const router = useRouter()
const progressStore = useProgressStore()

const percentage = computed(() => progressStore.percentageForBook(props.book.id))

const initials = computed(() =>
  props.book.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join(''),
)

const coverFallback = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

const navigate = () => router.push({ name: 'book-detail', params: { id: props.book.id } })
</script>

<template>
  <article class="book-card glass-surface" role="button" tabindex="0" @click="navigate" @keydown.enter="navigate">
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
      <span v-if="book.genre" class="book-card__genre">{{ book.genre }}</span>
      <h3 class="book-card__title">{{ book.title }}</h3>
      <p class="book-card__author">{{ book.author }}</p>

      <div class="book-card__progress">
        <div class="book-card__progress-track glass-track">
          <div class="book-card__progress-fill" :style="{ width: `${percentage}%` }" />
        </div>
        <span class="book-card__progress-pct">{{ percentage.toFixed(0) }}%</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.book-card {
  display: flex;
  gap: 1rem;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.book-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
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
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.book-card__cover-placeholder {
  position: absolute;
  inset: 0;
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2));
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-card__cover-placeholder--hidden {
  display: none;
}

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

.book-card__genre {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: rgba(99,102,241,0.15);
  align-self: flex-start;
  margin-bottom: 0.15rem;
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
</style>
