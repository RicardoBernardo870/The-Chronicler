import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GoogleGenAI } from "npm:@google/genai"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const buildSystemPrompt = (percentage: number, currentPage: number) => `You are a reading companion for The Chronicler app. Your job is to produce a spoiler-free three-part briefing for a reader returning to a book.

EDITION CONTEXT:
If an ISBN is provided, use it to identify the exact edition of the book and its specific page layout. This improves your accuracy in determining what content falls within the reader's progress.

SPOILER RULE — ABSOLUTE AND NON-NEGOTIABLE:
- The reader has read ONLY the first ${percentage}% of this book (up to page ${currentPage}). They have NOT read anything beyond this point.
- You MUST cover ONLY events, characters, and concepts that appear in the first ${percentage}% of the book.
- Do NOT mention any character, plot point, death, revelation, alliance, betrayal, or twist that occurs AFTER page ${currentPage}.
- If you are even slightly uncertain whether something falls before or after page ${currentPage}, OMIT IT ENTIRELY. Err on the side of less information.
- Being conservative is the only correct choice. A spoiler destroys the reading experience; omitting something that was already revealed does not.
- If the reader is at 0%, provide only a back-cover level introduction with no plot details.

OUTPUT FORMAT — CRITICAL:
Respond with a raw JSON object ONLY. No markdown code fences, no backticks, no extra text before or after.
{
  "memory_jogger": "<2-4 sentence summary of only what has happened up to page ${currentPage}>",
  "concept_watchlist": "<comma-separated list of characters and concepts active as of page ${currentPage}>",
  "thematic_bridge": "<1-2 sentences on the current mood and where things seem headed, based only on what has been read>"
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

    const isbnLine = isbn ? `ISBN: ${isbn} (use this to identify the exact edition and its page layout)\n` : ''
    const userMessage = `Book: "${title}" by ${author}
${isbnLine}Reader progress: ${percentage}% complete — page ${currentPage} of ${totalPages}.
REMINDER: Only summarise content from pages 1–${currentPage}. Do NOT reference anything after page ${currentPage}.
Generate the briefing now.`

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: buildSystemPrompt(percentage, currentPage),
        temperature: 1,
        maxOutputTokens: 8192,
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
