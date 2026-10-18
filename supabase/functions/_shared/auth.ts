// Shared caller verification for edge functions (BC-02, E-1).
//
// The bearer token is verified by Supabase Auth (signature, expiry and that the
// user still exists) instead of being base64-decoded locally. This works with
// both the legacy HS256 secret and asymmetric signing keys, and rejects the
// anon key, forged, expired and foreign-project tokens.
//
// Imported with a full npm: specifier so functions without an import map
// (generate-lore) can use it too.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"

let authClient: SupabaseClient | null = null

const getAuthClient = (): SupabaseClient | null => {
  if (authClient) return authClient
  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !anonKey) return null
  authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return authClient
}

export const bearerToken = (req: Request): string | null => {
  const header = req.headers.get("Authorization")
  if (!header) return null
  const token = header.replace(/^Bearer\s+/i, "").trim()
  return token.length > 0 ? token : null
}

/**
 * Returns the verified caller's user id, or null when the request carries no
 * valid user session. Callers answer null with their existing 401 body.
 */
export const requireUser = async (req: Request): Promise<string | null> => {
  const token = bearerToken(req)
  if (!token) return null

  const client = getAuthClient()
  if (!client) {
    console.error("requireUser: SUPABASE_URL / SUPABASE_ANON_KEY not set")
    return null
  }

  try {
    const { data, error } = await client.auth.getUser(token)
    if (error || !data?.user?.id) return null
    return data.user.id
  } catch (err) {
    console.error("requireUser: verification failed", err)
    return null
  }
}
