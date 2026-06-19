<script setup lang="ts">
import type { Book } from '@/types'
import Button from 'primevue/button'

const props = defineProps<{
  variant: 'empty' | 'queued'
  book?: Book | null
}>()

const emit = defineEmits<{
  addBook: []
  startBook: [bookId: string]
  import: []
}>()
</script>

<template>
  <section class="dashboard-empty glass-surface">
    <div class="dashboard-empty__icon">
      <i :class="props.variant === 'queued' ? 'pi pi-bookmark' : 'pi pi-book'" />
    </div>

    <div class="dashboard-empty__body">
      <template v-if="props.variant === 'queued' && props.book">
        <p class="dashboard-empty__eyebrow">Ready when you are</p>
        <h2 class="dashboard-empty__title">{{ props.book.title }}</h2>
        <p class="dashboard-empty__description">
          Start this book to make it your active read.
        </p>
      </template>

      <template v-else>
        <p class="dashboard-empty__eyebrow">First book</p>
        <h2 class="dashboard-empty__title">Build your library</h2>
        <p class="dashboard-empty__description">
          Add a book you are reading now, want to read next, or already finished.
        </p>
      </template>
    </div>

    <div class="dashboard-empty__actions">
      <Button
        v-if="props.variant === 'queued' && props.book"
        label="Start reading"
        icon="pi pi-play"
        @click="emit('startBook', props.book.id)"
      />
      <Button
        :label="props.variant === 'queued' ? 'Add another' : 'Add a book'"
        icon="pi pi-plus"
        :outlined="props.variant === 'queued'"
        @click="emit('addBook')"
      />
      <Button
        v-if="props.variant === 'empty'"
        label="Import library"
        icon="pi pi-file-import"
        text
        @click="emit('import')"
      />
    </div>
  </section>
</template>

<style scoped>
.dashboard-empty {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: center;
}

.dashboard-empty__icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
  color: var(--p-primary-color);
  font-size: 1.15rem;
}

.dashboard-empty__body {
  min-width: 0;
}

.dashboard-empty__eyebrow,
.dashboard-empty__description {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.dashboard-empty__eyebrow {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
}

.dashboard-empty__title {
  margin: 0.2rem 0 0.35rem;
  font-size: 1.2rem;
  line-height: 1.2;
}

.dashboard-empty__actions {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (min-width: 560px) {
  .dashboard-empty {
    grid-template-columns: auto 1fr auto;
  }

  .dashboard-empty__actions {
    grid-column: auto;
    justify-content: flex-end;
  }
}
</style>
