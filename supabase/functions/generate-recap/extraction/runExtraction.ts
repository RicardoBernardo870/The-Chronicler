// deno-lint-ignore-file no-explicit-any
import type { ExtractionResult } from "../types.ts"
import { extractJson } from "../utils/json.ts"
import { buildExtractionPrompt } from "../prompts/extraction.ts"
import { DEFAULT_THINKING_CONFIG } from "../aiClient.ts"
import { TEMPERATURE } from "./retryPolicy.ts"

export interface ExtractionParams {
  title:       string
  author:      string
  isbn?:       string
  fromPage:    number
  currentPage: number
  totalPages:  number
  percentage:  number
}

export interface ExtractionOutcome {
  /** Parsed ExtractionResult when JSON was valid AND confidence_level was a literal. */
  result:         ExtractionResult | null
  /** Raw model text (for logging / diagnostics). */
  raw:            string
  /** Validated JSON string (forwarded to the recap stage as user content). */
  rawJson:        string | null
  finishReason?:  string
  blockReason?:   string | null
  safetyRatings?: unknown
  usage?:         unknown
}

const VALID_CONFIDENCE = new Set(["high", "medium", "low"])

/**
 * Single extraction call. The confidence-retry loop lives in handlers/recap.ts;
 * this function has no retry logic of its own.
 */
export const runExtraction = async (
  ai: any,
  p: ExtractionParams,
): Promise<ExtractionOutcome> => {
  const rangeStart = p.fromPage > 0 ? p.fromPage + 1 : 1
  const isbnLine   = p.isbn ? `ISBN: ${p.isbn}\n` : ""

  const message = p.fromPage > 0
    ? `Book: "${p.title}" by ${p.author}
${isbnLine}Total pages: ${p.totalPages}
Reader progress: page ${p.currentPage} of ${p.totalPages} (${p.percentage}%).

List ONLY what happens in pages ${rangeStart} through ${p.currentPage}. Do NOT include events before page ${rangeStart} and nothing after page ${p.currentPage}.`
    : `Book: "${p.title}" by ${p.author}
${isbnLine}Total pages: ${p.totalPages}
Reader progress: page ${p.currentPage} of ${p.totalPages} (${p.percentage}%).

List ONLY what happens in pages 1 through ${p.currentPage}. Nothing after page ${p.currentPage}.`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction: buildExtractionPrompt(p.fromPage, p.currentPage, p.totalPages),
      temperature:       TEMPERATURE,
      maxOutputTokens:   8192,
      thinkingConfig:    DEFAULT_THINKING_CONFIG,
    },
  })

  const raw     = (response as any).text ?? ""
  const rawJson = extractJson(raw)

  let result: ExtractionResult | null = null
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson)
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.confidence_level === "string" &&
        VALID_CONFIDENCE.has(parsed.confidence_level)
      ) {
        result = parsed as ExtractionResult
      }
    } catch { /* leave result null */ }
  }

  const cand = (response as any).candidates?.[0]
  return {
    result,
    raw,
    rawJson,
    finishReason:  cand?.finishReason,
    blockReason:   (response as any).promptFeedback?.blockReason ?? null,
    safetyRatings: cand?.safetyRatings ?? null,
    usage:         (response as any).usageMetadata ?? null,
  }
}
