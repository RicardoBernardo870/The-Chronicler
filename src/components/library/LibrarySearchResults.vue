<script setup lang="ts">
// Flat search results for the library, grouped by status with the same
// section headers and cards the list view uses — no new styling vocabulary.
import { computed } from 'vue'
import type { Book, LibraryBookEntry } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useBooksStore } from '@/stores/books'
import SwipeableBookCard from '@/components/library/SwipeableBookCard.vue'

const props = defineProps<{
  results: LibraryBookEntry[]
  query: string
  velocityMap: Record<string, VelocityResult>
}>()

const emit = defineEmits<{
  edit: [book: Book]
  delete: [book: Book]
}>()

const booksStore = useBooksStore()

const bookFromEntry = (entry: LibraryBookEntry): Book =>
  booksStore.bookById(entry.id) ?? {
    id: entry.id,
    title: entry.title,
    author: entry.author,
    coverUrl: entry.coverUrl,
    totalPages: entry.totalPages,
    genre: entry.genre,
    isbn: entry.isbn,
    description: entry.description ?? null,
    source: entry.source,
    pageCountEstimated: entry.pageCountEstimated,
    userId: '',
    createdAt: '',
  }

interface ResultGroup {
  key: string
  label: string
  accentClass: string
  badgeClass: string
  entries: LibraryBookEntry[]
}

const groups = computed<ResultGroup[]>(() =>
  (
    [
      {
        key: 'reading',
        label: 'Now Reading',
        accentClass: 'section-accent--reading',
        badgeClass: 'section-badge--reading',
        entries: props.results.filter((e) => e.status === 'reading'),
      },
      {
        key: 'queue',
        label: 'Queue',
        accentClass: 'section-accent--queue',
        badgeClass: 'section-badge--queue',
        entries: props.results.filter((e) => e.status === 'unread'),
      },
      {
        key: 'completed',
        label: 'Completed',
        accentClass: 'section-accent--archive',
        badgeClass: 'section-badge--archive',
        entries: props.results.filter((e) => e.status === 'finished'),
      },
    ] as ResultGroup[]
  ).filter((g) => g.entries.length > 0),
)
</script>

<template>
  <div class="library-search-results" aria-live="polite">
    <p v-if="results.length === 0" class="library-search-results__empty">
      No books match “{{ query }}”.
    </p>

    <section
      v-for="group in groups"
      :key="group.key"
      class="library-search-results__section"
    >
      <header class="library-search-results__header">
        <span class="section-accent" :class="group.accentClass"></span>
        <span class="section-label">{{ group.label }}</span>
        <span class="section-badge" :class="group.badgeClass">{{ group.entries.length }}</span>
      </header>
      <div class="library-search-results__list">
        <SwipeableBookCard
          v-for="entry in group.entries"
          :key="entry.id"
          :book="bookFromEntry(entry)"
          :days-left="entry.status === 'reading' ? (velocityMap[entry.id] ?? null) : null"
          @edit="(b) => emit('edit', b)"
          @delete="(b) => emit('delete', b)"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.library-search-results {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.library-search-results__section {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.library-search-results__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.library-search-results__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.library-search-results__empty {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.35;
  padding: 0.5rem 0;
}

/* ── Section accent / label / badge (same vocabulary as the views) ──────── */

.section-accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}
.section-accent--reading { background: var(--p-indigo-500); box-shadow: 0 0 6px rgba(99, 102, 241, 0.7); }
.section-accent--queue   { background: var(--p-violet-400, #a78bfa); }
.section-accent--archive { background: rgba(255, 255, 255, 0.2); }

.section-label {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
}

.section-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
}
.section-badge--reading {
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.25);
}
.section-badge--queue {
  background: rgba(167, 139, 250, 0.18);
  color: var(--p-violet-300, #c4b5fd);
  border: 1px solid rgba(167, 139, 250, 0.22);
}
.section-badge--archive {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:root[data-p-theme="light"] .section-badge--reading {
  background: rgba(99, 102, 241, 0.1);
  color: var(--p-indigo-600);
}
:root[data-p-theme="light"] .section-badge--queue {
  background: rgba(167, 139, 250, 0.12);
  color: var(--p-violet-600, #7c3aed);
}
</style>
