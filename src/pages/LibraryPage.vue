<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useUpNextStore } from '@/stores/upNext'
import { useLoreCardsStore } from '@/stores/loreCards'
import BookCard from '@/components/books/BookCard.vue'
import BookGridCard from '@/components/books/BookGridCard.vue'
import EmptyState from '@/components/shared/EmptyState.vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const upNextStore = useUpNextStore()
const loreStore = useLoreCardsStore()

// View mode — persisted to localStorage
const viewMode = ref<'list' | 'grid'>(
  (localStorage.getItem('library-view-mode') as 'list' | 'grid') ?? 'list'
)
watch(viewMode, v => localStorage.setItem('library-view-mode', v))

onMounted(async () => {
  // 017 — single RPC replaces sequential fetchLibrary + fetchProgress pair
  await booksStore.fetchLibraryWithProgress()
  await Promise.all([
    progressStore.fetchProgress(),
    upNextStore.fetchOrder(),
  ])
  // Fetch all lore so hasUnseenLore() is reactive on every BookCard (FR-026, T035)
  loreStore.fetchLoreForAllBooks().catch(() => { /* silent — Library is best-effort for chips */ })
})

// 4-tier sort:
// 1. Most-recently-updated in-progress book first
// 2. Other in-progress books ascending by %
// 3. 0%-progress books in up-next order
// 4. Completed (100%) books last
const sortedBooks = computed(() => {
  const books = [...booksStore.books]
  const upNextIds = upNextStore.sortedBookIds()

  return books.sort((a, b) => {
    const pA = progressStore.percentageForBook(a.id)
    const pB = progressStore.percentageForBook(b.id)
    const updA = progressStore.progressForBook(a.id)?.updatedAt ?? a.createdAt
    const updB = progressStore.progressForBook(b.id)?.updatedAt ?? b.createdAt

    const tierA = pA >= 100 ? 3 : pA > 0 ? 1 : 2
    const tierB = pB >= 100 ? 3 : pB > 0 ? 1 : 2

    if (tierA !== tierB) return tierA - tierB

    // Tier 1: in-progress — most recently updated first
    if (tierA === 1) return new Date(updB).getTime() - new Date(updA).getTime()

    // Tier 2: 0% — follow up-next order, unordered books go last
    if (tierA === 2) {
      const iA = upNextIds.indexOf(a.id)
      const iB = upNextIds.indexOf(b.id)
      if (iA === -1 && iB === -1) return 0
      if (iA === -1) return 1
      if (iB === -1) return -1
      return iA - iB
    }

    // Tier 3: completed — most recently finished first
    return new Date(updB).getTime() - new Date(updA).getTime()
  })
})
</script>

<template>
  <div class="library">
    <header class="library__header">
      <h1 class="library__title">Library</h1>
      <div class="library__header-actions">
        <!-- View toggle -->
        <div class="library__view-toggle">
          <Button
            icon="pi pi-list"
            :text="viewMode !== 'list'"
            :outlined="viewMode === 'list'"
            size="small"
            rounded
            aria-label="List view"
            @click="viewMode = 'list'"
          />
          <Button
            icon="pi pi-th-large"
            :text="viewMode !== 'grid'"
            :outlined="viewMode === 'grid'"
            size="small"
            rounded
            aria-label="Grid view"
            @click="viewMode = 'grid'"
          />
        </div>
        <Button
          icon="pi pi-plus"
          rounded
          aria-label="Add book"
          @click="router.push('/books/add')"
        />
      </div>
    </header>

    <!-- Loading skeletons -->
    <template v-if="booksStore.loading">
      <div class="library__list">
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

    <!-- Grid view -->
    <div v-else-if="viewMode === 'grid'" class="library__grid">
      <BookGridCard
        v-for="book in sortedBooks"
        :key="book.id"
        :book="book"
      />
    </div>

    <!-- List view -->
    <TransitionGroup v-else name="book-list" tag="div" class="library__list">
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
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.library__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.library__view-toggle {
  display: flex;
  gap: 0.25rem;
}

.library__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.library__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
}

.book-list-enter-active,
.book-list-leave-active { transition: all 0.3s ease; }
.book-list-enter-from   { opacity: 0; transform: translateY(-6px); }
.book-list-leave-to     { opacity: 0; transform: translateY(6px); }
</style>
