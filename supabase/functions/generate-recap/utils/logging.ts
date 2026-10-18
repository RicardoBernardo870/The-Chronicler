import type { StageLogEntry } from "../types.ts"

const PREVIEW_CAP = 500

export const logStageFailure = (entry: StageLogEntry): void => {
  const safe: StageLogEntry = { ...entry }
  if (safe.rawTextPreview && safe.rawTextPreview.length > PREVIEW_CAP) {
    safe.rawTextPreview = safe.rawTextPreview.slice(0, PREVIEW_CAP)
  }
  console.error("[generate-recap]", JSON.stringify(safe))
}
