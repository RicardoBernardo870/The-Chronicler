<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useUpNextStore } from '@/stores/upNext'
import { useLexiconStore } from '@/stores/lexicon'
import { useReadingPulse } from '@/composables/useReadingPulse'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import InputNumber from 'primevue/inputnumber'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/shared/EmptyState.vue'
import WordOfTheDay from '@/components/dashboard/WordOfTheDay.vue'
import draggable from 'vuedraggable'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const upNextStore = useUpNextStore()
const lexiconStore = useLexiconStore()

const loading = ref(true)
const pageInput = ref<number>(0)
const saving = ref(false)
const saveError = ref<string | null>(null)
const justSaved = ref(false)

onMounted(async () => {
  try {
    await booksStore.fetchLibrary()
    await progressStore.fetchProgress()
    await upNextStore.fetchOrder()
    // Load lexicon entries for all books (powers WordOfTheDay computed)
    booksStore.books.forEach(b => lexiconStore.fetchEntriesForBook(b.id))
    // Load reading pulse for hero card
    if (currentBook.value) heroPulse.value?.fetchHistory()
    if (currentBook.value) {
      pageInput.value = progressStore.progressForBook(currentBook.value.id)?.currentPage ?? 0
    }
  } finally {
    loading.value = false
  }
})

// Hero card: most recently updated in-progress book (< 100%).
// Falls back to most recently updated book of any % if none are in-progress.
const currentBook = computed(() => {
  const allProgress = Object.values(progressStore.progress)
  if (allProgress.length === 0) return null
  const inProgress = allProgress.filter(p => p.percentage < 100)
  const source = inProgress.length > 0 ? inProgress : []
  if (source.length === 0) return null
  const latest = [...source].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]
  return booksStore.bookById(latest.bookId) ?? null
})

const currentProgress = computed(() =>
  currentBook.value ? progressStore.progressForBook(currentBook.value.id) : null
)

// In-progress list: all books between 0–99%, excluding the hero card book
const inProgressOthers = computed(() =>
  progressStore.inProgressBooks.filter(
    item => item.book.id !== currentBook.value?.id
  )
)

// Up Next: 0%-progress books sorted by up-next order
const upNextBooks = computed(() => {
  const zeroBooks = booksStore.books.filter(b => progressStore.percentageForBook(b.id) === 0)
  const orderedIds = upNextStore.sortedBookIds()
  return [
    ...zeroBooks.filter(b => orderedIds.includes(b.id)).sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
    ...zeroBooks.filter(b => !orderedIds.includes(b.id)),
  ]
})

// Mutable list for vuedraggable
const upNextDraggable = computed({
  get: () => upNextBooks.value,
  set: (newOrder) => {
    upNextStore.saveOrder(newOrder.map(b => b.id))
  },
})

// Completed section
const completedPreview = computed(() => progressStore.completedBooks.slice(0, 2))
const completedOverflow = computed(() => Math.max(0, progressStore.completedBooks.length - 2))

const pendingSync = computed(() => progressStore.pendingSync)

// Reading Pulse for hero card continuity warning
const heroPulse = computed(() =>
  currentBook.value ? useReadingPulse(currentBook.value.id) : null
)
const heroWarning = computed(() => (heroPulse.value?.continuityScore.value ?? 100) < 40)

const hasAnyBooks = computed(() => booksStore.books.length > 0)

const saveProgress = async () => {
  if (!currentBook.value) return
  const page = Math.max(0, Math.min(pageInput.value ?? 0, currentBook.value.totalPages))
  saving.value = true
  saveError.value = null
  justSaved.value = false
  try {
    await progressStore.updateProgress(currentBook.value.id, page)
    justSaved.value = true
    setTimeout(() => { justSaved.value = false }, 2000)
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

const coverFallback = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<template>
  <div class="dashboard">
    <h1 class="dashboard__heading">Your Reading</h1>

    <!-- Loading -->
    <template v-if="loading">
      <div class="dashboard__current glass-surface">
        <Skeleton height="160px" border-radius="12px" />
        <Skeleton height="1.25rem" width="55%" style="margin-top: 1rem" />
        <Skeleton height="0.875rem" width="35%" style="margin-top: 0.5rem" />
      </div>
    </template>

    <!-- No books at all -->
    <EmptyState
      v-else-if="!hasAnyBooks"
      icon="pi-book"
      title="No current read"
      description="Add your first book to start tracking your reading journey."
    >
      <template #action>
        <Button label="Add a book" icon="pi pi-plus" @click="router.push('/books/add')" />
      </template>
    </EmptyState>

    <template v-else>
      <!-- Hero: current in-progress book -->
      <article v-if="currentBook" class="dashboard__current glass-surface" :class="{ 'dashboard__current--warning': heroWarning }">
        <div class="dashboard__hero">
          <div class="dashboard__cover-wrap">
            <img
              v-if="currentBook.coverUrl"
              :src="currentBook.coverUrl"
              :alt="`Cover of ${currentBook.title}`"
              class="dashboard__cover"
              @error="coverFallback"
            />
            <div v-else class="dashboard__cover-placeholder">
              <i class="pi pi-book" style="font-size: 2.5rem; opacity: 0.35" />
            </div>
          </div>

          <div class="dashboard__meta">
            <span v-if="currentBook.genre" class="dashboard__genre">{{ currentBook.genre }}</span>
            <h2 class="dashboard__title">{{ currentBook.title }}</h2>
            <p class="dashboard__author">{{ currentBook.author }}</p>

            <div class="dashboard__progress-row">
              <ProgressBar
                :value="currentProgress?.percentage ?? 0"
                class="dashboard__progress-bar"
              />
              <span class="dashboard__pct">{{ (currentProgress?.percentage ?? 0).toFixed(1) }}%</span>
            </div>

            <p class="dashboard__page-hint">
              Page {{ currentProgress?.currentPage ?? 0 }} of {{ currentBook.totalPages }}
            </p>
          </div>
        </div>

        <div class="dashboard__update">
          <InputNumber
            v-model="pageInput"
            :min="0"
            :max="currentBook.totalPages"
            placeholder="Update page"
            show-buttons
            :step="1"
            fluid
            class="dashboard__page-input"
          />
          <Button
            :label="justSaved ? 'Saved!' : 'Save'"
            :icon="justSaved ? 'pi pi-check' : 'pi pi-check'"
            :loading="saving"
            :severity="justSaved ? 'success' : 'primary'"
            @click="saveProgress"
          />
        </div>

        <p v-if="saveError" class="dashboard__error">
          <i class="pi pi-exclamation-triangle" /> {{ saveError }}
        </p>

        <div v-if="heroWarning" class="dashboard__continuity-warning">
          <i class="pi pi-exclamation-triangle" />
          It's been a while — time for a Memory Jogger?
        </div>

        <div v-if="pendingSync" class="dashboard__offline-badge">
          <i class="pi pi-wifi" style="opacity: 0.5" />
          Progress will sync when you're back online
        </div>

        <div class="dashboard__actions">
          <Button
            label="Get Recap"
            icon="pi pi-sparkles"
            class="dashboard__action-btn"
            @click="router.push({ name: 'book-detail', params: { id: currentBook!.id } })"
          />
          <Button
            label="View Library"
            icon="pi pi-th-large"
            class="glass-surface dashboard__action-btn"
            outlined
            @click="router.push('/library')"
          />
        </div>
      </article>

      <!-- Word of the Day -->
      <WordOfTheDay />

      <!-- In Progress list (all other in-progress books) -->
      <section v-if="inProgressOthers.length > 0" class="dashboard__section glass-surface">
        <h3 class="dashboard__section-title">
          <i class="pi pi-book-open" /> In Progress
        </h3>
        <ul class="dashboard__book-list">
          <li
            v-for="item in inProgressOthers"
            :key="item.book.id"
            class="dashboard__book-item glass-subtle"
            @click="router.push({ name: 'book-detail', params: { id: item.book.id } })"
          >
            <img
              v-if="item.book.coverUrl"
              :src="item.book.coverUrl"
              :alt="item.book.title"
              class="dashboard__book-thumb"
              @error="coverFallback"
            />
            <div v-else class="dashboard__book-thumb dashboard__book-thumb--placeholder">
              <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
            </div>
            <div class="dashboard__book-info">
              <span class="dashboard__book-title">{{ item.book.title }}</span>
              <span class="dashboard__book-author">{{ item.book.author }}</span>
              <div class="dashboard__book-progress-row">
                <ProgressBar :value="item.progress.percentage" class="dashboard__book-bar" />
                <span class="dashboard__book-pct">{{ item.progress.percentage.toFixed(0) }}%</span>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- Up Next section -->
      <section v-if="upNextBooks.length > 0" class="dashboard__section glass-surface">
        <h3 class="dashboard__section-title">
          <i class="pi pi-clock" /> Up Next
        </h3>
        <draggable
          v-model="upNextDraggable"
          item-key="id"
          handle=".up-next__handle"
          :animation="150"
          tag="ul"
          class="dashboard__book-list"
        >
          <template #item="{ element: book }">
            <li
              class="dashboard__book-item glass-subtle up-next__item"
              @click="router.push({ name: 'book-detail', params: { id: book.id } })"
            >
              <span class="up-next__handle" @click.stop title="Drag to reorder">⠿</span>
              <img
                v-if="book.coverUrl"
                :src="book.coverUrl"
                :alt="book.title"
                class="dashboard__book-thumb"
                @error="coverFallback"
              />
              <div v-else class="dashboard__book-thumb dashboard__book-thumb--placeholder">
                <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
              </div>
              <div class="dashboard__book-info">
                <span class="dashboard__book-title">{{ book.title }}</span>
                <span class="dashboard__book-author">{{ book.author }}</span>
              </div>
            </li>
          </template>
        </draggable>
      </section>

      <!-- Completed section -->
      <section v-if="completedPreview.length > 0" class="dashboard__section glass-surface">
        <h3 class="dashboard__section-title">
          <i class="pi pi-check-circle" /> Completed
        </h3>
        <ul class="dashboard__book-list">
          <li
            v-for="item in completedPreview"
            :key="item.book.id"
            class="dashboard__book-item glass-subtle"
            @click="router.push({ name: 'book-detail', params: { id: item.book.id } })"
          >
            <img
              v-if="item.book.coverUrl"
              :src="item.book.coverUrl"
              :alt="item.book.title"
              class="dashboard__book-thumb"
              @error="coverFallback"
            />
            <div v-else class="dashboard__book-thumb dashboard__book-thumb--placeholder">
              <i class="pi pi-book" style="font-size: 1rem; opacity: 0.35" />
            </div>
            <div class="dashboard__book-info">
              <span class="dashboard__book-title">{{ item.book.title }}</span>
              <span class="dashboard__book-author">{{ item.book.author }}</span>
              <span class="dashboard__book-complete-badge">
                <i class="pi pi-check" /> Finished
              </span>
            </div>
          </li>
        </ul>

        <p v-if="completedOverflow > 0" class="dashboard__overflow-hint">
          <i class="pi pi-info-circle" />
          and {{ completedOverflow }} more —
          <button class="dashboard__overflow-link" @click="router.push('/library')">
            check your Library
          </button>
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__heading {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* ── Hero card ────────────────────────────────────────────────── */
.dashboard__current {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__hero { display: flex; gap: 1.25rem; align-items: flex-start; }
.dashboard__cover-wrap { flex-shrink: 0; }

.dashboard__cover {
  width: 88px; height: 128px;
  object-fit: cover; border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}

.dashboard__cover-placeholder {
  width: 88px; height: 128px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
}

.dashboard__meta {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 0.25rem;
}

.dashboard__genre {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--p-indigo-300);
  padding: 0.15rem 0.5rem; border-radius: 999px;
  background: rgba(99,102,241,0.15);
  align-self: flex-start; margin-bottom: 0.2rem;
}

.dashboard__title {
  margin: 0; font-size: 1.15rem; font-weight: 700; line-height: 1.3;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.dashboard__author { margin: 0; font-size: 0.85rem; }

.dashboard__progress-row {
  display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;
}
.dashboard__progress-bar { flex: 1; }
.dashboard__pct {
  font-size: 0.8rem; font-weight: 700; color: var(--p-indigo-300);
  min-width: 40px; text-align: right;
}
.dashboard__page-hint { margin: 0; font-size: 0.75rem; opacity: 0.7; }

/* Continuity warning state */
.dashboard__current--warning {
  background: linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.06) 100%),
              var(--glass-surface-bg, rgba(255,255,255,0.04));
  border-color: rgba(251, 191, 36, 0.35) !important;
  animation: pulse-amber 2.5s ease-in-out infinite;
}

@keyframes pulse-amber {
  0%, 100% { box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
  50%       { box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.15); }
}

.dashboard__continuity-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fbbf24;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.25);
  align-self: flex-start;
}

.dashboard__update { display: flex; gap: 0.75rem; align-items: center; }
.dashboard__page-input { flex: 1; }
.dashboard__error { margin: 0; font-size: 0.85rem; color: var(--p-red-400); }

.dashboard__offline-badge {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.78rem; color: var(--p-text-muted-color);
  padding: 0.3rem 0.75rem; border-radius: 999px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
  align-self: flex-start;
}

.dashboard__actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.dashboard__action-btn { flex: 1; min-width: 120px; }

/* ── Shared section ───────────────────────────────────────────── */
.dashboard__section {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}

.dashboard__section-title {
  margin: 0; font-size: 0.85rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  opacity: 0.65; display: flex; align-items: center; gap: 0.4rem;
}

.dashboard__book-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.5rem;
}

.dashboard__book-item {
  display: flex; align-items: center; gap: 0.875rem;
  padding: 0.75rem; border-radius: 12px; cursor: pointer;
  transition: opacity 0.15s ease;
}
.dashboard__book-item:hover { opacity: 0.85; }

.dashboard__book-thumb {
  width: 44px; height: 62px;
  object-fit: cover; border-radius: 5px; flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.dashboard__book-thumb--placeholder {
  background: rgba(255,255,255,0.06);
  display: flex; align-items: center; justify-content: center;
}

.dashboard__book-info {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 0.2rem;
}
.dashboard__book-title {
  font-size: 0.9rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dashboard__book-author { font-size: 0.78rem; opacity: 0.6; }

.dashboard__book-progress-row {
  display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;
}
.dashboard__book-bar { flex: 1; }
.dashboard__book-pct {
  font-size: 0.72rem; font-weight: 700;
  color: var(--p-indigo-300); min-width: 32px; text-align: right;
}

.dashboard__book-complete-badge {
  font-size: 0.72rem; font-weight: 600;
  color: #34d399; display: inline-flex; align-items: center; gap: 0.25rem;
  margin-top: 0.2rem;
}

/* Up Next drag handle */
.up-next__item { touch-action: none; }
.up-next__handle {
  font-size: 1.1rem;
  cursor: grab;
  opacity: 0.45;
  padding: 0 0.25rem;
  flex-shrink: 0;
  min-width: 28px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
.up-next__handle:active { cursor: grabbing; }

/* Overflow hint */
.dashboard__overflow-hint {
  margin: 0; font-size: 0.8rem; opacity: 0.60;
  display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;
}
.dashboard__overflow-link {
  background: none; border: none; padding: 0; cursor: pointer;
  color: var(--p-indigo-300); font-size: inherit; font-weight: 600;
  text-decoration: underline;
}
</style>
