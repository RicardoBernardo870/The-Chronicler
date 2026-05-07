<script setup lang="ts">
import { computed } from "vue";
import type { LastSession } from "@/composables/useLastSession";
import { useBooksStore } from "@/stores/books";
import { formatRelativeToNow as formatRelative } from "@/utils/date";
import { Image } from "primevue";

const props = defineProps<{
  session: LastSession;
}>();

const booksStore = useBooksStore();

const bookImage = computed(() =>
  booksStore.bookById(props.session.bookId)?.coverUrl ?? undefined,
);

// ── Formatted metric helpers ─────────────────────────────────────────────

const timeLabel = computed((): string | null => {
  const s = props.session.durationSeconds;
  if (s === null || s === undefined) return null;
  if (s < 60) return "< 1 min";
  const mins = Math.round(s / 60);
  return mins === 1 ? "1 minute" : `${mins} minutes`;
});

const velocityLabel = computed((): string | null => {
  const v = props.session.velocityPph;
  if (v === null || v === undefined) return null;
  return `${v.toLocaleString()} pages/hr`;
});

const completionLabel = computed((): string | null => {
  const d = props.session.completionDelta;
  if (d === null || d === undefined) return null;
  return `${d}% of the book`;
});

const predictionLabel = computed((): string | null => {
  const p = props.session.finishPredictionSessions;
  if (p === null || p === undefined) return null;
  if (p <= 1) return "Finish next session! 🎉";
  return `~${p} more sessions`;
});

const distanceLabel = computed((): string => {
  const { pagesDelta, startPage, endPage } = props.session;
  if (pagesDelta === 0) return "0 pages";
  return `${pagesDelta} ${pagesDelta === 1 ? "page" : "pages"} · p. ${startPage + 1} → p. ${endPage}`;
});
</script>

<template>
  <section class="last-session glass-surface">
    <!-- Header -->
    <h3 class="last-session__title">
      <i class="pi pi-history" /> Last Session
      <span class="last-session__recency">
        {{ formatRelative(session.endedAt) }}
      </span>
    </h3>

    <!-- Book identity row -->
    <div class="last-session__book-info">
      <Image v-if="bookImage" :src="bookImage" width="56" preview />
      <div v-else class="last-session__cover-placeholder">
        <i class="pi pi-book" />
      </div>
      <div class="last-session__book-meta">
        <p class="last-session__book-title">{{ session.bookTitle }}</p>
        <p class="last-session__distance">{{ distanceLabel }}</p>
      </div>
    </div>

    <!-- Full metrics grid -->
    <div class="last-session__grid">
      <div class="last-session__metric">
        <span class="last-session__metric-label">
          <i class="pi pi-clock" /> Time
        </span>
        <span class="last-session__metric-value" :class="{ 'last-session__metric-value--muted': !timeLabel }">
          {{ timeLabel ?? "—" }}
        </span>
      </div>

      <div class="last-session__metric">
        <span class="last-session__metric-label">
          <i class="pi pi-bolt" /> Velocity
        </span>
        <span class="last-session__metric-value" :class="{ 'last-session__metric-value--muted': !velocityLabel }">
          {{ velocityLabel ?? "—" }}
        </span>
      </div>

      <div v-if="completionLabel !== null" class="last-session__metric">
        <span class="last-session__metric-label">
          <i class="pi pi-chart-pie" /> This sitting
        </span>
        <span class="last-session__metric-value">
          {{ completionLabel }}
        </span>
      </div>

      <div v-if="predictionLabel !== null" class="last-session__metric last-session__metric--wide">
        <span class="last-session__metric-label">
          <i class="pi pi-flag" /> At this pace
        </span>
        <span class="last-session__metric-value last-session__metric-value--highlight">
          {{ predictionLabel }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.last-session {
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

.last-session:hover {
  transform: translateY(-1px);
}

.last-session__title {
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

.last-session__recency {
  margin-left: auto;
  color: var(--p-indigo-300);
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0;
  opacity: 1;
}

.last-session__book-info {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}

.last-session__cover-placeholder {
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

.last-session__book-meta {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
  min-width: 0;
}

.last-session__book-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.last-session__distance {
  margin: 0;
  font-size: 0.82rem;
  color: var(--p-indigo-300);
  font-weight: 600;
}

.last-session__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem 1rem;
}

.last-session__metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.last-session__metric:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.last-session__metric-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.last-session__metric-label .pi {
  font-size: 0.65rem;
}

.last-session__metric-value {
  font-size: 0.9rem;
  font-weight: 600;
}

.last-session__metric-value--muted {
  opacity: 0.35;
  font-weight: 400;
}

.last-session__metric-value--highlight {
  color: var(--p-indigo-300);
}

@media (prefers-reduced-motion: reduce) {
  .last-session,
  .last-session__metric {
    transition: none;
  }

  .last-session:hover,
  .last-session__metric:hover {
    transform: none;
  }
}
</style>
