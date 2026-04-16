// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ---- Pass 1: Extract ONLY what happens in pages 1-N ----
const buildExtractionPrompt = (currentPage: number, totalPages: number) => `You are a literary analyst. Your task is to recall the content of a specific book and produce a detailed summary of ONLY the first ${currentPage} pages (out of ${totalPages} total).

METHODOLOGY - FOLLOW THIS STEP BY STEP:
1. Reconstruct the book's chapter structure
2. Identify which chapters fall within pages 1 to ${currentPage}
3. For each of those chapters, describe the key events and which characters are involved
4. STOP at the chapter that contains page ${currentPage} — include content from that chapter only up to approximately page ${currentPage}
5. Do NOT include any chapter or content that begins after page ${currentPage}

Be thorough and detailed for the chapters you DO cover. Include all significant characters, plot developments, relationships, and themes that have been established. A rich, detailed extraction is valuable — just make sure every detail comes from before page ${currentPage}.

Respond with a JSON object:
{
  "chapters_covered": ["<chapter name/number>", "..."],
  "key_events": ["<detailed event description>", "..."],
  "active_characters": ["<character name and their role so far>", "..."],
  "current_conflicts": "<unresolved tensions and open questions as of page ${currentPage}>",
  "mood": "<the emotional tone and atmosphere at this point in the story>"
}

Respond with ONLY the JSON object. No markdown, no code fences, no extra text.`

// ---- Pass 2: Generate recap from ONLY the extracted content ----
const buildRecapPrompt = () => `You are a reading companion called The Chronicler. You will receive a structured summary of what a reader has read so far. Your job is to turn this into a warm, engaging three-part briefing.

IMPORTANT: You must use ONLY the information provided in the extracted content below. Do NOT add any details from your own knowledge of the book. Do NOT reference events, characters, or developments that are not explicitly listed in the provided content. If the provided content seems incomplete, that is intentional - the reader has not reached those parts yet.

OUTPUT FORMAT - MANDATORY:
Respond with a raw JSON object ONLY. No markdown, no code fences, no backticks, no commentary.
{
  "memory_jogger": "<2-4 sentences summarizing the key events from the extracted content>",
  "concept_watchlist": "<comma-separated list of characters and concepts from the extracted content>",
  "thematic_bridge": "<1-2 sentences on the current mood and tensions, based ONLY on the extracted content>"
}`

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { title, author, isbn, percentage, currentPage, totalPages } = await req.json()

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

    // ========== PASS 1: Extract content up to current page ==========
    const extractionMessage = `Book: "${title}" by ${author}
${isbnLine}Total pages: ${totalPages}
Reader progress: page ${currentPage} of ${totalPages} (${percentage}%).

List ONLY what happens in pages 1 through ${currentPage}. Nothing after page ${currentPage}.`

    const extractionResult = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: extractionMessage }] }],
      config: {
        systemInstruction: buildExtractionPrompt(currentPage, totalPages),
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    })

    const rawExtraction = extractionResult.text ?? ''

    // Clean up the extraction (strip fences if present)
    let extractedContent = rawExtraction.trim()
    const fenceMatch = extractedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) extractedContent = fenceMatch[1].trim()

    // Validate JSON, fall back to raw text
    try {
      JSON.parse(extractedContent)
    } catch {
      extractedContent = rawExtraction
    }

    // ========== PASS 2: Generate recap from extracted content only ==========
    const recapMessage = `Here is the extracted content from pages 1 to ${currentPage} of "${title}" by ${author}:

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
