<script setup lang="ts">
import { ref } from 'vue'
import type { Book } from '@/types'
import { useBooksStore } from '@/stores/books'
import BookForm from '@/components/books/BookForm.vue'
import Dialog from 'primevue/dialog'

const props = defineProps<{
  book: Book
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  close: []
}>()

const booksStore = useBooksStore()
const saving = ref(false)

const onSave = async (data: { title: string; author: string; totalPages: number | null; genre: string | null; coverUrl: string | null }) => {
  saving.value = true
  try {
    await booksStore.updateBook(props.book.id, {
      title: data.title,
      author: data.author,
      ...(data.totalPages != null && { totalPages: data.totalPages }),
      genre: data.genre,
      coverUrl: data.coverUrl,
    })
    emit('update:visible', false)
    emit('close')
  } finally {
    saving.value = false
  }
}

const onCancel = () => {
  emit('update:visible', false)
  emit('close')
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Edit Book"
    modal
    :style="{ width: '92vw', maxWidth: '480px' }"
    :dismissable-mask="true"
  >
    <BookForm
      :initial="{
        title: book.title,
        author: book.author,
        totalPages: book.totalPages,
        genre: book.genre,
        coverUrl: book.coverUrl,
      }"
      :loading="saving"
      @submit="onSave"
      @cancel="onCancel"
    />
  </Dialog>
</template>
