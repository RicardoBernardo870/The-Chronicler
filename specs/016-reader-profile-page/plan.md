# Implementation Plan: Reader Profile Page with Reading DNA and Auto-Vocabulary Extraction

**Branch**: `016-reader-profile-page` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-reader-profile-page/spec.md`

## Summary

Ship a new top-level **Profile** page that combines a deterministic stats dashboard (lifetime stats, library breakdown, top themes) with two AI-powered capabilities: **Reading DNA** (a 2-3 sentence literary personality + mood signature + 3-5 personalized book suggestions, regenerated only when the user finishes 3 more books OR 90 days pass) and **Auto-Vocabulary Extraction** (silent, async post-capture extraction of up to 5 in-context-defined uncommon words per capture, deduped against the existing Lexicon and flowing into the existing Leitner system).

**Technical approach**: Two new Supabase tables (`reading_dna`, `vocabulary_extractions`) — vocabulary words themselves reuse the existing `lexicon_entries` table with a `source = 'auto'` differentiator and the existing `book_id` + `page_found` columns satisfying FR-022a source attribution. Two new Deno edge functions (`generate-reading-dna`, `extract-vocabulary`) call Gemini 2.5 Flash. All page-level stats are computed client-side from Pinia stores; no new derived tables. The Profile page is a new route (`/profile`) composed of small PrimeVue-first child components (`ReadingDnaCard`, `VocabularyGardenCard`, `LifetimeStatsGrid`, `TopThemesCloud`, `LibraryBreakdownCard`) per Constitution Principle VI.

## Technical Context

**Language/Version**: TypeScript 6 (strict) + Vue 3.5 (`<script setup>`, Composition API); Deno runtime for Supabase edge functions.
**Primary Dependencies**: PrimeVue 4, Pinia 3, Vue Router 4, Supabase JS v2, VueUse, date-fns v4. New runtime additions: none required (heatmap and word cloud built from PrimeVue primitives + raw SVG/CSS — no new npm packages).
**Storage**: Supabase PostgreSQL — two new tables (`reading_dna`, `vocabulary_extractions`); existing `lexicon_entries` extended with a `source` text column (`'manual' | 'auto'`, default `'manual'`). No new buckets; all stats computed client-side.
**Testing**: Manual via quickstart.md scenarios; unit-level type checks via `npm run lint`/`tsc --noEmit`. No new test framework introduced.
**Target Platform**: PWA (iOS Safari, Android Chrome, desktop Chrome/Safari/Firefox). Profile page must be one-handed mobile usable.
**Project Type**: Single-project Vue PWA (`src/`) + Supabase edge functions (`supabase/functions/`).
**Performance Goals**: Profile page first-render < 2 s on a 4G connection (SC-001); Reading DNA card displays cached value with zero AI calls on revisit (SC-005); vocabulary extraction adds zero perceptible latency to capture flow (SC-004 — < 50 ms regression).
**Constraints**: Vocabulary extraction MUST be fire-and-forget (non-blocking, silent on failure); DNA generation MUST be threshold-gated only (no manual button, no on-load triggers); no new persistent tables for derived stats (FR-006).
**Scale/Scope**: Single user per request (Supabase RLS scoped). Expected DNA records per user: ~4/year. Expected auto-vocabulary entries per user: ~5 per session × ~3 sessions/week ≈ 60–80/month.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance |
|---|---|
| **I. Memory Continuity** | ✅ Reading DNA is a *retrospective* identity artifact — it summarizes what the user has already read. It MUST NOT contain spoilers because its inputs are the user's own recaps + lore + captures, all of which already respect the spoiler-free constraint upstream. The DNA prompt explicitly forbids forward-looking content. |
| **II. Physical-to-Digital Bridge** | ✅ Vocabulary extraction is fed by the existing OCR capture flow (which already supports physical book readers). No regression. |
| **III. AI-First Recap Engine** | ✅ Two new AI integrations follow the same prompt-engineering pattern as `generate-recap`: structured JSON output, prompt caching, latency budget targeting < 5 s. Failures degrade gracefully (FR-014, FR-021). |
| **IV. Data Integrity & Synchronization** | ✅ DNA persists in Supabase; vocabulary writes through existing Lexicon path which already uses Supabase + RLS. Capture-flow vocabulary call is fire-and-forget — capture itself remains atomic. |
| **V. PWA-First & Frictionless Portability** | ✅ Profile page is reachable in 2 taps from home (bottom nav → Profile); no new bundle bloat (no new npm deps); lazy-loaded route. |
| **VI. Component Architecture & UI Standards** | ✅ All new UI uses PrimeVue components (Card, Chip, Tag, Skeleton, Image, ProgressBar, Tabs, Button, InlineMessage, Dialog, DataView, Badge) — see `contracts/ui-contracts.md`. **No custom UI components introduced.** Page-level `ProfilePage.vue` orchestrates only; substantive UI is delegated to small named components under `src/components/profile/`. All components stay under ~250 lines. |

**Initial gate result: PASS — no violations to track. No custom components.**

## Project Structure

### Documentation (this feature)

```text
specs/016-reader-profile-page/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── edge-functions.md       # generate-reading-dna, extract-vocabulary
│   └── ui-contracts.md         # ProfilePage components + PrimeVue mapping
└── tasks.md             # Phase 2 output (/speckit-tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── ProfilePage.vue                       # NEW — route /profile, orchestration only
├── components/
│   └── profile/                              # NEW — all Profile-page child components
│       ├── ReadingDnaCard.vue                # PrimeVue Card; personality + mood + suggestions
│       ├── BookSuggestionItem.vue            # PrimeVue Card/Panel inline; one suggestion row
│       ├── MoodSignature.vue                 # Tiny presentational — mood emoji/color sequence
│       ├── VocabularyGardenCard.vue          # PrimeVue Card; totals + Leitner box chips + recents
│       ├── LifetimeStatsGrid.vue             # PrimeVue Card grid (7 stat tiles)
│       ├── StatTile.vue                      # PrimeVue Card; one number + label + icon
│       ├── TopThemesCloud.vue                # PrimeVue Chip list, frequency-weighted sizing
│       └── LibraryBreakdownCard.vue          # PrimeVue Card; genre Tags + author count + pace bars
├── stores/
│   ├── readingDna.ts                         # NEW Pinia store — fetch / generate / cache DNA
│   └── lexicon.ts                            # MODIFIED — accept auto-extracted entries (no API change visible to callers)
├── composables/
│   ├── useReadingProfile.ts                  # NEW — aggregates lifetime stats from existing stores (client-side compute)
│   ├── useTopThemes.ts                       # NEW — derives theme frequency from recaps + lore
│   └── useVocabularyExtraction.ts            # NEW — fire-and-forget post-capture trigger
├── services/
│   └── (no new files — existing supabase client reused)
├── router/
│   └── index.ts                              # MODIFIED — add /profile route
└── types/
    └── index.ts                              # MODIFIED — add ReadingDna types + extend LexiconEntry source field

supabase/
├── functions/
│   ├── generate-reading-dna/                 # NEW — edge function
│   │   └── index.ts
│   └── extract-vocabulary/                   # NEW — edge function
│       └── index.ts
└── migrations/
    └── 20260428_reader_profile.sql           # NEW — reading_dna + vocabulary_extractions tables; lexicon_entries.source column
```

**Structure Decision**: Single-project Vue PWA (Option 1 of the template) — matches every prior feature in this repo. The Profile page is added as a new top-level page (`src/pages/ProfilePage.vue`) with a sibling component directory (`src/components/profile/`) that follows the existing convention of one component-per-file under a feature-named subdirectory (cf. `src/components/dashboard/`, `src/components/book/`, `src/components/lexicon/`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations. No custom UI components introduced — every Profile-page element maps to a PrimeVue component.*
