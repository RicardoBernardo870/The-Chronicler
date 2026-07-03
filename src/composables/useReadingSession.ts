import { computed, readonly, ref, watchEffect, onUnmounted } from 'vue'
import { useProgressStore } from '@/stores/progress'

export interface ReadingSessionState {
  isActive: boolean
  isPaused: boolean
  startedAt: Date | null
  elapsedSeconds: number
}

/**
 * Manages the lifecycle of an explicit reading session for a single book.
 * session_start_at is always server-confirmed — no optimistic local state.
 *
 * elapsedSeconds is seeded from the stored session_start_at so that a
 * browser refresh mid-session shows the correct running time. While paused,
 * the ticker freezes at (paused_at - started_at); resuming shifts the start
 * forward server-side so durations stay correct everywhere.
 */
export const useReadingSession = (bookId: string) => {
  const progressStore = useProgressStore()

  const elapsedSeconds = ref(0)
  let _intervalId: ReturnType<typeof setInterval> | null = null

  const _stopTimer = () => {
    if (_intervalId !== null) {
      clearInterval(_intervalId)
      _intervalId = null
    }
  }

  const _startTimer = (from: Date) => {
    _stopTimer()
    // Seed with already-elapsed time so app restarts show correct elapsed time
    elapsedSeconds.value = Math.floor((Date.now() - from.getTime()) / 1000)
    _intervalId = setInterval(() => {
      elapsedSeconds.value = Math.floor((Date.now() - from.getTime()) / 1000)
    }, 1000)
  }

  // Derived from Pinia — reactive across Dashboard and Book Detail simultaneously
  const startedAt = computed((): Date | null => {
    const raw = progressStore.progressForBook(bookId)?.sessionStartAt
    return raw ? new Date(raw) : null
  })

  const isActive = computed(() => startedAt.value !== null)

  const pausedAt = computed((): Date | null => {
    const raw = progressStore.sessionPausedAt[bookId]
    return raw ? new Date(raw) : null
  })

  const isPaused = computed(() => isActive.value && pausedAt.value !== null)

  // Lazily hydrate the paused flag when a session is active (survives refresh)
  watchEffect(() => {
    if (isActive.value) void progressStore.fetchPausedState(bookId)
  })

  // Side-effect: manage the interval reactively whenever active/paused changes
  watchEffect(() => {
    if (isActive.value && startedAt.value) {
      if (isPaused.value && pausedAt.value) {
        _stopTimer()
        elapsedSeconds.value = Math.max(
          0,
          Math.floor((pausedAt.value.getTime() - startedAt.value.getTime()) / 1000),
        )
      } else {
        _startTimer(startedAt.value)
      }
    } else {
      _stopTimer()
      elapsedSeconds.value = 0
    }
  })

  onUnmounted(_stopTimer)

  const state = computed((): ReadingSessionState => ({
    isActive: isActive.value,
    isPaused: isPaused.value,
    startedAt: startedAt.value,
    elapsedSeconds: elapsedSeconds.value,
  }))

  /**
   * Writes session_start_at = NOW() to reading_progress via the progress store.
   * Throws if offline or if the server write fails.
   * The caller is responsible for showing a conflict-warning dialog before
   * calling startSession() a second time when isActive is already true.
   */
  const startSession = async (): Promise<void> => {
    if (!navigator.onLine) {
      throw new Error('You appear to be offline. Start Session requires a connection.')
    }
    await progressStore.startSession(bookId)
  }

  const pauseSession = async (): Promise<void> => {
    if (!navigator.onLine) {
      throw new Error('You appear to be offline. Pause requires a connection.')
    }
    await progressStore.pauseSession(bookId)
  }

  const resumeSession = async (): Promise<void> => {
    if (!navigator.onLine) {
      throw new Error('You appear to be offline. Resume requires a connection.')
    }
    await progressStore.resumeSession(bookId)
  }

  /**
   * Resets session_start_at to null on reading_progress.
   * Called internally by the progress store after a page-save; exposed here for
   * testing and any manual-cancel flows.
   */
  const clearSession = async (): Promise<void> => {
    await progressStore.clearSession(bookId)
  }

  return {
    state: readonly(state),
    startSession,
    pauseSession,
    resumeSession,
    clearSession,
  }
}
