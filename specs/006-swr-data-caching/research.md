# Phase 0 Research: SWR Data Caching

## Decision 1 — Cache substrate: Pinia-augmented vs TanStack Query / SWR

**Decision**: Build a minimal `useCache()` composable on top of the existing Pinia stores. No new library.

**Rationale**:
- **Bundle size (constitution §V)**: TanStack Query (~12 KB gz) and swrv (~5 KB gz) both add runtime weight we don't need; the primitive we actually use (`key → { data, fetchedAt, status }` + `swr()` + `mutate()` + `invalidate()`) is ~150 lines.
- **Existing architecture fit**: All mutations in the app already route through Pinia store actions (books.addBook, progress.updateProgress, lexicon.updateLeitner, etc.). Invalidation is therefore already centralized — we just need to wire it.
- **Reactivity model**: Pinia + Vue's `ref`/`computed` are the native reactivity primitives the rest of the app uses. A query library introduces a parallel reactivity system (query results vs store refs) that we'd have to manage at every boundary.
- **Debuggability**: A small in-house module we can read end-to-end beats a generic library for a feature this architecturally central.
- **AI exclusion**: Easier to guarantee zero touch on the recap pipeline when we control every line of the cache layer.

**Alternatives considered**:
- **TanStack Query (Vue bindings)**: Best-in-class ergonomics but requires rewriting every store as query/mutation hooks. High refactor surface for marginal value over what we need.
- **swrv**: Lighter than TanStack Query but still introduces the dual-reactivity problem and is comparatively under-maintained.
- **Pure browser HTTP cache (Cache-Control)**: Insufficient — we need in-app revalidation signals (user change, mutation-driven invalidation) that HTTP caching alone cannot express. We still use `Cache-Control` for static assets (FR-014) but not for Supabase responses.

## Decision 2 — Cache key scheme

**Decision**: Hierarchical tuple keys stringified with a separator, e.g. `books:<userId>`, `progress:<userId>`, `progress:<userId>:<bookId>`, `lexicon:<userId>:<bookId>`, `lexicon:<userId>:all`, `recaps:<userId>:<bookId>`, `bookPassport:<userId>:<bookId>`, `upNext:<userId>`.

**Rationale**:
- **User-scoped prefix** enforces FR-008/SC-005: clearing `*:<userId>:*` on auth change is trivial.
- **Deterministic from params** satisfies FR-006 — no hashing, no ordering ambiguity.
- **Substring match for family invalidation** — e.g. `lexicon:user123:*` invalidates both per-book and all-books variants when any lexicon entry changes.

**Alternatives considered**:
- **Array keys (TanStack Query style)** — more expressive but requires a serializer. Overkill for our bounded key space.
- **Opaque hashes** — invalidation requires a reverse-index; premature optimization.

## Decision 3 — Freshness windows

**Decision**: Two defaults — **60 s for lists** (library, lexicon all-books, recap history, up-next), **30 s for per-entity volatile reads** (progress, per-book passport counts). Per-key overrides allowed when a store has domain knowledge of its update cadence.

**Rationale**:
- 60 s lists: matches the spec's "in-session freshness" target (SC-003). Background refocus revalidation (FR-013) handles the "user came back after lunch" case.
- 30 s progress: progress is the most mutation-heavy data path; shorter window reduces the edge-case window where a different device updated progress.

**Alternatives considered**:
- **Infinity (manual-invalidate-only)** — would force us to catch every indirect update path. Error-prone.
- **Single 60 s default** — rejected because progress deserves tighter revalidation (cross-device read scenarios).

## Decision 4 — Invalidation strategy per mutation

**Decision**: Prefer **direct cache mutation** (optimistic + server-confirmed) when the mutation returns the updated entity; fall back to **key invalidation** (mark stale; refetch on next access) when the mutation's effect is broad or unclear.

Mapping of mutations → cache effects documented in `data-model.md § Mutation Registry`.

**Rationale**:
- Direct mutation avoids a second round-trip for the most common case (optimistic UI, server confirms, cache already matches).
- Invalidation is the safe default when we can't prove the exact delta.

**Alternatives considered**:
- **Always refetch after mutation** — simple but wastes round-trips and defeats the "snappy UI" goal.
- **Always optimistic mutate** — fragile when the server normalizes fields we don't know about.

## Decision 5 — Revalidation triggers

**Decision**: Revalidate on (a) access-while-stale, (b) window `visibilitychange` → visible *for keys the user is currently viewing*, (c) explicit `invalidate(key)` call.

**Rationale**:
- (a) is the core SWR loop.
- (b) covers the "returned after lunch" case (FR-013) without spamming background requests for keys nobody is looking at.
- (c) enables future pull-to-refresh (FR-012) without shipping the UI for it now.

**Explicitly NOT doing**:
- **Polling / interval revalidation** — not in scope; adds complexity with no user-visible win.
- **Network-online revalidation** — existing offline queue already handles the resume case for writes.

## Decision 6 — Optimistic updates scope

**Decision**: Enable optimistic updates for **progress saves** and **Leitner advance/reset** only (US4 / FR-011). Book add/delete remain non-optimistic (they involve server-generated IDs and cover fallbacks).

**Rationale**:
- Progress and Leitner are high-frequency, low-risk, and have trivial rollback (one field).
- Book creation involves a server-generated UUID, cover URL canonicalization, and `createdAt` — rolling back a provisional book on failure is feasible but not worth it for once-per-session actions.

## Decision 7 — Static asset caching (FR-014)

**Decision**: Add Vercel-compatible `vercel.json` headers (or equivalent) declaring immutable caching for `/assets/*` (Vite-hashed filenames) and `no-cache` for `index.html`. Supabase responses get `Cache-Control: no-store` via the existing SDK defaults — no changes.

**Rationale**:
- Vite emits content-hashed filenames in `/assets/`, so they can be cached forever (`max-age=31536000, immutable`).
- `index.html` must revalidate to pick up new bundle hashes after deploys.
- Application-level cache is the only cache for API data (FR-014 prohibits browser-caching Supabase responses).

## Decision 8 — AI endpoint isolation

**Decision**: Keep `recaps.generateRecap`, streaming state (`generationStatus`, `streamingFragments`), and the `generate-recap` Edge Function outside the cache layer entirely. The *list of completed recaps per book* (used for history display) is cacheable because it's a plain SELECT, not a streaming or generating call.

**Guardrails**:
- Code review checklist item: no `useCache` import in `recaps.ts` streaming paths.
- Spec reference FR-009 + SC-006 enforced in the task breakdown.

## Decision 9 — Testing strategy

**Decision**: Unit tests against the `useCache()` primitive (cache lifecycle, freshness, invalidation by key + family, user-change clearAll). Integration verification via `quickstart.md` manual smoke (the seven user journeys). No heavy E2E harness in this feature — existing Vitest setup suffices.

**Rationale**: The cache primitive is small and pure; store adoptions are thin wrappers. Heavy E2E would duplicate what a 60-second manual smoke already proves.

## Unknowns resolved

All unknowns from the spec were resolved in this phase. No `NEEDS CLARIFICATION` markers remain.
