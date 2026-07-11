<script setup lang="ts">
// Page-save bottom sheet — the single place a page number gets typed.
// mode 'end': ending a session ("Where did you stop?") — unchanged page
//             offers "Cancel session instead".
// mode 'edit': quiet correction from the pencil ("Update your page").
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { checkPageSave } from '@/utils/pageSave'

const props = defineProps<{
  visible: boolean
  mode: 'end' | 'edit'
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [page: number]
  cancelSession: []
}>()

const page = ref<number>(props.currentPage)

watch(
  () => props.visible,
  (open) => {
    if (open) page.value = props.currentPage
  },
)

const check = computed(() => checkPageSave(page.value, props.currentPage, props.totalPages))

const hint = computed(() => {
  if (check.value.reason === 'out-of-range') {
    return `Enter a page between 0 and ${props.totalPages}.`
  }
  if (check.value.reason === 'unchanged') {
    return props.mode === 'end'
      ? `You're still on page ${props.currentPage}. Update it to finish the session.`
      : `That's already your current page.`
  }
  return null
})

const close = () => emit('update:visible', false)

const save = () => {
  if (!check.value.ok) return
  emit('save', page.value)
  close()
}

const cancelSession = () => {
  emit('cancelSession')
  close()
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    position="bottom"
    :draggable="false"
    :dismissable-mask="true"
    :header="mode === 'end' ? 'Where did you stop?' : 'Update your page'"
    :style="{ width: '92vw', maxWidth: '420px' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="page-sheet">
      <div class="page-sheet__input-row">
        <button
          type="button"
          class="page-sheet__step"
          aria-label="One page back"
          :disabled="page <= 0"
          @click="page = Math.max(0, (page ?? 0) - 1)"
        >
          <i class="pi pi-minus" aria-hidden="true" />
        </button>
        <div class="page-sheet__value">
          <input
            v-model.number="page"
            type="number"
            inputmode="numeric"
            :min="0"
            :max="totalPages"
            class="page-sheet__value-input"
            aria-label="Page number"
          />
          <span class="page-sheet__range">of {{ totalPages }} pages</span>
        </div>
        <button
          type="button"
          class="page-sheet__step"
          aria-label="One page forward"
          :disabled="page >= totalPages"
          @click="page = Math.min(totalPages, (page ?? 0) + 1)"
        >
          <i class="pi pi-plus" aria-hidden="true" />
        </button>
      </div>

      <p v-if="hint" class="page-sheet__hint">{{ hint }}</p>

      <Button
        :label="mode === 'end' ? 'Save & Finish' : 'Save'"
        icon="pi pi-check"
        :disabled="!check.ok"
        class="page-sheet__save"
        @click="save"
      />

      <button
        v-if="mode === 'end'"
        type="button"
        class="page-sheet__cancel-session"
        @click="cancelSession"
      >
        Cancel session — no progress saved
      </button>
    </div>
  </Dialog>
</template>

<style scoped>
.page-sheet {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.25rem;
}

.page-sheet__input-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.35rem 0;
}

.page-sheet__step {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-indigo-300);
  font-size: 0.8rem;
  cursor: pointer;
}

.page-sheet__step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-sheet__step:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.page-sheet__value {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  min-width: 6rem;
}

.page-sheet__value-input {
  width: 6rem;
  padding: 0.2rem 0;
  border: none;
  border-bottom: 2px solid rgba(99, 102, 241, 0.4);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  text-align: center;
  -moz-appearance: textfield;
  appearance: textfield;
}

.page-sheet__value-input::-webkit-outer-spin-button,
.page-sheet__value-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-sheet__value-input:focus {
  outline: none;
  border-bottom-color: var(--p-primary-color);
}

.page-sheet__range {
  font-size: 0.78rem;
  opacity: 0.6;
}

.page-sheet__hint {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.45;
  text-align: left;
  color: var(--p-text-muted-color);
}

.page-sheet__save {
  min-height: 2.7rem;
  border-radius: 999px;
}

.page-sheet__cancel-session {
  margin: 0;
  padding: 0.4rem;
  border: none;
  background: none;
  color: var(--p-red-400);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  opacity: 0.85;
}

.page-sheet__cancel-session:hover {
  opacity: 1;
}

.page-sheet__cancel-session:focus-visible {
  outline: 2px solid var(--p-red-400);
  outline-offset: 2px;
  border-radius: 8px;
}
</style>
