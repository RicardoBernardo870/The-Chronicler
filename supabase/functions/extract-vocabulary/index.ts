// deno-lint-ignore-file no-explicit-any
// 016 — extract-vocabulary
// Stateless transformer: receives OCR text + capture metadata, returns up to
// 5 in-context-defined uncommon words. Client performs DB writes (lexicon
// dedup + insert + ledger update). Always returns 200 unless auth/input fails,
// so the client's fire-and-forget call never bubbles errors to the user.
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const [, payload] = token.split(".")
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
  } catch { return null }
}

const SYSTEM_PROMPT = `You are a vocabulary tutor identifying words an educated adult literary reader would benefit from learning.

INSTRUCTION:
From the passage below, select UP TO 5 uncommon, advanced, or distinctively literary words.

HARD RULES:
- EXCLUDE proper nouns (character names, place names, brand names, titles).
- EXCLUDE common words even if they're long (e.g. "remember", "important", "different").
- For each chosen word, write a one-sentence definition that reflects how the word is used IN THIS PASSAGE — never a generic dictionary definition.
- If the passage contains no qualifying words, return { "words": [] }.
- Output strict JSON only. No prose outside the JSON envelope. No markdown.

OUTPUT SHAPE:
{ "words": [{ "word": "string", "definition": "one sentence" }] }`

interface VocabRequest {
  ocrText: string
}

const validateBody = (body: any): body is VocabRequest =>
  body && typeof body.ocrText === "string" && body.ocrText.trim().length > 0

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

const validateAndNormalise = (parsed: any): { word: string; definition: string }[] => {
  if (!parsed || !Array.isArray(parsed.words)) return []
  return parsed.words
    .filter((w: any) => w && typeof w.word === "string" && typeof w.definition === "string")
    .map((w: any) => ({ word: String(w.word).trim(), definition: String(w.definition).trim() }))
    .filter((w: any) => w.word.length > 1 && w.definition.length > 0)
    .slice(0, 5)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  const claims = token ? decodeJwt(token) : null
  if (!claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!validateBody(body)) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    // Return 200 with empty list — fire-and-forget contract; never surface errors.
    console.warn("[extract-vocabulary] GEMINI_API_KEY missing")
    return new Response(JSON.stringify({ words: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.4,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: "user", parts: [{ text: `PASSAGE:\n\n${body.ocrText}\n\nGenerate the JSON now.` }] }],
    })

    const rawText = response.text ?? ""
    const jsonStr = extractJson(rawText)
    let words: { word: string; definition: string }[] = []
    if (jsonStr) {
      try {
        const parsed = JSON.parse(jsonStr)
        words = validateAndNormalise(parsed)
      } catch (e) {
        console.warn("[extract-vocabulary] parse failed", e)
      }
    } else {
      console.warn("[extract-vocabulary] no JSON in response, raw:", rawText.slice(0, 300))
    }

    return new Response(JSON.stringify({ words }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error("[extract-vocabulary] unhandled:", err)
    // Even on errors, return 200 with empty list — never bubble.
    return new Response(JSON.stringify({ words: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
