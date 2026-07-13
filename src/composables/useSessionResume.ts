import { computed, toValue, type Ref } from 'vue'
import { useCapturesStore } from '@/stores/captures'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import { generateResumeForCapture } from '@/composables/usePageResume'
import type { SessionResume } from '@/types'

export interface SessionResumeView {
  page: number
  resume: SessionResume
}

/**
 * Data source for the pre-session resume dialog. Strictly resume-or-nothing:
 * SessionStartButton awaits `load()` on Start click and only shows the
 * dialog when `view` resolves — otherwise the session starts immediately.
 *
 * Fresh-recap suppression: if the latest recap covers the reader's current
 * position (pageSnapshot >= currentPage), the user generated a recap since
 * they last read — that recap IS this session's warm-up, so no resume is
 * shown and no backfill generation is spent. A recap from an earlier stretch
 * does not suppress: the pages read since it are uncovered, which is exactly
 * what the resume is for. Merely having the recap button unlocked never
 * suppresses — only an actually-generated recap does.
 */
export const useSessionResume = (bookId: Ref<string> | string) => {
  const capturesStore = useCapturesStore()
  const progressStore = useProgressStore()
  const recapsStore = useRecapsStore()

  const id = computed(() => toValue(bookId))

  // capturesForBook is sorted by page ascending — latest = highest page.
  const latestCapture = computed(() => {
    const list = capturesStore.capturesForBook(id.value)
    return list.length > 0 ? list[list.length - 1] : null
  })

  const suppressedByFreshRecap = computed(() => {
    const recap = recapsStore.latestRecapForBook(id.value)
    if (!recap) return false
    const currentPage = progressStore.progressForBook(id.value)?.currentPage ?? 0
    return (recap.pageSnapshot ?? 0) >= currentPage
  })

  const view = computed((): SessionResumeView | null => {
    if (suppressedByFreshRecap.value) return null
    const capture = latestCapture.value
    if (capture?.resume) return { page: capture.page, resume: capture.resume }
    return null
  })

  const load = async (): Promise<void> => {
    await Promise.all([
      capturesStore.fetchCapturesForBook(id.value).catch(() => {}),
      recapsStore.fetchRecapsForBook(id.value).catch(() => {}),
    ])
    if (suppressedByFreshRecap.value) return
    const capture = latestCapture.value
    if (capture && !capture.resume) {
      // Backfill path for pre-feature captures; result is persisted so this
      // runs at most once per capture. Silent on failure — the session simply
      // starts without a dialog.
      await generateResumeForCapture(capture).catch(() => null)
    }
  }

  return { view, load }
}
