<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Book } from '@/types'
import { useProgressStore } from '@/stores/progress'
import { coverFallback } from '@/utils/coverFallback'

const props = defineProps<{ book: Book }>()

const router = useRouter()
const progressStore = useProgressStore()

const percentage = computed(() => progressStore.percentageForBook(props.book.id))

const initials = computed(() =>
  props.book.title
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
)

const navigate = () => router.push({ name: 'book-detail', params: { id: props.book.id } })
</script>

<template>
  <article class="book-grid-card" role="button" tabindex="0" @click="navigate" @keydown.enter="navigate">
    <div class="book-grid-card__cover-wrap">
      <img
        v-if="book.coverUrl"
        :src="book.coverUrl"
        :alt="`Cover of ${book.title}`"
        class="book-grid-card__cover"
        @error="coverFallback"
      />
      <div class="book-grid-card__placeholder" :class="{ 'book-grid-card__placeholder--hidden': book.coverUrl }">
        <span class="book-grid-card__initials">{{ initials }}</span>
      </div>

      <!-- Frosted scrim with title/author overlay -->
      <div class="book-grid-card__scrim">
        <p class="book-grid-card__title">{{ book.title }}</p>
        <p class="book-grid-card__author">{{ book.author }}</p>
      </div>
    </div>

    <!-- Progress bar below the card -->
    <div class="book-grid-card__progress-track">
      <div class="book-grid-card__progress-fill" :style="{ width: `${percentage}%` }" />
    </div>
  </article>
</template>

<style scoped>
.book-grid-card {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
}

.book-grid-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,0.35); }
.book-grid-card:active { transform: scale(0.97); }

/* Cover: 2:3 aspect ratio */
.book-grid-card__cover-wrap {
  position: relative;
  aspect-ratio: 2 / 3;
  width: 100%;
  background: rgba(99, 102, 241, 0.12);
}

.book-grid-card__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.book-grid-card__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2));
}

.book-grid-card__placeholder--hidden { display: none; }

.book-grid-card__initials {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--p-indigo-200);
  letter-spacing: -0.02em;
}

/* Frosted scrim at bottom */
.book-grid-card__scrim {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem 0.6rem 0.6rem;
  background: linear-gradient(to top, rgba(10,10,20,0.85) 0%, transparent 100%);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.book-grid-card__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}

.book-grid-card__author {
  margin: 0;
  font-size: 0.68rem;
  color: rgba(255,255,255,0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Progress bar — 3px, indigo fill */
.book-grid-card__progress-track {
  height: 3px;
  background: rgba(255,255,255,0.08);
  border-radius: 0 0 10px 10px;
  overflow: hidden;
}

.book-grid-card__progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--p-indigo-400), var(--p-violet-400, #a78bfa));
  transition: width 0.4s ease;
}
</style>
