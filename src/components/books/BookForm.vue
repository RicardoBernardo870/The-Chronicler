<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BookMetadata } from '@/types'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'

const props = defineProps<{
  initial?: Partial<BookMetadata> & { isbn?: string | null }
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [data: Required<Omit<BookMetadata, 'coverUrl'>> & { coverUrl: string | null; isbn: string | null }]
  cancel: []
}>()

const title = ref(props.initial?.title ?? '')
const author = ref(props.initial?.author ?? '')
const totalPages = ref<number | null>(props.initial?.totalPages ?? null)
const genre = ref<string | null>(props.initial?.genre ?? '')
const coverUrl = ref<string | null>(props.initial?.coverUrl ?? null)
const isbn = ref<string | null>(props.initial?.isbn ?? null)

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
    isbn: isbn.value?.trim() || null,
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
</style>
