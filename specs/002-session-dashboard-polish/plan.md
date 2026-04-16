# Implementation Plan: Session Persistence & Dashboard Polish

**Branch**: `002-session-dashboard-polish` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-session-dashboard-polish/spec.md`

## Summary

Four targeted improvements to The Chronicler's UX and session handling: (1) fix authentication state loss on page refresh by correctly initialising Supabase Auth on app boot; (2) enrich the Dashboard with an in-progress reading list and a capped Completed section; (3) sort the Library by ascending progress percentage; (4) replace always-expanded recap cards with a PrimeVue Accordion where Memory Jogger opens by default and the other two panels are collapsed.

No new backend tables or edge functions are required. All changes are client-side Pinia store updates, computed property additions, and component-level UI refactors.

## Technical Context

**Language/Version**: TypeScript 6 + Vue 3.5+  
**Primary Dependencies**: PrimeVue 4 (Accordion component), Pinia 3, Supabase JS v2, Vue Router 4  
**Storage**: Supabase PostgreSQL (existing schema — no migrations needed)  
**Testing**: Vitest + @vue/test-utils  
**Target Platform**: PWA — iOS Safari, Android Chrome, desktop browsers  
**Project Type**: Web application (SPA/PWA)  
**Performance Goals**: Dashboard render < 300ms; session restore < 200ms on page load  
**Constraints**: Offline-capable; session MUST survive page refresh; no new Supabase tables  
**Scale/Scope**: Single authenticated user per session; up to ~200 books per library

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Memory Continuity | ✅ PASS | Session fix ensures recap history is always accessible; accordion layout preserves all three recap tiers |
| II. Physical-to-Digital Bridge | ✅ PASS | No changes to ISBN or page-tracking logic |
| III. AI-First Recap Engine | ✅ PASS | Accordion is a display-only change; recap data contract is unchanged |
| IV. Data Integrity & Synchronization | ✅ PASS | Session persistence directly serves this principle — user data must never be lost on refresh |
| V. PWA-First & Frictionless Portability | ✅ PASS | Session fix improves PWA reliability; dashboard overview reduces taps to key info |

**No violations. No Complexity Tracking entries required.**

## Project Structure

### Documentation (this feature)

```text
specs/002-session-dashboard-polish/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (affected files)

```text
src/
├── stores/
│   ├── auth.ts                   ← US1: session init + onAuthStateChange
│   └── progress.ts               ← US2/US3: inProgress/completed computed selectors
├── pages/
│   ├── DashboardPage.vue         ← US2: in-progress list + completed section
│   └── LibraryPage.vue           ← US3: sort by progress ascending
└── components/
    └── recap/
        ├── RecapStream.vue       ← US4: replace section divs with Accordion
        └── RecapCard.vue         ← US4: same accordion layout for history cards

supabase/                         ← no changes needed
```

## Complexity Tracking

*No constitution violations — table omitted.*
