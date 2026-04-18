// deno-lint-ignore-file no-explicit-any
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ── JWT decode (same pattern as generate-recap; verify_jwt = false) ──────────

const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const [, payload] = token.split(".")
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
  } catch {
    return null
  }
}

// ── Chronicler Historian system prompt (per research.md § Decision 4) ────────


const SYSTEM_PROMPT = `You are the "Chronicler Historian." Your task is to write one focused lore entry that EXPANDS the world of the book beyond the immediate events of the recap, while remaining fully spoiler-safe.

CRITICAL SPOILER GUARDRAIL:
You are given a "Master Recap" of the story so far. You MUST NOT reference any character, event, place, or concept that does NOT appear in the recap.
However, you may expand on those elements by providing background, history, context, or side-stories that are logically connected and would be known within the world.

CORE GOAL:
Do NOT summarize or restate what the reader already read.
Instead, provide "expanded context" — something that enriches the world:
- origins and backstory
- past events briefly referenced
- cultural or societal context
- lesser-known anecdotes
- relevant historical or institutional background

This should feel like additional knowledge ABOUT the world, not a continuation of the plot.

The tone and style MUST adapt to the book’s genre:
- Fantasy → mythic, legendary, ancient tone
- Sci-fi → technological, scientific, or institutional context
- Thriller/Mystery → investigative, historical, or case-related background
- Romance → personal history, relationships, or social context
- Historical → grounded in real-world-like history and events

TOPIC SELECTION — follow this priority order:
1. A named ITEM or OBJECT → explain its origin, creator, or past use
2. A named PLACE → describe its history, reputation, or significance
3. A named EVENT → expand on its causes or broader context
4. A named ORGANIZATION or FACTION → reveal origins, structure, or influence
5. A named GROUP or DEMOGRAPHIC → describe customs, role, or background

EXPANSION RULE:
- You may introduce NEW details, but ONLY if they are logically tied to something explicitly mentioned in the recap
- These details must feel natural and believable within the story’s world
- Do NOT hint at future plot developments

DIVERSITY RULE:
If a list of already-covered topics is provided, you MUST pick something new.
Prioritise elements mentioned in the most recent recap sections.

BE SPECIFIC:
Focus on ONE clearly named subject from the recap.
Avoid general themes.

TONE:
- In-universe when appropriate, but always match the genre
- Avoid generic summaries or analysis
- Write as if this is a piece of background knowledge someone could discover

FORMAT:
Return a raw JSON object ONLY. No markdown, no code fences, no backticks, no commentary.

{
  "title": "<3–8 word evocative title>",
  "content": "<90–160 words of expanded lore/context, not a recap>",
  "type": "<one of: History | Culture | Geography | Technology | Lore>",
  "linked_entities": ["<up to 5 specific names drawn only from the Master Recap>"]
}`;


// ── Input validation ──────────────────────────────────────────────────────────

const VALID_MILESTONES = new Set([10, 20, 30, 40, 50, 60, 70, 80, 90])

interface LoreRequest {
  title: string
  author: string
  isbn?: string
  currentPage: number
  totalPages: number
  percentage: number
  milestone: number
  masterRecap: string
  existingTopics?: string[]
}

const validateBody = (body: any): body is LoreRequest => {
  if (!body) return false
  const required = ["title", "author", "currentPage", "totalPages", "percentage", "milestone", "masterRecap"]
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) return false
  }
  if (typeof body.masterRecap !== "string" || body.masterRecap.trim() === "") return false
  if (!VALID_MILESTONES.has(Number(body.milestone))) return false
  return true
}

// ── Output normalisation & validation ────────────────────────────────────────

// The five types the prompt offers the AI to choose from.
const VALID_TYPES = new Set(["History", "Culture", "Geography", "Technology", "Lore"])

const validateAndNormalise = (parsed: any): { ok: false } | { ok: true; data: any } => {
  if (!parsed || typeof parsed !== "object") return { ok: false }
  if (typeof parsed.title !== "string" || parsed.title.trim() === "") return { ok: false }
  if (typeof parsed.content !== "string" || parsed.content.trim() === "") return { ok: false }

  if (!VALID_TYPES.has(parsed.type)) {
    console.error("[generate-lore] Unrecognised type value:", parsed.type)
    return { ok: false }
  }

  // Truncate to 5 instead of failing — AI sometimes returns more
  const entities: string[] = Array.isArray(parsed.linked_entities)
    ? parsed.linked_entities.filter((e: any) => typeof e === "string").slice(0, 5)
    : []

  return { ok: true, data: { ...parsed, linked_entities: entities } }
}

// ── Extract the first well-formed JSON object from the AI response ────────────
// Handles: leading/trailing prose, code fences, thinking blocks, partial wrapping.

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{")
  const end   = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

// ── Edge function entry point ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? ""
  const token = authHeader.replace(/^Bearer\s+/i, "").trim()
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const claims = decodeJwt(token)
  if (!claims || !claims.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // ── Body parse & validation ───────────────────────────────────────────────
  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!validateBody(body)) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const { title, author, isbn, currentPage, totalPages, percentage, milestone, masterRecap, existingTopics } =
    body as LoreRequest

  // ── AI key check ──────────────────────────────────────────────────────────
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // ── Gemini call ───────────────────────────────────────────────────────────
  try {
    const ai = new GoogleGenAI({ apiKey })

    const alreadyCoveredBlock = (existingTopics && existingTopics.length > 0)
      ? `\n=== ALREADY COVERED — do NOT write about these topics again ===\n${existingTopics.map(t => `- ${t}`).join("\n")}\n=== END ALREADY COVERED ===\n\nYou MUST choose a completely different topic from the list above. Scan the most recent recap sections for something fresh.\n`
      : ""

      const userMessage = `Book: "${title}" by ${author}${isbn ? ` (ISBN: ${isbn})` : ""}

      Current reading position:
      - Page ${currentPage} of ${totalPages}
      - Progress: ${Math.round(percentage)}%
      - Milestone: ${milestone}%
      
      ${alreadyCoveredBlock}
      
      === MASTER RECAP (everything the reader has seen so far, oldest → newest) ===
      ${masterRecap}
      === END MASTER RECAP ===
      
      TASK:
      Generate ONE specific lore entry that expands the world of the book.
      
      IMPORTANT RULES:
      - Do NOT summarize or restate events from the recap
      - Focus on ONE named subject (person, place, object, event, group, etc.)
      - Prefer elements introduced or mentioned in the MOST RECENT recap sections
      - Expand the world by adding background, history, origin, or context
      - The result should feel like "extra knowledge" about the world, not part of the main narrative
      
      SPOILER SAFETY:
      - You may ONLY reference names, places, and concepts explicitly present in the Master Recap
      - You may expand on them, but NEVER introduce future events or hints
      
      AVOID:
      - Rewriting scenes from the recap
      - Generic world-building not tied to a specific named subject
      - Vague or obvious observations
      
      GOAL:
      The reader should feel: "I didn’t read this, but it makes the world richer and fits perfectly."
      
      Generate the lore entry now.`;
      

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.85,
        maxOutputTokens: 4096,
        // Gemini 2.5 Flash uses "thinking" tokens that count against
        // maxOutputTokens. Lore generation doesn't need reasoning — skip it
        // so the whole budget is available for visible text.
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    })

    const rawText = response.text ?? ""
    const jsonStr = extractJson(rawText)

    if (!jsonStr) {
      // Diagnostic dump — tells us WHY .text was empty next time this fires.
      const candidate  = (response as any).candidates?.[0]
      const finishReason = candidate?.finishReason ?? "<unknown>"
      const safetyRatings = candidate?.safetyRatings ?? null
      const blockReason = (response as any).promptFeedback?.blockReason ?? null
      const usage = (response as any).usageMetadata ?? null

      console.error("[generate-lore] No JSON block found. Diagnostics:", JSON.stringify({
        finishReason,
        blockReason,
        safetyRatings,
        usage,
        rawTextLength: rawText.length,
        rawTextPreview: rawText.slice(0, 500),
      }))

      return new Response(
        JSON.stringify({
          error: "AI output invalid",
          detail: "No JSON block found in response",
          finishReason,
          blockReason,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error("[generate-lore] JSON.parse failed. Extracted:", jsonStr)
      return new Response(
        JSON.stringify({ error: "AI output invalid", detail: "Response was not valid JSON" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const result = validateAndNormalise(parsed)
    if (!result.ok) {
      console.error("[generate-lore] Output shape invalid:", JSON.stringify(parsed))
      return new Response(
        JSON.stringify({ error: "AI output invalid", detail: "Response failed shape validation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { data } = result
    return new Response(
      JSON.stringify({
        title: data.title.trim(),
        content: data.content.trim(),
        type: data.type,
        linked_entities: data.linked_entities.map((e: string) => e.trim()).filter(Boolean),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    console.error("[generate-lore] Unhandled error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err?.message ?? err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
