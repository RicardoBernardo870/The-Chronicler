# Contract: `useCache()` composable + store adoption

This file is the canonical interface description. Any deviation in implementation must update this file first.

## Public API — `src/composables/useCache.ts`

```ts
export interface CacheOptions {
  /** Freshness window in ms. Default: 60000 (lists) / 30000 (volatile) depending on caller. */
  ttlMs?: number
}

export interface CacheHandle<T> {
  /** Reactive data ref — undefined until first successful fetch. */
  data: Readonly<Ref<T | undefined>>
  /** Reactive status ref. */
  status: Readonly<Ref<'idle' | 'loading' | 'revalidating' | 'error'>>
  /** Reactive error ref (null when no error). */
  error: Readonly<Ref<Error | null>>
  /** True when data is undefined AND status is 'loading' — the ONLY time callers should render a full-page spinner. */
  isInitialLoading: Readonly<Ref<boolean>>
}

/**
 * Stale-While-Revalidate access.
 * - If no entry exists: triggers fetcher, sets status='loading', returns handle (data undefined until resolve).
 * - If entry exists and fresh: returns handle with cached data, no network call.
 * - If entry exists and stale: returns handle with cached data immediately, triggers background revalidation (status='revalidating').
 * - Concurrent calls for the same key share the single in-flight promise (dedupe).
 */
export const swr: <T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions,
) => CacheHandle<T>

/** Directly write a new value for `key`. Resets fetchedAt to now. Use after mutations that return the full entity. */
export const mutate: <T>(key: string, updater: T | ((current: T | undefined) => T)) => void

/** Mark `key` stale without clearing data. Next access triggers revalidation; current consumers keep seeing old data until new arrives. */
export const invalidate: (keyOrPrefix: string, options?: { prefix?: boolean }) => void

/** Clear every cache entry and cancel in-flight revalidations. Called by auth store on user change. */
export const clearAll: () => void

/** Force-revalidate `key` now (bypasses freshness). Returns the in-flight promise. Enables future pull-to-refresh UI. */
export const revalidate: <T>(key: string) => Promise<T | undefined>
```

### Guarantees

1. **Single source of truth**: every store that adopts this composable MUST expose its data via the returned `CacheHandle.data` ref (or a computed derived from it). No parallel `ref<Book[]>` that drifts from the cache.
2. **No spinner on warm navigation**: pages MUST check `isInitialLoading`, NOT `status === 'loading'`, when deciding whether to render a skeleton. A revalidating cache with `data` present is not "loading" for UX purposes.
3. **Deterministic keys**: callers build keys via helpers exported from `src/composables/useCache.ts`:
   ```ts
   export const cacheKeys = {
     books: (uid: string) => `books:${uid}`,
     progress: (uid: string) => `progress:${uid}`,
     lexicon: (uid: string, bookId: string) => `lexicon:${uid}:${bookId}`,
     lexiconAll: (uid: string) => `lexicon:${uid}:all`,
     recaps: (uid: string, bookId: string) => `recaps:${uid}:${bookId}`,
     bookPassport: (uid: string, bookId: string) => `bookPassport:${uid}:${bookId}`,
     upNext: (uid: string) => `upNext:${uid}`,
   } as const
   ```
4. **User scoping**: `clearAll()` fires when `authStore.user?.id` transitions to a different id or to null. The cache composable subscribes once at module init.
5. **Visibility revalidation**: on `document.visibilitychange` → visible, every stale key with ≥1 live subscriber is revalidated. Fresh keys are not touched.

## Store adoption contract

Every store listed in `data-model.md § CacheKey` MUST conform to this pattern:

```ts
// BEFORE (current books.ts shape)
const books = ref<Book[]>([])
const loading = ref(false)
const fetchLibrary = async () => { /* sets loading, assigns books */ }

// AFTER
const authStore = useAuthStore()
const handle = computed(() => {
  const uid = authStore.user?.id
  if (!uid) return null
  return swr(cacheKeys.books(uid), () => booksService.list(uid), { ttlMs: 60_000 })
})
const books = computed(() => handle.value?.data.value ?? [])
const isInitialLoading = computed(() => handle.value?.isInitialLoading.value ?? false)

const fetchLibrary = () => { /* becomes a no-op shim kept for backward-compat; cache handles it on first access */ }
const refreshLibrary = () => revalidate(cacheKeys.books(authStore.user!.id)) // for pull-to-refresh hooks

const addBook = async (input) => {
  const created = await booksService.create(input)
  mutate(cacheKeys.books(authStore.user!.id), (prev = []) => [created, ...prev])
  return created
}

const removeBook = async (id) => {
  await booksService.remove(id)
  const uid = authStore.user!.id
  mutate(cacheKeys.books(uid), (prev = []) => prev.filter(b => b.id !== id))
  invalidate(`progress:${uid}`)
  invalidate(`lexicon:${uid}`, { prefix: true })
  invalidate(`recaps:${uid}:${id}`)
  invalidate(`bookPassport:${uid}:${id}`)
}
```

### Component/page-level contract

Pages that previously branched on `store.loading` MUST switch to `store.isInitialLoading`. Example (LibraryPage):

```vue
<!-- BEFORE -->
<div v-if="booksStore.loading">…skeleton…</div>

<!-- AFTER -->
<div v-if="booksStore.isInitialLoading">…skeleton…</div>
```

If a page wants to show a subtle "refreshing" indicator during background revalidation, it can bind to `status === 'revalidating'` — but this is OPTIONAL polish, not required.

## AI exclusion contract

**MUST NOT** import or call any `useCache` export from:
- `src/stores/recaps.ts` — the `generateRecap` function or anything it touches (stream handlers, fragment accumulators, generationStatus)
- `supabase/functions/generate-recap/**` (Edge Function, out of frontend anyway)
- Any component that renders live recap streaming (`RecapStream.vue` et al.)

**MAY** use `useCache` in `recaps.ts` ONLY for `fetchRecapsForBook(bookId)` — the plain SELECT that returns completed recap metadata. This is the one recap surface that is cached.

Enforcement:
- Task list includes a "grep audit" step — no cache imports in excluded files.
- Code review checklist item: "Does this PR modify any AI streaming code?" → if yes, flag for second review.

## Testing contract

Unit tests (Vitest) MUST cover:
1. `swr(key, fetcher)` returns cached data immediately when fresh, no fetcher call.
2. `swr(key, fetcher)` returns cached data AND triggers fetcher when stale.
3. Two concurrent `swr(key, fetcher)` calls share one fetcher invocation (dedupe).
4. `mutate(key, value)` updates data and resets fetchedAt.
5. `invalidate(key)` marks stale; next access triggers fetcher.
6. `invalidate(prefix, { prefix: true })` affects every matching key.
7. `clearAll()` empties the cache and cancels in-flight promises.
8. Auth user-change signal triggers `clearAll()`.
9. `revalidate(key)` forces fetch even if fresh.
10. Fetcher error sets `status='error'` but preserves previous `data` if any.

Manual smoke (quickstart.md) covers end-to-end behavior.
