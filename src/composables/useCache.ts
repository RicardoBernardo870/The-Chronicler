// ── SWR Cache Primitive ───────────────────────────────────────────────────────
// Stale-While-Revalidate pattern for Pinia stores.
// No external dependency — ~150 LOC, module-level singleton.
//
// Pattern in stores:
//   const status = swrStatus(key, TTL_MS)
//   if (status === 'fresh') return
//   const fetcher = async () => { /* update reactive state */ }
//   if (status === 'loading') { loading.value = true; await swrRun(key, fetcher); loading.value = false }
//   else swrRun(key, fetcher).catch(() => { /* silent background error */ })

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  fetchedAt: number          // epoch ms — 0 means never fetched
  ttlMs: number
  inflight: Promise<void> | null  // deduplicates concurrent calls
  subscriberCount: number    // >0 = page currently mounted; used by visibility handler
}

/** What the store should do next for a given key. */
export type SwrStatus = 'loading' | 'fresh' | 'background'

// ── Module-level state ────────────────────────────────────────────────────────

const entries = new Map<string, CacheEntry>()

// Registry: key → background-safe revalidation function registered by each store.
// Called by the visibilitychange handler for stale live keys (US3 / FR-013).
const _revalidators = new Map<string, () => void>()

const _stats = { hits: 0, misses: 0, revalidations: 0 }

// ── Internal helpers ──────────────────────────────────────────────────────────

const _getOrCreate = (key: string, ttlMs: number): CacheEntry => {
  let e = entries.get(key)
  if (!e) {
    e = { fetchedAt: 0, ttlMs, inflight: null, subscriberCount: 0 }
    entries.set(key, e)
  }
  return e
}

// ── Core API ──────────────────────────────────────────────────────────────────

/**
 * Check the cache state for a key.
 * - 'loading'    → no data yet; show a spinner / skeleton.
 * - 'fresh'      → data is within TTL; skip the fetch entirely.
 * - 'background' → data exists but is stale; serve it and revalidate in background.
 */
export const swrStatus = (key: string, ttlMs: number): SwrStatus => {
  const e = _getOrCreate(key, ttlMs)
  if (e.fetchedAt === 0) {
    _stats.misses++
    return 'loading'
  }
  if (Date.now() - e.fetchedAt <= e.ttlMs) {
    _stats.hits++
    return 'fresh'
  }
  _stats.revalidations++
  return 'background'
}

/**
 * Run a fetcher for `key`, deduplicating concurrent calls.
 * The fetcher should update reactive store state as a side-effect.
 * On success the cache entry's fetchedAt is set to now.
 */
export const swrRun = (key: string, fetcher: () => Promise<void>): Promise<void> => {
  const e = entries.get(key) ?? _getOrCreate(key, 60_000)
  if (e.inflight) return e.inflight

  const p = fetcher()
    .then(() => {
      const entry = entries.get(key)
      if (entry) {
        entry.fetchedAt = Date.now()
        entry.inflight = null
      }
    })
    .catch(err => {
      const entry = entries.get(key)
      if (entry) entry.inflight = null
      throw err
    })

  e.inflight = p
  return p
}

/**
 * Mark a key as freshly fetched right now (use after direct cache mutations
 * so the next SWR check sees 'fresh' instead of 'background').
 */
export const swrTouch = (key: string): void => {
  const e = entries.get(key)
  if (e) e.fetchedAt = Date.now()
}

/**
 * Mark one key (or all keys with a given prefix) as stale.
 * The next access will trigger a background revalidation.
 * Does NOT clear the reactive data — callers keep seeing it until new data arrives.
 */
export const invalidate = (keyOrPrefix: string, opts?: { prefix?: boolean }): void => {
  if (opts?.prefix) {
    for (const [k, e] of entries) {
      if (k.startsWith(keyOrPrefix)) e.fetchedAt = 0
    }
  } else {
    const e = entries.get(keyOrPrefix)
    if (e) e.fetchedAt = 0
  }
}

/**
 * Force-revalidate a key on next access regardless of freshness.
 * Enables pull-to-refresh / error-recovery without clearing data (FR-012).
 */
export const revalidate = (key: string): void => {
  const e = entries.get(key)
  if (e) e.fetchedAt = 0
}

/**
 * Clear every cache entry and cancel stat counters.
 * MUST be called when the authenticated user changes (FR-008 / SC-005).
 */
export const clearAll = (): void => {
  entries.clear()
  _revalidators.clear()
  _stats.hits = 0
  _stats.misses = 0
  _stats.revalidations = 0
}

// ── Subscriber tracking (US3 / FR-013) ───────────────────────────────────────

/** Increment subscriber count — call from onMounted in the store or page. */
export const cacheSubscribe = (key: string): void => {
  const e = entries.get(key)
  if (e) e.subscriberCount++
}

/** Decrement subscriber count — call from onUnmounted / onScopeDispose. */
export const cacheUnsubscribe = (key: string): void => {
  const e = entries.get(key)
  if (e && e.subscriberCount > 0) e.subscriberCount--
}

/**
 * Register a background-safe revalidation function for a key.
 * The visibility handler calls it when the tab refocuses and the key is stale.
 * Should be registered once at store initialisation (not per component).
 */
export const registerRevalidator = (key: string, fn: () => void): void => {
  _revalidators.set(key, fn)
}

// ── Visibility revalidation (US3 / FR-013) ───────────────────────────────────
// On tab refocus, revalidate any stale key that has ≥1 active subscriber or
// a registered revalidator — background-only, never blocks the UI.

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    for (const [key, entry] of entries) {
      const isStale = entry.fetchedAt > 0 && Date.now() - entry.fetchedAt > entry.ttlMs
      const isLive = entry.subscriberCount > 0 || _revalidators.has(key)
      if (isStale && isLive && !entry.inflight) {
        const fn = _revalidators.get(key)
        if (fn) {
          try { fn() } catch { /* visibility revalidation errors are always silent */ }
        }
      }
    }
  })
}

// ── Cache key helpers ─────────────────────────────────────────────────────────

export const cacheKeys = {
  books:           (uid: string)                  => `books:${uid}`,
  progress:        (uid: string)                  => `progress:${uid}`,
  lexicon:         (uid: string, bookId: string)  => `lexicon:${uid}:${bookId}`,
  lexiconAll:      (uid: string)                  => `lexicon:${uid}:all`,
  recaps:          (uid: string, bookId: string)  => `recaps:${uid}:${bookId}`,
  bookPassport:    (uid: string, bookId: string)  => `bookPassport:${uid}:${bookId}`,
  upNext:          (uid: string)                  => `upNext:${uid}`,
  lore:            (uid: string, bookId: string)  => `lore:${uid}:${bookId}`,
  loreAll:         (uid: string)                  => `lore:${uid}:all`,
  // 017 — RPC aggregate cache keys
  library:         (uid: string)                  => `library:${uid}`,
  readingStats:    (uid: string)                  => `readingStats:${uid}`,
  lastSession:     (uid: string)                  => `lastSession:${uid}`,
  libraryBreakdown:(uid: string)                  => `libraryBreakdown:${uid}`,
  // 019 — reading-velocity RPC: cached until a session ends or the page reloads
  velocity:        (uid: string)                  => `velocity:${uid}`,
} as const

// ── Dev-only observability (T004 / data-model.md § Observability) ─────────────

if (import.meta.env.DEV) {
  ;(window as typeof window & {
    __bookheroCache: {
      keys: () => string[]
      get: (k: string) => CacheEntry | undefined
      stats: () => { hits: number; misses: number; revalidations: number }
    }
  }).__bookheroCache = {
    keys:  ()  => [...entries.keys()],
    get:   (k) => entries.get(k),
    stats: ()  => ({ ..._stats }),
  }
}
