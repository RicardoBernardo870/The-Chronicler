<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Skeleton } from 'primevue'
import { useToast } from 'primevue/usetoast'
import { useBooksStore } from '@/stores/books'
import { useProgressStore } from '@/stores/progress'
import { formatRelativeToNow } from '@/utils/date'
import type { LibraryBookEntry } from '@/types'
import EmptyState from '@/components/shared/EmptyState.vue'

const router = useRouter()
const booksStore = useBooksStore()
const progressStore = useProgressStore()
const toast = useToast()

const dnfEntries = computed(() =>
  booksStore.libraryEntries
    .filter((entry) => entry.status === 'dnf')
    .sort((a, b) =>
      new Date(b.dnfAt ?? 0).getTime() - new Date(a.dnfAt ?? 0).getTime(),
    ),
)

const resumingId = ref<string | null>(null)

// Imported DNF books arrive without progress or a real shelving moment — the
// import timestamp and "p. 0" would just be noise, so they get no detail line.
const detailFor = (entry: LibraryBookEntry): string | null => {
  if (entry.source !== 'manual' && entry.currentPage === 0) return null
  const parts: string[] = []
  if (entry.currentPage > 0) {
    parts.push(`stopped at p. ${entry.currentPage} · ${Math.round(entry.percentage)}%`)
  }
  if (entry.dnfAt) parts.push(`shelved ${formatRelativeToNow(entry.dnfAt)}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

const resume = async (bookId: string) => {
  resumingId.value = bookId
  try {
    await progressStore.resumeDnf(bookId)
    toast.add({
      severity: 'success',
      summary: 'Back on the shelf',
      detail: 'The book is back in your reading list.',
      life: 3000,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: 'Resume failed',
      detail: 'Could not resume the book. Try again.',
      life: 3000,
    })
  } finally {
    resumingId.value = null
  }
}

onMounted(async () => {
  await booksStore.fetchLibraryWithProgress()
  await progressStore.fetchProgress()
})
</script>

<template>
  <div class="dnf-page">
    <header class="dnf-page__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back to Library"
        @click="router.push('/library')"
      />
      <h1 class="dnf-page__title">Did Not Finish</h1>
      <span v-if="dnfEntries.length > 0" class="dnf-page__count">{{ dnfEntries.length }}</span>
    </header>

    <div v-if="booksStore.loading" class="dnf-page__list">
      <div v-for="i in 2" :key="i" class="glass-surface dnf-card">
        <Skeleton width="48px" height="68px" border-radius="6px" />
        <div class="dnf-card__meta">
          <Skeleton height="0.9rem" width="60%" />
          <Skeleton height="0.75rem" width="40%" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="dnfEntries.length === 0"
      icon="pi-book"
      title="Nothing shelved"
      description="Books you mark as Did Not Finish will land here — you can pick them back up anytime."
    >
      <template #action>
        <Button
          label="Back to Library"
          icon="pi pi-arrow-left"
          outlined
          @click="router.push('/library')"
        />
      </template>
    </EmptyState>

    <TransitionGroup v-else name="dnf-page__item" tag="div" class="dnf-page__list" appear>
      <article
        v-for="entry in dnfEntries"
        :key="entry.id"
        class="glass-surface dnf-card"
        role="button"
        tabindex="0"
        @click="router.push({ name: 'book-detail', params: { id: entry.id } })"
        @keydown.enter="router.push({ name: 'book-detail', params: { id: entry.id } })"
      >
        <img
          v-if="entry.coverUrl"
          :src="entry.coverUrl"
          :alt="`Cover of ${entry.title}`"
          class="dnf-card__cover"
        />
        <div v-else class="dnf-card__cover dnf-card__cover--placeholder">
          <i class="pi pi-book" />
        </div>

        <div class="dnf-card__meta">
          <p class="dnf-card__book-title">{{ entry.title }}</p>
          <p class="dnf-card__author">{{ entry.author }}</p>
          <p v-if="detailFor(entry)" class="dnf-card__detail">{{ detailFor(entry) }}</p>
        </div>

        <Button
          label="Resume"
          icon="pi pi-play"
          size="small"
          outlined
          :loading="resumingId === entry.id"
          class="dnf-card__resume"
          @click.stop="resume(entry.id)"
        />
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.dnf-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dnf-page__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dnf-page__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.dnf-page__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(99, 102, 241, 0.22);
  color: var(--p-indigo-300);
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.dnf-page__list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.dnf-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem;
  border-radius: var(--p-border-radius-xl, 16px);
  cursor: pointer;
  transition: transform 0.15s ease;
}

.dnf-card:hover {
  transform: translateY(-1px);
}

.dnf-card:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.dnf-card__cover {
  width: 48px;
  height: 68px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.dnf-card__cover--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  opacity: 0.4;
  font-size: 1.1rem;
}

.dnf-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.dnf-card__book-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dnf-card__author {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.65;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dnf-card__detail {
  margin: 0;
  font-size: 0.75rem;
  color: var(--p-indigo-300);
  font-weight: 600;
}

.dnf-card__resume {
  flex-shrink: 0;
}

.dnf-page__item-enter-active,
.dnf-page__item-leave-active,
.dnf-page__item-move {
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}

.dnf-page__item-enter-from,
.dnf-page__item-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.dnf-page__item-leave-active {
  position: absolute;
  width: calc(100% - 2rem);
  max-width: 648px;
}

@media (prefers-reduced-motion: reduce) {
  .dnf-page__item-enter-active,
  .dnf-page__item-leave-active,
  .dnf-page__item-move {
    transition: none;
  }

  .dnf-page__item-enter-from,
  .dnf-page__item-leave-to {
    transform: none;
  }
}
</style>
