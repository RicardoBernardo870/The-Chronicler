// deno-lint-ignore-file no-explicit-any
import type { ExtractionResult } from "../types.ts";
import { extractJson } from "../utils/json.ts";
import { buildExtractionPrompt } from "../prompts/extraction.ts";

export interface ExtractionParams {
  title: string;
  author: string;
  isbn?: string;
  fromPage: number;
  currentPage: number;
  totalPages: number;
  percentage: number;
}

export interface ExtractionOutcome {
  result: ExtractionResult | null;
  raw: string;
  rawJson: string | null;
  finishReason?: string;
  blockReason?: string | null;
  safetyRatings?: unknown;
  usage?: unknown;
}

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

export const runExtraction = async (
  ai: any,
  p: ExtractionParams,
): Promise<ExtractionOutcome> => {
  const message = `
INSTRUCTIONS:
1. Search for: "${p.title} ${p.author} chapter page count" or "${p.title} table of contents".
2. Based on a total of ${p.totalPages} pages, determine which chapter corresponds to page ${p.currentPage}.
3. To prevent spoilers, summarize ONLY up to the chapter BEFORE the one you identified. 
4. If you cannot find a page-to-chapter map, stop your summary at the ${Math.round(p.percentage * 0.8)}% mark of the narrative.

BOOK: "${p.title}" by ${p.author}
ISBN: ${p.isbn || "N/A"}
USER IS AT: Page ${p.currentPage} of ${p.totalPages} (${p.percentage}%)
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [{ role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction: buildExtractionPrompt(
        p.fromPage,
        p.currentPage,
        p.totalPages,
      ),
      temperature: 0.0, // Forced determinism
      maxOutputTokens: 8192,
      tools: [{ googleSearch: {} }],
      dynamicRetrievalConfig: {
        mode: "MODE_DYNAMIC",
        dynamicThreshold: 0, // Back to forced grounding
      },
    },
  });

  const raw = (response as any).text ?? "";
  const rawJson = extractJson(raw);

  let result: ExtractionResult | null = null;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      // Ensure we still match your ExtractionResult type while using the new audit logic
      if (parsed && typeof parsed === "object") {
        result = parsed as ExtractionResult;
      }
    } catch {
      /* parse error */
    }
  }

  const cand = (response as any).candidates?.[0];
  return {
    result,
    raw,
    rawJson,
    finishReason: cand?.finishReason,
    blockReason: (response as any).promptFeedback?.blockReason ?? null,
    safetyRatings: cand?.safetyRatings ?? null,
    usage: (response as any).usageMetadata ?? null,
  };
};
