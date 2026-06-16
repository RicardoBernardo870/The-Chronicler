<script setup lang="ts">
import type { InitialBookStatus } from '@/types'

defineProps<{
  modelValue: InitialBookStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: InitialBookStatus]
}>()

const options: Array<{ value: InitialBookStatus; label: string; icon: string }> = [
  { value: 'queued', label: 'Want to read', icon: 'pi pi-bookmark' },
  { value: 'currentlyReading', label: 'Reading now', icon: 'pi pi-book' },
  { value: 'completed', label: 'Finished', icon: 'pi pi-check-circle' },
]
</script>

<template>
  <div class="status-selector" role="radiogroup" aria-label="Library status">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="status-selector__option"
      :class="{ 'status-selector__option--active': modelValue === option.value }"
      @click="emit('update:modelValue', option.value)"
    >
      <i :class="option.icon" class="status-selector__icon" />
      <span class="status-selector__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.status-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
}

.status-selector__option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 76px;
  padding: 0.65rem 0.5rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: var(--p-text-color);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
}

.status-selector__option:hover {
  background: rgba(255, 255, 255, 0.07);
}

.status-selector__option:active {
  transform: scale(0.98);
}

.status-selector__option--active {
  border-color: var(--p-indigo-400);
  background: rgba(99, 102, 241, 0.18);
  color: var(--p-indigo-300);
  box-shadow: 0 0 0 1px var(--p-indigo-400) inset;
}

.status-selector__icon {
  font-size: 1.15rem;
}

.status-selector__label {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.15;
}
</style>
