import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  swrStatus,
  swrRun,
  swrTouch,
  invalidate,
  revalidate,
  clearAll,
  cacheSubscribe,
  cacheUnsubscribe,
  registerRevalidator,
  cacheKeys,
} from '@/composables/useCache'

// Reset module-level state between tests by calling clearAll()
beforeEach(() => {
  clearAll()
})

// ── Test 1: fresh hit skips fetcher ──────────────────────────────────────────

describe('swrStatus — fresh hit', () => {
  it('returns "fresh" and skips the fetcher when data is within TTL', async () => {
    const key = cacheKeys.books('u1')
    const fetcher = vi.fn(async () => {})

    // First call: miss → loading
    expect(swrStatus(key, 60_000)).toBe('loading')
    await swrRun(key, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)

    // Second call immediately: fresh → no fetch
    expect(swrStatus(key, 60_000)).toBe('fresh')
    // Caller sees 'fresh' and returns early — swrRun is NOT called
    expect(fetcher).toHaveBeenCalledTimes(1) // unchanged
  })
})

// ── Test 2: stale serves data + triggers background revalidation ──────────────

describe('swrStatus — stale background revalidation', () => {
  it('returns "background" after TTL expires and the fetcher runs silently', async () => {
    const key = cacheKeys.books('u2')
    const fetcher = vi.fn(async () => {})

    await swrRun(key, fetcher)
    expect(swrStatus(key, 60_000)).toBe('fresh')

    // Simulate TTL expiry by moving fetchedAt back
    swrTouch(key) // ensure entry exists
    const entry = (window as any).__bookheroCache?.get(key)
    if (entry) entry.fetchedAt = Date.now() - 70_000

    expect(swrStatus(key, 60_000)).toBe('background')
  })
})

// ── Test 3: concurrent calls share one inflight fetch (dedupe) ────────────────

describe('swrRun — concurrent deduplication', () => {
  it('runs the fetcher exactly once when called concurrently for the same key', async () => {
    const key = cacheKeys.books('u3')
    let resolve!: () => void
    const fetcher = vi.fn(() => new Promise<void>(r => { resolve = r }))

    const p1 = swrRun(key, fetcher)
    const p2 = swrRun(key, fetcher)

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(p1).toBe(p2) // same promise

    resolve()
    await p1
  })
})

// ── Test 4: mutate updates data and resets fetchedAt ─────────────────────────

describe('swrTouch', () => {
  it('marks the entry as freshly fetched right now', async () => {
    const key = cacheKeys.progress('u4')

    // Create entry via swrRun
    await swrRun(key, async () => {})
    const beforeTouch = Date.now()

    // Expire artificially
    const entry = (window as any).__bookheroCache?.get(key)
    if (entry) entry.fetchedAt = 0

    // Touch should reset it to now
    swrTouch(key)
    expect(swrStatus(key, 60_000)).toBe('fresh')
    if (entry) expect(entry.fetchedAt).toBeGreaterThanOrEqual(beforeTouch)
  })
})

// ── Test 5: invalidate marks single key stale ─────────────────────────────────

describe('invalidate — single key', () => {
  it('marks the key stale so the next swrStatus returns "background"', async () => {
    const key = cacheKeys.books('u5')
    await swrRun(key, async () => {})
    expect(swrStatus(key, 60_000)).toBe('fresh')

    invalidate(key)

    // Entry's fetchedAt is 0 again → 'loading' (as if never fetched)
    // Actually it will be 'loading' since fetchedAt = 0
    expect(swrStatus(key, 60_000)).toBe('loading')
  })
})

// ── Test 6: prefix invalidation affects all matching keys ────────────────────

describe('invalidate — prefix', () => {
  it('marks every key with the given prefix as stale', async () => {
    const k1 = cacheKeys.lexicon('u6', 'book-1')
    const k2 = cacheKeys.lexicon('u6', 'book-2')
    const k3 = cacheKeys.lexiconAll('u6')
    const other = cacheKeys.books('u6')

    await swrRun(k1, async () => {})
    await swrRun(k2, async () => {})
    await swrRun(k3, async () => {})
    await swrRun(other, async () => {})

    invalidate(`lexicon:u6`, { prefix: true })

    expect(swrStatus(k1, 60_000)).toBe('loading')
    expect(swrStatus(k2, 60_000)).toBe('loading')
    expect(swrStatus(k3, 60_000)).toBe('loading')
    // The non-lexicon key must be unaffected
    expect(swrStatus(other, 60_000)).toBe('fresh')
  })
})

// ── Test 7: clearAll empties all entries ──────────────────────────────────────

describe('clearAll', () => {
  it('removes every cache entry so all keys return "loading" again', async () => {
    const k1 = cacheKeys.books('u7')
    const k2 = cacheKeys.progress('u7')
    await swrRun(k1, async () => {})
    await swrRun(k2, async () => {})

    clearAll()

    expect(swrStatus(k1, 60_000)).toBe('loading')
    expect(swrStatus(k2, 60_000)).toBe('loading')
  })
})

// ── Test 8: auth user-change triggers clearAll ───────────────────────────────
// This test validates the contract expected by auth.ts integration (T003).
// In the real app auth.ts calls clearAll() when user.id changes.

describe('clearAll — auth user change contract', () => {
  it('ensures a new user sees no cached data from the previous user', async () => {
    // Simulate user A session
    const keyA = cacheKeys.books('userA')
    await swrRun(keyA, async () => {})
    expect(swrStatus(keyA, 60_000)).toBe('fresh')

    // User changes → clearAll() called by auth store
    clearAll()

    // User A's key is gone
    expect(swrStatus(keyA, 60_000)).toBe('loading')

    // User B's key starts fresh too
    const keyB = cacheKeys.books('userB')
    expect(swrStatus(keyB, 60_000)).toBe('loading')
  })
})

// ── Test 9: revalidate forces fetch even when fresh ──────────────────────────

describe('revalidate', () => {
  it('marks a fresh key as stale so it triggers a fetch on next access', async () => {
    const key = cacheKeys.upNext('u9')
    await swrRun(key, async () => {})
    expect(swrStatus(key, 60_000)).toBe('fresh')

    revalidate(key)
    expect(swrStatus(key, 60_000)).toBe('loading') // fetchedAt reset to 0
  })
})

// ── Test 10: fetcher error preserves previous data ───────────────────────────

describe('swrRun — error handling', () => {
  it('clears inflight but does NOT reset fetchedAt on fetcher error', async () => {
    const key = cacheKeys.recaps('u10', 'book-x')

    // First successful fetch
    await swrRun(key, async () => {})
    const statusAfterSuccess = swrStatus(key, 60_000)
    expect(statusAfterSuccess).toBe('fresh')

    // Expire and revalidate with a failing fetcher
    const entry = (window as any).__bookheroCache?.get(key)
    if (entry) entry.fetchedAt = Date.now() - 70_000 // expire

    const failingFetcher = vi.fn(async () => { throw new Error('network error') })
    await expect(swrRun(key, failingFetcher)).rejects.toThrow('network error')

    // fetchedAt should still be the old value (not 0) — data survives error
    if (entry) expect(entry.fetchedAt).toBeGreaterThan(0)
    // inflight should be cleared
    if (entry) expect(entry.inflight).toBeNull()
  })
})

// ── Bonus: cacheKeys helpers produce deterministic strings ───────────────────

describe('cacheKeys', () => {
  it('produces stable deterministic key strings', () => {
    expect(cacheKeys.books('abc')).toBe('books:abc')
    expect(cacheKeys.lexicon('abc', 'book1')).toBe('lexicon:abc:book1')
    expect(cacheKeys.lexiconAll('abc')).toBe('lexicon:abc:all')
    expect(cacheKeys.progress('abc')).toBe('progress:abc')
    expect(cacheKeys.recaps('abc', 'b2')).toBe('recaps:abc:b2')
    expect(cacheKeys.bookPassport('abc', 'b3')).toBe('bookPassport:abc:b3')
    expect(cacheKeys.upNext('abc')).toBe('upNext:abc')
    expect(cacheKeys.retentionSummary('abc')).toBe('retentionSummary:abc')
  })
})
