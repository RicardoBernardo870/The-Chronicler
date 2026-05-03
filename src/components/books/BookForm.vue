<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BookMetadata, InitialBookStatus } from '@/types'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import RadioButton from 'primevue/radiobutton'

const props = defineProps<{
  initial?: Partial<BookMetadata> & { isbn?: string | null }
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Required<Omit<BookMetadata, 'coverUrl'>> & {
    coverUrl: string | null
    isbn: string | null
    initialStatus: InitialBookStatus
    currentPage: number | null
  }]
  cancel: []
}>()

const title = ref(props.initial?.title ?? '')
const author = ref(props.initial?.author ?? '')
const totalPages = ref<number | null>(props.initial?.totalPages ?? null)
const genre = ref<string | null>(props.initial?.genre ?? '')
const coverUrl = ref<string | null>(props.initial?.coverUrl ?? null)
const isbn = ref<string | null>(props.initial?.isbn ?? null)
const initialStatus = ref<InitialBookStatus>('queued')
const currentPage = ref<number | null>(null)
const statusOptions = [
  { label: 'Want to read', value: 'queued' },
  { label: 'Reading now', value: 'currentlyReading' },
  { label: 'Already finished', value: 'completed' },
] satisfies Array<{ label: string; value: InitialBookStatus }>

const errors = ref<Record<string, string>>({})

// Re-populate when initial prop changes (e.g. after ISBN lookup)
watch(() => props.initial, (val) => {
  if (!val) return
  title.value = val.title ?? title.value
  author.value = val.author ?? author.value
  totalPages.value = val.totalPages ?? totalPages.value
  genre.value = val.genre ?? genre.value
  coverUrl.value = val.coverUrl ?? coverUrl.value
  isbn.value = val.isbn ?? isbn.value
})

const validate = () => {
  const e: Record<string, string> = {}
  if (!title.value.trim()) e.title = 'Title is required'
  if (!author.value.trim()) e.author = 'Author is required'
  if (!totalPages.value || totalPages.value < 1) e.totalPages = 'Enter a valid page count'
  if (initialStatus.value === 'currentlyReading') {
    const maxPage = Math.max(0, (totalPages.value ?? 0) - 1)
    if (!currentPage.value || currentPage.value < 1 || currentPage.value > maxPage) {
      e.currentPage = maxPage > 0
        ? `Enter a page between 1 and ${maxPage}`
        : 'Use Already finished for one-page books'
    }
  }
  errors.value = e
  return Object.keys(e).length === 0
}

const onSubmit = () => {
  if (!validate()) return
  emit('submit', {
    title: title.value.trim(),
    author: author.value.trim(),
    totalPages: totalPages.value!,
    genre: genre.value,
    coverUrl: coverUrl.value,
    isbn: isbn.value?.trim().toUpperCase() || null,
    initialStatus: initialStatus.value,
    currentPage: initialStatus.value === 'currentlyReading' ? currentPage.value : null,
  })
}
</script>

<template>
  <form class="book-form" @submit.prevent="onSubmit">
    <!-- Cover preview -->
    <div v-if="coverUrl" class="book-form__cover-preview">
      <img :src="coverUrl" alt="Book cover" class="book-form__cover-img" />
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-title">Title *</label>
      <InputText
        id="bf-title"
        v-model="title"
        placeholder="e.g. The Lord of the Rings"
        :invalid="!!errors.title"
        fluid
      />
      <small v-if="errors.title" class="book-form__error">{{ errors.title }}</small>
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-author">Author *</label>
      <InputText
        id="bf-author"
        v-model="author"
        placeholder="e.g. J.R.R. Tolkien"
        :invalid="!!errors.author"
        fluid
      />
      <small v-if="errors.author" class="book-form__error">{{ errors.author }}</small>
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-pages">Total Pages *</label>
      <InputNumber
        id="bf-pages"
        v-model="totalPages"
        :min="1"
        :max="99999"
        placeholder="e.g. 423"
        :invalid="!!errors.totalPages"
        fluid
      />
      <small v-if="errors.totalPages" class="book-form__error">{{ errors.totalPages }}</small>
    </div>

    <div class="book-form__field">
      <fieldset class="book-form__status-fieldset">
        <legend class="book-form__label">Library status</legend>
        <div class="book-form__status-options">
          <label
            v-for="option in statusOptions"
            :key="option.value"
            class="book-form__status-option"
            :for="`bf-status-${option.value}`"
          >
            <RadioButton
              :input-id="`bf-status-${option.value}`"
              v-model="initialStatus"
              name="library-status"
              :value="option.value"
            />
            <span>{{ option.label }}</span>
          </label>
        </div>
      </fieldset>
    </div>

    <div v-if="initialStatus === 'currentlyReading'" class="book-form__field">
      <label class="book-form__label" for="bf-current-page">Current Page *</label>
      <InputNumber
        id="bf-current-page"
        v-model="currentPage"
        :min="1"
        :max="Math.max(1, (totalPages ?? 1) - 1)"
        placeholder="Where are you now?"
        :invalid="!!errors.currentPage"
        fluid
      />
      <small v-if="errors.currentPage" class="book-form__error">{{ errors.currentPage }}</small>
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-genre">Genre</label>
      <InputText
        id="bf-genre"
        v-model="genre"
        placeholder="e.g. Fantasy"
        fluid
      />
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-isbn">ISBN <span class="book-form__optional">(optional — improves AI recap accuracy)</span></label>
      <InputText
        id="bf-isbn"
        v-model="isbn"
        placeholder="e.g. 9780261102354"
        fluid
      />
    </div>

    <div class="book-form__field">
      <label class="book-form__label" for="bf-cover">Cover URL <span class="book-form__optional">(optional)</span></label>
      <InputText
        id="bf-cover"
        v-model="coverUrl"
        placeholder="https://…"
        fluid
      />
    </div>

    <div class="book-form__actions">
      <Button
        type="button"
        label="Cancel"
        icon="pi pi-times"
        outlined
        @click="emit('cancel')"
      />
      <Button
        type="submit"
        label="Save Book"
        icon="pi pi-check"
        :loading="loading"
      />
    </div>
  </form>
</template>

<style scoped>
.book-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.book-form__cover-preview {
  display: flex;
  justify-content: center;
}

.book-form__cover-img {
  width: 80px;
  height: 116px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
}

.book-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.book-form__label {
  font-size: 0.85rem;
  font-weight: 600;
}

.book-form__optional {
  font-weight: 400;
  opacity: 0.55;
  font-size: 0.8rem;
}

.book-form__error {
  color: var(--p-red-400);
  font-size: 0.78rem;
}

.book-form__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.book-form__status-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-inline-size: 0;
}

.book-form__status-options {
  display: grid;
  gap: 0.65rem;
}

.book-form__status-option {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  cursor: pointer;
}

.book-form__status-option span {
  font-size: 0.9rem;
  font-weight: 600;
}
</style>
