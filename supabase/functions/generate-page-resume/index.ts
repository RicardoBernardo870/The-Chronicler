// deno-lint-ignore-file no-explicit-any
// generate-page-resume — session-start warm-up dialog.
// Stateless transformer: receives one captured page's text (+ optional prior
// recap context for name continuity) and returns a tiny structured resume:
// up to 3 one-sentence bullets and 1 tension line.
// The client performs the DB write (page_captures.resume). Always returns 200
// with { resume: null } on soft failure so fire-and-forget callers never see
// errors. Recap edge functions are intentionally untouched by this feature.
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

const SYSTEM_PROMPT = `You are The Chronicler, a reading companion helping a reader re-enter their book at the start of a reading session.

You will receive the text of the LAST PAGE the reader photographed, and optionally a short PRIOR RECAP for continuity.

CRITICAL GROUNDING RULES:
- Use ONLY the provided page text. Do NOT add external knowledge about the book, even if you recognize it.
- Do NOT infer or hint at anything beyond this page. No predictions, no foreshadowing.
- The PRIOR RECAP, when present, may be used ONLY to recognize character names and ongoing situations — never as a source of new events.
- One sentence is enough for each item. Keep every sentence short and concrete.

OUTPUT:
- "bullets": up to 3 items, each ONE short sentence describing what is happening on this page, in reading order.
- "tension": ONE sentence, present tense, naming the open question or pressure the page leaves hanging. No speculation about what comes next.

If the page text is too short, garbled, or not narrative prose (index, copyright page, etc.), return { "insufficient": true }.

Output strict JSON only. No prose outside the JSON. No markdown.

OUTPUT SHAPE:
{ "bullets": ["string"], "tension": "string" }
or
{ "insufficient": true }`

interface ResumeRequest {
  pageText: string
  recapContext?: string
}

const validateBody = (body: any): body is ResumeRequest =>
  body &&
  typeof body.pageText === "string" &&
  body.pageText.trim().length > 0 &&
  (body.recapContext === undefined || typeof body.recapContext === "string")

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

interface SessionResume {
  bullets: string[]
  tension: string
}

const oneSentenceCap = (s: string): string => s.trim().slice(0, 240)

const validateAndNormalise = (parsed: any): SessionResume | null => {
  if (!parsed || parsed.insufficient === true) return null
  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.filter((b: any) => typeof b === "string" && b.trim().length > 0)
        .map(oneSentenceCap).slice(0, 3)
    : []
  if (bullets.length === 0) return null
  const tension = typeof parsed.tension === "string" ? oneSentenceCap(parsed.tension) : ""
  return { bullets, tension }
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
    console.warn("[generate-page-resume] GEMINI_API_KEY missing")
    return new Response(JSON.stringify({ resume: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const pageText = body.pageText.trim().slice(0, 12000)
  const recapContext = (body.recapContext ?? "").trim().slice(0, 800)
  const userText = recapContext
    ? `PRIOR RECAP (names/continuity only):\n${recapContext}\n\nPAGE TEXT:\n\n${pageText}\n\nGenerate the JSON now.`
    : `PAGE TEXT:\n\n${pageText}\n\nGenerate the JSON now.`

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: "user", parts: [{ text: userText }] }],
    })

    const rawText = response.text ?? ""
    const jsonStr = extractJson(rawText)
    let resume: SessionResume | null = null
    if (jsonStr) {
      try {
        resume = validateAndNormalise(JSON.parse(jsonStr))
      } catch (e) {
        console.warn("[generate-page-resume] parse failed", e)
      }
    } else {
      console.warn("[generate-page-resume] no JSON in response, raw:", rawText.slice(0, 300))
    }

    return new Response(JSON.stringify({ resume }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error("[generate-page-resume] unhandled:", err)
    // Even on errors, return 200 with null — never bubble.
    return new Response(JSON.stringify({ resume: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
