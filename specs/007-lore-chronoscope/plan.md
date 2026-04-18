# Implementation Plan: Lore Chronoscope

**Branch**: `007-lore-chronoscope` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-lore-chronoscope/spec.md`

## Summary

Introduce a background-generation system that silently creates "Lore Cards" (short, spoiler-safe world-building snippets) whenever a reader crosses a 10% reading milestone. Rename the existing "Lexicon" surface to "The Great Library" and re-house it as a two-tab view (Lexicon + Lore Cards). Surface a random unlocked lore card on the Book Detail page as a "Lore Chronoscope" discovery card. Notify readers of new lore via a transient toast and a persistent chip on the book's Library card.

The feature reuses the existing AI provider integration (Gemini 2.5 Flash), the existing SWR caching layer (feature 006), and the existing Supabase auth + cache-clear lifecycle. It adds **one** new edge function (`generate-lore`), **one** new database table (`lore_cards`), and **one** new Pinia store.

## Technical Context

**Language/Version**: TypeScript 6.x (frontend) + Deno (edge function)  
**Primary Dependencies**: Vue 3.5 (Composition API), Pinia 3, Vue Router 4, PrimeVue 4 (Tabs, Toast, Chip, Card, Skeleton), Supabase JS v2, `@google/genai` (Gemini 2.5 Flash inside the edge function)  
**Storage**: Supabase PostgreSQL — new `lore_cards` table; no IndexedDB usage  
**Testing**: Vitest (unit tests for milestone-detection and master-recap assembly), manual smoke tests via `quickstart.md`  
**Target Platform**: PWA (iOS / Android / desktop Chrome / Edge) — same PWA envelope as the rest of the app  
**Project Type**: Single Vue 3 PWA + Supabase Edge Functions (web-app)  
**Performance Goals**: Chronoscope card render ≤ 100 ms on return visits (cached); lore generation completes in ≤ 30 s end-to-end; Great Library tab switch instant; zero additional network requests on repeat milestones.  
**Constraints**: Must not add a new bottom-nav entry; must not modify the existing `generate-recap` streaming paths (FR-009 from feature 006 still in force); must fail silently on generation errors; bundle-size delta < 10 KB gzipped; zero schema changes to existing tables.  
**Scale/Scope**: Up to 9 cards per book per user (one per 10% milestone). For a typical power user with 50 books that caps at ≤ 450 lore cards lifetime — trivial row count.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Memory Continuity (spoiler-free, context-aware, three-tiered) | ✅ PASS | Lore cards are guaranteed spoiler-free via the Master Recap wall (FR-002, FR-005). The three-tiered recap constraint applies to recaps only, not to lore cards which are a different content type; this is not a violation — the principle governs recaps, lore cards are supplementary world-building. |
| II. Physical-to-Digital Bridge | ✅ PASS | No change to ISBN / page-number / manual-entry flows. |
| III. AI-First Recap Engine | ✅ PASS | New AI surface follows the same spoiler-safety philosophy (system-prompt-level guardrail). Reuses Gemini 2.5 Flash per existing AI layer. |
| IV. Data Integrity & Sync | ✅ PASS | Lore cards persisted in Supabase, cleared on auth change via existing `clearAll()` hook, deletion cascades via existing book-delete flow. |
| V. PWA-First & Frictionless Portability | ✅ PASS | No new bottom-nav entry, feature reachable within existing 2-tap reach (Library → book → Chronoscope, or bottom-nav → Great Library → Lore Cards). Lazy-loaded `<GreatLibraryPage>` route. |

**Result**: All gates pass on first evaluation. No complexity-tracking entries required.

**Constitution note**: Principle I governs *recaps*. Lore cards are a distinct content type derived from recaps (not a recap in themselves). The spoiler-free requirement carries over via derivation — you cannot reference what isn't in the Master Recap — but the "three-tiered" structure is not imposed on lore. This is consistent with the constitution's wording ("every AI-generated recap MUST include …") which scopes the tiered format to recap output specifically.

## Project Structure

### Documentation (this feature)

```text
specs/007-lore-chronoscope/
├── plan.md                       # This file
├── spec.md                       # Feature spec (complete)
├── research.md                   # Phase 0 decisions
├── data-model.md                 # Phase 1 entities
├── quickstart.md                 # Phase 1 smoke tests
├── contracts/
│   ├── lore-api.md               # Edge function + store-level API
│   └── ui-contracts.md           # UI surface contracts (Chronoscope card, Great Library tabs, chip)
├── checklists/
│   └── requirements.md           # Spec quality checklist (complete)
└── tasks.md                      # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root — changes in this feature)

```text
src/
├── composables/
│   └── useCache.ts                              # ADD: new cacheKeys.lore(uid, bookId) helper
├── stores/
│   ├── loreCards.ts                             # NEW: Pinia store (fetch + generate + cache)
│   ├── progress.ts                              # MODIFY: milestone-detection hook in updateProgress
│   └── auth.ts                                  # NO CHANGE (clearAll already fires on user switch)
├── services/
│   └── loreService.ts                           # NEW: edge-function client wrapper
├── components/
│   ├── lore/
│   │   ├── LoreChronoscopeCard.vue              # NEW: Discovery card for Book Detail Page
│   │   ├── LoreCardList.vue                     # NEW: List view inside Great Library
│   │   └── LoreCardDetail.vue                   # NEW: Expanded single-card view
│   └── shared/
│       └── AppBottomNav.vue                     # MODIFY: label "Lexicon" → "Great Library"; keep /lexicon path
├── pages/
│   ├── LexiconPage.vue                          # RENAME → GreatLibraryPage.vue; add Tabs wrapper; preserve content in Lexicon tab
│   └── BookDetailPage.vue                       # MODIFY: insert <LoreChronoscopeCard :book-id />
├── router/
│   └── index.ts                                 # MODIFY: route name stays 'lexicon' for compat; no path change
└── types/
    └── index.ts                                 # ADD: LoreCard, LoreCardRow, LoreType, mapLoreCard

supabase/
├── functions/
│   └── generate-lore/
│       ├── index.ts                             # NEW: edge function
│       └── deno.json                            # NEW: import map (if needed — else reuse root deno.json)
└── migrations/
    └── 20260417_lore_cards.sql                  # NEW: CREATE TABLE lore_cards + RLS policies

tests/
└── unit/
    ├── masterRecap.spec.ts                      # NEW: tests the master-recap assembly logic
    └── milestoneDetect.spec.ts                  # NEW: tests the milestone-crossing detector
```

**Structure Decision**: Single-project Vue 3 PWA + Supabase Edge Functions. The feature is additive — it introduces one new edge function, one new Pinia store, three new components, and one new page rename. All existing stores and composables remain functionally unchanged; `progress.ts` receives a single new fire-and-forget call to `loreCardsStore.maybeUnlockForMilestone()` after the existing progress save succeeds, mirroring how the Book Passport auto-generation hooks in today.

## Complexity Tracking

*No constitution violations — table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
