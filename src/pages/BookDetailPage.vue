<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import { useBookPassportStore } from '@/stores/bookPassport'
import RecapStream from '@/components/recap/RecapStream.vue'
import VelocityBadge from '@/components/pulse/VelocityBadge.vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const recapsStore = useRecapsStore()
const passportStore = useBookPassportStore()

const bookId = computed(() => route.params.id as string)
const book = computed(() => booksStore.bookById(bookId.value))
const progress = computed(() => progressStore.progressForBook(bookId.value))

const currentPageInput = ref<number>(0)
const progressLoading = ref(false)
const progressError = ref<string | null>(null)
const recapTriggered = ref(false)

onMounted(async () => {
  if (!book.value) await booksStore.fetchLibrary()
  if (!progress.value) await progressStore.fetchProgress()
  await recapsStore.fetchRecapsForBook(bookId.value)
  if (progress.value) currentPageInput.value = progress.value.currentPage
  await passportStore.fetchPassport(bookId.value)
})

watch(progress, (p) => {
  if (p && !progressLoading.value) currentPageInput.value = p.currentPage
})

const percentage = computed(() => progress.value?.percentage ?? 0)
const isComplete = computed(() => percentage.value >= 100)
const isGenerating = computed(() => recapsStore.generationStatus === 'streaming')
const recapCount = computed(() => recapsStore.recapHistoryForBook(bookId.value).length)

// Milestone recap lock
const lastRecapPct = computed(() =>
  recapsStore.latestRecapForBook(bookId.value)?.progressSnapshot ?? 0
)
const unlockPage = computed(() => {
  if (!book.value || lastRecapPct.value === 0) return 0
  return Math.ceil((lastRecapPct.value + 5) / 100 * book.value.totalPages)
})
const recapLocked = computed(() =>
  lastRecapPct.value > 0 && (progress.value?.currentPage ?? 0) < unlockPage.value
)
const pagesUntilUnlock = computed(() =>
  Math.max(0, unlockPage.value - (progress.value?.currentPage ?? 0))
)

const saveProgress = async () => {
  if (!book.value) return
  const page = Math.max(0, Math.min(currentPageInput.value ?? 0, book.value.totalPages))
  progressLoading.value = true
  progressError.value = null
  try {
    await progressStore.updateProgress(bookId.value, page)
  } catch (e: unknown) {
    progressError.value = e instanceof Error ? e.message : 'Failed to save progress'
  } finally {
    progressLoading.value = false
  }
}

const getRecap = async () => {
  recapTriggered.value = true
  recapsStore.resetStatus()
  await recapsStore.generateRecap(bookId.value)
}

const retryRecap = () => {
  recapsStore.resetStatus()
  getRecap()
}

const coverFallback = (e: Event) => {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}
</script>

<template>
  <div class="book-detail">
    <!-- Not found -->
    <div v-if="!book && !booksStore.loading" class="book-detail__not-found glass-surface">
      <i class="pi pi-exclamation-circle" style="font-size: 3rem; opacity: 0.4" />
      <p>Book not found.</p>
      <Button label="Back to Library" icon="pi pi-arrow-left" outlined @click="router.push('/library')" />
    </div>

    <template v-else-if="book">
      <!-- Hero -->
      <section class="book-detail__hero glass-surface">
        <div class="book-detail__cover-wrap">
          <img
            v-if="book.coverUrl"
            :src="book.coverUrl"
            :alt="`Cover of ${book.title}`"
            class="book-detail__cover"
            @error="coverFallback"
          />
          <div v-else class="book-detail__cover-placeholder">
            <i class="pi pi-book" style="font-size: 3rem; opacity: 0.4" />
          </div>
        </div>

        <div class="book-detail__meta">
          <span v-if="book.genre" class="book-detail__genre">{{ book.genre }}</span>
          <h1 class="book-detail__title">{{ book.title }}</h1>
          <p class="book-detail__author">{{ book.author }}</p>
          <p class="book-detail__pages">{{ book.totalPages }} pages</p>
        </div>
      </section>

      <!-- Progress -->
      <section class="book-detail__progress glass-surface">
        <h2 class="book-detail__section-title">Reading Progress</h2>

        <div class="book-detail__progress-bar-wrap">
          <ProgressBar :value="percentage" :show-value="false" class="book-detail__progress-bar" />
          <span class="book-detail__progress-pct">{{ percentage.toFixed(1) }}%</span>
        </div>

        <div class="book-detail__progress-input">
          <InputNumber
            v-model="currentPageInput"
            :min="0"
            :max="book.totalPages"
            :placeholder="`Page (max ${book.totalPages})`"
            class="book-detail__page-input"
            show-buttons
            :step="1"
            fluid
          />
          <Button
            label="Save"
            icon="pi pi-check"
            :loading="progressLoading"
            @click="saveProgress"
          />
        </div>

        <p v-if="progressError" class="book-detail__progress-error">
          <i class="pi pi-exclamation-triangle" /> {{ progressError }}
        </p>

        <p class="book-detail__progress-hint">
          Page {{ progress?.currentPage ?? 0 }} of {{ book.totalPages }}
        </p>

        <VelocityBadge
          v-if="progress && progress.currentPage > 0 && !isComplete"
          :book-id="bookId"
          :total-pages="book.totalPages"
          :current-page="progress.currentPage"
        />

        <Button
          v-if="isComplete"
          label="✦ View Reading Journey"
          icon="pi pi-star"
          class="book-detail__passport-btn"
          @click="router.push({ name: 'book-passport', params: { id: bookId } })"
        />
      </section>

      <!-- Recap — hidden when book is complete (use Book Passport instead) -->
      <section v-if="!isComplete" class="book-detail__recap glass-surface">
        <div class="book-detail__recap-header">
          <h2 class="book-detail__section-title">AI Recap</h2>
          <!-- Locked state -->
          <Button
            v-if="!isGenerating && recapLocked"
            :label="`🔒 Read ${pagesUntilUnlock} more pages to unlock`"
            disabled
            class="book-detail__recap-locked"
            v-tooltip.top="'You unlock a new recap every 10% of progress'"
          />
          <!-- Unlocked state -->
          <Button
            v-else-if="!isGenerating"
            :label="recapTriggered ? 'New Recap' : 'Get Recap'"
            icon="pi pi-sparkles"
            @click="getRecap"
          />
        </div>

        <p v-if="!recapTriggered && !isGenerating" class="book-detail__recap-hint">
          Get a spoiler-free summary of your progress so far.
        </p>

        <RecapStream
          v-if="isGenerating || recapTriggered"
          :bookId="bookId"
          @retry="retryRecap"
        />

        <div v-if="recapCount > 0" class="book-detail__history-link">
          <Button
            :label="`View Recap History (${recapCount})`"
            icon="pi pi-history"
            link
            @click="router.push({ name: 'recap-history', params: { id: bookId } })"
          />
        </div>
      </section>
    </template>

    <!-- Loading skeleton -->
    <template v-else>
      <div class="book-detail__skeleton glass-surface">
        <Skeleton height="200px" border-radius="12px" />
        <Skeleton height="1.5rem" width="60%" style="margin-top: 1rem" />
        <Skeleton height="1rem" width="40%" style="margin-top: 0.5rem" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.book-detail {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1rem 4rem;
}

.book-detail__not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  border-radius: var(--p-border-radius-xl, 16px);
  text-align: center;
  color: var(--p-text-muted-color);
}

.book-detail__hero {
  display: flex;
  gap: 1.25rem;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  align-items: flex-start;
}

.book-detail__cover-wrap { flex-shrink: 0; }

.book-detail__cover {
  width: 96px;
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

.book-detail__cover-placeholder {
  width: 96px;
  height: 140px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
}

.book-detail__meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.book-detail__genre {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-300);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99,102,241,0.15);
  align-self: flex-start;
  margin-bottom: 0.25rem;
}

.book-detail__title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.3;
}

.book-detail__author {
  margin: 0;
  font-size: 0.9rem;
}

.book-detail__pages {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.7;
}

.book-detail__progress {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-detail__section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.book-detail__progress-bar-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.book-detail__progress-bar { flex: 1; }

.book-detail__progress-pct {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  min-width: 44px;
  text-align: right;
}

.book-detail__progress-input {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.book-detail__page-input { flex: 1; }

.book-detail__progress-error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}

.book-detail__progress-hint {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.55;
}

.book-detail__passport-btn {
  align-self: center;
  background: linear-gradient(135deg, #34d399, #a78bfa) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 700;
}

.book-detail__recap {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.book-detail__recap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.book-detail__recap-hint {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.60;
}

.book-detail__recap-locked {
  opacity: 0.55;
  cursor: not-allowed !important;
  font-size: 0.82rem;
}

.book-detail__history-link {
  display: flex;
  justify-content: flex-end;
}

.book-detail__skeleton {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
}
</style>
