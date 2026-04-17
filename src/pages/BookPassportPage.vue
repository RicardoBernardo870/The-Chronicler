<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useBookPassportStore } from '@/stores/bookPassport'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import Skeleton from 'primevue/skeleton'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const passportStore = useBookPassportStore()

const bookId = computed(() => route.params.id as string)
const book = computed(() => booksStore.bookById(bookId.value))
const passport = computed(() => passportStore.passportFor(bookId.value))
const isGenerating = computed(() => passportStore.isGenerating(bookId.value))
const streamText = computed(() => passportStore.streamFor(bookId.value))

onMounted(async () => {
  if (!book.value) await booksStore.fetchLibrary()
  await passportStore.fetchPassport(bookId.value)
})

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const shareJourney = async () => {
  const text = `I finished "${book.value?.title}" by ${book.value?.author}! 📚✨\n\nRead in ${passport.value?.totalDays ?? '?'} days with ${passport.value?.vocabularyCount ?? 0} new words learned. #TheChronicler`
  if (navigator.share) {
    await navigator.share({ title: `My Reading Journey: ${book.value?.title}`, text })
  } else {
    await navigator.clipboard.writeText(text)
  }
}

const aiSummary = computed(() => passport.value?.aiSummary || streamText.value)
</script>

<template>
  <div class="passport">
    <!-- Back -->
    <button class="passport__back" @click="router.push({ name: 'book-detail', params: { id: bookId } })">
      <i class="pi pi-arrow-left" /> Back
    </button>

    <!-- Header -->
    <header class="passport__header">
      <div class="passport__star">✦</div>
      <h1 class="passport__title">Reading Journey</h1>
      <p class="passport__subtitle">{{ book?.title }}</p>
      <p class="passport__author">by {{ book?.author }}</p>
    </header>

    <!-- Loading state: generating -->
    <div v-if="isGenerating && !passport" class="passport__generating glass-surface">
      <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; opacity: 0.5" />
      <p>Crafting your reading journey…</p>
      <div v-if="streamText" class="passport__stream-preview">{{ streamText }}</div>
    </div>

    <!-- Not found / not generated yet -->
    <div v-else-if="!passport && !isGenerating" class="passport__empty glass-surface">
      <i class="pi pi-book" style="font-size: 2.5rem; opacity: 0.25" />
      <p>Your passport is being generated.</p>
      <p style="font-size: 0.85rem; opacity: 0.55">Check back in a moment.</p>
    </div>

    <template v-else-if="passport">
      <!-- Stats -->
      <section class="passport__stats">
        <div class="passport__stat glass-surface">
          <span class="passport__stat-icon">📅</span>
          <div>
            <p class="passport__stat-value">{{ passport.totalDays ?? '—' }} days</p>
            <p class="passport__stat-label">to finish</p>
          </div>
        </div>

        <div class="passport__stat glass-surface">
          <span class="passport__stat-icon">⚡</span>
          <div>
            <p class="passport__stat-value">{{ passport.peakDayPages ?? '—' }} pages</p>
            <p class="passport__stat-label">peak day · {{ formatDate(passport.peakDay) }}</p>
          </div>
        </div>

        <div class="passport__stat glass-surface">
          <span class="passport__stat-icon">📖</span>
          <div>
            <p class="passport__stat-value">{{ passport.vocabularyCount }}</p>
            <p class="passport__stat-label">words learned</p>
          </div>
        </div>
      </section>

      <Divider />

      <!-- AI Summary -->
      <section class="passport__summary glass-surface">
        <h2 class="passport__summary-title">✦ Your Story So Far</h2>

        <div v-if="isGenerating" class="passport__summary-body">
          <Skeleton v-if="!streamText" height="1rem" style="margin-bottom: 0.5rem" />
          <Skeleton v-if="!streamText" height="1rem" width="85%" style="margin-bottom: 0.5rem" />
          <Skeleton v-if="!streamText" height="1rem" width="70%" />
          <p v-if="streamText" class="passport__summary-text passport__summary-text--streaming">{{ streamText }}</p>
        </div>
        <p v-else class="passport__summary-text">{{ aiSummary }}</p>
      </section>

      <!-- Share -->
      <Button
        label="Share Journey"
        icon="pi pi-share-alt"
        class="passport__share"
        outlined
        @click="shareJourney"
      />
    </template>
  </div>
</template>

<style scoped>
.passport {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.passport__back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: inherit;
  opacity: 0.6;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
  align-self: flex-start;
  transition: opacity 0.15s;
}
.passport__back:hover { opacity: 1; }

/* Header */
.passport__header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem 0;
}

.passport__star {
  font-size: 2rem;
  background: linear-gradient(135deg, #34d399, #fbbf24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
}

.passport__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #34d399 0%, #a78bfa 50%, #fbbf24 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.passport__subtitle {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

.passport__author {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.6;
}

/* Stats */
.passport__stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.passport__stat {
  border-radius: 14px;
  padding: 1rem 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.passport__stat-icon { font-size: 1.5rem; flex-shrink: 0; }

.passport__stat-value {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.2;
}

.passport__stat-label {
  margin: 0;
  font-size: 0.68rem;
  opacity: 0.55;
  line-height: 1.3;
}

/* Summary */
.passport__summary {
  border-radius: 16px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border: 1px solid rgba(52, 211, 153, 0.15);
}

.passport__summary-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  background: linear-gradient(135deg, #34d399, #fbbf24);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.passport__summary-body { display: flex; flex-direction: column; gap: 0.4rem; }

.passport__summary-text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.7;
  opacity: 0.88;
}

.passport__summary-text--streaming { opacity: 0.7; }

/* Generating / empty states */
.passport__generating,
.passport__empty {
  border-radius: 16px;
  padding: 3rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
}

.passport__stream-preview {
  font-size: 0.82rem;
  opacity: 0.6;
  max-height: 120px;
  overflow: hidden;
  text-align: left;
  line-height: 1.5;
}

.passport__share {
  align-self: center;
}

@media (max-width: 400px) {
  .passport__stats { grid-template-columns: 1fr; }
}
</style>
