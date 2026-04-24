<script setup lang="ts">
import { computed, ref } from 'vue'
import { useReadingSession } from '@/composables/useReadingSession'
import Button from 'primevue/button'

const props = defineProps<{
  bookId: string
  iconOnly?: boolean
}>()

const emit = defineEmits<{
  conflictWarning: [startedAt: Date]
}>()

const { state, startSession } = useReadingSession(props.bookId)

const pending = ref(false)
const error = ref<string | null>(null)

// Format elapsed seconds as M:SS
const elapsedLabel = computed(() => {
  const s = state.value.elapsedSeconds
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const handleClick = async () => {
  error.value = null

  // If a session is already active, emit conflict so the parent can confirm
  if (state.value.isActive && state.value.startedAt) {
    emit('conflictWarning', state.value.startedAt)
    return
  }

  pending.value = true
  try {
    await startSession()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Could not start session'
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="session-start-btn" :class="{ 'session-start-btn--icon-only': iconOnly }">

    <!-- ── Icon-only variant (used next to save button) ── -->
    <template v-if="iconOnly">
      <!-- Active: clock icon, indigo tint, tooltip shows elapsed -->
      <Button
        v-if="state.isActive"
        icon="pi pi-clock"
        :aria-label="`Session active — ${elapsedLabel} elapsed. Tap to replace.`"
        v-tooltip.top="`⏱ ${elapsedLabel}`"
        class="session-start-btn__icon-btn session-start-btn__icon-btn--active"
        @click="handleClick"
      />
      <!-- Idle: play icon -->
      <Button
        v-else
        icon="pi pi-play"
        aria-label="Start reading session"
        v-tooltip.top="'Start Session'"
        outlined
        :loading="pending"
        class="session-start-btn__icon-btn"
        @click="handleClick"
      />
    </template>

    <!-- ── Full variant (standalone placement) ── -->
    <template v-else>
      <!-- Active state: timer pill -->
      <button
        v-if="state.isActive"
        class="session-start-btn__timer"
        :aria-label="`Reading session active — ${elapsedLabel} elapsed. Tap to replace session.`"
        @click="handleClick"
      >
        <i class="pi pi-clock session-start-btn__clock-icon" />
        <span class="session-start-btn__elapsed">⏱ {{ elapsedLabel }}</span>
      </button>

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
  </div>
</template>

<style scoped>
.session-start-btn {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: flex-start;
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
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-indigo-300);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.session-start-btn__timer:hover {
  opacity: 0.8;
}

.session-start-btn__clock-icon {
  font-size: 0.75rem;
  opacity: 0.75;
}

.session-start-btn__elapsed {
  letter-spacing: 0.02em;
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
