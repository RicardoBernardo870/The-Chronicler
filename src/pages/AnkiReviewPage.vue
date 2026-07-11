<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
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

const {
  dueCards,
  currentCard,
  currentIndex,
  sessionKnown,
  sessionUnknown,
  isComplete,
  missedCards,
  canUndo,
  undoLast,
  onKnew,
  onDidntKnow,
  reviewMore,
  onExit,
} = useAnkiSession()

const bookTitleFor = (bookId: string) =>
  booksStore.bookById(bookId)?.title ?? ''

const handleDone = async () => {
  if (authStore.user) await onExit(authStore.user.id)
  router.push({ name: 'dashboard' })
}

// Deep-link safe: the deck sources from the lexicon store, which only the
// dashboard/Codex normally hydrate. Fetch here too (both store-cached).
const ready = ref(false)
onMounted(async () => {
  try {
    await Promise.all([
      lexiconStore.fetchEntriesForAllBooks(),
      booksStore.fetchLibrary(),
    ])
  } catch {
    /* deck simply stays as-is */
  } finally {
    ready.value = true
  }
})

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
      <button
        v-if="canUndo"
        type="button"
        class="anki-page__undo"
        @click="undoLast"
      >
        <i class="pi pi-undo" aria-hidden="true" /> Undo
      </button>
      <span class="anki-page__progress">
        {{ Math.min(currentIndex + 1, dueCards.length) }} / {{ dueCards.length }}
      </span>
    </header>

    <div
      v-if="dueCards.length > 0"
      class="anki-page__bar"
      role="progressbar"
      :aria-valuenow="Math.min(currentIndex, dueCards.length)"
      :aria-valuemax="dueCards.length"
    >
      <div
        class="anki-page__bar-fill"
        :style="{ width: `${(Math.min(currentIndex, dueCards.length) / dueCards.length) * 100}%` }"
      />
    </div>

    <!-- Loading (deep-link) -->
    <div v-if="!ready && dueCards.length === 0" class="anki-page__deck" />

    <!-- Empty state -->
    <div v-else-if="dueCards.length === 0" class="anki-page__empty glass-surface">
      <div class="anki-page__empty-icon">
        <i class="pi pi-check" />
      </div>
      <template v-if="lexiconStore.extraAvailable">
        <p class="anki-page__empty-title">Daily review done!</p>
        <p class="anki-page__empty-hint">You've cleared today's words — more are waiting.</p>
        <Button label="Review more" icon="pi pi-bolt" class="anki-page__more-btn" @click="reviewMore" />
      </template>
      <template v-else>
        <p class="anki-page__empty-title">You're all caught up!</p>
        <p class="anki-page__empty-hint">No words due for review today.</p>
      </template>
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
      <div v-if="missedCards.length > 0" class="anki-page__missed">
        <p class="anki-page__missed-title">Worth another look</p>
        <ul class="anki-page__missed-list">
          <li v-for="card in missedCards" :key="card.id">
            <span class="anki-page__missed-term">{{ card.term }}</span>
            <span class="anki-page__missed-def">{{ card.definition }}</span>
          </li>
        </ul>
      </div>

      <div class="anki-page__summary-actions">
        <Button
          v-if="lexiconStore.extraAvailable"
          label="Review more"
          icon="pi pi-bolt"
          class="anki-page__more-btn"
          @click="reviewMore"
        />
        <Button label="Back to dashboard" @click="handleDone" />
      </div>
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

.anki-page__more-btn {
  border: 1px solid rgba(99, 102, 241, 0.3) !important;
  background: rgba(99, 102, 241, 0.18) !important;
  color: var(--p-indigo-300) !important;
}

.anki-page__more-btn:hover {
  background: rgba(99, 102, 241, 0.26) !important;
}

:root[data-p-theme="light"] .anki-page__more-btn {
  color: var(--p-indigo-600) !important;
}

.anki-page__undo {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 auto;
  padding: 0.25rem 0.7rem;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-indigo-300);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.anki-page__undo .pi {
  font-size: 0.7rem;
}

.anki-page__undo:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.anki-page__bar {
  height: 4px;
  margin-top: -0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.anki-page__bar-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--p-primary-color);
  transition: width 0.25s ease;
}

.anki-page__missed {
  width: 100%;
  text-align: left;
  margin-top: 0.25rem;
}

.anki-page__missed-title {
  margin: 0 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.55;
}

.anki-page__missed-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.anki-page__missed-list li {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.anki-page__missed-term {
  flex: none;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--p-indigo-300);
}

.anki-page__missed-def {
  overflow: hidden;
  font-size: 0.78rem;
  opacity: 0.65;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .anki-page__bar-fill {
    transition: none;
  }
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

.anki-page__summary-actions {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
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
