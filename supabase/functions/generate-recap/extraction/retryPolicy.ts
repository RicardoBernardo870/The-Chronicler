export const MAX_ATTEMPTS = 2
export const PAGE_BUFFER = 5
export const TEMPERATURE = 0.3

export const computeAdjustedPage = (
  currentPage: number,
  fromPage: number,
  attempt: number,
): number | null => {
  const raw = currentPage - PAGE_BUFFER * attempt
  const floor = Math.max(fromPage + 1, 1)
  const adjusted = Math.max(raw, floor)
  if (adjusted <= fromPage) return null
  return adjusted
}
