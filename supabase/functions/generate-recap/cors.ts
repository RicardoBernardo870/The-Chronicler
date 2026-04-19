export const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

/** Returns a preflight Response for OPTIONS, otherwise null. */
export const handleOptions = (req: Request): Response | null =>
  req.method === "OPTIONS"
    ? new Response("ok", { headers: corsHeaders })
    : null
