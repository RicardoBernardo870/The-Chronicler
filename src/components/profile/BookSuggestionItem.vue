<script setup lang="ts">
// 016 — One book suggestion: title + author pill + reason. glass-subtle surface.
defineProps<{
  title: string;
  author: string;
  reason: string;
}>();
</script>

<template>
  <div class="book-suggestion glass-subtle">
    <h3 class="book-suggestion__title">{{ title }}</h3>
    <span class="book-suggestion__author">{{ author }}</span>
    <p class="book-suggestion__reason">{{ reason }}</p>
  </div>
</template>

<style scoped>
.book-suggestion {
  padding: 0.8rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.book-suggestion__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.book-suggestion__author {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-indigo-400);
  background: rgba(99, 102, 241, 0.15);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  align-self: flex-start;
}

.book-suggestion__reason {
  margin: 0;
  font-size: 0.83rem;
  line-height: 1.45;
  opacity: 0.7;
}
</style>
