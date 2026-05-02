<script setup lang="ts">
import type { Book } from '@/types'
import { useLoreCardsStore } from '@/stores/loreCards'
import { useProgressStore } from '@/stores/progress'
import ProgressBar from 'primevue/progressbar'
import { coverFallback } from '@/utils/coverFallback'

defineProps<{
  books: Book[]
}>()

const emit = defineEmits<{
  select: [bookId: string]
  viewBook: [bookId: string]
}>()

const loreStore = useLoreCardsStore()
const progressStore = useProgressStore()
</script>

<template>
  <section class="in-progress glass-surface">
    <h3 class="in-progress__title">
      <i class="pi pi-book-open" /> In Progress
    </h3>
    <TransitionGroup tag="ul" name="in-progress__list" class="in-progress__list" appear>
      <li
        v-for="book in books"
        :key="book.id"
        class="in-progress__item glass-subtle"
        role="button"
        tabindex="0"
        :aria-label="`Switch to ${book.title}`"
        @click="emit('select', book.id)"
        @keydown.enter="emit('select', book.id)"
      >
        <button
          v-if="loreStore.hasUnseenLore(book.id)"
          class="in-progress__lore-chip"
          aria-label="New lore unlocked — tap to view"
          @click.stop="emit('viewBook', book.id)"
        >
          <i class="pi pi-sparkles" />
          New Lore
        </button>
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="book.title"
          class="in-progress__thumb"
          @error="coverFallback"
        />
        <div v-else class="in-progress__thumb in-progress__thumb--placeholder">
          <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
        </div>
        <div class="in-progress__info">
          <span class="in-progress__book-title">{{ book.title }}</span>
          <span class="in-progress__book-author">{{ book.author }}</span>
          <div class="in-progress__progress-row">
            <ProgressBar
              :value="progressStore.percentageForBook(book.id)"
              :show-value="false"
              class="in-progress__bar"
            />
            <span class="in-progress__pct">
              {{ progressStore.percentageForBook(book.id).toFixed(0) }}%
            </span>
          </div>
        </div>
      </li>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.in-progress {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.in-progress__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.in-progress__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.in-progress__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    background 0.15s ease;
}

.in-progress__item:hover {
  opacity: 0.92;
  transform: translateX(2px);
}

.in-progress__item:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.in-progress__thumb {
  width: 44px;
  height: 62px;
  object-fit: cover;
  border-radius: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.in-progress__thumb--placeholder {
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.in-progress__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.in-progress__book-title {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.in-progress__book-author {
  font-size: 0.78rem;
  opacity: 0.6;
}

.in-progress__progress-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.in-progress__bar { flex: 1; }

.in-progress__pct {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 32px;
  text-align: right;
}

.in-progress__lore-chip {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.2rem 0.45rem 0.2rem 0.35rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(167, 139, 250, 0.85));
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition: opacity 0.15s, transform 0.15s;
}

.in-progress__lore-chip:hover {
  opacity: 0.9;
  transform: scale(1.04);
}

.in-progress__list-enter-active,
.in-progress__list-leave-active,
.in-progress__list-move {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.in-progress__list-enter-from,
.in-progress__list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.in-progress__list-leave-active {
  position: absolute;
  width: 100%;
}

.in-progress__lore-chip .pi { font-size: 0.6rem; }

@media (prefers-reduced-motion: reduce) {
  .in-progress__item,
  .in-progress__lore-chip,
  .in-progress__list-enter-active,
  .in-progress__list-leave-active,
  .in-progress__list-move {
    transition: none;
  }

  .in-progress__item:hover,
  .in-progress__list-enter-from,
  .in-progress__list-leave-to {
    transform: none;
  }
}
</style>
