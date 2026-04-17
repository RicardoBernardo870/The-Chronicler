<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useReadingPulse } from '@/composables/useReadingPulse'

const props = defineProps<{
  bookId: string
  totalPages: number
  currentPage: number
}>()

const pulse = useReadingPulse(props.bookId)

onMounted(() => pulse.fetchHistory())

const pph = computed(() => {
  const v = pulse.velocity.value
  if (!v) return null
  return Math.round(v)
})

const prediction = computed(() => pulse.finishPrediction(props.totalPages, props.currentPage))
</script>

<template>
  <div v-if="pph !== null" class="velocity-badge glass-subtle">
    <i class="pi pi-chart-line" />
    <span>{{ pph }} pg/hr</span>
    <span v-if="prediction" class="velocity-badge__sep">·</span>
    <span v-if="prediction" class="velocity-badge__prediction">{{ prediction }}</span>
  </div>
</template>

<style scoped>
.velocity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.2);
  align-self: flex-start;
}

.velocity-badge .pi { font-size: 0.85rem; }
.velocity-badge__sep { opacity: 0.4; }
.velocity-badge__prediction { opacity: 0.75; font-weight: 500; }
</style>
