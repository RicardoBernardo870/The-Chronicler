<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Book, LibraryBookEntry } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useBooksStore } from '@/stores/books'
import SwipeableBookCard from '@/components/library/SwipeableBookCard.vue'
import QueueReorderList from '@/components/library/QueueReorderList.vue'
import Button from 'primevue/button'

const props = defineProps<{
  readingBooks:  LibraryBookEntry[]
  queuedBooks:   LibraryBookEntry[]
  archivedBooks: LibraryBookEntry[]
  velocityMap:   Record<string, VelocityResult>
}>()

const emit = defineEmits<{
  edit:   [book: Book]
  delete: [book: Book]
  reorderQueue: [orderedIds: string[]]
}>()

const booksStore = useBooksStore()
const router = useRouter()

// Persisted Queue / Completed tab selection
const activeTab = ref<'queue' | 'completed'>(
  (localStorage.getItem('library-active-tab') as 'queue' | 'completed') ?? 'queue',
)
watch(activeTab, (v) => {
  localStorage.setItem('library-active-tab', v)
  reorderMode.value = false
})

// Queue reorder mode — swaps the swipe cards for a drag list.
const reorderMode = ref(false)

const activeTabBooks = computed(() =>
  activeTab.value === 'queue' ? props.queuedBooks : props.archivedBooks,
)

// Resolve a Book domain object from a LibraryBookEntry; falls back to a synthetic
// projection if the book isn't yet in the books store cache.
const bookFromEntry = (entry: LibraryBookEntry): Book =>
  booksStore.bookById(entry.id) ?? {
    id:         entry.id,
    title:      entry.title,
    author:     entry.author,
    coverUrl:   entry.coverUrl,
    totalPages: entry.totalPages,
    genre:      entry.genre,
    isbn:       entry.isbn,
    description: entry.description ?? null,
    source:     entry.source,
    pageCountEstimated: entry.pageCountEstimated,
    userId:     '',
    createdAt:  '',
  }
</script>

<template>
  <TransitionGroup name="library-list-view__section" tag="div" class="library-list-view" appear>
    <!-- Pinned: Currently Reading -->
    <section key="reading" class="now-reading-panel">
      <header class="now-reading-panel__header">
        <span class="section-accent section-accent--reading"></span>
        <span class="section-label">Now Reading</span>
        <span class="now-reading-panel__badge">{{ readingBooks.length }}</span>
      </header>

      <div v-if="readingBooks.length > 0" class="library-list reading-card">
        <SwipeableBookCard
          v-for="entry in readingBooks"
          :key="entry.id"
          :book="bookFromEntry(entry)"
          :days-left="velocityMap[entry.id] ?? null"
          @edit="(b) => emit('edit', b)"
          @delete="(b) => emit('delete', b)"
        />
      </div>
      <p v-else class="library-list__empty">No books in progress.</p>
    </section>

    <!-- Pill tabs: Queue / Completed -->
    <div key="tabs" class="pill-tabs" role="tablist">
      <button
        class="pill-tabs__tab"
        :class="{ 'pill-tabs__tab--active': activeTab === 'queue' }"
        role="tab"
        :aria-selected="activeTab === 'queue'"
        @click="activeTab = 'queue'"
      >
        <span class="pill-tabs__label">Queue</span>
        <span class="pill-tabs__count">{{ queuedBooks.length }}</span>
      </button>
      <button
        class="pill-tabs__tab"
        :class="{ 'pill-tabs__tab--active': activeTab === 'completed' }"
        role="tab"
        :aria-selected="activeTab === 'completed'"
        @click="activeTab = 'completed'"
      >
        <span class="pill-tabs__label">Completed</span>
        <span class="pill-tabs__count">{{ archivedBooks.length }}</span>
      </button>
      <button
        type="button"
        class="pill-tabs__reorder"
        :class="{ 'pill-tabs__reorder--active': reorderMode }"
        :disabled="activeTab !== 'queue' || queuedBooks.length < 2"
        :aria-pressed="reorderMode"
        :aria-label="reorderMode ? 'Finish reordering' : 'Reorder queue'"
        :title="reorderMode ? 'Finish reordering' : 'Reorder queue'"
        @click="reorderMode = !reorderMode"
      >
        <i :class="`pi ${reorderMode ? 'pi-check' : 'pi-sort-alt'}`" aria-hidden="true" />
      </button>
    </div>

    <!-- Tab content -->
    <div key="tab-content" class="pill-tabs__content" role="tabpanel">
      <Transition name="library-list-view__tab" mode="out-in" appear>
        <QueueReorderList
          v-if="activeTab === 'queue' && reorderMode"
          key="queue-reorder"
          :books="queuedBooks"
          @update:books="(v) => emit('reorderQueue', v.map((b) => b.id))"
        />
        <div
          v-else-if="activeTabBooks.length > 0"
          :key="activeTab"
          class="library-list"
        >
          <SwipeableBookCard
            v-for="entry in activeTabBooks"
            :key="entry.id"
            :book="bookFromEntry(entry)"
            @edit="(b) => emit('edit', b)"
            @delete="(b) => emit('delete', b)"
          />
        </div>
        <div
          v-else-if="activeTab === 'queue'"
          :key="`${activeTab}-empty`"
          class="library-list__tbr-empty"
        >
          <i class="pi pi-bookmark" />
          <p class="library-list__tbr-empty-text">
            Your Want-to-read shelf is empty. Import your Goodreads or StoryGraph library, or search
            for your next read.
          </p>
          <Button
            label="Add or import books"
            icon="pi pi-plus"
            size="small"
            outlined
            @click="router.push('/books/add')"
          />
        </div>
        <p v-else :key="`${activeTab}-empty`" class="library-list__empty">
          No finished books yet.
        </p>
      </Transition>
    </div>
  </TransitionGroup>
</template>

<style scoped>
.library-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.library-list-view {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.reading-card :deep(.book-card) {
  display: flex;
    gap: 0.875rem;
    padding: 0.75rem;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(167, 139, 250, 0.08));
    border: 1px solid rgba(99, 102, 241, 0.26) !important;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.12), 0 1px 0 rgba(255, 255, 255, 0.05) inset;
}

.library-list__empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.35;
  padding: 0.5rem 0;
}

.library-list__tbr-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  text-align: center;
  padding: 1.5rem 1rem;
}

.library-list__tbr-empty .pi-bookmark {
  font-size: 1.4rem;
  color: var(--p-indigo-300);
  opacity: 0.8;
}

.library-list__tbr-empty-text {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.65;
  line-height: 1.45;
  max-width: 22rem;
}

/* ── Pinned "Now Reading" panel ───────────────────────────────────────── */

.now-reading-panel {
  overflow: hidden;
}

.now-reading-panel__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
}

.now-reading-panel__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--p-indigo-500);
  box-shadow: 0 0 7px rgba(99, 102, 241, 0.85);
  flex-shrink: 0;
}

.section-accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
}

.section-accent--reading { background: var(--p-indigo-500); box-shadow: 0 0 6px rgba(99, 102, 241, 0.7); }

.now-reading-panel__label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--p-indigo-300);
  opacity: 0.85;
}

.now-reading-panel__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.25);
}

/* ── Pill tab strip ───────────────────────────────────────────────────── */

.pill-tabs {
  display: flex;
  gap: 0.375rem;
  padding: 0.1875rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 1rem;
  /* Stays reachable mid-scroll (below the sticky search bar); blur keeps the
     existing translucent background readable without changing its color. */
  position: sticky;
  top: 3.6rem;
  z-index: 50;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.pill-tabs__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.4375rem 0.5rem;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s, box-shadow 0.15s;
}

.pill-tabs__tab--active {
  background: rgba(18, 18, 36, 0.88);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.pill-tabs__label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(226, 228, 240, 0.45);
  transition: color 0.15s;
}

.pill-tabs__tab--active .pill-tabs__label {
  color: rgba(226, 228, 240, 0.9);
}

.pill-tabs__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  background: transparent;
  color: rgba(226, 228, 240, 0.4);
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.pill-tabs__tab--active .pill-tabs__count {
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border-color: rgba(99, 102, 241, 0.25);
}

.pill-tabs__content {
  margin-top: 0.75rem;
}

.pill-tabs__reorder {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: rgba(226, 228, 240, 0.45);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.pill-tabs__reorder .pi {
  font-size: 0.8rem;
}

.pill-tabs__reorder:hover:not(:disabled) {
  color: rgba(226, 228, 240, 0.85);
}

.pill-tabs__reorder:disabled {
  opacity: 0.35;
  cursor: default;
}

.pill-tabs__reorder--active {
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
}

.pill-tabs__reorder:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.library-list-view__section-enter-active,
.library-list-view__section-leave-active,
.library-list-view__section-move,
.library-list-view__tab-enter-active,
.library-list-view__tab-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.library-list-view__section-enter-from,
.library-list-view__section-leave-to,
.library-list-view__tab-enter-from,
.library-list-view__tab-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.library-list-view__section-leave-active {
  position: absolute;
  width: 100%;
}

/* ── Light mode overrides ─────────────────────────────────────────────── */
:root[data-p-theme="light"] .pill-tabs {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

:root[data-p-theme="light"] .pill-tabs__tab--active {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:root[data-p-theme="light"] .pill-tabs__label {
  color: rgba(0, 0, 0, 0.4);
}

:root[data-p-theme="light"] .pill-tabs__tab--active .pill-tabs__label {
  color: rgba(0, 0, 0, 0.85);
}

:root[data-p-theme="light"] .pill-tabs__reorder {
  color: rgba(0, 0, 0, 0.4);
}

:root[data-p-theme="light"] .pill-tabs__reorder:hover:not(:disabled) {
  color: rgba(0, 0, 0, 0.75);
}

:root[data-p-theme="light"] .pill-tabs__reorder--active {
  background: rgba(99, 102, 241, 0.14);
  color: var(--p-indigo-600);
}

:root[data-p-theme="light"] .now-reading-panel__badge {
  background: rgba(99, 102, 241, 0.1);
  color: var(--p-indigo-600);
}

:root[data-p-theme="light"] .reading-wide-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(167, 139, 250, 0.04));
  border-color: rgba(99, 102, 241, 0.2) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
}

@media (prefers-reduced-motion: reduce) {
  .library-list-view__section-enter-active,
  .library-list-view__section-leave-active,
  .library-list-view__section-move,
  .library-list-view__tab-enter-active,
  .library-list-view__tab-leave-active {
    transition: none;
  }

  .library-list-view__section-enter-from,
  .library-list-view__section-leave-to,
  .library-list-view__tab-enter-from,
  .library-list-view__tab-leave-to {
    transform: none;
  }
}
</style>
