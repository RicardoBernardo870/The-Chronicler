<script setup lang="ts">
// Book-length shelf — average length of finished books plus the longest and
// shortest (with covers). Pure client-side from already-loaded progress data.
import { computed } from 'vue'
import { useProgressStore } from '@/stores/progress'
import { coverFallback } from '@/utils/coverFallback'

const progressStore = useProgressStore()

const finished = computed(() =>
  progressStore.completedBooks.filter((c) => c.book.totalPages > 0),
)

const avgPages = computed(() => {
  if (finished.value.length === 0) return 0
  return Math.round(
    finished.value.reduce((sum, c) => sum + c.book.totalPages, 0) /
      finished.value.length,
  )
})

const longest = computed(() =>
  finished.value.reduce(
    (best, c) => (c.book.totalPages > (best?.book.totalPages ?? 0) ? c : best),
    finished.value[0] ?? null,
  ),
)

const shortest = computed(() =>
  finished.value.reduce(
    (best, c) => (c.book.totalPages < (best?.book.totalPages ?? Infinity) ? c : best),
    finished.value[0] ?? null,
  ),
)
</script>

<template>
  <section
    v-if="finished.length > 0 && longest && shortest"
    class="book-length glass-surface"
    aria-label="Book length stats"
  >
    <h2 class="book-length__title">
      <i class="pi pi-arrows-v" aria-hidden="true" /> Book Lengths
    </h2>

    <p class="book-length__avg">
      Your average finished book runs
      <strong>{{ avgPages.toLocaleString() }} pages</strong>.
    </p>

    <div class="book-length__row">
      <div class="book-length__extreme">
        <span class="book-length__label">Longest</span>
        <div class="book-length__book">
          <img
            v-if="longest.book.coverUrl"
            :src="longest.book.coverUrl"
            alt=""
            class="book-length__cover"
            loading="lazy"
            @error="coverFallback"
          />
          <div class="book-length__meta">
            <span class="book-length__book-title">{{ longest.book.title }}</span>
            <span class="book-length__pages">{{ longest.book.totalPages.toLocaleString() }} pages</span>
          </div>
        </div>
      </div>
      <div class="book-length__extreme">
        <span class="book-length__label">Shortest</span>
        <div class="book-length__book">
          <img
            v-if="shortest.book.coverUrl"
            :src="shortest.book.coverUrl"
            alt=""
            class="book-length__cover"
            loading="lazy"
            @error="coverFallback"
          />
          <div class="book-length__meta">
            <span class="book-length__book-title">{{ shortest.book.title }}</span>
            <span class="book-length__pages">{{ shortest.book.totalPages.toLocaleString() }} pages</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.book-length {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.1rem 1rem;
}

.book-length__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}

.book-length__title .pi {
  font-size: 0.8rem;
}

.book-length__avg {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.8;
}

.book-length__avg strong {
  color: var(--p-indigo-300);
}

.book-length__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.book-length__extreme {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.book-length__label {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.5;
}

.book-length__book {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.book-length__cover {
  flex: none;
  width: 30px;
  height: 44px;
  object-fit: cover;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.book-length__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.book-length__book-title {
  overflow: hidden;
  font-size: 0.78rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-length__pages {
  font-size: 0.7rem;
  opacity: 0.6;
}

:root[data-p-theme="light"] .book-length__avg strong {
  color: var(--p-indigo-600);
}
</style>
