import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCapturesStore } from '@/stores/captures'
import { useRecapsStore } from '@/stores/recaps'
import type { PageCapture, SessionResume } from '@/types'

/**
 * Session-start page resume generation.
 *
 * Same architecture as vocabulary extraction: the `generate-page-resume`
 * edge function is a stateless transformer; this composable owns the DB
 * write (page_captures.resume on the user's own row).
 *
 * Two entry points:
 *  - triggerResumeGeneration: fire-and-forget right after a capture is saved.
 *  - generateResumeForCapture: awaited on-demand path used at session start
 *    for captures that predate this feature (or whose generation failed).
 *    At most one generation per capture — the result is persisted, so this
 *    never becomes a per-session cost.
 *
 * Generation is unconditional at capture time — whether the resume is shown
 * is decided at session start (useSessionResume suppresses it when a fresh
 * recap already covers the reader's position). Grounding contract: capture
 * text only, plus the latest recap's memory jogger passed strictly for name
 * continuity. On failure the resume stays null — never inferred content.
 */

const latestRecapContext = (bookId: string): string | undefined => {
  const recapsStore = useRecapsStore()
  const jogger = recapsStore.latestRecapForBook(bookId)?.memoryJogger?.trim()
  return jogger ? jogger : undefined
}

export const generateResumeForCapture = async (
  capture: PageCapture,
): Promise<SessionResume | null> => {
  const authStore = useAuthStore()
  if (!authStore.user) return null
  if (capture.resume) return capture.resume
  if (!capture.text?.trim()) return null

  const { data, error } = await supabase.functions.invoke('generate-page-resume', {
    body: {
      pageText: capture.text,
      recapContext: latestRecapContext(capture.bookId),
    },
  })
  if (error) throw error

  const resume = (data?.resume ?? null) as SessionResume | null
  if (!resume || !Array.isArray(resume.bullets) || resume.bullets.length === 0) return null

  const { error: updateErr } = await supabase
    .from('page_captures')
    .update({ resume, resume_generated_at: new Date().toISOString() })
    .eq('id', capture.id)
  if (updateErr) throw updateErr

  useCapturesStore().applyResume(capture.bookId, capture.page, resume)
  return resume
}

export const usePageResume = () => {
  const triggerResumeGeneration = (capture: PageCapture): void => {
    // Fire-and-forget. Catch absolutely everything — the capture is already
    // saved and must stay successful regardless of resume generation.
    void generateResumeForCapture(capture).catch((err) => {
      console.warn('[page-resume] generation failed', err)
    })
  }

  return { triggerResumeGeneration, generateResumeForCapture }
}
