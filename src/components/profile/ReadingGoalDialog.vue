<template>
  <Dialog
    :visible="visible"
    modal
    :header="goalLabel"
    class="reading-goal-dialog"
    @update:visible="emit('update:visible', $event)"
    @show="focusInput"
  >
    <form class="goal-form" @submit.prevent="handleSubmit">
      <label for="yearly-goal-target">Books to read in {{ year }}</label>
      <InputNumber
        v-model="target"
        input-id="yearly-goal-target"
        :min="1"
        :max="999"
        :use-grouping="false"
        show-buttons
        autofocus
        fluid
      />
      <small id="yearly-goal-help">You can adjust this anytime.</small>

      <Message v-if="localError || error" severity="error" size="small">
        {{ localError || error }}
      </Message>

      <div class="goal-actions">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          text
          :disabled="saving"
          @click="emit('update:visible', false)"
        />
        <Button type="submit" label="Save goal" icon="pi pi-check" :loading="saving" />
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'

const props = defineProps<{
  visible: boolean
  year: number
  currentTarget: number | null
  saving: boolean
  error: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  save: [targetBooks: number]
}>()

const target = ref<number | null>(props.currentTarget ?? 12)
const localError = ref<string | null>(null)

const goalLabel = computed(() => props.currentTarget ? 'Edit yearly goal' : 'Set yearly goal')

watch(
  () => [props.visible, props.currentTarget] as const,
  ([visible, currentTarget]) => {
    if (!visible) return
    target.value = currentTarget ?? 12
    localError.value = null
  },
)

const focusInput = async () => {
  await nextTick()
  document.getElementById('yearly-goal-target')?.focus()
}

const handleSubmit = () => {
  const value = Math.floor(target.value ?? 0)
  if (value < 1) {
    localError.value = 'Choose at least 1 book.'
    return
  }
  localError.value = null
  emit('save', value)
}
</script>

<style scoped>
.reading-goal-dialog {
  width: min(28rem, calc(100vw - 2rem));
}

.goal-form {
  display: grid;
  gap: 0.75rem;
}

.goal-form label {
  color: var(--p-text-color);
  font-weight: 700;
}

.goal-form small {
  color: var(--p-text-muted-color);
}

.goal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
</style>
