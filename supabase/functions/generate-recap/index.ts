// deno-lint-ignore-file no-explicit-any
// Thin HTTP entrypoint for the generate-recap edge function.
// All business logic lives in the handlers/ directory.

import { corsHeaders, handleOptions } from "./cors.ts"
import { requireUser } from "../_shared/auth.ts"
import { internalErrorBody } from "../_shared/errors.ts"
import { createGeminiClient } from "./aiClient.ts"
import { createOpenAIClient } from "./openaiClient.ts"
import { resolveMode } from "./router.ts"
import { handleBlurb } from "./handlers/blurb.ts"
import { handlePassport } from "./handlers/passport.ts"
import { handleRecap } from "./handlers/recap.ts"
import { handleRecapImage } from "./handlers/recapImage.ts"
import type { RecapImageRequestBody, RequestBody } from "./types.ts"

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req)
  if (preflight) return preflight

  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed" })
    }

    // ── Auth ────────────────────────────────────────────────────────────────
    // Verified by Supabase Auth (signature + expiry), never decoded locally.
    if (!req.headers.get("Authorization")) {
      return jsonResponse(401, { error: "No authorization header" })
    }

    const userId = await requireUser(req)
    if (!userId) {
      return jsonResponse(401, { error: "Unauthorized" })
    }

    // ── Body validation ─────────────────────────────────────────────────────
    let body: RequestBody | RecapImageRequestBody
    try {
      body = (await req.json()) as RequestBody | RecapImageRequestBody
    } catch {
      return jsonResponse(400, { error: "invalid_input" })
    }
    if (!body || typeof body !== "object") {
      return jsonResponse(400, { error: "invalid_input" })
    }

    if (body.mode === "recap_image") {
      const imageBody = body as RecapImageRequestBody
      if (!imageBody.recapId || !imageBody.title || !imageBody.memoryJogger) {
        return jsonResponse(400, { error: "Missing required image fields" })
      }
    } else if (!body.title || !body.author || body.percentage === undefined || !body.totalPages) {
      return jsonResponse(400, { error: "Missing required fields" })
    }

    // ── AI client ───────────────────────────────────────────────────────────
    const ai = createGeminiClient()
    if (!ai) {
      return jsonResponse(503, { error: "AI service not configured" })
    }

    const openai = body.mode === "recap_image" ? createOpenAIClient() : null
    if (body.mode === "recap_image" && !openai) {
      return jsonResponse(503, { error: "OpenAI image service not configured" })
    }

    // ── Dispatch ────────────────────────────────────────────────────────────
    const mode = resolveMode(body as RequestBody)
    switch (mode) {
      case "passport_summary": return await handlePassport(ai, body as RequestBody)
      case "blurb":             return await handleBlurb(ai, body as RequestBody)
      case "recap":             return await handleRecap(ai, body as RequestBody)
      case "recap_image":        return await handleRecapImage(ai, openai!, body as RecapImageRequestBody, userId)
    }
  } catch (err) {
    return jsonResponse(500, internalErrorBody("generate-recap", err))
  }
})

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
