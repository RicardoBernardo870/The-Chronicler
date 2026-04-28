// deno-lint-ignore-file no-explicit-any
// =====================================================================
// ocr-page edge function (015-corpus-recaps)
// =====================================================================
// Purpose: Accept a base64-encoded book-page image, send to Gemini 2.5
//          Flash multimodal for text extraction, return { text, confidence,
//          wordCount }.
//
// CRITICAL: The image bytes are held in memory only for the duration of
//          this request and are NEVER persisted to disk, logs, or Storage.
//          Only the extracted text is returned to the client.
// =====================================================================

import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ─── Auth ─────────────────────────────────────────────────────────────
// Mirror the manualJwtDecode pattern used by sibling edge functions.
const manualJwtDecode = (authHeader: string | null): string | null => {
  if (!authHeader) return null
  const jwt = authHeader.replace(/^Bearer\s+/i, "")
  const parts = jwt.split(".")
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1]))
    return typeof payload?.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

// ─── Constants ────────────────────────────────────────────────────────
const MAX_DECODED_BYTES   = 5 * 1024 * 1024  // 5 MB
const GEMINI_TIMEOUT_MS   = 10_000
const ALLOWED_MIME_TYPES  = new Set(["image/jpeg", "image/png"])

// ─── OCR prompt (per contracts/ocr-page.md) ──────────────────────────
const OCR_PROMPT = `You are an OCR engine for a personal reading-tracking application. Extract all visible text from the provided image of a book page. Preserve paragraph breaks as \\n\\n and line breaks within paragraphs as single \\n.

Do not include:
- Page numbers printed on the image (the application tracks page numbers separately)
- Headers/footers (chapter titles, running titles)
- Footnote markers
- Decorative ornaments or page-break symbols

Respond with a JSON object only, no markdown fences:

{
  "text": "<extracted text>",
  "confidence": <number 0.0-1.0 — your assessment of how legibly the text was captured>,
  "notes": "<optional: any caveats about the extraction, e.g. 'partial blur on right margin'>"
}

Confidence guidance:
- 0.95-1.00 = clean, no doubts
- 0.70-0.94 = good but minor uncertainty in some words
- 0.40-0.69 = significant uncertainty; user should review carefully
- 0.00-0.39 = poor capture; recommend retake`

// ─── Helpers ──────────────────────────────────────────────────────────
const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

const decodedBase64Length = (b64: string): number => {
  // base64 decoded bytes = 3/4 of the encoded length minus padding.
  const padding = (b64.match(/=+$/) ?? [""])[0].length
  return Math.floor((b64.length * 3) / 4) - padding
}

const stripJsonFences = (raw: string): string => {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenceMatch) return fenceMatch[1].trim()
  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objectMatch) return objectMatch[0]
  return trimmed
}

const callGeminiOnce = async (
  ai: any,
  imageBase64: string,
  mimeType: string,
): Promise<{ text: string; confidence: number }> => {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        { text: OCR_PROMPT },
      ],
    }],
    config: {
      temperature:     0.1,
      maxOutputTokens: 8192,
      thinkingConfig:  { thinkingBudget: 0 },
    },
  })

  const raw = (result?.text ?? "").trim()
  if (!raw) throw new Error("Empty response from Gemini")

  let parsed: { text?: unknown; confidence?: unknown }
  try {
    parsed = JSON.parse(stripJsonFences(raw))
  } catch {
    throw new Error("Gemini returned non-JSON response")
  }

  const text = typeof parsed.text === "string" ? parsed.text : ""
  const confidenceRaw = typeof parsed.confidence === "number" ? parsed.confidence : 0
  const confidence = Math.max(0, Math.min(1, confidenceRaw))

  return { text, confidence }
}

const callGeminiWithRetry = async (
  ai: any,
  imageBase64: string,
  mimeType: string,
): Promise<{ text: string; confidence: number }> => {
  try {
    return await callGeminiOnce(ai, imageBase64, mimeType)
  } catch (err) {
    // Single retry on transient errors. Re-throw if the second attempt also fails.
    console.warn("ocr-page: first attempt failed, retrying once.", String(err).slice(0, 200))
    return await callGeminiOnce(ai, imageBase64, mimeType)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization")
    const userId = manualJwtDecode(authHeader)
    if (!userId) {
      return jsonResponse(401, { error: "Unauthorized", message: "Missing or invalid JWT" })
    }

    // Parse body
    const body = await req.json().catch(() => null) as { imageBase64?: unknown; mimeType?: unknown } | null
    if (!body) {
      return jsonResponse(400, { error: "InvalidRequest", message: "Body must be JSON" })
    }

    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : ""
    const mimeType    = typeof body.mimeType    === "string" ? body.mimeType    : ""

    if (!imageBase64) {
      return jsonResponse(400, { error: "InvalidRequest", message: "imageBase64 missing or invalid" })
    }
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return jsonResponse(400, { error: "InvalidRequest", message: "mimeType must be image/jpeg or image/png" })
    }

    const decoded = decodedBase64Length(imageBase64)
    if (decoded > MAX_DECODED_BYTES) {
      return jsonResponse(400, { error: "InvalidRequest", message: "Image exceeds 5 MB limit" })
    }

    // AI client
    const apiKey = Deno.env.get("GEMINI_API_KEY")
    if (!apiKey) {
      return jsonResponse(503, { error: "AiUnavailable", message: "AI service not configured" })
    }
    const ai = new GoogleGenAI({ apiKey })

    // OCR with timeout
    const ocrPromise = callGeminiWithRetry(ai, imageBase64, mimeType)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini call timed out")), GEMINI_TIMEOUT_MS),
    )

    let result: { text: string; confidence: number }
    try {
      result = await Promise.race([ocrPromise, timeoutPromise])
    } catch (err) {
      const msg = String(err)
      if (msg.includes("timed out")) {
        return jsonResponse(504, { error: "OcrTimeout", message: "OCR took too long; please try again" })
      }
      console.error("ocr-page: Gemini failure after retry:", msg.slice(0, 500))
      return jsonResponse(502, { error: "OcrUpstream", message: "Gemini call failed after retry" })
    }

    const text = result.text
    const wordCount = text.split(/\s+/).filter(Boolean).length

    // Note: image bytes go out of scope here and are GC'd. Not persisted anywhere.
    return jsonResponse(200, {
      text,
      confidence: result.confidence,
      wordCount,
    })
  } catch (err) {
    console.error("ocr-page: unexpected error:", String(err).slice(0, 500))
    return jsonResponse(500, { error: "InternalError", message: "Unexpected error" })
  }
})
