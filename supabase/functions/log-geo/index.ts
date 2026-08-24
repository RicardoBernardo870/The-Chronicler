// deno-lint-ignore-file no-explicit-any
// log-geo — silent coarse geolocation for activity_logs.
// Given an app_open row id, derives approximate location from the request IP
// (server-side, so no browser permission prompt) and merges it into that row's
// metadata.geo. Writes with the service role but scopes every statement to the
// caller's own row; only the tracked account is enriched. Best-effort: any
// failure is a quiet no-op so telemetry never breaks the client.
//
// TRACKED_USER_IDS below must stay in sync with
// src/composables/useActivityLog.ts.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TRACKED_USER_IDS = new Set(["f817241e-f331-421c-b1a8-8147da346e9d"]);

const decodeJwt = (token: string): Record<string, any> | null => {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clientIp = (req: Request): string | null => {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
};

// Skip loopback / RFC-1918 private ranges — they never geolocate to anything.
const isPublicIp = (ip: string): boolean =>
  !!ip &&
  !ip.startsWith("10.") &&
  !ip.startsWith("192.168.") &&
  !ip.startsWith("127.") &&
  !ip.startsWith("::1") &&
  ip !== "::" &&
  !/^172\.(1[6-9]|2\d|3[01])\./.test(ip) &&
  !ip.startsWith("fc") &&
  !ip.startsWith("fd");

interface Geo {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  org?: string;
  timezone?: string;
  source: string;
}

const lookupGeo = async (ip: string): Promise<Geo | null> => {
  try {
    const res = await fetch(`https://ipwho.is/${ip}`);
    if (!res.ok) return null;
    const d: any = await res.json();
    if (d?.success === false) return null;
    return {
      ip,
      city: d.city ?? undefined,
      region: d.region ?? undefined,
      country: d.country ?? undefined,
      countryCode: d.country_code ?? undefined,
      latitude: typeof d.latitude === "number" ? d.latitude : undefined,
      longitude: typeof d.longitude === "number" ? d.longitude : undefined,
      org: d.connection?.isp ?? d.connection?.org ?? undefined,
      timezone: d.timezone?.id ?? undefined,
      source: "ipwho.is",
    };
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const claims = token ? decodeJwt(token) : null;
  const uid = typeof claims?.sub === "string" ? claims.sub : null;
  if (!uid) return json({ error: "unauthorized" }, 401);
  // Only the tracked account is enriched; anyone else is a silent no-op.
  if (!TRACKED_USER_IDS.has(uid)) return json({ ok: true, skipped: "not_tracked" });

  let body: { rowId?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const rowId = typeof body.rowId === "string" ? body.rowId : null;
  if (!rowId) return json({ error: "invalid_input" }, 400);

  const ip = clientIp(req);
  if (!ip || !isPublicIp(ip)) return json({ ok: true, skipped: "no_public_ip" });

  const geo = await lookupGeo(ip);
  if (!geo) return json({ ok: true, skipped: "lookup_failed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "server_misconfigured" }, 500);
  }

  const sb = createClient(supabaseUrl, serviceKey);

  // Merge geo into the row's existing metadata, scoped to the caller's own row.
  const { data: row } = await sb
    .from("activity_logs")
    .select("metadata")
    .eq("id", rowId)
    .eq("user_id", uid)
    .maybeSingle();

  const merged = {
    ...((row?.metadata as Record<string, unknown> | null) ?? {}),
    geo,
  };

  const { error } = await sb
    .from("activity_logs")
    .update({ metadata: merged })
    .eq("id", rowId)
    .eq("user_id", uid);

  if (error) return json({ error: "update_failed" }, 500);
  return json({ ok: true, geo });
});
