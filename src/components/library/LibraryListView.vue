<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Book, LibraryBookEntry } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useBooksStore } from '@/stores/books'
import SwipeableBookCard from '@/components/library/SwipeableBookCard.vue'

const props = defineProps<{
  readingBooks:  LibraryBookEntry[]
  queuedBooks:   LibraryBookEntry[]
  archivedBooks: LibraryBookEntry[]
  velocityMap:   Record<string, VelocityResult>
}>()

const emit = defineEmits<{
  edit:   [book: Book]
  delete: [book: Book]
}>()

const booksStore = useBooksStore()

// Persisted Queue / Completed tab selection
const activeTab = ref<'queue' | 'completed'>(
  (localStorage.getItem('library-active-tab') as 'queue' | 'completed') ?? 'queue',
)
watch(activeTab, (v) => localStorage.setItem('library-active-tab', v))

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
    userId:     '',
    createdAt:  '',
  }
</script>

<template>
  <!-- Pinned: Currently Reading -->
  <section class="now-reading-panel">
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
  <div class="pill-tabs" role="tablist">
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
  </div>

  <!-- Tab content -->
  <div class="pill-tabs__content" role="tabpanel">
    <div v-if="activeTabBooks.length > 0" class="library-list">
      <SwipeableBookCard
        v-for="entry in activeTabBooks"
        :key="entry.id"
        :book="bookFromEntry(entry)"
        @edit="(b) => emit('edit', b)"
        @delete="(b) => emit('delete', b)"
      />
    </div>
    <p v-else class="library-list__empty">
      {{ activeTab === 'queue' ? 'Your queue is empty.' : 'No finished books yet.' }}
    </p>
  </div>
</template>

<style scoped>
.library-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
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

:root[data-p-theme="light"] .now-reading-panel__badge {
  background: rgba(99, 102, 241, 0.1);
  color: var(--p-indigo-600);
}

:root[data-p-theme="light"] .reading-wide-card {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(167, 139, 250, 0.04));
  border-color: rgba(99, 102, 241, 0.2) !important;
  box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
}
</style>
