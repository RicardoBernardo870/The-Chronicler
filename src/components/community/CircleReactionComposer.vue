<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'

const props = defineProps<{
  currentPage: number | null
  totalPages: number | null
  saving?: boolean
}>()

const emit = defineEmits<{
  submit: [page: number, content: string]
}>()

const page = ref<number | null>(props.currentPage)
const content = ref('')

watch(
  () => props.currentPage,
  value => {
    if (!page.value) page.value = value
  },
)

const trimmed = computed(() => content.value.trim())
const remaining = computed(() => 280 - content.value.length)
const hasValidProgress = computed(() => !!props.totalPages && !!props.currentPage && props.totalPages > 0 && props.currentPage > 0)
const pageError = computed(() => {
  if (!hasValidProgress.value) return 'Set a valid current page before adding reactions.'
  if (!page.value || page.value < 1) return 'Choose a page in this book.'
  if (props.totalPages && page.value > props.totalPages) return 'That page is beyond this edition.'
  if (props.currentPage && page.value > props.currentPage) return 'Reactions can only be at or behind your current progress.'
  return null
})
const canSubmit = computed(() => !props.saving && !pageError.value && trimmed.value.length > 0 && content.value.length <= 280)

const submit = () => {
  if (!canSubmit.value || !page.value) return
  emit('submit', page.value, trimmed.value)
  content.value = ''
}
</script>

<template>
  <form class="circle-reaction-composer" @submit.prevent="submit">
    <div class="circle-reaction-composer__row">
      <InputNumber
        v-model="page"
        input-id="circle-reaction-page"
        :min="1"
        :max="totalPages || undefined"
        show-buttons
        size="small"
      />
      <span class="circle-reaction-composer__limit">{{ remaining }}</span>
    </div>

    <Textarea
      v-model="content"
      rows="3"
      auto-resize
      maxlength="280"
      placeholder="Leave a short reaction"
    />

    <Message v-if="pageError" severity="secondary" size="small">
      {{ pageError }}
    </Message>

    <div class="circle-reaction-composer__actions">
      <Button
        type="submit"
        label="Add reaction"
        icon="pi pi-send"
        size="small"
        :loading="saving"
        :disabled="!canSubmit"
      />
    </div>
  </form>
</template>

<style scoped>
.circle-reaction-composer {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.circle-reaction-composer__row,
.circle-reaction-composer__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.circle-reaction-composer__limit {
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  min-width: 3ch;
  text-align: right;
}
</style>
