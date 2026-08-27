import { notifyLoadFailure } from '@/composables/useLoadFailureNotice'

// ── Transient 401 retry ───────────────────────────────────────────────────────
// PostgREST intermittently rejects a *valid* access token with PGRST303
// ("JWT claims validation or parsing failed") when a burst of requests lands in
// the same moment the token is refreshed — i.e. every cold start after the app
// has been away longer than the token lifetime, which on iOS is most opens.
//
// The token is genuinely fine: gateway logs show the same JWT (same signature
// prefix, same session_id) succeeding on its sibling requests in the same
// second and again seconds later, with a full hour of validity left. Exactly
// one request per cold-start burst loses this race.
//
// supabase-js's built-in retry (v2.102+) covers 408/409/503/504 and network
// failures but NOT 401, so these fell through to the stores — most of which
// swallow the error and render an empty section until the user reloads.
// One short retry clears it.

export const RETRY_DELAY_MS = 400

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

const hasUserToken = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  )
  return Boolean(headers.get('Authorization'))
}

export interface RetryingFetchOptions {
  fetchImpl?: typeof fetch
  onPersistentAuthFailure?: () => void
  delayMs?: number
}

export const createRetryingFetch = (
  options: RetryingFetchOptions = {},
): typeof fetch => {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
  const onPersistentAuthFailure = options.onPersistentAuthFailure ?? notifyLoadFailure
  const delayMs = options.delayMs ?? RETRY_DELAY_MS

  return async (input, init) => {
    // A Request body can only be read once — clone before the first attempt so
    // the retry has an intact body to send.
    const replay = input instanceof Request ? input.clone() : null

    const response = await fetchImpl(input, init)
    if (response.status !== 401) return response

    // Data API only. A 401 with no Authorization header is a real "signed out",
    // not the flake — retrying that would just fail again and warn spuriously.
    if (!requestUrl(input).includes('/rest/v1/')) return response
    if (!hasUserToken(input, init)) return response

    await new Promise((resolve) => setTimeout(resolve, delayMs))
    const retried = await fetchImpl(replay ?? input, init)
    // Only warn when the retry is *still* 401 — the flake clears on the retry,
    // so a healthy cold start stays silent.
    if (retried.status === 401) onPersistentAuthFailure()
    return retried
  }
}
