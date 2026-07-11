export type PageSaveBlock = 'unchanged' | 'out-of-range' | null

export interface PageSaveCheck {
  ok: boolean
  reason: PageSaveBlock
}

/**
 * Validates a page number typed into the page-save sheet.
 * - out-of-range: not a finite number within [0, totalPages]
 * - unchanged: equals the stored page (nothing to save; when ending a
 *   session this is the "no pages read" case)
 */
export const checkPageSave = (
  page: number | null | undefined,
  currentPage: number,
  totalPages: number,
): PageSaveCheck => {
  if (
    page === null ||
    page === undefined ||
    !Number.isFinite(page) ||
    page < 0 ||
    page > totalPages
  ) {
    return { ok: false, reason: 'out-of-range' }
  }
  if (page === currentPage) return { ok: false, reason: 'unchanged' }
  return { ok: true, reason: null }
}
