// deno-lint-ignore-file no-explicit-any
// 016 — generate-reading-dna (simplified)
// Receives the user's finished book list, returns a structured DNA payload.
// The client UPSERTs the result into public.reading_dna.
import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

const SYSTEM_PROMPT = `You are a Technical Narrative Critic and Literary Curator. Your expertise lies in the "Great Books" tradition, hard-world-building, and unflinching moral realism. Your task is to analyze a reader's finished book list and provide a psychological reading profile with recommendations.

OUTPUT CONSTRAINTS:
1. PERSONALITY: 2-3 sentences (50-800 chars). Address the reader as "You...". Analyze their taste through the lens of intellectual rigor and an appetite for "Heavy" or "Unflinching" narratives.
2. MOODSIGNATURE.TONE: Exactly ONE word (e.g., "Sovereign," "Steeled," "Grounded," "Epic," "Stoic").
3. MOODSIGNATURE.EMOJIS: Exactly 3 glyphs (e.g., ⚔️, 🏛️, 🏔️).
4. SUGGESTIONS: 3-5 REAL, books. 
5. REASON: One sentence explaining the book's "Technical Craft" or "Structural Weight" as it relates to the user's list.

OUTPUT FORMAT: Strict JSON only. No prose outside the JSON. No markdown fences.

{
  "personality": "...",
  "moodSignature": { "tone": "...", "emojis": ["x","y","z"] },
  "suggestions": [
    { "title": "...", "author": "...", "reason": "..." }
  ]
}`;

interface DnaRequest {
  books: { title: string; author: string }[];
}

const validateBody = (body: any): body is DnaRequest =>
  body && Array.isArray(body.books) && body.books.length >= 1;

const extractJson = (text: string): string | null => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
};

const validateAndNormalise = (parsed: any) => {
  if (!parsed || typeof parsed !== "object") return null;
  const personality = String(parsed.personality ?? "").trim();
  if (personality.length < 50 || personality.length > 800) return null;
  const moodTone = String(parsed.moodSignature?.tone ?? "").trim();
  if (moodTone.length < 1 || moodTone.length > 40) return null;
  const moodEmojis = Array.isArray(parsed.moodSignature?.emojis)
    ? parsed.moodSignature.emojis
        .filter((e: any) => typeof e === "string")
        .slice(0, 5)
    : [];
  if (moodEmojis.length < 1) return null;
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
    : [];
  const cleanSuggestions = suggestions
    .filter(
      (s: any) =>
        s &&
        typeof s.title === "string" &&
        typeof s.author === "string" &&
        typeof s.reason === "string",
    )
    .map((s: any) => ({
      title: s.title.trim(),
      author: s.author.trim(),
      reason: s.reason.trim(),
    }))
    .slice(0, 5);
  if (cleanSuggestions.length < 3) return null;
  return {
    personality,
    moodSignature: { tone: moodTone, emojis: moodEmojis },
    suggestions: cleanSuggestions,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const claims = token ? decodeJwt(token) : null;
  if (!claims?.sub) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!validateBody(body)) {
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ai_unavailable" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bookList = body.books
    .map(
      (b: { title: string; author: string }) => `- "${b.title}" by ${b.author}`,
    )
    .join("\n");

  const userMessage = `FINISHED BOOKS:\n${bookList}\n\nGenerate the reader's Reading DNA per the system prompt's output shape. JSON only.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.85,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
    });

    const rawText = response.text ?? "";
    const jsonStr = extractJson(rawText);
    if (!jsonStr) {
      console.error(
        "[generate-reading-dna] no json block; raw:",
        rawText.slice(0, 500),
      );
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = validateAndNormalise(parsed);
    if (!result) {
      console.error(
        "[generate-reading-dna] shape invalid:",
        JSON.stringify(parsed),
      );
      return new Response(JSON.stringify({ error: "ai_unavailable" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ...result,
        booksFinishedAtGeneration: body.books.length,
        generatedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[generate-reading-dna] unhandled:", err);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
