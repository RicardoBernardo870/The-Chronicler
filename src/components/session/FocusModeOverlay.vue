<script setup lang="ts">
// Focus mode — a full-screen reading companion for an active session: big
// timer, cover, pause/end controls, and a Screen Wake Lock so the phone can
// sit beside the book without the display sleeping. Closing (or ending the
// session) releases the lock; the session itself is untouched by open/close.
//
// Auto-dim: the OS can't dim-without-locking from the web, so after 30 s
// without a touch we simulate it — a near-black layer fades in (timer stays
// faintly visible, kind to OLED batteries) and any tap wakes the screen.
// The wake lock stays held the whole time; only the pixels go dark.
import { computed, onMounted, onUnmounted, ref } from 'vue'
import Button from 'primevue/button'
import { useReadingSession } from '@/composables/useReadingSession'
import { useWakeLock } from '@/composables/useWakeLock'
import { coverFallback } from '@/utils/coverFallback'
import type { Book } from '@/types'

const props = defineProps<{
  book: Book
}>()

const emit = defineEmits<{
  close: []
  endSession: []
}>()

const { state, pauseSession, resumeSession } = useReadingSession(props.book.id)
const wakeLock = useWakeLock()

const pausePending = ref(false)

const DIM_AFTER_MS = 30_000
const dimmed = ref(false)
let dimTimer: ReturnType<typeof setTimeout> | null = null

const scheduleDim = (): void => {
  if (dimTimer !== null) clearTimeout(dimTimer)
  dimTimer = setTimeout(() => { dimmed.value = true }, DIM_AFTER_MS)
}

// Any touch while lit restarts the countdown. While dimmed, the dim layer
// itself catches the tap (it covers everything), so buttons underneath
// can't be hit accidentally by a wake tap.
const keepAwake = (): void => {
  if (!dimmed.value) scheduleDim()
}

const wake = (): void => {
  dimmed.value = false
  scheduleDim()
}

onMounted(() => {
  void wakeLock.enable()
  scheduleDim()
})

onUnmounted(() => {
  if (dimTimer !== null) clearTimeout(dimTimer)
})

const elapsedLabel = computed(() => {
  const s = state.value.elapsedSeconds
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hours > 0) return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

const togglePause = async (): Promise<void> => {
  pausePending.value = true
  try {
    if (state.value.isPaused) await resumeSession()
    else await pauseSession()
  } catch { /* keep focus mode open; the panel surfaces session errors */ }
  finally {
    pausePending.value = false
  }
}

const close = async (): Promise<void> => {
  await wakeLock.disable()
  emit('close')
}

const endSession = async (): Promise<void> => {
  await wakeLock.disable()
  emit('endSession')
}
</script>

<template>
  <Teleport to="body">
    <div
      class="focus-mode"
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
      @pointerdown="keepAwake"
    >
      <Button
        icon="pi pi-times"
        text
        rounded
        aria-label="Exit focus mode"
        class="focus-mode__close"
        @click="close"
      />

      <div class="focus-mode__body">
        <img
          v-if="book.coverUrl"
          :src="book.coverUrl"
          alt=""
          class="focus-mode__cover"
          @error="coverFallback"
        />
        <div v-else class="focus-mode__cover focus-mode__cover--empty">
          <i class="pi pi-book" aria-hidden="true" />
        </div>

        <h2 class="focus-mode__book-title">{{ book.title }}</h2>
        <p class="focus-mode__author">{{ book.author }}</p>

        <p class="focus-mode__timer" :class="{ 'focus-mode__timer--paused': state.isPaused }">
          {{ elapsedLabel }}
        </p>
        <p class="focus-mode__status">
          {{ state.isPaused ? 'Paused' : wakeLock.active.value ? 'Screen stays awake' : 'Reading' }}
        </p>
      </div>

      <div class="focus-mode__actions">
        <Button
          :icon="`pi ${state.isPaused ? 'pi-play' : 'pi-pause'}`"
          :aria-label="state.isPaused ? 'Resume session' : 'Pause session'"
          :loading="pausePending"
          rounded
          outlined
          class="focus-mode__pause"
          @click="togglePause"
        />
        <Button
          label="End Session"
          class="focus-mode__end"
          @click="endSession"
        />
      </div>

      <!-- Simulated screen dim — tap anywhere to wake -->
      <Transition name="focus-dim">
        <button
          v-if="dimmed"
          type="button"
          class="focus-mode__dim"
          aria-label="Wake screen"
          @click="wake"
        >
          <span class="focus-mode__dim-timer">{{ elapsedLabel }}</span>
          <span class="focus-mode__dim-hint">tap to wake</span>
        </button>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.focus-mode {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: max(1.25rem, env(safe-area-inset-top)) 1.5rem max(2rem, env(safe-area-inset-bottom));
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(99, 102, 241, 0.16), transparent 60%),
    rgba(11, 13, 22, 0.93);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.focus-mode__close {
  align-self: flex-end;
  flex: none;
}

.focus-mode__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
  width: 100%;
}

.focus-mode__cover {
  width: min(38vw, 150px);
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  margin-bottom: 1rem;
}

.focus-mode__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(99, 102, 241, 0.14);
}

.focus-mode__cover--empty .pi {
  font-size: 2rem;
  color: var(--p-indigo-300);
}

.focus-mode__book-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.focus-mode__author {
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.6;
}

.focus-mode__timer {
  margin: 1.25rem 0 0;
  font-size: 3.4rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--p-indigo-300);
}

.focus-mode__timer--paused {
  opacity: 0.55;
}

.focus-mode__status {
  margin: 0.4rem 0 0;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.5;
}

.focus-mode__actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  max-width: 340px;
}

.focus-mode__pause {
  flex: none;
  width: 3rem !important;
  height: 3rem !important;
}

.focus-mode__end {
  flex: 1;
  font-weight: 700;
  padding: 0.85rem 1rem !important;
  border-radius: var(--p-border-radius-lg, 12px) !important;
  border: none !important;
  background: var(--p-primary-color) !important;
  color: #fff !important;
}

.focus-mode__dim {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  border: none;
  background: rgba(0, 0, 0, 0.94);
  cursor: pointer;
}

.focus-mode__dim-timer {
  font-size: 2.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: rgba(165, 170, 246, 0.3);
}

.focus-mode__dim-hint {
  font-size: 0.66rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.16);
}

/* Slow fade into the dim, near-instant wake */
.focus-dim-enter-active {
  transition: opacity 1.2s ease;
}

.focus-dim-leave-active {
  transition: opacity 0.15s ease;
}

.focus-dim-enter-from,
.focus-dim-leave-to {
  opacity: 0;
}

[data-p-theme='light'] .focus-mode {
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(99, 102, 241, 0.12), transparent 60%),
    rgba(246, 247, 251, 0.93);
}

[data-p-theme='light'] .focus-mode__timer,
[data-p-theme='light'] .focus-mode__cover--empty .pi {
  color: var(--p-primary-700, #4338ca);
}
</style>
