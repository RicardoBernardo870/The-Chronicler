# Implementation Plan: Reading Suite v3

**Branch**: `003-reading-suite-v3` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)

## Summary

Six user stories extending The Chronicler across library UX, vocabulary learning, analytics, smart recap gating, and end-of-book celebration. The P1–P2 stories (library polish, ISBN enrichment) are low-risk incremental changes to existing code. P3–P6 introduce three new domain features (Lexicon, Reading Pulse, Milestone Recap, Reading Odyssey) each requiring new Supabase tables, Pinia stores, pages, and components. The most architecturally significant addition is a `progress_history` table that unlocks velocity calculations and streak tracking by logging every progress update as a timestamped event rather than overwriting a single row.

## Technical Context

**Language/Version**: TypeScript 6 + Vue 3.5+
**Primary Dependencies**: PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, Vite PWA (injectManifest)
**Storage**: Supabase PostgreSQL (primary) + IndexedDB (offline queue + Leitner state)
**Testing**: `npm test` (vitest), `npm run lint` (eslint)
**Target Platform**: PWA — iOS Safari 16+, Android Chrome, desktop
**Project Type**: Mobile-first PWA
**Performance Goals**: Recap starts streaming within 3s; Library renders < 200ms; Lexicon flip animation 60fps
**Constraints**: Offline-capable for progress updates and Lexicon spaced repetition; bundle lazy-load for new heavy features
**Scale/Scope**: Single-user PWA; new features add ~6 new Supabase tables, ~8 new pages/components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Memory Continuity | ✅ PASS | Milestone recapping strengthens spoiler-free constraint; fragment stitching maintains page-bounded context. Reading Odyssey final summary is at 100% so no spoiler risk. |
| II. Physical-to-Digital Bridge | ✅ PASS | ISBN field-by-field merge directly enhances edition accuracy. |
| III. AI-First Recap Engine | ✅ PASS | Milestone gating + fragment stitching improve recap quality and reduce cost without degrading the user experience. |
| IV. Data Integrity | ✅ PASS | All new entities persist to Supabase. Lexicon spaced repetition state syncs server-side, not just IndexedDB. |
| V. PWA-First | ✅ PASS | New pages lazy-loaded via dynamic imports. Lexicon offline-first via IndexedDB queue. Grid view images deferred. |
| UX Minimalism | ⚠️ JUSTIFIED | Milestone locked-state and Word of the Day add visible new elements to existing screens. Justified: locked-state is primarily a cost-control mechanism; Word of the Day is opt-in (hidden until first word saved). Neither adds friction to the core 2-tap flow. |

**Gate result: PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/003-reading-suite-v3/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── ui-contracts.md
│   └── supabase-schema.sql
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (additions to existing structure)

```text
src/
├── composables/
│   ├── useIsbn.ts           ← MODIFY: field-by-field merge instead of full fallback
│   ├── useLexicon.ts        ← NEW: Free Dictionary API lookup
│   ├── useLeitner.ts        ← NEW: spaced repetition logic (JS only, no AI)
│   └── useReadingPulse.ts   ← NEW: velocity + continuity score calculations
├── pages/
│   ├── LexiconPage.vue      ← NEW
│   ├── BookPassportPage.vue ← NEW
│   └── LibraryPage.vue      ← MODIFY: grid toggle, edit/delete, sort
├── components/
│   ├── books/
│   │   ├── BookCard.vue         ← MODIFY: add edit/delete actions
│   │   ├── BookGridCard.vue     ← NEW: grid view card
│   │   └── BookEditDialog.vue   ← NEW: edit modal (reuses BookForm)
│   ├── lexicon/
│   │   ├── LexiconCard.vue      ← NEW: flip card
│   │   └── AddWordDialog.vue    ← NEW: add word form
│   ├── pulse/
│   │   └── VelocityBadge.vue    ← NEW: PPH + finish prediction
│   └── dashboard/
│       └── WordOfTheDay.vue     ← NEW: dashboard widget
├── stores/
│   ├── lexicon.ts           ← NEW
│   ├── recapFragments.ts    ← NEW
│   └── bookPassport.ts      ← NEW
├── services/
│   └── recapService.ts      ← MODIFY: fragment-aware assembly
└── types/
    └── index.ts             ← MODIFY: new interfaces + row types

supabase/functions/
└── generate-recap/
    └── index.ts             ← MODIFY: fragment stitching pass
```

## Complexity Tracking

| Justified Addition | Why Needed | Simpler Alternative Rejected Because |
|-------------------|------------|-------------------------------------|
| `progress_history` table | Reading velocity + streak require timestamped history. Current schema only stores latest state. | Deriving from `updated_at` alone loses granularity when multiple updates happen same day |
| Lexicon offline-first with IndexedDB | Leitner state must survive offline; word review should not require network | Server-only would break the offline PWA guarantee from Principle IV |
| Two-pass milestone fragment system | Cost control at scale — reduces token use per recap by ~60% | Always re-running full Pass 1 from page 1 is functionally fine now but unscalable |
