<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import BookCard from '@/components/books/BookCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()

onMounted(async () => {
  await booksStore.fetchLibrary()
  await progressStore.fetchProgress()
})

// Sort ascending by progress % (least complete first), updatedAt desc as tie-breaker
const sortedBooks = computed(() =>
  [...booksStore.books].sort((a, b) => {
    const pA = progressStore.percentageForBook(a.id)
    const pB = progressStore.percentageForBook(b.id)
    if (pA !== pB) return pA - pB
    const dateA = progressStore.progressForBook(a.id)?.updatedAt ?? a.createdAt
    const dateB = progressStore.progressForBook(b.id)?.updatedAt ?? b.createdAt
    return new Date(dateB).getTime() - new Date(dateA).getTime()
  })
)
</script>

<template>
  <div class="library">
    <header class="library__header">
      <h1 class="library__title">Library</h1>
      <Button
        icon="pi pi-plus"
        rounded
        aria-label="Add book"
        @click="router.push('/books/add')"
      />
    </header>

    <!-- Loading skeletons -->
    <template v-if="booksStore.loading">
      <div class="library__grid">
        <div v-for="i in 4" :key="i" class="glass-surface" style="border-radius: 16px; padding: 1rem; display: flex; gap: 1rem">
          <Skeleton width="64px" height="92px" border-radius="6px" />
          <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem">
            <Skeleton height="0.875rem" width="60%" />
            <Skeleton height="0.75rem" width="40%" />
            <Skeleton height="4px" style="margin-top: auto" />
          </div>
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <EmptyState
      v-else-if="booksStore.books.length === 0"
      icon="pi-book"
      title="Your library is empty"
      description="Scan an ISBN or add a book manually to start tracking your reading."
    >
      <template #action>
        <Button label="Add your first book" icon="pi pi-plus" @click="router.push('/books/add')" />
      </template>
    </EmptyState>

    <!-- Book list — sorted by progress ascending -->
    <TransitionGroup v-else name="book-list" tag="div" class="library__grid">
      <BookCard
        v-for="book in sortedBooks"
        :key="book.id"
        :book="book"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.library {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.library__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.library__grid {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.book-list-enter-active,
.book-list-leave-active { transition: all 0.3s ease; }
.book-list-enter-from   { opacity: 0; transform: translateY(-6px); }
.book-list-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
