<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useBookSearch } from '@/composables/useBookSearch'
import BookSearchResultCard from '@/components/books/BookSearchResultCard.vue'
import type { BookSearchResult } from '@/types'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'

const router = useRouter()
const {
  query, loading, loadingMore, error, hasSearched, results, hasMore, retry, loadNextPage,
} = useBookSearch()

const onSelect = (result: BookSearchResult) => {
  router.push({
    name: 'add-book-details',
    params: { source: result.source, key: encodeURIComponent(result.key) },
  })
}
</script>

<template>
  <section class="book-search">
    <label class="book-search__label" for="book-search-input">Search for a book</label>
    <IconField>
      <InputIcon class="pi pi-search" />
      <InputText
        id="book-search-input"
        v-model="query"
        placeholder="Title, author, or ISBN"
        autocomplete="off"
        fluid
      />
    </IconField>

    <div v-if="loading" class="book-search__loading">
      <ProgressSpinner style="width: 2rem; height: 2rem" stroke-width="4" />
      <span>Searching…</span>
    </div>

    <Message v-else-if="error" severity="warn" class="book-search__msg">
      <div class="book-search__error-row">
        <span>{{ error }}</span>
        <Button label="Retry" icon="pi pi-refresh" size="small" text @click="retry" />
      </div>
    </Message>

    <Message
      v-else-if="hasSearched && results.length === 0"
      severity="info"
      class="book-search__msg"
    >
      No books found. Try a different title, author, or ISBN.
    </Message>

    <div v-if="results.length > 0" class="book-search__results">
      <BookSearchResultCard
        v-for="result in results"
        :key="result.key"
        :result="result"
        @select="onSelect"
      />

      <Button
        v-if="hasMore"
        label="Load more"
        icon="pi pi-angle-down"
        outlined
        fluid
        :loading="loadingMore"
        class="book-search__load-more"
        @click="loadNextPage"
      />
    </div>
  </section>
</template>

<style scoped>
.book-search {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.book-search__label {
  font-size: 0.85rem;
  font-weight: 600;
}

.book-search__loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.25rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.book-search__msg {
  margin-top: 0.25rem;
}

.book-search__error-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.book-search__results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.book-search__load-more {
  margin-top: 0.5rem;
}
</style>
