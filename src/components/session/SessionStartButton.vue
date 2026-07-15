<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReadingSession } from '@/composables/useReadingSession'
import { useSessionResume } from '@/composables/useSessionResume'
import { useBookQuiz } from '@/composables/useBookQuiz'
import SessionResumeDialog from '@/components/session/SessionResumeDialog.vue'
import MemoryCheckDialog from '@/components/session/MemoryCheckDialog.vue'
import Button from 'primevue/button'

const props = defineProps<{
  bookId: string
  iconOnly?: boolean
}>()

const emit = defineEmits<{
  conflictWarning: [startedAt: Date]
  cancelSession: []
}>()

const { state, startSession, pauseSession, resumeSession } = useReadingSession(props.bookId)

// Pre-session resume: loaded on Start click, shown as a modal BEFORE the
// session is started server-side. The timer (session_start_at) only starts
// when the reader confirms via "Begin reading"; dismissing the dialog aborts
// the start. The resume is persisted per capture, so start → cancel → start
// re-shows the same stored resume without regenerating.
const sessionResume = useSessionResume(props.bookId)
const resumeDialogVisible = ref(false)

// Memory Check (035): when the reader has been away from this book for 2+
// days (and quiz material exists), the "Previously" slot offers a short
// recall quiz INSTEAD of the passive resume bullets. Same timer contract —
// the session only starts on "Begin reading" / "Skip to reading".
const bookQuiz = useBookQuiz(props.bookId)
const quizDialogVisible = ref(false)

const pending = ref(false)
const pausePending = ref(false)
const error = ref<string | null>(null)

// Format elapsed seconds as M:SS (H:MM:SS past the hour)
const elapsedLabel = computed(() => {
  const s = state.value.elapsedSeconds
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const beginSession = async () => {
  pending.value = true
  try {
    await startSession()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not start session'
  } finally {
    pending.value = false
  }
}

const handleClick = async () => {
  error.value = null

  if (state.value.isActive && state.value.startedAt) {
    emit('cancelSession')
    return
  }

  // Memory Check first: cheap cached reads decide eligibility (away 2+ days
  // + capture material + no fresh recap). The AI call, if any, only happens
  // after the reader taps "Quiz me" inside the dialog.
  pending.value = true
  try {
    await bookQuiz.prepare()
  } finally {
    pending.value = false
  }

  if (bookQuiz.sessionPromptEligible.value) {
    quizDialogVisible.value = true
    return
  }

  // Load (or one-time backfill) the resume — usually instant because it
  // is pre-generated at capture time. With a resume, the dialog gates the
  // session start; without one, start immediately as before.
  pending.value = true
  try {
    await sessionResume.load()
  } finally {
    pending.value = false
  }

  if (sessionResume.view.value) {
    resumeDialogVisible.value = true
    return
  }

  await beginSession()
}

const confirmResume = async () => {
  resumeDialogVisible.value = false
  await beginSession()
}

const togglePause = async () => {
  error.value = null
  pausePending.value = true
  try {
    if (state.value.isPaused) await resumeSession()
    else await pauseSession()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not update the session'
  } finally {
    pausePending.value = false
  }
}
</script>

<template>
  <div class="session-start-btn" :class="{ 'session-start-btn--icon-only': iconOnly }">

    <!-- ── Icon-only variant (used next to save button) ── -->
    <template v-if="iconOnly">
      <!-- Active: clock/pause icon, indigo tint -->
      <Button
        v-if="state.isActive"
        :icon="`pi ${state.isPaused ? 'pi-pause' : 'pi-clock'}`"
        :aria-label="`Session ${state.isPaused ? 'paused' : 'active'} — ${elapsedLabel} elapsed. Tap to cancel.`"
        class="session-start-btn__icon-btn session-start-btn__icon-btn--active"
        :class="{ 'session-start-btn__icon-btn--paused': state.isPaused }"
        @click="handleClick"
      />
      <!-- Idle: play icon -->
      <Button
        v-else
        icon="pi pi-play"
        aria-label="Start reading session"
        outlined
        :loading="pending"
        class="session-start-btn__icon-btn"
        @click="handleClick"
      />
    </template>

    <!-- ── Full variant (standalone placement) ── -->
    <template v-else>
      <!-- Active state: one card — pause · stop · live timer -->
      <div
        v-if="state.isActive"
        class="session-start-btn__timer"
        :class="{ 'session-start-btn__timer--paused': state.isPaused }"
        aria-live="off"
      >
        <Button
          :icon="`pi ${state.isPaused ? 'pi-play' : 'pi-pause'}`"
          :aria-label="state.isPaused ? 'Resume session' : 'Pause session'"
          :loading="pausePending"
          text
          rounded
          class="session-start-btn__pause"
          @click="togglePause"
        />
        <button
          class="session-start-btn__stop"
          aria-label="Cancel session — or save your page to finish it."
          @click="handleClick"
        >
          <i class="pi pi-stop-circle session-start-btn__stop-icon" />
        </button>
        <div class="session-start-btn__timer-meta">
          <span class="session-start-btn__timer-value">{{ elapsedLabel }}</span>
          <span v-if="state.isPaused" class="session-start-btn__timer-hint">paused</span>
        </div>
      </div>

      <!-- Idle state -->
      <Button
        v-else
        label="Start Session"
        icon="pi pi-play"
        size="small"
        outlined
        :loading="pending"
        class="session-start-btn__cta"
        @click="handleClick"
      />
    </template>

    <!-- Offline / server error (shown in both variants) -->
    <p v-if="error" class="session-start-btn__error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </p>

    <!-- Pre-session resume: timer starts only on "Begin reading" -->
    <SessionResumeDialog
      v-if="sessionResume.view.value"
      v-model:visible="resumeDialogVisible"
      :view="sessionResume.view.value"
      @confirm="confirmResume"
    />

    <!-- Memory Check (2+ days away): timer starts only on begin/skip -->
    <MemoryCheckDialog
      :book-id="bookId"
      v-model:visible="quizDialogVisible"
      mode="session"
      @begin="beginSession"
    />
  </div>
</template>

<style scoped>
.session-start-btn {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: stretch;
}

/* ── Icon-only wrapper: no extra column gap needed ── */
.session-start-btn--icon-only {
  gap: 0.2rem;
}

/* ── Icon-only buttons ── */
.session-start-btn__icon-btn {
  /* match PrimeVue Button's default square feel */
}

.session-start-btn__icon-btn--active {
  color: var(--p-indigo-300) !important;
  border-color: rgba(99, 102, 241, 0.5) !important;
  background: rgba(99, 102, 241, 0.12) !important;
  animation: pulse-session 2s ease-in-out infinite;
}

@keyframes pulse-session {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  50%       { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
}

/* ── Full variant ── */
.session-start-btn__cta {
  font-size: 0.8rem;
}

.session-start-btn__timer {
  width: 100%;
  min-width: 0;
  display: flex;
  gap: 0.15rem;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.5rem;
  border-radius: var(--p-border-radius-lg, 12px);
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.3);
  animation: pulse-session 2s ease-in-out infinite;
}

.session-start-btn__timer-meta {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin-left: 0.4rem;
}

.session-start-btn__timer--paused {
  animation: none;
  opacity: 0.75;
}

.session-start-btn__timer-value {
  font-size: 1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--p-indigo-300);
}

.session-start-btn__timer-hint {
  font-size: 0.52rem;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.55;
    margin-left: 1px;
}

.session-start-btn__pause {
  flex: none;
  width: 2.2rem !important;
  height: 2.2rem !important;
  padding: 0 !important;
}

.session-start-btn__icon-btn--paused {
  animation: none;
  opacity: 0.8;
}

.session-start-btn__stop {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  border-radius: 50%;
  border: none;
  color: var(--p-red-400);
  background: transparent;
  cursor: pointer;
  transition: background 0.18s ease;
}

.session-start-btn__stop-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
}


/* ── Error ── */
.session-start-btn__error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--p-red-400);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
</style>
