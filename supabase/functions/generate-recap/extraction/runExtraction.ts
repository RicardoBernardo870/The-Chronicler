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
  const rangeStart = p.fromPage > 0 ? p.fromPage + 1 : 1;

  const message = `
INSTRUCTIONS FOR GROUNDING:
1. Use Google Search to find the Table of Contents or a Chapter-to-Page index for ISBN: ${p.isbn || "N/A"} (Book: "${p.title}" by ${p.author}).
2. Determine exactly which CHAPTER or scene ends closest to page ${p.currentPage} of ${p.totalPages}.
3. If you cannot find the page-to-chapter mapping for this specific edition, respond with "confidence_level": "low".

TASK:
${
  p.fromPage > 0
    ? `List ONLY the key events occurring from page ${rangeStart} through page ${p.currentPage}. DO NOT include anything before page ${rangeStart}.`
    : `List ONLY the key events from the VERY BEGINNING of the book up to page ${p.currentPage}.`
}

STRICT BOUNDARY:
- STOP strictly at page ${p.currentPage}.
- DO NOT summarize the entire book or mention any events that occur after page ${p.currentPage}.
- It is better to leave out a scene than to accidentally include a spoiler from page ${p.currentPage + 1} onwards.


BOOK CONTEXT:
- Title: "${p.title}"
- ISBN: ${p.isbn || "N/A"}
- Progress: Page ${p.currentPage} (${p.percentage}%)
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
      temperature: 0,
      maxOutputTokens: 8192,
      tools: [
        {
          googleSearch: {}, // This enables the search engine
        },
      ],
      // Force the model to use the search tool if it's unsure
      dynamicRetrievalConfig: {
        mode: "MODE_DYNAMIC",
        dynamicThreshold: 0, // Lower means it's MORE likely to search
      },
    },
  });

  const raw = (response as any).text ?? "";
  const rawJson = extractJson(raw);

  let result: ExtractionResult | null = null;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.confidence_level === "string" &&
        VALID_CONFIDENCE.has(parsed.confidence_level)
      ) {
        result = parsed as ExtractionResult;
      }
    } catch {
      /* leave result null */
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
