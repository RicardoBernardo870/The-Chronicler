# Implementation Plan: Dashboard State Logic Refactor

**Branch**: `011-dashboard-state-refactor` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-dashboard-state-refactor/spec.md`

## Summary

Refactor the Dashboard to eliminate a book-progress state leak when the hero book changes, enable in-place hero swapping via Up Next taps (with "View Book" as the only navigation path to Book Details), harden VelocityBadge against NaN/Infinity edge cases, and introduce a new "Last Session" card (recency + volume + velocity). All state must be reactively keyed to the active bookId, with watchers cleaned up on unmount and on bookId change. Existing SWR cache composable (`useCache.ts`) is reused for progress/recap/pulse lookups.

## Technical Context

**Language/Version**: TypeScript 6 (strict), Vue 3.5 (Composition API, `<script setup>`)
**Primary Dependencies**: Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2, VueUse
**Storage**: Supabase PostgreSQL (existing — no schema changes); in-memory Pinia refs + SWR cache
**Testing**: Manual smoke tests from `quickstart.md` + existing Vitest unit harness
**Target Platform**: PWA (iOS/Android/desktop browsers)
**Project Type**: Single-project Vue PWA (frontend-only change; no backend work)
**Performance Goals**: Hero swap renders within one frame (<16ms); cached swaps show no loading skeleton
**Constraints**: No route navigation on Up Next taps; no memory leaks from retained watchers during rapid swaps; no "NaN"/"Infinity" in velocity output
**Scale/Scope**: ~3 components modified (DashboardPage, VelocityBadge, new LastSessionCard); 1 Pinia store may expose a new `activeBookId` ref; 0 DB migrations

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: ✅ No change to recap content generation; spoiler-free rules are inherited. The Last Session card surfaces user-authored progress only (no AI-generated narrative content), so the spoiler contract is unaffected.
- **II. Physical-to-Digital Bridge**: ✅ No change to ISBN lookup or page-number handling. Progress percentage continues to derive from `currentPage / totalPages`.
- **III. AI-First Recap Engine**: ✅ Out of scope — this feature touches Dashboard state only. Recap streaming from feature 010 is preserved.
- **IV. Data Integrity & Synchronization**: ✅ Existing Supabase write paths untouched. Hero swap is a UI-only selection (ephemeral per Assumption in spec). Cache reuse via `useCache.ts` means fewer redundant reads without sacrificing freshness.
- **V. PWA-First & Frictionless Portability**: ✅ Reduces clicks (no navigation required to preview an alternate in-progress book). No bundle-size regression expected; new card is a small component. Lighthouse PWA ≥ 90 maintained.

**UX Philosophy Check**: Dashboard keeps its two primary actions (Update Progress, Get Recap). Last Session card is a glanceable addition, not a new action surface. Liquid-glass aesthetic preserved.

**Gate result**: PASS. No violations — Complexity Tracking section empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-dashboard-state-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── useActiveBook.md
│   ├── VelocityBadge.md
│   └── LastSessionCard.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── pulse/
│   │   └── VelocityBadge.vue          # MODIFIED — NaN/edge-case guards
│   └── dashboard/
│       └── LastSessionCard.vue        # NEW — recency + volume + velocity
├── composables/
│   ├── useActiveBook.ts               # NEW — hero bookId + swap + auto-promotion rule
│   ├── useLastSession.ts              # NEW — latest session across library
│   ├── useReadingPulse.ts             # EXISTING — consumed by velocity + last session
│   └── useCache.ts                    # EXISTING — reused for cache-aware swaps
├── pages/
│   └── DashboardPage.vue              # MODIFIED — consume useActiveBook, render LastSessionCard
└── stores/
    ├── books.ts                       # EXISTING — in-progress filter reused
    └── progress.ts                    # EXISTING — progressForBook(id) reused
```

**Structure Decision**: Single-project Vue PWA. All changes live under `src/`. No backend/edge function changes. One new component, two new composables, targeted edits to one page and one existing component.

## Complexity Tracking

*No violations — table intentionally empty.*
