import type { Recap } from '@/types'

/**
 * Assembles the "Master Recap" spoiler-wall context from a book's recap history.
 *
 * Rules (per data-model.md § MasterRecap):
 *  - Only recaps where progress_snapshot > 0 (excludes page-0 blurbs).
 *  - Only recaps where page_snapshot <= currentPage (spoiler wall).
 *  - Sorted by page_snapshot ascending (chronological order).
 *  - Joined with a separator so the AI sees a clean timeline.
 *
 * Returns an empty string when no qualifying recaps exist (the store
 * uses this to short-circuit AI calls — FR-004).
 */
export const buildMasterRecap = (recaps: Recap[], currentPage: number): string => {
  const qualifying = recaps
    .filter(r => r.progressSnapshot > 0)
    .filter(r => (r.pageSnapshot ?? 0) <= currentPage)
    .sort((a, b) => (a.pageSnapshot ?? 0) - (b.pageSnapshot ?? 0))

  if (qualifying.length === 0) return ''

  return qualifying
    .map(r =>
      [
        `Memory jogger: ${r.memoryJogger}`,
        `Concept watchlist: ${r.conceptWatchlist}`,
        `Thematic bridge: ${r.thematicBridge}`,
      ].join('\n'),
    )
    .join('\n\n---\n\n')
}
