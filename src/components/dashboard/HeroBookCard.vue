<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { Book, ReadingProgress } from "@/types";
import { useLoreCardsStore } from "@/stores/loreCards";
import { useProgressStore } from "@/stores/progress";
import { useLastSession } from "@/composables/useLastSession";
import RecapStream from "@/components/recap/RecapStream.vue";
import SessionCaptureField from "@/components/session/SessionCaptureField.vue";
import SessionStartButton from "@/components/session/SessionStartButton.vue";
import Button from "primevue/button";
import Chip from "primevue/chip";
import Tag from "primevue/tag";
import ProgressBar from "primevue/progressbar";
import InputNumber from "primevue/inputnumber";
import InputGroup from "primevue/inputgroup";
import { coverFallback } from "@/utils/coverFallback";
import { Message } from "primevue";

const props = defineProps<{
  book: Book;
  progress: ReadingProgress | null;
  saving: boolean;
  justSaved: boolean;
  saveError: string | null;
  pageInput: number;
  heroWarning: boolean;
  pendingSync: boolean;
  recapTriggered: boolean;
  recapLocked: boolean;
  pagesUntilUnlock: number;
  recapLockLabel: string;
}>();

const emit = defineEmits<{
  "update:pageInput": [value: number];
  save: [];
  getRecap: [];
  dismissRecap: [];
  viewBook: [];
  sessionConflict: [startedAt: Date];
  cancelSession: [];
}>();

const loreStore = useLoreCardsStore();
const progressStore = useProgressStore();
const { lastSession, fetchLastSession } = useLastSession();

const showCaptureField = ref(false);
const pendingHistoryRowId = ref<string | null>(null);
const pendingBookId = ref<string | null>(null);

watch(
  () => progressStore.lastSessionEnded,
  (event) => {
    if (event?.bookId === props.book.id) {
      pendingHistoryRowId.value = event.historyRowId;
      pendingBookId.value = event.bookId;
      showCaptureField.value = true;
    }
  },
  { immediate: true },
);

watch(
  () => props.book.id,
  () => {
    if (pendingBookId.value !== props.book.id) {
      showCaptureField.value = false;
      pendingHistoryRowId.value = null;
      pendingBookId.value = null;
    }
  },
);

const heroSessionNote = computed(() =>
  lastSession.value?.bookId === props.book.id
    ? lastSession.value.sessionNote
    : null,
);

const handleCaptureComplete = () => {
  showCaptureField.value = false;
  pendingHistoryRowId.value = null;
  pendingBookId.value = null;
  progressStore.consumeSessionEnded();
  fetchLastSession();
};

onMounted(() => fetchLastSession());
</script>

<template>
  <article
    class="hero-card glass-surface"
    :class="{ 'hero-card--warning': heroWarning }"
  >
    <!-- New Lore chip -->
    <button
      v-if="loreStore.hasUnseenLore(book.id)"
      class="hero-card__new-lore-chip"
      aria-label="New lore unlocked — tap to view"
      @click.stop="emit('viewBook')"
    >
      <i class="pi pi-sparkles" />
      New Lore
    </button>

    <div class="hero-card__hero">
      <div class="hero-card__cover-wrap">
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          :alt="`Cover of ${book.title}`"
          class="hero-card__cover"
          @error="coverFallback"
        />
        <div v-else class="hero-card__cover-placeholder">
          <i class="pi pi-book" style="font-size: 2.5rem; opacity: 0.35" />
        </div>
      </div>

      <div class="hero-card__meta">
        <Chip v-if="book.genre" :label="book.genre" class="hero-card__genre" />
        <div class="hero-card__title-row">
          <h2 class="hero-card__title">{{ book.title }}</h2>
          <Button
            class="hero-card__chevron"
            aria-label="View book details"
            @click="emit('viewBook')"
          >
            <i class="pi pi-chevron-right" />
        </Button>
        </div>
        <p class="hero-card__author">{{ book.author }}</p>

        <div class="hero-card__progress-row">
          <ProgressBar
            :value="progress?.percentage ?? 0"
            :show-value="false"
            class="hero-card__progress-bar"
          />
          <span class="hero-card__pct"
            >{{ (progress?.percentage ?? 0).toFixed(1) }}%</span
          >
        </div>

        <p class="hero-card__page-hint">
          Page {{ progress?.currentPage ?? 0 }} of {{ book.totalPages }}
        </p>
      </div>
    </div>

    <div class="hero-card__update-section">
      <span class="hero-card__update-label">CURRENT PAGE</span>
      <div class="hero-card__update-row">
        <InputGroup class="hero-card__page-group">
          <InputNumber
            :model-value="pageInput"
            :min="0"
            :max="book.totalPages"
            placeholder="Page"
            show-buttons
            :step="1"
            class="hero-card__page-input"
            @update:model-value="(v) => emit('update:pageInput', v ?? 0)"
            @input="(e: any) => emit('update:pageInput', e.value ?? 0)"
          />
        </InputGroup>
        <Button
          :label="justSaved ? 'Saved!' : 'Save'"
          :icon="justSaved ? 'pi pi-check' : 'pi pi-check'"
          :loading="saving"
          :disabled="pageInput === (progress?.currentPage ?? 0)"
          class="hero-card__save-btn"
          :class="{ 'hero-card__save-btn--saved': justSaved }"
          @click="emit('save')"
        />
      </div>
    </div>

    <Transition name="hero-card__fade">
      <p v-if="saveError" class="hero-card__error">
        <i class="pi pi-exclamation-triangle" /> {{ saveError }}
      </p>
    </Transition>

    <Transition name="hero-card__fade">
      <Message
        v-if="heroWarning"
        severity="warn"
        class="hero-card__continuity-warning"
      >
        It's been a while — time for a Memory Jogger?
      </Message>
    </Transition>

    <Transition name="hero-card__fade">
      <Tag
        v-if="pendingSync"
        severity="warn"
        value="Progress will sync when you're back online"
        class="hero-card__offline-badge"
      />
    </Transition>

    <div class="hero-card__actions">
      <div class="hero-card__session-action">
        <SessionStartButton
          :book-id="book.id"
          :icon-only="false"
          @conflict-warning="(startedAt) => emit('sessionConflict', startedAt)"
          @cancel-session="emit('cancelSession')"
        />
      </div>
      <Button
        v-if="!recapTriggered && recapLocked"
        :label="recapLockLabel || `Read ${pagesUntilUnlock} more pages`"
        disabled
        class="hero-card__recap-btn hero-card__recap-btn--locked"
      />
      <Button
        v-else
        :label="recapTriggered ? 'Recap open' : 'Get Recap'"
        icon="pi pi-sparkles"
        class="hero-card__recap-btn"
        :disabled="recapTriggered"
        @click="emit('getRecap')"
      />
    </div>

    <Transition name="hero-card__detail" mode="out-in">
      <div
        v-if="showCaptureField && pendingHistoryRowId && pendingBookId"
        class="hero-card__detail-block"
      >
        <hr class="hero-card__sep" />
        <SessionCaptureField
          :history-row-id="pendingHistoryRowId"
          :book-id="pendingBookId"
          @saved="handleCaptureComplete"
          @skipped="handleCaptureComplete"
        />
      </div>

      <div v-else-if="heroSessionNote" class="hero-card__detail-block">
        <hr class="hero-card__sep" />
        <p class="hero-card__note">
          <i class="pi pi-pencil" />
          {{ heroSessionNote }}
        </p>
      </div>
    </Transition>
  </article>

  <!-- Inline Recap Panel -->
  <Transition name="hero-card__panel">
    <div v-if="recapTriggered" class="hero-card__inline-panel glass-surface">
      <div class="hero-card__inline-panel-header">
        <span class="hero-card__inline-panel-title">AI Recap</span>
        <button
          class="hero-card__inline-dismiss"
          aria-label="Dismiss recap"
          @click="emit('dismissRecap')"
        >
          <i class="pi pi-times" />
        </button>
      </div>
      <RecapStream :bookId="book.id" />
    </div>
  </Transition>
</template>

<style scoped>
.hero-card {
  position: relative;
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  transition:
    border-color 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.hero-card:hover {
  transform: translateY(-1px);
}

.hero-card--warning {
  background:
    linear-gradient(
      135deg,
      rgba(251, 191, 36, 0.12) 0%,
      rgba(245, 158, 11, 0.06) 100%
    ),
    var(--glass-surface-bg, rgba(255, 255, 255, 0.04));
  border-color: rgba(251, 191, 36, 0.35) !important;
  animation: pulse-amber 2.5s ease-in-out infinite;
}

@keyframes pulse-amber {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.15);
  }
}

.hero-card__hero {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.hero-card__cover-wrap {
  flex-shrink: 0;
}

.hero-card__cover {
  width: 88px;
  height: 128px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.hero-card:hover .hero-card__cover {
  transform: translateY(-2px);
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.38);
}

.hero-card__cover-placeholder {
  width: 88px;
  height: 128px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hero-card__genre {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-indigo-400);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  align-self: flex-start;
  margin-bottom: 0.2rem;
}

.hero-card__title-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  justify-content: space-between;
}

.hero-card__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-card__chevron {
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.4;
  padding: 0.15rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.hero-card__chevron:hover {
  opacity: 0.85;
}

.hero-card__chevron .pi {
  font-size: 0.75rem;
}

.hero-card__author {
  margin: 0;
  font-size: 0.85rem;
}

.hero-card__progress-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.hero-card__progress-bar {
  flex: 1;
  height: 5px;
}

.hero-card__pct {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-indigo-300);
  min-width: 40px;
  text-align: right;
}

.hero-card__page-hint {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
}

.hero-card__update-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.hero-card__update-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
}

.hero-card__update-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.hero-card__page-group {
  flex: 1;
  border-radius: var(--p-border-radius-lg, 12px);
  overflow: hidden;
}

/* InputGroup border unification */
.hero-card__page-group :deep(.p-inputgroup-addon) {
  background: var(--p-surface-100, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--p-surface-border, var(--p-surface-300));
  color: var(--p-primary-color);
  padding: 0 0.75rem;
}

.hero-card__page-input {
  flex: 1;
}

/* InputNumber inner input styling */
.hero-card__page-input :deep(.p-inputnumber-input) {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  border-color: var(--p-surface-border, var(--p-surface-300));
}

.hero-card__page-input :deep(.p-inputnumber-input:focus) {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

/* Stepper buttons subtle styling */
.hero-card__page-input :deep(.p-inputnumber-button) {
  background: var(--p-surface-100, rgba(255, 255, 255, 0.04));
  border-color: var(--p-surface-border, var(--p-surface-300));
  color: var(--p-text-muted-color);
  transition: background 0.15s ease, color 0.15s ease;
}

.hero-card__page-input :deep(.p-inputnumber-button:hover) {
  background: rgba(99, 102, 241, 0.15);
  color: var(--p-primary-color);
}

.hero-card__save-btn {
  white-space: nowrap;
  font-size: 0.82rem;
  border-radius: var(--p-border-radius-lg, 12px) !important;
  border: none !important;
  background: rgba(99, 102, 241, 0.18) !important;
  color: var(--p-indigo-300) !important;
  transition: background 0.18s ease !important;
}

.hero-card__save-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.24) !important;
  color: var(--p-indigo-300) !important;
}

.hero-card__save-btn--saved {
  background: color-mix(in srgb, var(--p-green-500, #22c55e) 14%, transparent) !important;
  color: color-mix(in srgb, var(--p-green-500, #22c55e) 80%, white) !important;
}

.hero-card__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}

.hero-card__continuity-warning {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fbbf24;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(251, 191, 36, 0.12);
  border: 1px solid rgba(251, 191, 36, 0.25);
  align-self: flex-start;
}

.hero-card__offline-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  align-self: flex-start;
}

.hero-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: stretch;
}

.hero-card__session-action {
  flex: 2;
  display: flex;
  min-width: 0;
}

/* Override SessionStartButton inner CTA to be filled, rounded, and stretch */
.hero-card__session-action :deep(.session-start-btn) {
  width: 100%;
  height: 100%;
  align-items: stretch;
}

.hero-card__session-action :deep(.session-start-btn__cta) {
  width: 100%;
  height: 100%;
  background: var(--p-primary-color) !important;
  color: #fff !important;
  border-color: var(--p-primary-color) !important;
  font-size: 0.9rem !important;
  font-weight: 800 !important;
  padding: 0.75rem 1.25rem !important;
  border-radius: var(--p-border-radius-lg, 12px) !important;
}

.hero-card__session-action :deep(.session-start-btn__bar) {
  width: 100%;
}

.hero-card__recap-btn {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.75rem 1rem !important;
  border-radius: var(--p-border-radius-lg, 12px) !important;
  border: none !important;
  background: rgba(99, 102, 241, 0.18) !important;
  color: var(--p-indigo-300) !important;
  transition: background 0.18s ease !important;
}

.hero-card__recap-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.24) !important;
  color: var(--p-indigo-300) !important;
}

.hero-card__recap-btn--locked {
  opacity: 0.5;
  cursor: not-allowed !important;
  font-size: 0.8rem;
}

[data-p-theme='light'] .hero-card__save-btn:not(:disabled),
[data-p-theme='light'] .hero-card__recap-btn:not(:disabled) {
  color: var(--p-primary-700, #4338ca) !important;
}

.hero-card__sep {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 0;
}

.hero-card__detail-block {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.hero-card__note {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.7;
  font-style: italic;
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  line-height: 1.5;
}

.hero-card__note .pi {
  font-size: 0.72rem;
  opacity: 0.5;
  margin-top: 0.2rem;
  flex-shrink: 0;
}

/* New Lore chip */
.hero-card__new-lore-chip {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  padding: 0.25rem 0.55rem 0.25rem 0.45rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(
    135deg,
    rgba(99, 102, 241, 0.85),
    rgba(167, 139, 250, 0.85)
  );
  color: #fff;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.hero-card__new-lore-chip:hover {
  opacity: 0.9;
  transform: scale(1.04);
}

.hero-card__new-lore-chip:focus-visible,
.hero-card__inline-dismiss:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.hero-card__new-lore-chip .pi {
  font-size: 0.65rem;
}

/* Inline recap panel */
.hero-card__inline-panel {
  border-radius: 14px;
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hero-card__inline-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-card__inline-panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  opacity: 0.8;
}

.hero-card__inline-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.45;
  padding: 0.2rem 0.35rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  transition: opacity 0.15s;
}

.hero-card__inline-dismiss:hover {
  opacity: 0.9;
}
.hero-card__inline-dismiss .pi {
  font-size: 0.8rem;
}

.hero-card__fade-enter-active,
.hero-card__fade-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.hero-card__fade-enter-from,
.hero-card__fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.hero-card__panel-enter-active,
.hero-card__panel-leave-active,
.hero-card__detail-enter-active,
.hero-card__detail-leave-active {
  overflow: hidden;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    max-height 0.22s ease;
}

.hero-card__panel-enter-from,
.hero-card__panel-leave-to,
.hero-card__detail-enter-from,
.hero-card__detail-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.hero-card__panel-enter-to,
.hero-card__panel-leave-from,
.hero-card__detail-enter-to,
.hero-card__detail-leave-from {
  opacity: 1;
  max-height: 900px;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .hero-card,
  .hero-card__cover,
  .hero-card__new-lore-chip,
  .hero-card__inline-dismiss,
  .hero-card__fade-enter-active,
  .hero-card__fade-leave-active,
  .hero-card__panel-enter-active,
  .hero-card__panel-leave-active,
  .hero-card__detail-enter-active,
  .hero-card__detail-leave-active {
    transition: none;
    animation: none;
  }

  .hero-card:hover,
  .hero-card:hover .hero-card__cover,
  .hero-card__fade-enter-from,
  .hero-card__fade-leave-to,
  .hero-card__panel-enter-from,
  .hero-card__panel-leave-to,
  .hero-card__detail-enter-from,
  .hero-card__detail-leave-to {
    transform: none;
  }
}
</style>
