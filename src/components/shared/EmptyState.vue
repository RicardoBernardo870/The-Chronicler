<template>
  <div class="empty-state glass-subtle">
    <i v-if="icon" :class="`pi ${icon} empty-state__icon`" />
    <h3 class="empty-state__title">{{ title }}</h3>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string
  title: string
  description?: string
}>()
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 2rem;
  text-align: center;
  border-radius: 20px;
}

.empty-state__icon {
  font-size: 2.5rem;
  opacity: 0.35;
  margin-bottom: 0.25rem;
}

.empty-state__title {
  font-size: 1.1rem;
  font-weight: 600;
  opacity: 0.80;
}

.empty-state__description {
  font-size: 0.875rem;
  opacity: 0.50;
  max-width: 280px;
  line-height: 1.6;
}
</style>
