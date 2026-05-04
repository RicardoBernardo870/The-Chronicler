// deno-lint-ignore-file no-explicit-any
// Thin HTTP entrypoint for the generate-recap edge function.
// All business logic lives in the handlers/ directory.

import { corsHeaders, handleOptions } from "./cors.ts"
import { manualJwtDecode } from "./auth.ts"
import { createGeminiClient } from "./aiClient.ts"
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
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse(401, { error: "No authorization header" })
    }

    const userId = manualJwtDecode(authHeader)
    if (!userId) {
      return jsonResponse(401, { error: "Unauthorized" })
    }

    // ── Body validation ─────────────────────────────────────────────────────
    const body = (await req.json()) as RequestBody | RecapImageRequestBody
    if (body.mode === "recap_image") {
      if (!body.recapId || !body.title || !body.memoryJogger) {
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

    // ── Dispatch ────────────────────────────────────────────────────────────
    const mode = resolveMode(body as RequestBody)
    switch (mode) {
      case "passport_summary": return await handlePassport(ai, body as RequestBody)
      case "blurb":             return await handleBlurb(ai, body as RequestBody)
      case "recap":             return await handleRecap(ai, body as RequestBody)
      case "recap_image":        return await handleRecapImage(ai, body as RecapImageRequestBody, userId)
    }
  } catch (err) {
    console.error("Edge function error:", err)
    return jsonResponse(500, { error: "Internal server error", detail: String(err) })
  }
})

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
