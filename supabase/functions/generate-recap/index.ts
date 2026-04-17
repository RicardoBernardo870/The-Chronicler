// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ---- Pass 1: Extract ONLY what happens in the given page range ----
const buildExtractionPrompt = (fromPage: number, currentPage: number, totalPages: number) => {
  const rangeStart = fromPage > 0 ? fromPage + 1 : 1
  const rangeDesc = fromPage > 0
    ? `pages ${rangeStart} to ${currentPage}`
    : `the first ${currentPage} pages (out of ${totalPages} total)`

  return `You are a literary analyst. Your task is to recall the content of a specific book and produce a detailed summary of ONLY ${rangeDesc}.

METHODOLOGY - FOLLOW THIS STEP BY STEP:
1. Reconstruct the book's chapter structure
2. Identify which chapters fall within ${rangeDesc}
3. For each of those chapters, describe the key events and which characters are involved
4. STOP at the chapter that contains page ${currentPage} — include content from that chapter only up to approximately page ${currentPage}
5. Do NOT include any chapter or content that begins after page ${currentPage}${fromPage > 0 ? `\n6. Do NOT include any chapter or content from before page ${rangeStart} — the reader already has a summary of that material` : ''}

Be thorough and detailed for the chapters you DO cover. Include all significant characters, plot developments, relationships, and themes that have been established. A rich, detailed extraction is valuable — just make sure every detail comes from ${fromPage > 0 ? `between pages ${rangeStart} and ${currentPage}` : `before page ${currentPage}`}.

Respond with a JSON object:
{
  "chapters_covered": ["<chapter name/number>", "..."],
  "key_events": ["<detailed event description>", "..."],
  "active_characters": ["<character name and their role so far>", "..."],
  "current_conflicts": "<unresolved tensions and open questions as of page ${currentPage}>",
  "mood": "<the emotional tone and atmosphere at this point in the story>"
}

Respond with ONLY the JSON object. No markdown, no code fences, no extra text.`
}

// ---- Pass 2: Generate recap from ONLY the extracted content ----
const buildRecapPrompt = () => `You are a reading companion called The Chronicler. You will receive a structured summary of what a reader has read so far. Your job is to turn this into a warm, engaging three-part briefing.

IMPORTANT: You must use ONLY the information provided in the extracted content below. Do NOT add any details from your own knowledge of the book. Do NOT reference events, characters, or developments that are not explicitly listed in the provided content. If the provided content seems incomplete, that is intentional - the reader has not reached those parts yet.

OUTPUT FORMAT - MANDATORY:
Respond with a raw JSON object ONLY. No markdown, no code fences, no backticks, no commentary.
{
  "memory_jogger": "<2-4 sentences, MAX 600 characters including spaces. Focus on the most important plot developments only.>",
  "concept_watchlist": "<comma-separated, MAX 13 items. Include ONLY main characters central to the plot and key locations where major events take place. No secondary locations.>",
  "thematic_bridge": "<1-2 sentences on the current mood and tensions, based ONLY on the extracted content>"
}`

// ---- Passport Summary: narrative prompt for completed book ----
const buildPassportSummaryPrompt = (title: string, author: string) =>
  `You are a book chronicler celebrating a reader's completion of "${title}" by ${author}. Write a flowing, personal narrative summary of this book for the reader who has just finished it.

The summary should:
- Be a single cohesive paragraph of 200–400 words
- Cover the full arc of the story from beginning to end
- Highlight the most memorable moments, characters, and themes
- Capture the emotional journey and what made this book special
- Feel warm and celebratory — this reader just finished a book!
- No spoiler constraints — they have read the entire book

Write ONLY the narrative paragraph. No JSON, no headings, no bullet points, no extra text.`

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Manual JWT decode — verify_jwt: false in config.toml (ES256 compatibility)
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const jwt = authHeader.replace(/^Bearer\s+/i, "")
    let userId: string | undefined
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]))
      userId = payload.sub
    } catch {
      // malformed token
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Supabase client for RLS-gated operations (if needed)
    const _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { title, author, isbn, percentage, currentPage, totalPages, mode, from_page } = await req.json()

    if (!title || !author || percentage === undefined || !totalPages) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")
    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const isbnLine = isbn ? `ISBN: ${isbn}\n` : ''

    // ========== passport_summary mode: narrative paragraph for completed book ==========
    if (mode === 'passport_summary') {
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: `Write the reading journey narrative for "${title}" by ${author}.${isbn ? ` ISBN: ${isbn}.` : ''}` }] }],
        config: {
          systemInstruction: buildPassportSummaryPrompt(title, author),
          temperature: 0.8,
          maxOutputTokens: 4096,
        },
      })

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.text
              if (text) controller.enqueue(encoder.encode(text))
            }
            controller.close()
          } catch (err) {
            console.error("Passport summary stream error:", err)
            controller.error(err)
          }
        },
      })

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
      })
    }

    // ========== PASS 1: Extract content for the given page range ==========
    // from_page = start of delta range (0 means full book from page 1)
    const fromPage = typeof from_page === 'number' ? from_page : 0

    const rangeStart = fromPage > 0 ? fromPage + 1 : 1
    const extractionMessage = fromPage > 0
      ? `Book: "${title}" by ${author}
${isbnLine}Total pages: ${totalPages}
Reader progress: page ${currentPage} of ${totalPages} (${percentage}%).

List ONLY what happens in pages ${rangeStart} through ${currentPage}. Do NOT include events before page ${rangeStart} and nothing after page ${currentPage}.`
      : `Book: "${title}" by ${author}
${isbnLine}Total pages: ${totalPages}
Reader progress: page ${currentPage} of ${totalPages} (${percentage}%).

List ONLY what happens in pages 1 through ${currentPage}. Nothing after page ${currentPage}.`

    const extractionResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: extractionMessage }] }],
      config: {
        systemInstruction: buildExtractionPrompt(fromPage, currentPage, totalPages),
        temperature: 0.4,
        maxOutputTokens: 8192, // increased from 4096 to prevent truncation on large books
      },
    })

    const rawExtraction = extractionResult.text ?? ''
    let extractedContent = rawExtraction.trim()
    const fenceMatch = extractedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) extractedContent = fenceMatch[1].trim()

    // Validate JSON, fall back to raw text
    try { JSON.parse(extractedContent) } catch { extractedContent = rawExtraction }

    // ========== PASS 2: Generate recap from extracted content ==========
    const recapMessage = `Here is the extracted content${fromPage > 0 ? ` from pages ${rangeStart} to ${currentPage}` : ` from pages 1 to ${currentPage}`} of "${title}" by ${author}:

${extractedContent}

Generate the three-part briefing using ONLY the characters, events, and details listed above. Do NOT add anything from your own knowledge of the book that is not in the extracted content.`

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: recapMessage }] }],
      config: {
        systemInstruction: buildRecapPrompt(),
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text
            if (text) controller.enqueue(encoder.encode(text))
          }
          controller.close()
        } catch (err) {
          console.error("Stream error:", err)
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    })
  } catch (err) {
    console.error("Edge function error:", err)
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
