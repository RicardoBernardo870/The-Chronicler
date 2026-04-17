# Implementation Plan: SWR Data Caching & Instant Navigation

**Branch**: `006-swr-data-caching` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-swr-data-caching/spec.md`

## Summary

Eliminate the "spinner on every navigation" UX by adding a stale-while-revalidate (SWR) cache layer over the existing Pinia stores. Returning to a previously visited page renders cached data instantly, a background revalidation runs if the cache is stale, and every mutation (add/edit/delete) explicitly updates or invalidates the affected cache keys. AI recap endpoints and Edge Functions are strictly untouched.

Chosen approach: **augment Pinia stores with a shared `useCache()` composable** — no new library dependency (TanStack Query / SWR) — because (a) all data access already routes through Pinia stores, (b) constitution §V requires minimized bundle size, and (c) the cache semantics we need are a ~150-line primitive that is easier to reason about than a generic query library wrapped around our existing code.

## Technical Context

**Language/Version**: TypeScript 6.x + Vue 3.5 (Composition API)
**Primary Dependencies**: Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4
**Storage**: In-memory Pinia refs (cache metadata + payload); no new storage layer. Existing IndexedDB offline queue (progress) is unchanged.
**Testing**: Vitest (unit) — cache core + invalidation matrix. Manual E2E smoke per `quickstart.md`.
**Target Platform**: PWA (iOS/Android/desktop) — existing Vite PWA setup.
**Project Type**: Single-page frontend (Vue SPA) + Supabase BaaS. No backend changes.
**Performance Goals**: <100ms perceived render on warm navigation (SC-001); <50ms optimistic UI response (SC-004); ≥80% cache-hit on in-session repeat navigation (SC-003).
**Constraints**: Zero modifications to AI recap endpoints / Edge Functions (FR-009, SC-006). Bundle size delta < 5 KB gzipped (no new deps). Must clear on user change (FR-008, SC-005).
**Scale/Scope**: ~7 Pinia stores, ~12 distinct fetchers, ~15 mutation sites. Cache key space bounded by books × users (low hundreds per user).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Memory Continuity (spoiler-free, context-aware, three-tiered recaps) | ✅ PASS | Feature does not touch recap content, progress-to-percentage derivation, or the three-tier contract. Cache layer is transparent to recap display logic. |
| II. Physical-to-Digital Bridge (ISBN, absolute pages, manual fallback) | ✅ PASS | No change to ISBN lookup, page tracking semantics, or manual entry fallback. |
| III. AI-First Recap Engine (streaming, prompt contract, persistence) | ✅ PASS | **Explicitly excluded by FR-009.** AI streaming, recap fragment tables, and the `generate-recap` Edge Function receive zero diffs. Recap *history list metadata* (the completed-recap index) is cached, but the streaming payload and generation status are not. |
| IV. Data Integrity & Synchronization (Supabase, sync writes, offline graceful, no data loss) | ✅ PASS | Writes remain synchronous against Supabase; cache is a read-side optimization. Optimistic updates always roll back on server error (FR-011). Offline queue for progress is unchanged. |
| V. PWA-First & Frictionless Portability (installable, two-tap core actions, Lighthouse ≥ 90, small bundle) | ✅ PASS | No new runtime dependency → bundle-size-neutral. Faster warm navigation improves Lighthouse interactivity metrics. |

**Gate result: PASS.** No deviations; Complexity Tracking table not required.

Post-design re-check (after Phase 1): **PASS** — designed contracts preserve all five gates (see Phase 1 artifacts).

## Project Structure

### Documentation (this feature)

```text
specs/006-swr-data-caching/
├── plan.md              # This file
├── research.md          # Phase 0 output — cache substrate decision + patterns
├── data-model.md        # Phase 1 output — CacheEntry / CacheKey / Mutation registry
├── quickstart.md        # Phase 1 output — developer + QA smoke guide
├── contracts/
│   └── cache-api.md     # The useCache() composable surface + store adoption contract
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── composables/
│   ├── useCache.ts            # NEW — core SWR primitive (get/set/invalidate/mutate)
│   └── useAppTheme.ts         # (unchanged)
├── stores/
│   ├── books.ts               # REFACTOR — adopt useCache for fetchLibrary + invalidate on mutations
│   ├── progress.ts            # REFACTOR — cache fetchProgress; optimistic updateProgress
│   ├── lexicon.ts             # REFACTOR — cache entries per book + all-books; mutation invalidation
│   ├── bookPassport.ts        # REFACTOR — cache per-book passport
│   ├── upNext.ts              # REFACTOR — cache "up next" ordering
│   ├── recaps.ts              # PARTIAL — cache recap *history list only*; streaming untouched
│   └── auth.ts                # ADD — emit user-change signal for cache.clearAll()
├── services/                  # (unchanged — no fetcher changes, only callsite wrapping)
└── pages/                     # (unchanged — pages consume stores, which now return cached data)

tests/
└── unit/
    └── useCache.spec.ts       # NEW — cache primitives + invalidation matrix
```

**Structure Decision**: Single-project Vue SPA layout (existing). One new composable, one new test file, seven touched stores. No new directories.

## Complexity Tracking

Not required — all gates pass without deviation.
