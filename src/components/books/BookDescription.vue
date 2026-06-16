<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'

const props = defineProps<{
  text: string | null
}>()

// Show a "Read more" toggle only when the text is long enough to be clamped.
const CLAMP_THRESHOLD = 280

const expanded = ref(false)
const isLong = computed(() => (props.text?.length ?? 0) > CLAMP_THRESHOLD)
</script>

<template>
  <section class="book-description">
    <h2 class="book-description__title">About this book</h2>

    <p
      v-if="text"
      class="book-description__text"
      :class="{ 'book-description__text--clamped': isLong && !expanded }"
    >
      {{ text }}
    </p>
    <p v-else class="book-description__empty">No description available.</p>

    <div class="book-description__footer">
      <Button
        v-if="isLong"
        :label="expanded ? 'Read less' : 'Read more'"
        :icon="expanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        icon-pos="right"
        link
        size="small"
        class="book-description__toggle"
        @click="expanded = !expanded"
      />
      <span v-else class="book-description__spacer" />

      <slot name="action" />
    </div>
  </section>
</template>

<style scoped>
.book-description {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.book-description__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.book-description__text {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.55;
  opacity: 0.85;
  white-space: pre-line;
}

.book-description__text--clamped {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-description__empty {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-muted-color);
}

.book-description__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.book-description__toggle {
  padding-left: 0;
}

.book-description__spacer {
  flex: 1 1 auto;
}
</style>
