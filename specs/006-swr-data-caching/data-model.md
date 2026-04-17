# Phase 1 Data Model: SWR Cache

## Entities

### CacheEntry&lt;T&gt;

In-memory record held by the cache composable.

| Field | Type | Notes |
|-------|------|-------|
| `key` | `string` | Deterministic key (see CacheKey). |
| `data` | `T \| undefined` | The cached payload. `undefined` until first successful fetch. |
| `fetchedAt` | `number` (epoch ms) | Set on every successful fetch or direct `mutate()`. `0` for uninitialized. |
| `status` | `'idle' \| 'loading' \| 'revalidating' \| 'error'` | Observable UI state. |
| `error` | `Error \| null` | Last error on this key (cleared on success). |
| `ttlMs` | `number` | Freshness window for this key. Defaults: 60 000 (lists) / 30 000 (volatile). |
| `inflight` | `Promise<T> \| null` | Dedupe: concurrent `swr(key)` calls share one request. |

### Cache State (module singleton)

| Field | Type | Notes |
|-------|------|-------|
| `entries` | `Map<string, CacheEntry>` | Keyed by full cache key string. |
| `currentUserId` | `string \| null` | Observed from auth store; drives `clearAll()`. |
| `visibilityHandler` | `() => void` | Registered once for `visibilitychange` → revalidate live keys. |

## CacheKey — Naming convention

All keys are strings of the form `<resource>:<userId>[:<scopeId>][:<variant>]`.

| Resource | Key Pattern | TTL | Produced by |
|----------|-------------|-----|-------------|
| Library | `books:<userId>` | 60 s | `booksStore.fetchLibrary()` |
| Progress (all) | `progress:<userId>` | 30 s | `progressStore.fetchProgress()` |
| Progress (one) | `progress:<userId>:<bookId>` | 30 s | derived view; not a separate fetch |
| Lexicon (per book) | `lexicon:<userId>:<bookId>` | 60 s | `lexiconStore.fetchEntriesForBook()` |
| Lexicon (all) | `lexicon:<userId>:all` | 60 s | `lexiconStore.fetchEntriesForAllBooks()` |
| Recap history | `recaps:<userId>:<bookId>` | 60 s | `recapsStore.fetchRecapsForBook()` — **metadata only** |
| Book passport | `bookPassport:<userId>:<bookId>` | 60 s | `bookPassportStore.fetchPassport()` |
| Up-Next | `upNext:<userId>` | 60 s | `upNextStore.fetchUpNext()` |

**Excluded from cache** (FR-009): recap streaming fragments, `generationStatus`, any payload produced by the `generate-recap` Edge Function, authentication session objects.

## Mutation Registry

For each mutation, the effect on cache keys is explicit and documented in code (a `MUTATION_EFFECTS` map) so invalidation is reviewable at a glance.

| Mutation | Effect | Strategy |
|----------|--------|----------|
| `booksStore.addBook(book)` | `books:<userId>` | Direct mutate (append returned entity) |
| `booksStore.updateBook(id, changes)` | `books:<userId>` | Direct mutate (replace by id) |
| `booksStore.removeBook(id)` | `books:<userId>`, `progress:<userId>`, `lexicon:<userId>:<id>`, `lexicon:<userId>:all`, `recaps:<userId>:<id>`, `bookPassport:<userId>:<id>` | Invalidate (broad effect) |
| `progressStore.updateProgress(bookId, page)` | `progress:<userId>` | **Optimistic** direct mutate; rollback on error |
| `lexiconStore.addEntry(entry)` | `lexicon:<userId>:<bookId>`, `lexicon:<userId>:all` | Direct mutate (append) |
| `lexiconStore.deleteEntry(id, bookId)` | `lexicon:<userId>:<bookId>`, `lexicon:<userId>:all` | Direct mutate (filter) |
| `lexiconStore.updateLeitner(id, action)` | `lexicon:<userId>:<bookId>`, `lexicon:<userId>:all` | **Optimistic** direct mutate; rollback on error |
| `upNextStore.reorder(order)` | `upNext:<userId>` | Direct mutate |
| `recapsStore.generateRecap(bookId)` *(AI path — EXCLUDED)* | No cache effect from streaming; on completion, **invalidate** `recaps:<userId>:<bookId>` so the next history view picks up the new entry | Invalidate-only, no direct mutate — keeps streaming path cache-free |
| **Auth change** (`auth.user` id differs from `currentUserId`) | ALL entries | `clearAll()` |

## State Transitions

```
           ┌─────────────┐
           │ uninitialized│ data=undefined, fetchedAt=0, status='idle'
           └──────┬──────┘
           first swr()│
                  ▼
           ┌─────────────┐
           │   loading   │ inflight=Promise, status='loading'
           └──────┬──────┘
        success │      │ error
                ▼      ▼
     ┌──────────┐   ┌────────┐
     │   fresh  │   │  error │ data=undefined, status='error', error set
     └────┬─────┘   └────────┘
          │ now - fetchedAt > ttlMs
          ▼
     ┌──────────┐
     │   stale  │ still serves `data` immediately on access
     └────┬─────┘
access    │
          ▼
     ┌──────────────┐
     │ revalidating │ status='revalidating', serves old `data` until resolve
     └──────┬───────┘
  success   │   error
     ┌──────┴──────┐
     ▼             ▼
  fresh (new)  stale (kept; error logged, no user-facing error per FR-005)
```

## Validation rules

- `ttlMs` must be > 0.
- Cache key string must be non-empty and include the current `userId`; calls without a user id throw (prevents unscoped leaks).
- `mutate(key, updater)` must preserve `fetchedAt` semantics: passing a new value counts as a successful fetch (sets `fetchedAt = now`), while `markStale(key)` sets `fetchedAt = 0` without clearing `data`.
- `clearAll()` removes every entry and cancels any in-flight revalidation.

## Observability

Development build exposes `window.__bookheroCache` (read-only proxy) with:
- `keys()` — list of active cache keys
- `get(key)` — full CacheEntry snapshot
- `stats()` — hit / miss / revalidation counts since mount

Production build omits the global to avoid leaking debug surface.
