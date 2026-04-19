import type { Mode, RequestBody } from "./types.ts"

/**
 * Resolve the generation mode from the request body.
 *
 * Priority:
 *   1. Explicit `mode: 'passport_summary'` wins (finished-book flow).
 *   2. `currentPage === 0` → blurb (pre-start preview).
 *   3. Otherwise → mid-book recap (the hardened path).
 */
export const resolveMode = (body: RequestBody): Mode => {
  if (body.mode === "passport_summary") return "passport_summary"
  if (body.currentPage === 0) return "blurb"
  return "recap"
}
