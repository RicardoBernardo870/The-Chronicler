# Research: Dashboard State Refactor

**Feature**: 011-dashboard-state-refactor
**Date**: 2026-04-20

## Decision 1: Hero bookId source of truth

**Decision**: Introduce a new composable `useActiveBook()` that owns a module-scoped `activeBookId` ref. Auto-promotion (completion event) and explicit user swap both write to it. All Dashboard-scoped state (progress bar, page counter, lock, recap context, velocity lookups) is `computed` from `activeBookId` — never copied into local refs that can go stale.

**Rationale**:
- Eliminates the current state leak: the bug comes from local refs seeded at mount from `currentBook` that don't re-seed when `currentBook` changes. `computed` derivations are reactive by construction.
- Keeps persistence ephemeral (per spec Assumption) — a module ref is enough; no Pinia store plumbing required, no localStorage.
- Composable pattern matches `useRecapLock` from feature 010 — consistent architecture.

**Alternatives considered**:
- Storing `activeBookId` in the `books` Pinia store: heavier, requires store tests, and leaks UI-selection concerns into a domain store.
- Route param / query string: violates the spec's "no navigation on swap" requirement and complicates back-button semantics.

## Decision 2: Auto-promotion vs explicit-swap conflict resolution

**Decision**: Auto-promotion on completion fires **only if** the completed bookId equals the current `activeBookId`. Completion events for other books do not mutate `activeBookId`. Initial value of `activeBookId` is the first in-progress book from the library (existing default promotion rule).

**Rationale**: Matches Clarification Q1. Preserves user intent when they've explicitly swapped.

**Alternatives considered**:
- Always promote on any completion → overwrites explicit user swap (rejected).
- Never auto-promote mid-session → breaks FR-005 and existing UX for users who finish a book and expect the next one (rejected).

## Decision 3: VelocityBadge fallback strategy

**Decision**:
- Compute pph only when: at least one session exists AND that session has `durationSeconds ≥ 60` AND `pagesDelta ≥ 1`.
- If any guard fails, return `null` from `pph` computed and render a fallback string (`"—"` or similar) — never pass `NaN`/`Infinity` to the DOM.
- Guard `finishPrediction` against `totalPages <= 0` and `currentPage > totalPages`.

**Rationale**: Matches FR-006, FR-007, SC-003. A 60-second floor avoids amplifying tiny denominators into absurd velocities ("4,800 pages/hr").

**Alternatives considered**:
- Show raw computed value with client-side clamp to MAX — still risks misleading numbers on sub-minute sessions.
- Hide the badge entirely on insufficient data — rejected; keeping the slot visible with a fallback is less jarring.

## Decision 4: Last Session card data source

**Decision**: New composable `useLastSession()` reads from the existing `progress_history` data already consumed by `useReadingPulse`. Returns `{ bookId, endedAt, pagesDelta, velocity }` for the most recent qualifying session **across the user's library** (not scoped to the hero book — per spec Assumption).

**Rationale**: Reuses existing Supabase-backed pulse history; no schema or new endpoint needed. Library-wide scope aligns with "habit/momentum signal".

**Alternatives considered**:
- Scoped to hero book → would mean the card re-fetches on every swap and may render empty for fresh books. Rejected per spec.
- New dedicated table/view → overkill; data already exists.

## Decision 5: Relative-time phrasing

**Decision**: Client-side formatter with coarse buckets:
- `< 60min` → "X minutes ago" (or "Just now" for <2 min)
- `< 24h` → "X hours ago"
- Same calendar day before midnight → same as above; yesterday (`now.date - 1`) → "Yesterday"
- `< 7 days` → "X days ago"
- `≥ 7 days` → "X weeks ago"

Use local device time. No i18n library required for v1.

**Rationale**: Matches FR-009 and spec Assumption. Small pure function — trivial to unit-test.

**Alternatives considered**:
- `Intl.RelativeTimeFormat` → solid choice but locale detection adds variance; coarse bucket rule is more predictable for tests.
- External library (date-fns) → avoid new dependency for one function.

## Decision 6: Watcher cleanup pattern

**Decision**: Use `watch(activeBookId, ...)` inside components with the default cleanup semantics (Vue automatically disposes on unmount). For any ad-hoc side-effect watchers (e.g., aborting in-flight recap streams on book swap), use the effect-cleanup callback form:

```ts
watch(activeBookId, (_, __, onCleanup) => {
  const ctrl = new AbortController()
  onCleanup(() => ctrl.abort())
})
```

**Rationale**: Matches FR-010 and SC-005. `onCleanup` is idiomatic Vue 3 and prevents leaks even across rapid successive book swaps.

**Alternatives considered**:
- Manual `stop()` handle tracking → error-prone and duplicates what the framework does.
- `onUnmounted` only → insufficient; misses the in-session swap case.

## Decision 7: Cache reuse on swap

**Decision**: Rely on the existing `useCache.ts` SWR composable. Each swap triggers `fetchProgress(newId)` / `fetchRecapsForBook(newId)` — these no-op on cache hit (fresh) or return cached value while revalidating in background. No new cache keys needed for the Last Session card because its underlying pulse history is already SWR-cached.

**Rationale**: Matches FR-011 and SC-006. No new cache infrastructure, no stale data risk.

**Alternatives considered**:
- Prefetching all in-progress books at mount → wastes bandwidth for users with many books in progress.
- Per-component local cache → duplicates SWR and loses invalidation.

## Open questions

None. All clarifications from the spec are resolved. Time-bucket exact wording (Decision 5) is implementation-level and can be adjusted during polish without architectural impact.
