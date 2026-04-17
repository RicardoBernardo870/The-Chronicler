<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { useIsbn } from '@/composables/useIsbn'
import IsbnScanner from '@/components/books/IsbnScanner.vue'
import BookForm from '@/components/books/BookForm.vue'
import type { BookMetadata } from '@/types'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'

const router = useRouter()
const booksStore = useBooksStore()
const { lookup } = useIsbn()

type Step = 'scan' | 'form'

const step = ref<Step>('scan')
const prefill = ref<Partial<BookMetadata>>({})
const saving = ref(false)
const saveError = ref<string | null>(null)
const lookupLoading = ref(false)
const manualIsbn = ref('')
// Stores the ISBN from scan/lookup so it gets saved with the book (US6)
const resolvedIsbn = ref<string | null>(null)

const onBarcodeDetected = async (isbn: string) => {
  lookupLoading.value = true
  const meta = await lookup(isbn)
  lookupLoading.value = false
  resolvedIsbn.value = isbn
  prefill.value = meta ?? {}
  step.value = 'form'
}

const enterManually = () => {
  prefill.value = {}
  step.value = 'form'
}

const lookupManualIsbn = async () => {
  if (!manualIsbn.value.trim()) {
    enterManually()
    return
  }
  lookupLoading.value = true
  const meta = await lookup(manualIsbn.value.trim())
  lookupLoading.value = false
  resolvedIsbn.value = manualIsbn.value.trim()
  prefill.value = meta ?? {}
  step.value = 'form'
}

const onFormSubmit = async (data: Required<Omit<BookMetadata, 'coverUrl'>> & { coverUrl: string | null; isbn: string | null }) => {
  saving.value = true
  saveError.value = null
  try {
    // data.isbn comes from BookForm (user may have typed one manually); resolvedIsbn is the fallback from scan
    await booksStore.addBook({ ...data, isbn: data.isbn ?? resolvedIsbn.value, totalPages: data.totalPages ?? 0 })
    router.push('/library')
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save book'
    saving.value = false
  }
}

const onFormCancel = () => {
  if (step.value === 'form') {
    step.value = 'scan'
  } else {
    router.push('/library')
  }
}
</script>

<template>
  <div class="add-book">
    <header class="add-book__header">
      <Button icon="pi pi-arrow-left" text rounded aria-label="Back" @click="onFormCancel" />
      <h1 class="add-book__title">Add a Book</h1>
    </header>

    <!-- Step 1: Scan -->
    <template v-if="step === 'scan'">
      <p class="add-book__hint">Scan the barcode on the back of your book.</p>

      <IsbnScanner @detected="onBarcodeDetected" />

      <div v-if="lookupLoading" class="add-book__lookup-loading glass-subtle">
        <i class="pi pi-spin pi-spinner" />
        Looking up ISBN…
      </div>

      <div class="add-book__manual glass-subtle">
        <p class="add-book__manual-label">No camera? Enter the ISBN manually:</p>
        <div class="add-book__manual-row">
          <InputText
            v-model="manualIsbn"
            placeholder="e.g. 9780261102354"
            fluid
            @keydown.enter="lookupManualIsbn"
          />
          <Button label="Look up" icon="pi pi-search" outlined @click="lookupManualIsbn" />
        </div>
        <Button label="Skip — enter details manually" link size="small" @click="enterManually" />
      </div>
    </template>

    <!-- Step 2: Form -->
    <template v-else>
      <p v-if="Object.keys(prefill).length > 0" class="add-book__prefill-notice">
        <i class="pi pi-check-circle" style="color: var(--p-green-400)" />
        Metadata found! Review and save.
      </p>

      <div class="add-book__form-wrap glass-surface">
        <BookForm
          :initial="{ ...prefill, isbn: resolvedIsbn }"
          :loading="saving"
          @submit="onFormSubmit"
          @cancel="onFormCancel"
        />
        <p v-if="saveError" class="add-book__save-error">
          <i class="pi pi-exclamation-triangle" /> {{ saveError }}
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.add-book {
  max-width: 600px;
  margin: 0 auto;
  padding: 1rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.add-book__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.add-book__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.add-book__hint {
  margin: 0;
  font-size: 0.875rem;
}

.add-book__lookup-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.875rem;
}

.add-book__manual {
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.add-book__manual-label {
  margin: 0;
  font-size: 0.85rem;
}

.add-book__manual-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.add-book__prefill-notice {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}

.add-book__form-wrap {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
}

.add-book__save-error {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}
</style>
