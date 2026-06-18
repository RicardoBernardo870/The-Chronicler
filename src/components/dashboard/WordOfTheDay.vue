<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLexiconStore } from '@/stores/lexicon'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'
import { useAnkiSessionStore } from '@/stores/ankiSession'
import { diffInDays, formatShortDate } from '@/utils/date'

const router = useRouter()
const lexiconStore = useLexiconStore()
const booksStore = useBooksStore()
const authStore = useAuthStore()
const ankiSessionStore = useAnkiSessionStore()

const showAnkiPrompt = computed(() => {
  if (!ankiSessionStore.isDueForReview) return false
  // 032 — gate on today's capped set, not the raw backlog.
  return lexiconStore.activeReviewWords.length >= 5
})

const entry = computed(() => lexiconStore.wordOfTheDay)
const isPreview = computed(() => lexiconStore.isWordOfTheDayPreview)

const bookTitle = computed(() => {
  if (!entry.value) return ''
  return booksStore.bookById(entry.value.bookId)?.title ?? '(removed book)'
})

// Human-friendly "next review" label derived from the upcoming entry's date
const nextReviewLabel = computed(() => {
  if (!entry.value) return ''
  const next = new Date(entry.value.nextReviewAt)
  const diff = diffInDays(next, new Date())
  if (diff <= 1) return 'tomorrow'
  if (diff <= 6) return `in ${diff} days`
  return `on ${formatShortDate(entry.value.nextReviewAt)}`
})

const navigateToLexicon = () => {
  router.push({ name: 'lexicon', query: { bookId: entry.value?.bookId } })
}

const advancing = ref(false)

const markReviewed = async () => {
  if (!entry.value || advancing.value) return
  advancing.value = true
  try {
    await lexiconStore.updateLeitner(entry.value.id, 'advance')
  } finally {
    advancing.value = false
  }
}

// 032 — lift the daily cap for the rest of the day and resume reviewing.
// (the store clears the WotD cache and re-picks the next word)
const onReviewMore = () => {
  lexiconStore.enableReviewMore()
}

onMounted(() => {
  if (authStore.user) {
    lexiconStore.resolveWordOfTheDay(authStore.user.id)
  }
})
</script>

<template>
  <Transition name="wotd__switch" mode="out-in" appear>
  <!-- Anki review due — replaces WotD entirely -->
  <article
    v-if="showAnkiPrompt"
    key="anki"
    class="wotd wotd--review glass-surface"
    role="button"
    tabindex="0"
    @click="router.push({ name: 'anki-review' })"
    @keydown.enter="router.push({ name: 'anki-review' })"
  >
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-clone" /> Vocabulary Review</span>
    </div>
    <div class="wotd__done-body">
      <div class="wotd__review-icon">
        <i class="pi pi-play" />
      </div>
      <div>
        <p class="wotd__done-title">Ready for review</p>
        <p class="wotd__done-hint">Tap to start your flashcard session.</p>
      </div>
    </div>
  </article>

  <!-- Caught up for today — daily limit reached, but more words remain (032) -->
  <article
    v-else-if="isPreview && lexiconStore.extraAvailable"
    key="today-done"
    class="wotd wotd--done glass-surface"
  >
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-book" /> Word of the Day</span>
    </div>
    <div class="wotd__done-body">
      <div class="wotd__done-icon">
        <i class="pi pi-check" />
      </div>
      <div>
        <p class="wotd__done-title">Daily review done!</p>
        <p class="wotd__done-hint">You've cleared today's words. More are waiting.</p>
      </div>
    </div>
    <button class="wotd__review-more" @click="onReviewMore">
      <i class="pi pi-bolt" /> Review more
    </button>
  </article>

  <!-- All caught up — nothing left to review at all -->
  <article
    v-else-if="entry && isPreview"
    key="done"
    class="wotd wotd--done glass-surface"
    role="button"
    tabindex="0"
    @click="navigateToLexicon"
    @keydown.enter="navigateToLexicon"
  >
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-book" /> Word of the Day</span>
    </div>
    <div class="wotd__done-body">
      <div class="wotd__done-icon">
        <i class="pi pi-check" />
      </div>
      <div>
        <p class="wotd__done-title">All caught up!</p>
        <p class="wotd__done-hint">Next word due {{ nextReviewLabel }}.</p>
      </div>
    </div>
  </article>

  <!-- Normal review card -->
  <article
    v-else-if="entry"
    key="review"
    class="wotd glass-surface"
    role="button"
    tabindex="0"
    @click="navigateToLexicon"
    @keydown.enter="navigateToLexicon"
  >
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-book" /> Word of the Day</span>
      <span v-if="lexiconStore.activeReviewWords.length > 0" class="wotd__count">
        {{ lexiconStore.activeReviewWords.length }} left
      </span>
    </div>

    <div class="wotd__body">
      <p class="wotd__term">{{ entry.term }}</p>
      <p class="wotd__definition">{{ entry.definition }}</p>
    </div>

    <div class="wotd__footer">
      <span class="wotd__source">
        from: <em>{{ bookTitle }}</em>
        <span v-if="entry.pageFound"> · p.{{ entry.pageFound }}</span>
      </span>
      <button
        class="wotd__advance-btn"
        :disabled="advancing"
        title="Mark as reviewed"
        @click.stop="markReviewed"
      >
        <i :class="advancing ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'" />
      </button>
    </div>
  </article>
  </Transition>
</template>

<style scoped>
.wotd {
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    border-color 0.15s ease;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.wotd:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  border-color: rgba(99, 102, 241, 0.36);
}

.wotd:focus-visible,
.wotd__advance-btn:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.wotd__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.wotd__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 1;
}

.wotd__count {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.25);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}

/* ── Anki review due state ───────────────────────────────────────── */

.wotd--review {
  border-color: rgba(99, 102, 241, 0.3);
}

.wotd__review-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--p-indigo-300);
}

.wotd__review-icon .pi { font-size: 0.9rem; }

/* ── All caught up state ─────────────────────────────────────────── */

.wotd--done {
  border-color: rgba(52, 211, 153, 0.2);
}

.wotd__done-body {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.wotd__done-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(52, 211, 153, 0.15);
  border: 1px solid rgba(52, 211, 153, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--p-emerald-400, #34d399);
}

.wotd__done-icon .pi { font-size: 0.9rem; }

.wotd__review-more {
  margin-top: 0.25rem;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  cursor: pointer;
}

.wotd__review-more:hover { background: rgba(99, 102, 241, 0.28); }

.wotd__done-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.wotd__done-hint {
  margin: 0.15rem 0 0;
  font-size: 0.78rem;
  opacity: 0.55;
}

/* ── Normal card ─────────────────────────────────────────────────── */

.wotd__body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.wotd__term {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.wotd__definition {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.5;
  opacity: 0.8;
}

.wotd__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.wotd__source {
  font-size: 0.75rem;
  opacity: 0.55;
}

.wotd__advance-btn {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.25);
  color: var(--p-indigo-300);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.wotd__advance-btn:hover:not(:disabled) { background: rgba(99, 102, 241, 0.28); }
.wotd__advance-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.wotd__switch-enter-active,
.wotd__switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.wotd__switch-enter-from,
.wotd__switch-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .wotd,
  .wotd__advance-btn,
  .wotd__switch-enter-active,
  .wotd__switch-leave-active {
    transition: none;
  }

  .wotd:hover,
  .wotd__switch-enter-from,
  .wotd__switch-leave-to {
    transform: none;
  }
}
</style>
