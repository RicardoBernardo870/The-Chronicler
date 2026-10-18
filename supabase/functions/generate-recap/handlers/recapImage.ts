// deno-lint-ignore-file no-explicit-any
import { createClient } from "@supabase/supabase-js"
import { corsHeaders } from "../cors.ts"
import { handleImageGeneration } from "./image.ts"
import type { RecapImageRequestBody } from "../types.ts"
import type { OpenAIClient } from "../openaiClient.ts"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const handleRecapImage = async (
  ai: any,
  openai: OpenAIClient,
  body: RecapImageRequestBody,
  userId: string,
): Promise<Response> => {
  const admin = createSupabaseAdmin()
  if (!admin) {
    return jsonResponse(503, { error: "Supabase admin client not configured" })
  }

  // Ownership before cost: the service-role client below writes to this recap
  // and to recap-images/{userId}/, so the caller must own the recap.
  if (!UUID_RE.test(String(body.recapId))) {
    return jsonResponse(404, { error: "recap_not_found" })
  }
  const { data: owned, error: ownErr } = await admin
    .from("recaps")
    .select("id")
    .eq("id", body.recapId)
    .eq("user_id", userId)
    .maybeSingle()
  if (ownErr) throw ownErr
  if (!owned) {
    return jsonResponse(404, { error: "recap_not_found" })
  }

  waitUntil(handleImageGeneration(admin, ai, openai, {
    recapId: body.recapId,
    userId,
    bookTitle: body.title,
    bookAuthor: body.author,
    bookGenre: body.genre,
    memoryJogger: body.memoryJogger,
    pageRange: typeof body.currentPage === "number"
      ? { fromPage: body.fromPage ?? 0, toPage: body.currentPage }
      : undefined,
    textStageDurationMs: body.textStageDurationMs,
  }))

  return jsonResponse(202, { status: "accepted" })
}

const createSupabaseAdmin = () => {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return null

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

const waitUntil = (promise: Promise<unknown>) => {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime
  if (runtime?.waitUntil) {
    runtime.waitUntil(promise)
    return
  }
  promise.catch((err) => console.error("Background task failed:", err))
}

const jsonResponse = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
