<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useLexiconStore } from '@/stores/lexicon'
import LexiconCard from '@/components/lexicon/LexiconCard.vue'
import AddWordDialog from '@/components/lexicon/AddWordDialog.vue'
import Button from 'primevue/button'
import Select from 'primevue/select'

const booksStore = useBooksStore()
const lexiconStore = useLexiconStore()
const route = useRoute()

const selectedBookId = ref<string | null>(null)
const addDialogVisible = ref(false)
// T011: only show spinner when there are no entries yet (first load).
// On return visits the store already has data, so loading starts false.
const loading = ref(lexiconStore.allEntries.length === 0)

onMounted(async () => {
  await booksStore.fetchLibrary()
  // Fetch entries for all books
  await Promise.all(booksStore.books.map(b => lexiconStore.fetchEntriesForBook(b.id)))
  // If navigated with a book pre-selected (e.g. from WordOfTheDay)
  const queryBook = route.query.bookId as string | undefined
  if (queryBook) selectedBookId.value = queryBook
  loading.value = false
})

const bookOptions = computed(() => [
  { label: 'All Books', value: null },
  ...booksStore.books
    .filter(b => (lexiconStore.entriesByBook[b.id]?.length ?? 0) > 0)
    .map(b => ({ label: b.title, value: b.id })),
])

const filteredEntries = computed(() =>
  selectedBookId.value
    ? (lexiconStore.entriesByBook[selectedBookId.value] ?? [])
    : lexiconStore.allEntries
)
</script>

<template>
  <div class="lexicon">
    <header class="lexicon__header">
      <h1 class="lexicon__title">Lexicon</h1>
      <Button icon="pi pi-plus" label="Add to Codex" size="small" @click="addDialogVisible = true" />
    </header>

    <div class="lexicon__filters">
      <Select
        v-model="selectedBookId"
        :options="bookOptions"
        option-label="label"
        option-value="value"
        placeholder="All Books"
        style="min-width: 180px"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="lexicon__loading">
      <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem; opacity: 0.4" />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredEntries.length === 0" class="lexicon__empty glass-surface">
      <i class="pi pi-book" style="font-size: 2rem; opacity: 0.25; margin-bottom: 0.5rem" />
      <p>No words saved yet.</p>
      <p style="font-size: 0.85rem; opacity: 0.55">Add a word while reading to build your vocabulary vault.</p>
    </div>

    <!-- Cards -->
    <div v-else class="lexicon__list">
      <LexiconCard
        v-for="entry in filteredEntries"
        :key="entry.id"
        :entry="entry"
      />
    </div>

    <AddWordDialog
      v-if="addDialogVisible"
      :visible="addDialogVisible"
      :book-id="selectedBookId ?? undefined"
      @update:visible="addDialogVisible = $event"
      @saved="addDialogVisible = false"
    />
  </div>
</template>

<style scoped>
.lexicon {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.lexicon__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.lexicon__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.lexicon__filters {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.lexicon__loading {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.lexicon__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 1.5rem;
  border-radius: 16px;
  gap: 0.25rem;
}

.lexicon__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
</style>
