// deno-lint-ignore-file no-explicit-any
import { buildRecapPrompt } from "../prompts/recap.ts"
import { DEFAULT_THINKING_CONFIG } from "../aiClient.ts"
import { corsHeaders } from "../cors.ts"
import { runExtraction, type ExtractionOutcome } from "../extraction/runExtraction.ts"
import { MAX_ATTEMPTS, computeAdjustedPage } from "../extraction/retryPolicy.ts"
import { logStageFailure } from "../utils/logging.ts"
import type { RequestBody } from "../types.ts"

/**
 * Mid-book Recap handler — the hardened path.
 *
 * Flow:
 *   1. Call extractor. On confidence `high` | `medium` → proceed to composer.
 *   2. On confidence `low` OR parse failure → retry with a reduced page window
 *      (up to MAX_ATTEMPTS additional attempts).
 *   3. On provider safety block → terminal graceful error (no retry).
 *   4. On exhausted retries still low → graceful error (never a speculative recap).
 *   5. On success → stream the recap composition back to the client.
 */
export const handleRecap = async (ai: any, body: RequestBody): Promise<Response> => {
  const fromPage = typeof body.from_page === "number" ? body.from_page : 0

  let attempt   = 0
  let outcome:  ExtractionOutcome | null = null
  let lastAdjustedPage = body.currentPage

  while (attempt <= MAX_ATTEMPTS) {
    const adjustedPage = attempt === 0
      ? body.currentPage
      : computeAdjustedPage(body.currentPage, fromPage, attempt)

    if (adjustedPage === null) {
      // Retry window collapsed into fromPage — abort retries.
      logStageFailure({
        stage:          "extractor",
        attempt,
        rawTextPreview: "adjusted page would not advance past fromPage; aborting retries",
      })
      return jsonError("AI output invalid", "Low extraction confidence after retries")
    }

    lastAdjustedPage = adjustedPage

    outcome = await runExtraction(ai, {
      title:       body.title,
      author:      body.author,
      isbn:        body.isbn,
      fromPage,
      currentPage: adjustedPage,
      totalPages:  body.totalPages,
      percentage:  body.percentage,
    })

    // Provider safety block → terminal (no retry).
    if (outcome.blockReason) {
      logStageFailure({
        stage:          "extractor",
        attempt,
        finishReason:   outcome.finishReason,
        blockReason:    outcome.blockReason,
        safetyRatings:  outcome.safetyRatings,
        usage:          outcome.usage,
        rawTextLength:  outcome.raw.length,
        rawTextPreview: outcome.raw.slice(0, 500),
      })
      return jsonError("AI output invalid", "Provider safety block", {
        finishReason: outcome.finishReason,
        blockReason:  outcome.blockReason,
      })
    }

    // Parsed successfully AND confidence is not low → proceed to composer.
    if (outcome.result && outcome.result.confidence_level !== "low") break

    // Otherwise: log, bump attempt, maybe retry.
    logStageFailure({
      stage:          "extractor",
      attempt,
      finishReason:   outcome.finishReason,
      blockReason:    outcome.blockReason,
      rawTextLength:  outcome.raw.length,
      rawTextPreview: outcome.raw.slice(0, 500),
      usage:          outcome.usage,
    })

    attempt++
    if (attempt > MAX_ATTEMPTS) break
  }

  // Retry budget exhausted OR still low-confidence → graceful error.
  if (!outcome || !outcome.rawJson || !outcome.result || outcome.result.confidence_level === "low") {
    const detail = outcome?.rawJson
      ? "Low extraction confidence after retries"
      : "No JSON block found in response"
    return jsonError("AI output invalid", detail, {
      finishReason: outcome?.finishReason,
      blockReason:  outcome?.blockReason,
    })
  }

  // ===== Composer stage — stream the recap =====
  const rangeStart = fromPage > 0 ? fromPage + 1 : 1
  const recapMessage = `Here is the extracted content${fromPage > 0 ? ` from pages ${rangeStart} to ${lastAdjustedPage}` : ` from pages 1 to ${lastAdjustedPage}`} of "${body.title}" by ${body.author}:

${outcome.rawJson}

Generate the three-part briefing using ONLY the characters, events, and details listed above. Do NOT add anything from your own knowledge of the book that is not in the extracted content.`

  let stream
  try {
    stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: recapMessage }] }],
      config: {
        systemInstruction: buildRecapPrompt(),
        temperature:       0.7,
        maxOutputTokens:   4096,
        thinkingConfig:    DEFAULT_THINKING_CONFIG,
      },
    })
  } catch (err) {
    logStageFailure({
      stage:          "recap",
      attempt,
      rawTextPreview: String(err).slice(0, 500),
    })
    return jsonError("AI output invalid", "Recap composition failed")
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = (chunk as any).text
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (err) {
        console.error("Recap stream error:", err)
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}

// ── local helpers ───────────────────────────────────────────────────────────

const jsonError = (
  error: string,
  detail: string,
  extra: Record<string, unknown> = {},
): Response =>
  new Response(
    JSON.stringify({ error, detail, ...extra }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
