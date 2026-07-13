<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import type { SessionResumeView } from '@/composables/useSessionResume'

// Pre-session warm-up dialog. Shown by SessionStartButton BEFORE the session
// is started server-side — session_start_at is only written when the reader
// clicks "Begin reading", so the timer never counts reading-the-resume time.
// Closing the dialog any other way aborts the session start entirely.
defineProps<{
  visible: boolean
  view: SessionResumeView
}>()

defineEmits<{
  'update:visible': [value: boolean]
  confirm: []
}>()
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :dismissable-mask="true"
    :draggable="false"
    :style="{ width: '92vw', maxWidth: '460px' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="session-resume-dialog__header">
        <i class="pi pi-bookmark" aria-hidden="true" />
        <span class="session-resume-dialog__title">Previously</span>
        <span class="session-resume-dialog__source">page {{ view.page }}</span>
      </div>
    </template>

    <div class="session-resume-dialog__body">
      <ul class="session-resume-dialog__bullets">
        <li v-for="(bullet, i) in view.resume.bullets" :key="i">{{ bullet }}</li>
      </ul>

      <p v-if="view.resume.tension" class="session-resume-dialog__tension">
        {{ view.resume.tension }}
      </p>
    </div>

    <template #footer>
      <div class="session-resume-dialog__footer">
        <span class="session-resume-dialog__hint">Your timer starts once you begin.</span>
        <Button
          label="Begin reading"
          icon="pi pi-play"
          class="session-resume-dialog__begin"
          @click="$emit('confirm')"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.session-resume-dialog__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.session-resume-dialog__header .pi {
  color: var(--p-indigo-300);
  font-size: 0.9rem;
}

.session-resume-dialog__title {
  font-size: 1rem;
  font-weight: 600;
}

.session-resume-dialog__source {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  color: var(--p-indigo-300);
  white-space: nowrap;
}

.session-resume-dialog__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.session-resume-dialog__bullets {
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.9rem;
  line-height: 1.55;
}

.session-resume-dialog__tension {
  margin: 0;
  font-size: 0.87rem;
  font-style: italic;
  opacity: 0.8;
  padding-left: 0.75rem;
  border-left: 2px solid var(--p-indigo-300);
}

.session-resume-dialog__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.session-resume-dialog__hint {
  font-size: 0.72rem;
  opacity: 0.55;
  text-align: left;
}

.session-resume-dialog__begin {
  flex: none;
  font-weight: 700;
}

[data-p-theme='light'] .session-resume-dialog__source,
[data-p-theme='light'] .session-resume-dialog__header .pi {
  color: var(--p-primary-700, #4338ca);
}
</style>
