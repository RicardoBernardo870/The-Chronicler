<script setup lang="ts">
import { computed, onMounted } from 'vue'
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

const navigateToLexicon = () => {
  router.push({ name: 'lexicon', query: { bookId: entry.value?.bookId } })
}

const markReviewed = () => {
  if (!entry.value) return
  lexiconStore.updateLeitner(entry.value.id, 'advance')
}

onMounted(() => {
  // Seed WotD selection once entries are available (DashboardPage calls fetchEntriesForAllBooks first)
  if (authStore.user) {
    lexiconStore.resolveWordOfTheDay(authStore.user.id)
  }
})
</script>

<template>
  <article v-if="entry" class="wotd glass-surface" @click="navigateToLexicon">
    <div class="wotd__header">
      <span class="wotd__label"><i class="pi pi-book" /> Word of the Day</span>
      <span v-if="isPreview" class="wotd__preview-badge">Coming up</span>
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
      <button class="wotd__advance-btn" title="Mark as reviewed" @click.stop="markReviewed">
        <i class="pi pi-arrow-right" />
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

.wotd__preview-badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-amber-300);
  background: rgba(245, 158, 11, 0.15);
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
  flex-shrink: 0;
}

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

.wotd__advance-btn:hover { background: rgba(99, 102, 241, 0.28); }
</style>
