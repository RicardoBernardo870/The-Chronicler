<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Book } from '@/types'
import type { VelocityResult } from '@/composables/useReadingVelocity'
import { useProgressStore } from '@/stores/progress'
import BookGridCard from '@/components/books/BookGridCard.vue'
import ReadingWideCard from '@/components/library/ReadingWideCard.vue'
import QueueReorderList from '@/components/library/QueueReorderList.vue'

const props = defineProps<{
  /** Already-sorted full set of books (reading first, queue, completed last). */
  books: Book[]
  velocityMap: Record<string, VelocityResult>
}>()

const emit = defineEmits<{
  reorderQueue: [orderedIds: string[]]
}>()

// Queue reorder mode — swaps the cover grid for a drag list.
const reorderMode = ref(false)

const progressStore = useProgressStore()

const reading = computed(() =>
  props.books.filter((b) => {
    const p = progressStore.percentageForBook(b.id)
    return p > 0 && p < 100
  }),
)
const queue = computed(() =>
  props.books.filter((b) => progressStore.percentageForBook(b.id) === 0),
)
const archive = computed(() =>
  props.books.filter((b) => progressStore.percentageForBook(b.id) >= 100),
)

// ── Collapsible sections (persisted) ────────────────────────────────────────

type SectionKey = 'reading' | 'queue' | 'archive'

const readCollapsed = (): Record<SectionKey, boolean> => {
  try {
    return {
      reading: false,
      queue: false,
      archive: false,
      ...JSON.parse(localStorage.getItem('library-grid-collapsed') ?? '{}'),
    }
  } catch {
    return { reading: false, queue: false, archive: false }
  }
}

const collapsed = ref(readCollapsed())

const toggleSection = (key: SectionKey) => {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] }
  localStorage.setItem('library-grid-collapsed', JSON.stringify(collapsed.value))
}
</script>

<template>
  <TransitionGroup name="library-grid__section-transition" tag="div" class="library-grid" appear>

    <!-- Currently Reading — wide horizontal cards -->
    <section v-if="reading.length > 0" key="reading" class="library-grid__section">
      <button
        type="button"
        class="library-grid__section-header"
        :aria-expanded="!collapsed.reading"
        @click="toggleSection('reading')"
      >
        <span class="section-accent section-accent--reading"></span>
        <span class="section-label">Now Reading</span>
        <span class="section-badge section-badge--reading">{{ reading.length }}</span>
        <i
          class="pi pi-chevron-down library-grid__chevron"
          :class="{ 'library-grid__chevron--collapsed': collapsed.reading }"
          aria-hidden="true"
        />
      </button>
      <div v-show="!collapsed.reading" class="library-grid__reading-row">
        <ReadingWideCard
          v-for="book in reading"
          :key="book.id"
          :book="book"
          :days-left="velocityMap[book.id] ?? null"
        />
      </div>
    </section>

    <!-- The Queue — standard cover grid -->
    <section v-if="queue.length > 0" key="queue" class="library-grid__section">
      <div class="library-grid__header-row">
        <button
          type="button"
          class="library-grid__section-header"
          :aria-expanded="!collapsed.queue"
          @click="toggleSection('queue')"
        >
          <span class="section-accent section-accent--queue"></span>
          <span class="section-label">The Queue</span>
          <span class="section-badge section-badge--queue">{{ queue.length }}</span>
          <i
            class="pi pi-chevron-down library-grid__chevron"
            :class="{ 'library-grid__chevron--collapsed': collapsed.queue }"
            aria-hidden="true"
          />
        </button>
        <button
          v-if="!collapsed.queue && queue.length > 1"
          type="button"
          class="library-grid__reorder-toggle"
          :aria-pressed="reorderMode"
          @click="reorderMode = !reorderMode"
        >
          <i :class="`pi ${reorderMode ? 'pi-check' : 'pi-sort-alt'}`" aria-hidden="true" />
          {{ reorderMode ? 'Done' : 'Reorder' }}
        </button>
      </div>
      <QueueReorderList
        v-if="!collapsed.queue && reorderMode"
        :books="queue"
        @update:books="(v) => emit('reorderQueue', v.map((b) => b.id))"
      />
      <div v-show="!collapsed.queue && !reorderMode" class="library-grid__cover-grid">
        <BookGridCard v-for="book in queue" :key="book.id" :book="book" />
      </div>
    </section>

    <!-- Completed — dimmed cover grid -->
    <section
      v-if="archive.length > 0"
      key="archive"
      class="library-grid__section library-grid__section--completed"
    >
      <button
        type="button"
        class="library-grid__section-header"
        :aria-expanded="!collapsed.archive"
        @click="toggleSection('archive')"
      >
        <span class="section-accent section-accent--archive"></span>
        <span class="section-label section-label--dim">Completed</span>
        <span class="section-badge section-badge--archive">{{ archive.length }}</span>
        <i
          class="pi pi-chevron-down library-grid__chevron"
          :class="{ 'library-grid__chevron--collapsed': collapsed.archive }"
          aria-hidden="true"
        />
      </button>
      <div v-show="!collapsed.archive" class="library-grid__cover-grid library-grid__cover-grid--dim">
        <BookGridCard v-for="book in archive" :key="book.id" :book="book" />
      </div>
    </section>

  </TransitionGroup>
</template>

<style scoped>
.library-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.library-grid__section {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

/* ── Header row (collapse button + queue reorder toggle) ────────────────── */

.library-grid__header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: sticky;
  top: 3.6rem;
  z-index: 40;
}

.library-grid__header-row .library-grid__section-header {
  position: static;
  flex: 1;
  min-width: 0;
}

.library-grid__reorder-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex: none;
  margin: 0;
  padding: 0.25rem 0.6rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
  cursor: pointer;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.library-grid__reorder-toggle .pi {
  font-size: 0.65rem;
}

.library-grid__reorder-toggle:hover {
  opacity: 1;
}

.library-grid__reorder-toggle:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

:root[data-p-theme="light"] .library-grid__reorder-toggle {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

/* ── Section headers — same look, now buttons, sticky while scrolling ───── */

.library-grid__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  border: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 10px;
  position: sticky;
  top: 3.6rem;
  z-index: 40;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  background: rgba(18, 18, 28, 0.35);
}

.library-grid__chevron {
  margin-left: auto;
  font-size: 0.7rem;
  opacity: 0.5;
  transition: transform 0.18s ease;
}

.library-grid__chevron--collapsed {
  transform: rotate(-90deg);
}

.library-grid__reading-row {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.library-grid__cover-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.625rem;
}

.library-grid__cover-grid--dim {
  opacity: 0.65;
  filter: saturate(0.7);
}

/* ── Section accent + label + badge (shared between sections) ─────────── */

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
.section-label--dim { opacity: 0.4; }

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

:root[data-p-theme="light"] .library-grid__section-header {
  background: rgba(255, 255, 255, 0.55);
}

.library-grid__section-transition-enter-active,
.library-grid__section-transition-leave-active,
.library-grid__section-transition-move {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.library-grid__section-transition-enter-from,
.library-grid__section-transition-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.library-grid__section-transition-leave-active {
  position: absolute;
  width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .library-grid__section-transition-enter-active,
  .library-grid__section-transition-leave-active,
  .library-grid__section-transition-move,
  .library-grid__chevron {
    transition: none;
  }

  .library-grid__section-transition-enter-from,
  .library-grid__section-transition-leave-to {
    transform: none;
  }
}
</style>
