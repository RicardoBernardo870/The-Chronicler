import { describe, it, expect, vi } from 'vitest'
import { createRetryingFetch } from '@/services/retryingFetch'

const REST_URL = 'https://project.supabase.co/rest/v1/rpc/get_library_with_progress'
const AUTHED = { headers: { Authorization: 'Bearer token', apikey: 'anon' } }

const responder = (...statuses: number[]) => {
  const fetchImpl = vi.fn(async () =>
    new Response(null, { status: statuses.shift() ?? 200 }),
  )
  return fetchImpl as unknown as typeof fetch & { mock: { calls: unknown[] } }
}

const build = (fetchImpl: typeof fetch, onPersistentAuthFailure = vi.fn()) => ({
  doFetch: createRetryingFetch({ fetchImpl, onPersistentAuthFailure, delayMs: 0 }),
  onPersistentAuthFailure,
})

describe('retryingFetch — transient PostgREST 401 on cold start', () => {
  it('retries once and returns the successful retry', async () => {
    const fetchImpl = responder(401, 200)
    const { doFetch, onPersistentAuthFailure } = build(fetchImpl)

    const res = await doFetch(REST_URL, AUTHED)

    expect(res.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // The flake clears on the retry — the user must not be warned.
    expect(onPersistentAuthFailure).not.toHaveBeenCalled()
  })

  it('warns when the retry is still 401', async () => {
    const fetchImpl = responder(401, 401)
    const { doFetch, onPersistentAuthFailure } = build(fetchImpl)

    const res = await doFetch(REST_URL, AUTHED)

    expect(res.status).toBe(401)
    expect(onPersistentAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('does not retry a successful request', async () => {
    const fetchImpl = responder(200)
    const { doFetch } = build(fetchImpl)

    await doFetch(REST_URL, AUTHED)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('leaves a genuine signed-out 401 alone when no token was sent', async () => {
    const fetchImpl = responder(401, 200)
    const { doFetch, onPersistentAuthFailure } = build(fetchImpl)

    const res = await doFetch(REST_URL, { headers: { apikey: 'anon' } })

    expect(res.status).toBe(401)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(onPersistentAuthFailure).not.toHaveBeenCalled()
  })

  it('does not retry non-Data-API requests', async () => {
    const fetchImpl = responder(401, 200)
    const { doFetch } = build(fetchImpl)

    const res = await doFetch('https://project.supabase.co/auth/v1/token', AUTHED)

    expect(res.status).toBe(401)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('replays the body when called with a Request object', async () => {
    const fetchImpl = responder(401, 200)
    const { doFetch } = build(fetchImpl)

    const request = new Request(REST_URL, {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ p_user: 'abc' }),
    })
    const res = await doFetch(request)

    expect(res.status).toBe(200)
    const replayed = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[1][0] as Request
    expect(await replayed.text()).toBe(JSON.stringify({ p_user: 'abc' }))
  })
})
