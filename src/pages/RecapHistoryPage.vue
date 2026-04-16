<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useRecapsStore } from '@/stores/recaps'
import RecapHistory from '@/components/recap/RecapHistory.vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const recapsStore = useRecapsStore()

const bookId = computed(() => route.params.id as string)
const book = computed(() => booksStore.bookById(bookId.value))
const recaps = computed(() => recapsStore.recapHistoryForBook(bookId.value))

const loading = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  error.value = null
  try {
    if (!book.value) await booksStore.fetchLibrary()
    await recapsStore.fetchRecapsForBook(bookId.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load recap history'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="recap-history-page">
    <header class="recap-history-page__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back"
        @click="router.push({ name: 'book-detail', params: { id: bookId } })"
      />
      <div class="recap-history-page__title-wrap">
        <h1 class="recap-history-page__title">Recap History</h1>
        <p v-if="book" class="recap-history-page__subtitle">{{ book.title }}</p>
      </div>
    </header>

    <div v-if="error" class="recap-history-page__error glass-surface">
      <i class="pi pi-exclamation-circle" style="font-size: 2rem; color: var(--p-red-400)" />
      <p>{{ error }}</p>
      <Button label="Retry" icon="pi pi-refresh" outlined @click="recapsStore.fetchRecapsForBook(bookId)" />
    </div>

    <template v-else-if="loading">
      <div class="recap-history-page__skeletons">
        <div v-for="i in 3" :key="i" class="glass-surface" style="border-radius: 16px; padding: 1.5rem">
          <Skeleton height="0.75rem" width="30%" style="margin-bottom: 1rem" />
          <Skeleton height="0.875rem" style="margin-bottom: 0.5rem" />
          <Skeleton height="0.875rem" width="80%" style="margin-bottom: 0.5rem" />
          <Skeleton height="0.875rem" width="65%" />
        </div>
      </div>
    </template>

    <RecapHistory
      v-else
      :recaps="recaps"
      :bookTitle="book?.title"
    />
  </div>
</template>

<style scoped>
.recap-history-page {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1rem 1rem 4rem;
}

.recap-history-page__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.recap-history-page__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.recap-history-page__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.recap-history-page__subtitle {
  margin: 0;
  font-size: 0.8rem;
}

.recap-history-page__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2.5rem;
  border-radius: 16px;
  text-align: center;
}

.recap-history-page__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
