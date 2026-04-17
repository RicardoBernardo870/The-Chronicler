<script setup lang="ts">
import { ref, watch } from 'vue'
import type { LexiconEntryType } from '@/types'
import { useLexiconStore } from '@/stores/lexicon'
import { useLexicon } from '@/composables/useLexicon'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'

const props = defineProps<{ visible: boolean; bookId: string }>()
const emit = defineEmits<{ 'update:visible': [value: boolean]; saved: [] }>()

const lexiconStore = useLexiconStore()
const { lookupWord } = useLexicon()

const term = ref('')
const definition = ref('')
const phonetic = ref<string | null>(null)
const entryType = ref<LexiconEntryType>('dictionary')
const contextSentence = ref('')
const pageFound = ref<number | null>(null)

const fetchingDef = ref(false)
const saving = ref(false)
const errors = ref<Record<string, string>>({})

const typeOptions = [
  { label: 'Dictionary', value: 'dictionary' },
  { label: 'Lore', value: 'lore' },
]

// Auto-fetch definition on blur (dictionary only)
const onTermBlur = async () => {
  if (!term.value.trim() || entryType.value !== 'dictionary') return
  fetchingDef.value = true
  definition.value = ''
  phonetic.value = null
  const result = await lookupWord(term.value.trim())
  fetchingDef.value = false
  if (result) {
    definition.value = result.definition
    phonetic.value = result.phonetic
  }
}

// Re-fetch when switching back to dictionary with a term already entered
watch(entryType, (val) => {
  if (val === 'dictionary' && term.value.trim() && !definition.value) {
    onTermBlur()
  }
})

const reset = () => {
  term.value = ''
  definition.value = ''
  phonetic.value = null
  entryType.value = 'dictionary'
  contextSentence.value = ''
  pageFound.value = null
  errors.value = {}
}

const close = () => {
  reset()
  emit('update:visible', false)
}

const onSave = async () => {
  errors.value = {}
  if (!term.value.trim()) errors.value.term = 'Word is required'
  if (!definition.value.trim()) errors.value.definition = 'Definition is required'
  if (Object.keys(errors.value).length) return

  saving.value = true
  try {
    await lexiconStore.addEntry({
      bookId: props.bookId,
      term: term.value.trim(),
      definition: definition.value.trim(),
      entryType: entryType.value,
      contextSentence: contextSentence.value.trim() || null,
      pageFound: pageFound.value,
    })
    emit('saved')
    close()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="$emit('update:visible', $event)"
    header="Add Word"
    modal
    :dismissable-mask="true"
    :style="{ width: '92vw', maxWidth: '460px' }"
  >
    <div class="add-word">
      <!-- Word -->
      <div class="add-word__field">
        <label class="add-word__label">Word *</label>
        <InputText
          v-model="term"
          placeholder="e.g. ephemeral"
          :invalid="!!errors.term"
          fluid
          @blur="onTermBlur"
        />
        <small v-if="errors.term" class="add-word__error">{{ errors.term }}</small>
      </div>

      <!-- Type toggle -->
      <div class="add-word__field">
        <label class="add-word__label">Type</label>
        <SelectButton v-model="entryType" :options="typeOptions" option-label="label" option-value="value" />
      </div>

      <!-- Definition -->
      <div class="add-word__field">
        <label class="add-word__label">
          Definition *
          <span v-if="fetchingDef" class="add-word__fetching">
            <i class="pi pi-spin pi-spinner" /> fetching…
          </span>
          <span v-else-if="phonetic" class="add-word__phonetic">{{ phonetic }}</span>
        </label>
        <Textarea
          v-model="definition"
          :placeholder="fetchingDef ? 'Fetching definition…' : entryType === 'lore' ? 'Describe this character, place, or concept…' : 'Definition'"
          :invalid="!!errors.definition"
          rows="3"
          fluid
          auto-resize
        />
        <small v-if="errors.definition" class="add-word__error">{{ errors.definition }}</small>
      </div>

      <!-- Context sentence (optional) -->
      <div class="add-word__field">
        <label class="add-word__label">Context <span class="add-word__optional">(optional)</span></label>
        <Textarea
          v-model="contextSentence"
          placeholder='"The ephemeral nature of the magic left him breathless."'
          rows="2"
          fluid
          auto-resize
        />
      </div>

      <!-- Page (optional) -->
      <div class="add-word__field">
        <label class="add-word__label">Page <span class="add-word__optional">(optional)</span></label>
        <InputNumber v-model="pageFound" :min="1" placeholder="e.g. 142" fluid />
      </div>

      <div class="add-word__actions">
        <Button label="Cancel" outlined @click="close" />
        <Button label="Save" icon="pi pi-check" :loading="saving" @click="onSave" />
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.add-word {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  padding-top: 0.25rem;
}

.add-word__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.add-word__label {
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.add-word__optional { font-weight: 400; opacity: 0.5; font-size: 0.8rem; }
.add-word__fetching { font-size: 0.75rem; opacity: 0.6; font-weight: 400; }
.add-word__phonetic { font-size: 0.78rem; opacity: 0.55; font-weight: 400; font-style: italic; }
.add-word__error { color: var(--p-red-400); font-size: 0.78rem; }

.add-word__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.25rem;
}
</style>
