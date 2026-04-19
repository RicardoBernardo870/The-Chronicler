import type { StageLogEntry } from "../types.ts"

const PREVIEW_CAP = 500

/**
 * Emit a single structured console.error for a stage failure. The raw-text
 * preview is capped at 500 chars to keep log volume sane.
 */
export const logStageFailure = (entry: StageLogEntry): void => {
  const safe: StageLogEntry = { ...entry }
  if (safe.rawTextPreview && safe.rawTextPreview.length > PREVIEW_CAP) {
    safe.rawTextPreview = safe.rawTextPreview.slice(0, PREVIEW_CAP)
  }
  console.error("[generate-recap]", JSON.stringify(safe))
}
