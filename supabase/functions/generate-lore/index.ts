// deno-lint-ignore-file no-explicit-any
import { GoogleGenAI } from "npm:@google/genai"
import { requireUser } from "../_shared/auth.ts"
import { internalErrorBody } from "../_shared/errors.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SYSTEM_PROMPT = `You are the "Chronicler Historian." Your task is to provide one focused lore entry that provides established background, history, or context for a specific book's world based on a provided "Master Recap." You must act as a scholar of the specific author's canon.

CRITICAL SPOILER GUARDRAIL:
You are given a "Master Recap" of the story so far. You MUST NOT reference any character, event, place, or concept that does NOT appear in the recap. However, you may provide deep historical or canonical context for those elements that would be known to a scholar within that world.

CORE GOAL:
Do NOT summarize or restate what the reader already read.
Instead, provide "canonical context"—actual, accurate lore from the author's published materials:
- ancient origins and deep history
- historical context of objects or locations
- cultural or societal foundations
- relevant institutional or lineage backgrounds

ACCURACY RULE:
Do NOT invent or "hallucinate" new details to fill gaps.
You must draw exclusively from the established lore, appendices, and official companion materials written by the author.
If the lore for a specific element is sparse, focus on what is known for certain rather than creative embellishment.

The tone and style MUST adapt to the book's genre:
Fantasy → mythic, legendary, ancient tone
Sci-fi → technological, archival, or institutional context
Thriller/Mystery → investigative, historical, or case-related background
Historical → grounded in real-world-like history and records

TOPIC SELECTION — follow this priority order:
A named ITEM or OBJECT → explain its true origin or past owners
A named PLACE → describe its original construction, purpose, or history
A named EVENT → expand on the historical causes or ancient precedents
A named ORGANIZATION or FACTION → reveal their founding principles or deep history
A named GROUP or DEMOGRAPHIC → describe their ancient customs or heritage

DIVERSITY RULE:
If a list of already-covered topics is provided, you MUST pick something new.
Prioritize elements mentioned in the most recent recap sections.

LENGTH:
Keep content concise — 90 to 160 words. Be evocative and scholarly, not exhaustive.

FORMAT:
Return a raw JSON object ONLY. No markdown, no code fences, no backticks, no commentary.

{
  "title": "<3–8 word evocative title>",
  "content": "<90–160 words of expanded lore/context, not a recap>",
  "type": "<one of: History | Culture | Geography | Technology | Lore>",
  "linked_entities": ["<up to 5 specific names drawn only from the Master Recap>"]
}`

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

const VALID_TYPES = new Set(["History", "Culture", "Geography", "Technology", "Lore"])

const validateAndNormalise = (parsed: any): { ok: false } | { ok: true; data: any } => {
  if (!parsed || typeof parsed !== "object") return { ok: false }
  if (typeof parsed.title !== "string" || parsed.title.trim() === "") return { ok: false }
  if (typeof parsed.content !== "string" || parsed.content.trim() === "") return { ok: false }

  if (!VALID_TYPES.has(parsed.type)) {
    console.error("[generate-lore] Unrecognised type value:", parsed.type)
    return { ok: false }
  }

  const entities: string[] = Array.isArray(parsed.linked_entities)
    ? parsed.linked_entities.filter((e: any) => typeof e === "string").slice(0, 5)
    : []

  return { ok: true, data: { ...parsed, linked_entities: entities } }
}

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{")
  const end   = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  // Verified by Supabase Auth (signature + expiry), never decoded locally.
  const userId = await requireUser(req)
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

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

  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AI service not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

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

=== MASTER RECAP (Current Knowledge Boundary) ===
${masterRecap}
=== END MASTER RECAP ===

TASK:
Consult your archival knowledge of ${author}'s established canon for "${title}." Generate ONE lore entry that provides deep historical or cultural context for a subject mentioned in the recap.

STRICT ACCURACY RULES:
- Use ONLY established facts from the author's published books, appendices, or official lore.
- Do NOT invent new details, names, or histories to fill gaps.
- If a subject is mentioned in the recap (e.g., a specific sword or city), explain its canonical origin or ancient history as written by ${author}.
- Do NOT reference any events, characters, or spoilers that occur after the current progress in the Master Recap.

LORE FOCUS:
- Target a specific entity from the most recent recap sections.
- The content must be 90 to 160 words.
- Tone: Match the specific prose style of ${author}.

Generate the lore entry now.`

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        // Lower temperature (0.3 - 0.4) is CRITICAL for factual accuracy.
        // It prevents the model from "hallucinating" creative details.
        temperature: 0.35,
        maxOutputTokens: 4096,
        // Enabling some thinking actually HELPS with factual recall/checking
        // against spoilers. Lore retrieval is a reasoning task.
        thinkingBudget: 1000,  // Values for 2.5 Flash range from 0 to 24576
        includeThoughts: true // Use this if you want to see the reasoning process
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
    return new Response(
      JSON.stringify(internalErrorBody("generate-lore", err)),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
