<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton } from 'primevue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useUpNextStore } from '@/stores/upNext'
import { useLoreCardsStore } from '@/stores/loreCards'
import { useReadingVelocity } from '@/composables/useReadingVelocity'
import type { Book } from '@/types'

import BookEditDialog   from '@/components/books/BookEditDialog.vue'
import LibraryListView  from '@/components/library/LibraryListView.vue'
import LibraryGridView  from '@/components/library/LibraryGridView.vue'
import EmptyState       from '@/components/shared/EmptyState.vue'

// ── Stores / services ───────────────────────────────────────────────────────

const router        = useRouter()
const booksStore    = useBooksStore()
const progressStore = useProgressStore()
const upNextStore   = useUpNextStore()
const loreStore     = useLoreCardsStore()
const toast         = useToast()    // global <Toast> lives in App.vue
const confirm       = useConfirm()  // global <ConfirmDialog> lives in App.vue

// ── View mode (persisted) ──────────────────────────────────────────────────

const viewMode = ref<'list' | 'grid'>(
  (localStorage.getItem('library-view-mode') as 'list' | 'grid') ?? 'list',
)
watch(viewMode, (v) => localStorage.setItem('library-view-mode', v))

// ── Section arrays (list view) ─────────────────────────────────────────────

const readingBooks = computed(() =>
  booksStore.libraryEntries.filter((e) => e.status === 'reading'),
)

const queuedBooks = computed(() => {
  const entries     = booksStore.libraryEntries.filter((e) => e.status === 'unread')
  const orderedIds  = upNextStore.sortedBookIds()
  return [...entries].sort((a, b) => {
    const iA = orderedIds.indexOf(a.id)
    const iB = orderedIds.indexOf(b.id)
    if (iA === -1 && iB === -1) return 0
    if (iA === -1) return 1
    if (iB === -1) return -1
    return iA - iB
  })
})

const archivedBooks = computed(() =>
  booksStore.libraryEntries.filter((e) => e.status === 'finished'),
)

// ── Sorted full set (grid view) ────────────────────────────────────────────

const sortedBooks = computed(() => {
  const books     = [...booksStore.books]
  const upNextIds = upNextStore.sortedBookIds()
  return books.sort((a, b) => {
    const pA   = progressStore.percentageForBook(a.id)
    const pB   = progressStore.percentageForBook(b.id)
    const updA = progressStore.progressForBook(a.id)?.updatedAt ?? a.createdAt
    const updB = progressStore.progressForBook(b.id)?.updatedAt ?? b.createdAt
    const tierA = pA >= 100 ? 3 : pA > 0 ? 1 : 2
    const tierB = pB >= 100 ? 3 : pB > 0 ? 1 : 2
    if (tierA !== tierB) return tierA - tierB
    if (tierA === 1) return new Date(updB).getTime() - new Date(updA).getTime()
    if (tierA === 2) {
      const iA = upNextIds.indexOf(a.id)
      const iB = upNextIds.indexOf(b.id)
      if (iA === -1 && iB === -1) return 0
      if (iA === -1) return 1
      if (iB === -1) return -1
      return iA - iB
    }
    return new Date(updB).getTime() - new Date(updA).getTime()
  })
})

// ── Reading velocity (server-side RPC) ─────────────────────────────────────

const readingBookIds = computed(() => readingBooks.value.map((e) => e.id))
const velocity       = useReadingVelocity(readingBookIds)

// ── Edit / delete handlers (driven by SwipeableBookCard events) ────────────

const editTarget  = ref<Book | null>(null)
const editVisible = ref(false)

const openEditDialog = (book: Book) => {
  editTarget.value  = book
  editVisible.value = true
}

const confirmDelete = (book: Book) => {
  confirm.require({
    message:    `Remove "${book.title}" and all its data? This cannot be undone.`,
    header:     'Remove Book',
    icon:       'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Remove',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await booksStore.removeBook(book.id)
      } catch {
        toast.add({
          severity: 'error',
          summary:  'Remove failed',
          detail:   'Could not remove the book. Try again.',
          life:     3000,
        })
      }
    },
  })
}

// ── Mount ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  await booksStore.fetchLibraryWithProgress()
  await Promise.all([progressStore.fetchProgress(), upNextStore.fetchOrder()])
  loreStore.fetchLoreForAllBooks().catch(() => {})
  await velocity.fetch()
})
</script>

<template>
  <BookEditDialog
    v-if="editTarget"
    :book="editTarget"
    :visible="editVisible"
    @update:visible="editVisible = $event"
    @close="editVisible = false; editTarget = null"
  />

  <div class="library">

    <!-- Header -->
    <header class="library__header">
      <h1 class="library__title">Library</h1>
      <div class="library__header-actions">
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

    <Transition name="library-state" mode="out-in" appear>
      <!-- Loading skeletons -->
      <div v-if="booksStore.loading" key="loading" class="library__skeleton-list">
        <div
          v-for="i in 3"
          :key="i"
          class="glass-surface library__skeleton-row"
        >
          <Skeleton width="64px" height="92px" border-radius="6px" />
          <div class="library__skeleton-text">
            <Skeleton height="0.875rem" width="60%" />
            <Skeleton height="0.75rem" width="40%" />
            <Skeleton height="4px" style="margin-top: auto" />
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <EmptyState
        v-else-if="booksStore.books.length === 0"
        key="empty"
        icon="pi-book"
        title="Your library is empty"
        description="Scan an ISBN or add a book manually to start tracking your reading."
      >
        <template #action>
          <Button
            label="Add your first book"
            icon="pi pi-plus"
            @click="router.push('/books/add')"
          />
        </template>
      </EmptyState>

      <Transition v-else name="library-view" mode="out-in" appear>
        <!-- Grid view -->
        <LibraryGridView
          v-if="viewMode === 'grid'"
          key="grid"
          :books="sortedBooks"
          :velocity-map="velocity.velocityMap.value"
        />

        <!-- List view -->
        <LibraryListView
          v-else
          key="list"
          :reading-books="readingBooks"
          :queued-books="queuedBooks"
          :archived-books="archivedBooks"
          :velocity-map="velocity.velocityMap.value"
          @edit="openEditDialog"
          @delete="confirmDelete"
        />
      </Transition>
    </Transition>

  </div>
</template>

<style scoped>
.library {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.library__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.library__skeleton-row {
  border-radius: 16px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
}

.library__skeleton-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.library-state-enter-active,
.library-state-leave-active,
.library-view-enter-active,
.library-view-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.library-state-enter-from,
.library-state-leave-to,
.library-view-enter-from,
.library-view-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .library-state-enter-active,
  .library-state-leave-active,
  .library-view-enter-active,
  .library-view-leave-active {
    transition: none;
  }

  .library-state-enter-from,
  .library-state-leave-to,
  .library-view-enter-from,
  .library-view-leave-to {
    transform: none;
  }
}
</style>
