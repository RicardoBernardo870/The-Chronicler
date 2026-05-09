<script setup lang="ts">
import type { Book, ReadingProgress } from '@/types'
import SessionStartButton from '@/components/session/SessionStartButton.vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import ProgressBar from 'primevue/progressbar'

const props = defineProps<{
  book: Book
  progress: ReadingProgress | null
  currentPageInput: number
  progressLoading: boolean
  progressError: string | null
  percentage: number
  isComplete: boolean
  canViewJourney: boolean
  lexiconCount: number
  recapLocked: boolean
  pagesUntilUnlock: number
  recapTriggered: boolean
  recapLockLabel: string
}>()

const emit = defineEmits<{
  'update:currentPageInput': [value: number]
  save: []
  getRecap: []
  sessionConflict: [startedAt: Date]
  cancelSession: []
  viewJourney: []
  openAddWord: []
  viewLexicon: []
}>()
</script>

<template>
  <section class="progress-panel glass-surface">
    <h2 class="progress-panel__title">Reading Progress</h2>

    <div class="progress-panel__bar-wrap">
      <ProgressBar :value="percentage" :show-value="false" class="progress-panel__bar" />
      <span class="progress-panel__pct">{{ percentage.toFixed(1) }}%</span>
    </div>

    <div class="progress-panel__input-row">
      <InputNumber
        :model-value="currentPageInput"
        :min="0"
        :max="book.totalPages"
        :placeholder="`Page (max ${book.totalPages})`"
        class="progress-panel__page-input"
        show-buttons
        :step="1"
        fluid
        @update:model-value="(v) => emit('update:currentPageInput', v ?? 0)"
        @input="(e: any) => emit('update:currentPageInput', e.value ?? 0)"
      />
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="progressLoading"
        :disabled="currentPageInput === (progress?.currentPage ?? 0)"
        aria-label="Save progress"
        class="progress-panel__save-btn"
        @click="emit('save')"
      />
    </div>

    <p v-if="progressError" class="progress-panel__error">
      <i class="pi pi-exclamation-triangle" /> {{ progressError }}
    </p>

    <p class="progress-panel__hint">
      Page {{ progress?.currentPage ?? 0 }} of {{ book.totalPages }}
    </p>

    <div class="progress-panel__actions">
      <div class="progress-panel__session-action">
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
        class="progress-panel__recap-btn progress-panel__recap-btn--locked"
      />
      <Button
        v-else
        :label="recapTriggered ? 'Recap open' : 'Get Recap'"
        icon="pi pi-sparkles"
        class="progress-panel__recap-btn"
        :disabled="recapTriggered"
        @click="emit('getRecap')"
      />
    </div>

    <div class="progress-panel__vocab-row">
      <div class="progress-panel__vocab-actions">
        <Button label="Add Word" icon="pi pi-plus" size="small" outlined @click="emit('openAddWord')" />
        <span
          v-if="lexiconCount > 0"
          class="progress-panel__vocab-count"
          role="button"
          tabindex="0"
          @click="emit('viewLexicon')"
          @keydown.enter="emit('viewLexicon')"
        >
          {{ lexiconCount }} {{ lexiconCount === 1 ? 'word' : 'words' }} saved
        </span>
      </div>
    </div>

    <Button
      v-if="isComplete && canViewJourney"
      label="✦ View Reading Journey"
      icon="pi pi-star"
      class="progress-panel__passport-btn"
      @click="emit('viewJourney')"
    />
  </section>
</template>

<style scoped>
.progress-panel {
  border-radius: var(--p-border-radius-xl, 16px);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-panel__title { margin: 0; font-size: 1rem; font-weight: 600; }

.progress-panel__bar-wrap {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.progress-panel__bar { flex: 1; }

.progress-panel__pct {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  min-width: 44px;
  text-align: right;
}

.progress-panel__input-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.progress-panel__page-input { flex: 1; }

.progress-panel__save-btn {
  white-space: nowrap;
  font-size: 0.82rem;
  border-radius: var(--p-border-radius-lg, 12px) !important;
  border: none !important;
  background: rgba(99, 102, 241, 0.18) !important;
  color: var(--p-indigo-300) !important;
  transition: background 0.18s ease !important;
}

.progress-panel__save-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.24) !important;
  color: var(--p-indigo-300) !important;
}

.progress-panel__error {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-red-400);
}

.progress-panel__hint { margin: 0; font-size: 0.8rem; opacity: 0.55; }

.progress-panel__actions {
  display: flex;
  gap: 0.75rem;
  align-items: stretch;
}

.progress-panel__session-action {
  flex: 2;
  display: flex;
  min-width: 0;
}

.progress-panel__session-action :deep(.session-start-btn) {
  width: 100%;
}

.progress-panel__session-action :deep(.session-start-btn__cta) {
  width: 100%;
  background: var(--p-primary-color) !important;
  color: #fff !important;
  border-color: var(--p-primary-color) !important;
  font-size: 0.9rem !important;
  font-weight: 800 !important;
  padding: 0.75rem 1.25rem !important;
  border-radius: var(--p-border-radius-lg, 12px) !important;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--p-primary-color) 28%, transparent) !important;
}

.progress-panel__session-action :deep(.session-start-btn__stop) {
  width: 100%;
  border-radius: var(--p-border-radius-lg, 12px) !important;
}

.progress-panel__recap-btn {
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

.progress-panel__recap-btn:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.24) !important;
  color: var(--p-indigo-300) !important;
}

.progress-panel__recap-btn--locked {
  opacity: 0.5;
  cursor: not-allowed !important;
  font-size: 0.8rem;
}

.progress-panel__passport-btn {
  align-self: center;
  background: linear-gradient(135deg, #34d399, #a78bfa) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 700;
}

.progress-panel__vocab-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.progress-panel__vocab-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.progress-panel__vocab-count {
  font-size: 0.8rem;
  opacity: 0.65;
  cursor: pointer;
  transition: opacity 0.15s;
}

.progress-panel__vocab-count:hover { opacity: 1; text-decoration: underline; }
</style>
