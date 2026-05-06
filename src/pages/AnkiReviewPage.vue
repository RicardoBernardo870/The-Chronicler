<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useLexiconStore } from '@/stores/lexicon'
import { useAuthStore } from '@/stores/auth'
import { useBooksStore } from '@/stores/books'
import { useAnkiSession } from '@/composables/useAnkiSession'
import SwipeableFlashcard from '@/components/anki/SwipeableFlashcard.vue'
import Button from 'primevue/button'

const router = useRouter()
const lexiconStore = useLexiconStore()
const authStore = useAuthStore()
const booksStore = useBooksStore()

const allEntries = computed(() => lexiconStore.allEntries)
const {
  dueCards,
  currentCard,
  currentIndex,
  sessionKnown,
  sessionUnknown,
  isComplete,
  onKnew,
  onDidntKnow,
  onExit,
} = useAnkiSession(allEntries)

const bookTitleFor = (bookId: string) =>
  booksStore.bookById(bookId)?.title ?? ''

const handleDone = async () => {
  if (authStore.user) await onExit(authStore.user.id)
  router.push({ name: 'dashboard' })
}

// Save progress if user navigates away without finishing
onBeforeUnmount(() => {
  if (authStore.user && !isComplete.value) {
    onExit(authStore.user.id)
  }
})
</script>

<template>
  <div class="anki-page">
    <header class="anki-page__header">
      <button class="anki-page__back" @click="handleDone">
        <i class="pi pi-arrow-left" />
      </button>
      <span class="anki-page__progress">
        {{ currentIndex }} / {{ dueCards.length }}
      </span>
    </header>

    <!-- Empty state -->
    <div v-if="dueCards.length === 0" class="anki-page__empty glass-surface">
      <div class="anki-page__empty-icon">
        <i class="pi pi-check" />
      </div>
      <p class="anki-page__empty-title">You're all caught up!</p>
      <p class="anki-page__empty-hint">No words due for review today.</p>
      <Button label="Back to dashboard" severity="secondary" @click="handleDone" />
    </div>

    <!-- Summary -->
    <div v-else-if="isComplete" class="anki-page__summary glass-surface">
      <div class="anki-page__summary-icon">
        <i class="pi pi-star" />
      </div>
      <p class="anki-page__summary-title">
        {{ sessionKnown / dueCards.length >= 0.7 ? 'Great session!' : 'Keep practising!' }}
      </p>
      <div class="anki-page__summary-stats">
        <div class="anki-page__stat">
          <span class="anki-page__stat-value">{{ dueCards.length }}</span>
          <span class="anki-page__stat-label">Reviewed</span>
        </div>
        <div class="anki-page__stat anki-page__stat--known">
          <span class="anki-page__stat-value">{{ sessionKnown }}</span>
          <span class="anki-page__stat-label">Knew it</span>
        </div>
        <div class="anki-page__stat anki-page__stat--unknown">
          <span class="anki-page__stat-value">{{ sessionUnknown }}</span>
          <span class="anki-page__stat-label">Didn't know</span>
        </div>
      </div>
      <Button label="Back to dashboard" @click="handleDone" />
    </div>

    <!-- Cards -->
    <div v-else class="anki-page__deck">
      <Transition name="card-switch" mode="out-in">
        <SwipeableFlashcard
          v-if="currentCard"
          :key="currentCard.id"
          :entry="currentCard"
          :book-title="bookTitleFor(currentCard.bookId)"
          @known="onKnew"
          @unknown="onDidntKnow"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.anki-page {
  min-height: 100svh;
  padding: 1rem 1.25rem calc(1rem + var(--app-nav-bottom-clearance, 4rem));
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.anki-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
}

.anki-page__back {
  background: none;
  border: none;
  color: inherit;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.25rem;
  opacity: 0.7;
}

.anki-page__progress {
  font-size: 0.8rem;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}

.anki-page__deck {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* Empty & summary shared */
.anki-page__empty,
.anki-page__summary {
  border-radius: 16px;
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  margin-top: auto;
  margin-bottom: auto;
}

.anki-page__empty-icon,
.anki-page__summary-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: var(--p-indigo-300);
}

.anki-page__empty-title,
.anki-page__summary-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.anki-page__empty-hint {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.55;
}

.anki-page__summary-stats {
  display: flex;
  gap: 1.5rem;
  margin: 0.5rem 0;
}

.anki-page__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.anki-page__stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.anki-page__stat-label {
  font-size: 0.72rem;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.anki-page__stat--known .anki-page__stat-value { color: var(--p-green-400, #4ade80); }
.anki-page__stat--unknown .anki-page__stat-value { color: var(--p-red-400, #f87171); }

/* Card transition */
.card-switch-enter-active,
.card-switch-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.card-switch-enter-from,
.card-switch-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .card-switch-enter-active,
  .card-switch-leave-active {
    transition: none;
  }
}
</style>
