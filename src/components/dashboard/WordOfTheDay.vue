<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLexiconStore } from '@/stores/lexicon'
import { useBooksStore } from '@/stores/books'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const lexiconStore = useLexiconStore()
const booksStore = useBooksStore()
const authStore = useAuthStore()

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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff <= 1) return 'tomorrow'
  if (diff <= 6) return `in ${diff} days`
  return `on ${next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
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

onMounted(() => {
  if (authStore.user) {
    lexiconStore.resolveWordOfTheDay(authStore.user.id)
  }
})
</script>

<template>
  <!-- All caught up — no words due today -->
  <article v-if="entry && isPreview" class="wotd wotd--done glass-surface" @click="navigateToLexicon">
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
  <article v-else-if="entry" class="wotd glass-surface" @click="navigateToLexicon">
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-book" /> Word of the Day</span>
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
</template>

<style scoped>
.wotd {
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  cursor: pointer;
  transition: opacity 0.15s;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.wotd:hover { opacity: 0.88; }

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
</style>
