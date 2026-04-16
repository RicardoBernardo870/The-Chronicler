<script setup lang="ts">
import type { Recap } from '@/types'
import RecapCard from './RecapCard.vue'

const props = defineProps<{
  recaps: Recap[]
  bookTitle?: string
}>()
</script>

<template>
  <section class="recap-history">
    <div v-if="recaps.length === 0" class="recap-history__empty glass-subtle">
      <i class="pi pi-clock" style="font-size: 2.5rem; opacity: 0.4" />
      <p class="recap-history__empty-msg">No recap history yet.</p>
      <p class="recap-history__empty-hint">
        Generate your first recap from the book detail page.
      </p>
    </div>

    <TransitionGroup v-else name="recap-list" tag="div" class="recap-history__list">
      <RecapCard
        v-for="recap in recaps"
        :key="recap.id"
        :recap="recap"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
.recap-history__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0.6rem;
  padding: 3rem 2rem;
  border-radius: var(--p-border-radius-xl, 16px);
}

.recap-history__empty-msg {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.recap-history__empty-hint {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.7;
}

.recap-history__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* TransitionGroup animations */
.recap-list-enter-active,
.recap-list-leave-active {
  transition: all 0.3s ease;
}

.recap-list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}

.recap-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
