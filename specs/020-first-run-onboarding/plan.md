# Implementation Plan: First-Run Onboarding

**Branch**: `021-first-run-onboarding` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-first-run-onboarding/spec.md`

## Summary

Refine the first-run library and Dashboard experience so BookHero infers the obvious next
reading focus for new users, avoids redundant empty sections, and lets users add queued,
currently-reading, or already-completed books without accidentally starting active-reading
or AI workflows. The technical approach is to extend existing Dashboard state derivation,
add initial-status support to the add-book flow, and keep progress/library cache updates
consistent through the current Pinia/SWR patterns. No new tables are planned.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5 Composition API  
**Primary Dependencies**: Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, VueUse, existing SWR cache primitive  
**Storage**: Existing Supabase PostgreSQL tables (`books`, `reading_progress`, `progress_history`, `up_next_order`) plus existing in-memory Pinia/SWR cache; no new storage layer planned  
**Testing**: `npx.cmd vue-tsc -b`; manual first-run validation matrix from quickstart; targeted store/composable regression checks if test harness work is added in tasks  
**Target Platform**: Current Vue PWA on mobile-first web, including iPhone bottom-nav safe area behavior  
**Project Type**: Single Vue PWA with Supabase-backed state  
**Performance Goals**: Dashboard first-run state resolves from existing library/progress payloads without additional first-paint round trips beyond current fetches; add-book initial status completes with one confirmed book write plus one progress write when needed  
**Constraints**: Existing private Profile page unaffected; existing Library page behavior must not regress; completed imports must not trigger recap/session/capture workflows; no unnecessary AI calls; use PrimeVue-first component patterns  
**Scale/Scope**: One onboarding slice covering Dashboard states, add-book initial status, active hero inference, completed import safeguards, and cache/state consistency

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Principle I: Memory Continuity passes. The feature improves the path back to a current read and prevents completed imports from masquerading as active recap contexts.
- Principle II: Physical-to-Digital Bridge passes. Add-book status still relies on edition-specific page counts and absolute page progress.
- Principle III: AI-First Recap Engine passes. Recap behavior is preserved and explicitly guarded from completed-import auto-triggering.
- Principle IV: Data Integrity & Synchronization passes. Progress/status mutations remain persisted through Supabase and existing cache invalidation patterns.
- Principle V: PWA-First & Frictionless Portability passes. The Dashboard remains mobile-first and one-handed, with first-run actions reachable directly.
- Principle VI: Component Architecture & UI Standards passes. UI changes will use PrimeVue primitives and small feature components rather than expanding Dashboard/Form logic excessively.
- Principle VII: Community Backend Contracts is not directly affected; no public/social backend contracts are added.

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/020-first-run-onboarding/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-state-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── books/
│   │   └── BookForm.vue
│   └── dashboard/
│       ├── DashboardEmptyState.vue
│       ├── CompletedOnlyState.vue
│       ├── HeroBookCard.vue
│       ├── InProgressSection.vue
│       └── UpNextSection.vue
├── composables/
│   ├── useActiveBook.ts
│   └── useDashboardOnboardingState.ts
├── pages/
│   ├── AddBookPage.vue
│   └── DashboardPage.vue
├── stores/
│   ├── books.ts
│   ├── progress.ts
│   └── upNext.ts
└── types/
    └── index.ts
```

**Structure Decision**: Use the existing single PWA structure. The Dashboard page should keep
orchestration responsibility while first-run presentation is extracted into small
`src/components/dashboard/` components and state derivation lives in composables/stores.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md). All planning unknowns are
resolved: first active hero inference, initial book status persistence, completed import
history behavior, section omission rules, and AI-trigger safeguards.

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/ui-state-contract.md](./contracts/ui-state-contract.md)
- [quickstart.md](./quickstart.md)

## Constitution Check (Post-Design)

- Principle I remains satisfied: automatic first-active focus makes continuing the current
  book easier, while completed imports avoid recap/session side effects.
- Principle IV remains satisfied: initial status writes use existing persisted book/progress
  records and invalidate existing cache keys after mutations.
- Principle VI remains satisfied: new Dashboard first-run states are planned as dedicated,
  single-responsibility components using PrimeVue Button/Message/Card-style primitives where
  appropriate.
- No Principle VII work is introduced because this feature does not add public/community
  backend contracts.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
