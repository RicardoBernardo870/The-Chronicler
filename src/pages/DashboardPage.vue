<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import InputNumber from 'primevue/inputnumber'
import Skeleton from 'primevue/skeleton'
import EmptyState from '@/components/shared/EmptyState.vue'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()

const loading = ref(true)
const pageInput = ref<number>(0)
const saving = ref(false)
const saveError = ref<string | null>(null)
const justSaved = ref(false)

onMounted(async () => {
  try {
    await booksStore.fetchLibrary()
    await progressStore.fetchProgress()
    if (currentBook.value) {
      pageInput.value = progressStore.progressForBook(currentBook.value.id)?.currentPage ?? 0
    }
  } finally {
    loading.value = false
  }
})

// Most recently updated book = first in progress entries by updatedAt
const currentBook = computed(() => {
  const allProgress = Object.values(progressStore.progress)
  if (allProgress.length === 0) return null
  const latest = allProgress.sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]
  return booksStore.bookById(latest.bookId) ?? null
})

const currentProgress = computed(() =>
  currentBook.value ? progressStore.progressForBook(currentBook.value.id) : null
)

const pendingSync = computed(() => progressStore.pendingSync)

async function saveProgress() {
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

function coverFallback(e: Event) {
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
      v-else-if="!currentBook"
      icon="pi-book"
      title="No current read"
      description="Add your first book to start tracking your reading journey."
    >
      <template #action>
        <Button
          label="Add a book"
          icon="pi pi-plus"
          @click="router.push('/books/add')"
        />
      </template>
    </EmptyState>

    <!-- Current read card -->
    <template v-else>
      <article class="dashboard__current glass-surface">
        <!-- Cover + meta -->
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

        <!-- Inline progress update -->
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

        <!-- Offline indicator -->
        <div v-if="pendingSync" class="dashboard__offline-badge">
          <i class="pi pi-wifi" style="opacity: 0.5" />
          Progress will sync when you're back online
        </div>

        <!-- Actions -->
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

/* Current read card */
.dashboard__current {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.dashboard__hero {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.dashboard__cover-wrap { flex-shrink: 0; }

.dashboard__cover {
  width: 88px;
  height: 128px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35);
}

.dashboard__cover-placeholder {
  width: 88px;
  height: 128px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.dashboard__genre {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99,102,241,0.15);
  align-self: flex-start;
  margin-bottom: 0.2rem;
}

.dashboard__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dashboard__author {
  margin: 0;
  font-size: 0.85rem;
}

.dashboard__progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.dashboard__progress-bar { flex: 1; }

.dashboard__pct {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 40px;
  text-align: right;
}

.dashboard__page-hint {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

/* Update row */
.dashboard__update {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.dashboard__page-input { flex: 1; }

.dashboard__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}

/* Offline badge */
.dashboard__offline-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  align-self: flex-start;
}

/* Action buttons */
.dashboard__actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dashboard__action-btn { flex: 1; min-width: 120px; }
</style>
