<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { getBookDetail, getRecommendations } from '@/services/bookSearchService'
import { isDuplicateBook } from '@/utils/duplicateBook'
import SearchBookHero from '@/components/books/SearchBookHero.vue'
import BookDescription from '@/components/books/BookDescription.vue'
import BookRecommendationsScroller from '@/components/books/BookRecommendationsScroller.vue'
import LibraryStatusSelector from '@/components/books/LibraryStatusSelector.vue'
import BookForm from '@/components/books/BookForm.vue'
import type {
  BookDetailDraft,
  BookSearchSource,
  InitialBookStatus,
  Recommendation,
} from '@/types'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Message from 'primevue/message'
import InputNumber from 'primevue/inputnumber'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const draft = ref<BookDetailDraft | null>(null)
const recommendations = ref<Recommendation[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const editing = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const addError = ref<string | null>(null)

const status = ref<InitialBookStatus>('queued')
const currentPage = ref<number | null>(null)

let controller: AbortController | null = null

const source = computed(() => route.params.source as BookSearchSource)
const decodedKey = computed(() => decodeURIComponent(route.params.key as string))
const maxCurrentPage = computed(() => Math.max(1, (draft.value?.totalPages ?? 1) - 1))

const loadDetail = async () => {
  if (controller) controller.abort()
  const local = new AbortController()
  controller = local

  loading.value = true
  loadError.value = null
  draft.value = null
  recommendations.value = []
  editing.value = false
  addError.value = null
  status.value = 'queued'
  currentPage.value = null

  try {
    // Keep the library warm so the duplicate check has data (cheap when cached).
    booksStore.fetchLibraryWithProgress().catch(() => {})
    const result = await getBookDetail(source.value, decodedKey.value, local.signal)
    if (local.signal.aborted) return
    draft.value = result

    getRecommendations(result, decodedKey.value, local.signal)
      .then((recs) => {
        if (!local.signal.aborted) recommendations.value = recs
      })
      .catch(() => {})
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    loadError.value = 'Could not load this book. Please go back and try again.'
  } finally {
    if (controller === local) {
      loading.value = false
      controller = null
    }
  }
}

watch(decodedKey, loadDetail, { immediate: true })

onBeforeUnmount(() => {
  if (controller) controller.abort()
})

const recHeading = computed(() => {
  const subject = draft.value?.subjects?.[0] ?? draft.value?.genre?.trim()
  return subject ? `More ${subject} books` : 'You might also like'
})

const isDuplicate = computed(() =>
  draft.value
    ? isDuplicateBook(
        { isbn: draft.value.isbn, title: draft.value.title, author: draft.value.author },
        booksStore.books,
      )
    : false,
)

// Apply edits from the metadata-only BookForm back onto the draft.
const onEditDone = (data: {
  title: string
  author: string
  totalPages: number | null
  genre: string | null
  description: string | null
  coverUrl: string | null
  isbn: string | null
}) => {
  if (!draft.value) return
  draft.value = {
    ...draft.value,
    title: data.title,
    author: data.author,
    totalPages: data.totalPages,
    genre: data.genre,
    description: data.description,
    coverUrl: data.coverUrl,
    isbn: data.isbn,
  }
  editing.value = false
}

const validateForAdd = (d: BookDetailDraft): string | null => {
  if (!d.title.trim() || !d.author.trim()) return 'Title and author are required — tap “Edit details”.'
  if (!d.totalPages || d.totalPages < 1) return 'This book needs a page count — tap “Edit details” to add it.'
  if (status.value === 'currentlyReading') {
    const max = maxCurrentPage.value
    if (!currentPage.value || currentPage.value < 1 || currentPage.value > max) {
      return `Enter a current page between 1 and ${max}.`
    }
  }
  return null
}

const addToLibrary = async () => {
  if (!draft.value) return
  const problem = validateForAdd(draft.value)
  if (problem) {
    addError.value = problem
    return
  }

  saving.value = true
  saveError.value = null
  addError.value = null
  try {
    await booksStore.addBookWithInitialStatus({
      title: draft.value.title,
      author: draft.value.author,
      isbn: draft.value.isbn,
      coverUrl: draft.value.coverUrl,
      totalPages: draft.value.totalPages ?? 0,
      genre: draft.value.genre,
      description: draft.value.description,
      initialStatus: status.value,
      currentPage: status.value === 'currentlyReading' ? currentPage.value : null,
    })
    router.push(status.value === 'currentlyReading' ? '/' : '/library')
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save book'
    saving.value = false
  }
}

const onSelectRecommendation = (rec: Recommendation) => {
  router.push({
    name: 'add-book-details',
    params: { source: rec.source, key: encodeURIComponent(rec.key) },
  })
}

const goBack = () => router.back()
</script>

<template>
  <div class="search-detail">
    <header class="search-detail__header">
      <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="goBack" />
      <h1 class="search-detail__title">Add to Library</h1>
    </header>

    <div v-if="loading" class="search-detail__skeleton glass-surface">
      <div class="search-detail__skeleton-row">
        <Skeleton width="116px" height="174px" border-radius="12px" />
        <div class="search-detail__skeleton-meta">
          <Skeleton width="80%" height="1.6rem" />
          <Skeleton width="50%" height="1rem" />
          <Skeleton width="60%" height="1.5rem" />
        </div>
      </div>
      <Skeleton width="100%" height="4rem" style="margin-top: 1rem" />
    </div>

    <Message v-else-if="loadError" severity="error" class="search-detail__msg">
      {{ loadError }}
    </Message>

    <template v-else-if="draft">
      <!-- Edit mode: reuse BookForm as a metadata-only editor -->
      <div v-if="editing" class="search-detail__form-wrap glass-surface">
        <h2 class="search-detail__edit-title">Edit details</h2>
        <BookForm
          :initial="draft"
          show-description
          metadata-only
          @submit="onEditDone"
          @cancel="editing = false"
        />
      </div>

      <!-- View mode: polished book page -->
      <template v-else>
        <div class="search-detail__book glass-surface">
          <SearchBookHero :draft="draft" />

          <Message v-if="isDuplicate" severity="info" class="search-detail__msg">
            This book is already in your library. You can still add it.
          </Message>

          <BookDescription :text="draft.description">
            <template #action>
              <Button
                label="Edit details"
                icon="pi pi-pencil"
                outlined
                size="small"
                @click="editing = true"
              />
            </template>
          </BookDescription>
        </div>

        <section class="search-detail__add glass-surface">
          <span class="search-detail__add-label">Add to your library</span>

          <LibraryStatusSelector v-model="status" />

          <div v-if="status === 'currentlyReading'" class="search-detail__page-field">
            <label class="search-detail__page-label" for="sd-current-page">Current page</label>
            <InputNumber
              id="sd-current-page"
              v-model="currentPage"
              :min="1"
              :max="maxCurrentPage"
              placeholder="Where are you now?"
              fluid
            />
          </div>

          <Message v-if="addError" severity="warn" class="search-detail__msg">
            {{ addError }}
          </Message>
          <p v-if="saveError" class="search-detail__save-error">
            <i class="pi pi-exclamation-triangle" /> {{ saveError }}
          </p>

          <Button
            label="Add to Library"
            icon="pi pi-check"
            class="search-detail__add-btn"
            :loading="saving"
            @click="addToLibrary"
          />
        </section>

        <BookRecommendationsScroller
          :recommendations="recommendations"
          :heading="recHeading"
          @select="onSelectRecommendation"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.search-detail {
  max-width: 640px;
  margin: 0 auto;
  padding: 1rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.search-detail__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.search-detail__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.search-detail__book {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.search-detail__add {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.search-detail__add-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.search-detail__page-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.search-detail__page-label {
  font-size: 0.85rem;
  font-weight: 600;
}

.search-detail__add-btn {
  width: 100%;
  margin-top: 0.25rem;
}

.search-detail__form-wrap {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.search-detail__edit-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.search-detail__skeleton {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
}

.search-detail__skeleton-row {
  display: flex;
  gap: 1.25rem;
}

.search-detail__skeleton-meta {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-top: 0.25rem;
}

.search-detail__msg {
  margin: 0;
}

.search-detail__save-error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}
</style>
