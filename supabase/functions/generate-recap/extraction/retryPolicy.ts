// Retry policy for confidence-based extraction retries (mid-book Recap mode).
// See specs/008-recap-hardening/research.md (Decisions 1 & 2).

export const MAX_ATTEMPTS = 2   // additional attempts after the initial call
export const PAGE_BUFFER  = 5   // pages to subtract per retry
export const TEMPERATURE  = 0.3 // constant across attempts

/**
 * Compute the reduced `currentPage` for a given retry attempt.
 *
 * Returns `null` if the reduction would collide with `fromPage` (i.e. the
 * retry would cover ≤ 0 pages of new material). Callers MUST abort retries
 * on null.
 */
export const computeAdjustedPage = (
  currentPage: number,
  fromPage: number,
  attempt: number,
): number | null => {
  const raw      = currentPage - PAGE_BUFFER * attempt
  const floor    = Math.max(fromPage + 1, 1)
  const adjusted = Math.max(raw, floor)
  if (adjusted <= fromPage) return null
  return adjusted
}
