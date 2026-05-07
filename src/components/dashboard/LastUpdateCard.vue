<script setup lang="ts">
import { computed } from "vue";
import type { LastSession } from "@/composables/useLastSession";
import { useBooksStore } from "@/stores/books";
import { formatRelativeToNow as formatRelative } from "@/utils/date";
import { Divider, Image } from "primevue";

const props = defineProps<{
  session: LastSession;
}>();

const booksStore = useBooksStore();

const bookImage = computed(
  () => booksStore.bookById(props.session.bookId)?.coverUrl ?? undefined,
);

const completionLabel = computed((): string | null => {
  const d = props.session.completionDelta;
  if (d === null || d === undefined) return null;
  return `${d}% of the book`;
});

const distanceLabel = computed((): string => {
  const { pagesDelta, startPage, endPage } = props.session;
  if (pagesDelta === 0) return "0 pages";
  return `${pagesDelta} ${pagesDelta === 1 ? "page" : "pages"} · p. ${startPage + 1} → p. ${endPage}`;
});
</script>

<template>
  <section class="last-update glass-surface">
    <!-- Header -->
    <h3 class="last-update__title">
      <i class="pi pi-pencil" /> Last Update
      <span class="last-update__recency">
        {{ formatRelative(session.endedAt) }}
      </span>
    </h3>

    <!-- Book identity row -->
    <div class="last-update__book-info">
      <Image v-if="bookImage" :src="bookImage" width="80" preview />
      <div v-else class="last-update__cover-placeholder">
        <i class="pi pi-book" />
      </div>
      <div class="last-update__book-meta">
        <p class="last-update__book-title">{{ session.bookTitle }}</p>
        <p class="last-update__distance">{{ distanceLabel }}</p>
      
        <!-- Single metric: completion delta (when available) -->
        <div v-if="completionLabel !== null" class="last-update__metric">
          <span class="last-update__metric-label">
            <i class="pi pi-chart-pie" /> This sitting
          </span>
          <span class="last-update__metric-value">
            {{ completionLabel }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.last-update {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.last-update:hover {
  transform: translateY(-1px);
}

.last-update__title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.last-update__recency {
  margin-left: auto;
  color: var(--p-indigo-300);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  opacity: 1;
}

.last-update__book-info {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.last-update__cover-placeholder {
  width: 56px;
  height: 80px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.2rem;
  opacity: 0.4;
}

.last-update__book-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  min-width: 0;
}

.last-update__book-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-update__distance {
  margin: 0;
  font-size: 0.82rem;
  color: var(--p-indigo-300);
  font-weight: 600;
}

.last-update__metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-top: 10px;
}

.last-update__metric-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.last-update__metric-label .pi {
  font-size: 0.65rem;
}

.last-update__metric-value {
  font-size: 0.9rem;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .last-update {
    transition: none;
  }

  .last-update:hover {
    transform: none;
  }
}
</style>
