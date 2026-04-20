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
  <div v-if="pph !== null" class="velocity-badge glass-subtle">
    <i class="pi pi-chart-line" />
    <span>{{ pph }} pg/hr</span>
    <span v-if="prediction" class="velocity-badge__sep">·</span>
    <span v-if="prediction" class="velocity-badge__prediction">{{ prediction }}</span>
  </div>
  <div v-else class="velocity-badge velocity-badge--fallback glass-subtle">
    <i class="pi pi-chart-line" />
    <span>—</span>
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

.velocity-badge--fallback {
  opacity: 0.45;
}

.velocity-badge .pi { font-size: 0.85rem; }
.velocity-badge__sep { opacity: 0.4; }
.velocity-badge__prediction { opacity: 0.75; font-weight: 500; }
</style>
