// deno-lint-ignore-file no-explicit-any
// generate-book-quiz — Memory Check recall quiz.
// Stateless transformer: receives the reader's own captured page texts
// (+ optional prior recap context for name continuity) and returns up to 3
// multiple-choice questions with exactly 3 options each.
// The client performs the DB write (book_quizzes upsert). Always returns 200
// with { quiz: null } on soft failure so callers can fall back gracefully.
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

const SYSTEM_PROMPT = `You are The Chronicler, a reading companion helping a reader test their memory of a book before they resume reading it.

You will receive the text of pages the reader photographed (each labelled with its page number), and optionally a short PRIOR RECAP for continuity.

CRITICAL GROUNDING RULES:
- Use ONLY the provided page texts. Do NOT add external knowledge about the book, even if you recognize it.
- Do NOT reference or hint at anything beyond these pages. No predictions, no foreshadowing.
- The PRIOR RECAP, when present, may be used ONLY to recognize character names and ongoing situations — never as a source of questions or answer options.
- Wrong options must be plausible-sounding but clearly contradicted by the provided text. They must NEVER introduce events, characters, or facts from outside the provided text.

QUIZ RULES:
- Write 3 questions when the material allows it; 2 or 1 when it is thin. Never pad with trivial or repetitive questions.
- Each question tests recall of something that happened, was said, was felt, or was revealed in the provided pages — the kind of thing a reader forgets after days away.
- Exactly 3 options per question. Exactly one is correct. Vary which position holds the correct answer.
- Questions are one sentence, at most 20 words. Options are short phrases, at most 12 words.
- "sourcePage" is the page number of the capture that grounds the question.

If the material is too short, garbled, or not narrative prose, return { "insufficient": true }.

Output strict JSON only. No prose outside the JSON. No markdown.

OUTPUT SHAPE:
{ "questions": [{ "question": "string", "options": ["string", "string", "string"], "correctIndex": 0, "sourcePage": 42 }] }
or
{ "insufficient": true }`

interface QuizCaptureInput {
  page: number
  text: string
}

interface QuizRequest {
  captures: QuizCaptureInput[]
  recapContext?: string
}

const validateBody = (body: any): body is QuizRequest =>
  body &&
  Array.isArray(body.captures) &&
  body.captures.length > 0 &&
  body.captures.every(
    (c: any) =>
      c &&
      typeof c.page === "number" &&
      typeof c.text === "string" &&
      c.text.trim().length > 0,
  ) &&
  (body.recapContext === undefined || typeof body.recapContext === "string")

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  sourcePage: number | null
}

const cap = (s: string, max: number): string => s.trim().slice(0, max)

// Shuffle options so the correct answer's position never follows a model
// habit (e.g. always first). Fisher-Yates over the 3 indices.
const shuffleQuestion = (q: QuizQuestion): QuizQuestion => {
  const order = [0, 1, 2]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    ...q,
    options: order.map((idx) => q.options[idx]),
    correctIndex: order.indexOf(q.correctIndex),
  }
}

const validateAndNormalise = (parsed: any): QuizQuestion[] | null => {
  if (!parsed || parsed.insufficient === true) return null
  if (!Array.isArray(parsed.questions)) return null

  const questions = parsed.questions
    .filter(
      (q: any) =>
        q &&
        typeof q.question === "string" &&
        q.question.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length === 3 &&
        q.options.every((o: any) => typeof o === "string" && o.trim().length > 0) &&
        typeof q.correctIndex === "number" &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex <= 2,
    )
    .slice(0, 3)
    .map((q: any): QuizQuestion =>
      shuffleQuestion({
        question: cap(q.question, 240),
        options: q.options.map((o: string) => cap(o, 120)),
        correctIndex: q.correctIndex,
        sourcePage: typeof q.sourcePage === "number" ? q.sourcePage : null,
      }),
    )

  return questions.length > 0 ? questions : null
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
    console.warn("[generate-book-quiz] GEMINI_API_KEY missing")
    return new Response(JSON.stringify({ quiz: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Most recent pages carry the freshest memory — keep the last 6 captures
  // and cap the total corpus so a long backlog never floods the model.
  const captures = (body.captures as QuizCaptureInput[])
    .slice(-6)
    .map((c) => ({ page: c.page, text: c.text.trim().slice(0, 6000) }))
  const recapContext = (body.recapContext ?? "").trim().slice(0, 800)

  const pagesBlock = captures
    .map((c) => `PAGE ${c.page}:\n${c.text}`)
    .join("\n\n---\n\n")
  const userText = recapContext
    ? `PRIOR RECAP (names/continuity only):\n${recapContext}\n\nCAPTURED PAGES:\n\n${pagesBlock}\n\nGenerate the JSON now.`
    : `CAPTURED PAGES:\n\n${pagesBlock}\n\nGenerate the JSON now.`

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
      contents: [{ role: "user", parts: [{ text: userText }] }],
    })

    const rawText = response.text ?? ""
    const jsonStr = extractJson(rawText)
    let questions: QuizQuestion[] | null = null
    if (jsonStr) {
      try {
        questions = validateAndNormalise(JSON.parse(jsonStr))
      } catch (e) {
        console.warn("[generate-book-quiz] parse failed", e)
      }
    } else {
      console.warn("[generate-book-quiz] no JSON in response, raw:", rawText.slice(0, 300))
    }

    return new Response(JSON.stringify({ quiz: questions ? { questions } : null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error("[generate-book-quiz] unhandled:", err)
    // Even on errors, return 200 with null — never bubble.
    return new Response(JSON.stringify({ quiz: null }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
