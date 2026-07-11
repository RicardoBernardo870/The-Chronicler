/**
 * Detects whether a forward progress save has crossed a 10% milestone.
 *
 * Rules (per data-model.md § Milestone):
 *  - Milestones are multiples of 10 in the range [10, 90] only.
 *    (100% = book finished — no lore card generated at completion.)
 *  - Only forward moves count; backward or same-value saves return null.
 *  - Multi-milestone jumps collapse to the LATEST milestone crossed (FR-010).
 *
 * @param previousPercentage - The reader's percentage before this save (0–100).
 * @param newPercentage      - The reader's percentage after this save  (0–100).
 * @returns The crossed milestone (10, 20 … 90) or null if none was crossed.
 *
 * @example
 *   detectCrossedMilestone(18, 22)  // → 20
 *   detectCrossedMilestone(8, 35)   // → 30  (latest crossed)
 *   detectCrossedMilestone(20, 20)  // → null (no forward move)
 *   detectCrossedMilestone(25, 15)  // → null (backward move)
 *   detectCrossedMilestone(0, 5)    // → null (no milestone bucket crossed)
 */
export const detectCrossedMilestone = (
  previousPercentage: number,
  newPercentage: number,
): number | null => {
  if (newPercentage <= previousPercentage) return null

  const prevBucket = Math.floor(previousPercentage / 10) * 10
  const newBucket  = Math.floor(newPercentage / 10) * 10

  if (newBucket <= prevBucket) return null

  // Collapse multi-milestone jumps to the latest crossed bucket.
  // Cap at 90 — no lore card fires at exactly 100%.
  const milestone = Math.min(newBucket, 90)

  if (milestone < 10) return null

  // After capping, re-check: if the capped milestone doesn't exceed prevBucket,
  // no new bucket was crossed (e.g. 95→100: prevBucket=90, milestone=90 → null).
  if (milestone <= prevBucket) return null

  return milestone
}

/**
 * Pages remaining until the next Insight (lore) milestone — multiples of 10%
 * in [10, 90]. Returns null when past the last milestone or the book has no
 * usable page count.
 */
export const pagesToNextInsight = (
  currentPage: number,
  totalPages: number,
): number | null => {
  if (totalPages <= 0 || currentPage < 0) return null
  const pct = (currentPage / totalPages) * 100
  const nextMilestone = (Math.floor(pct / 10) + 1) * 10
  if (nextMilestone > 90) return null
  const milestonePage = Math.ceil((nextMilestone / 100) * totalPages)
  const pages = milestonePage - currentPage
  return pages > 0 ? pages : null
}
