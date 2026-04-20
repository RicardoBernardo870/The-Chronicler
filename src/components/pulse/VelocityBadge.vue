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
  // Guard: null / undefined / NaN / Infinity / -Infinity all yield fallback
  if (v === null || v === undefined || !isFinite(v) || isNaN(v)) return null
  return Math.round(v)
})

const prediction = computed(() => {
  // Guard: invalid page or total counts prevent a meaningful prediction
  if (props.totalPages <= 0 || props.currentPage > props.totalPages) return null
  return pulse.finishPrediction(props.totalPages, props.currentPage)
})
</script>

<template>
  <div v-if="pph !== null" class="velocity-badge">
    <span>{{ pph }} pg/hr </span>
    <span v-if="prediction" class="velocity-badge__prediction">{{ prediction }}</span>
  </div>
  <div v-else class="velocity-badge velocity-badge--fallback glass-subtle">
    <i class="pi pi-chart-line" />
    <span>—</span>
  </div>
</template>

<style scoped>
.velocity-badge {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-400);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
  margin-bottom: 0.2rem;
}

.velocity-badge--fallback {
  opacity: 0.45;
}

.velocity-badge .pi { font-size: 0.85rem; }
.velocity-badge__sep { opacity: 0.7; }
.velocity-badge__prediction { opacity: 0.75; font-weight: 700; }
</style>
