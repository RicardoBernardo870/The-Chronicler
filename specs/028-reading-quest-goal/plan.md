# Implementation Plan: Reading Quest Goal

**Branch**: `028-reading-quest-goal` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/028-reading-quest-goal/spec.md`

## Summary

Add a gamified Profile experience with a current-year book goal, a Reading Quest progress card, and a derived reader level system. The technical approach is to persist one goal row per user/year, compute quest progress and XP through Supabase RPC aggregation to avoid client-side N+1 reads, and render compact Profile components that preserve the existing Reading DNA, Lifetime Stats, and Library Breakdown cards.

## Technical Context

**Language/Version**: TypeScript 6 strict; Vue 3.5 Composition API with `<script setup>`; SQL migrations for Supabase PostgreSQL  
**Primary Dependencies**: Vue 3.5, Pinia 3, Vue Router 4, Supabase JS v2, PrimeVue 4, existing SWR cache primitive  
**Storage**: Supabase PostgreSQL; new `reading_goals` table; existing `books`, `reading_progress`, `progress_history`, `recaps`, `page_captures`, `lore_cards`  
**Testing**: Vitest unit tests plus build validation; SQL contract verification through migration review and manual quickstart scenarios  
**Target Platform**: PWA web app on mobile and desktop browsers  
**Project Type**: Single Vue PWA with Supabase backend services  
**Performance Goals**: Profile quest summary loads with one aggregate RPC plus one goal upsert/read path; no per-book or per-activity client query loops  
**Constraints**: Preserve existing Profile cards; user-owned rows must be RLS protected; use RPC functions for profile aggregates wherever possible; no new activity ledger table for XP in v1  
**Scale/Scope**: Per-user yearly goal and derived profile aggregates over existing user activity; social goals, leaderboards, historical year browsing, and manual XP adjustments are out of scope

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: PASS. Feature supports return-to-reading motivation and profile memory without altering recap scope or spoiler behavior.
- **II. Physical-to-Digital Bridge**: PASS. Book goal counts completed books regardless of physical/digital source and does not change edition-specific page tracking.
- **III. AI-First Recap Engine**: PASS. No recap prompt or AI generation behavior changes.
- **IV. Data Integrity & Synchronization**: PASS. Goal rows are persisted in Supabase with RLS; quest/XP are derived from existing persisted activity.
- **V. PWA-First & Frictionless Portability**: PASS. Feature is Profile-page UI and uses existing PWA data flow; no native dependency.
- **VI. Component Architecture & UI Standards**: PASS. Plan uses dedicated Profile child components, a Pinia/composable boundary, and PrimeVue components for dialogs/forms/progress/status UI where appropriate.

## Project Structure

### Documentation (this feature)

```text
specs/028-reading-quest-goal/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- reading-goals.sql.md
|   |-- reading-quest-rpc.md
|   |-- profile-ui.md
|-- checklists/
|   |-- requirements.md
`-- tasks.md
```

### Source Code (repository root)

```text
src/
|-- components/
|   `-- profile/
|       |-- ReadingQuestCard.vue
|       |-- ReadingGoalDialog.vue
|       `-- ReaderLevelStrip.vue
|-- composables/
|   `-- useReadingQuest.ts
|-- stores/
|   `-- readingQuest.ts
|-- pages/
|   `-- ProfilePage.vue
|-- types/
|   `-- index.ts
supabase/
|-- migrations/
|   `-- 20260512_reading_quest_goal.sql
tests/
`-- unit/
    `-- readingQuest.spec.ts
```

**Structure Decision**: Use the existing single-app structure. Profile UI remains delegated to `src/components/profile`, state and Supabase interaction live in a focused store/composable, and Supabase schema/RPC work lives in one additive migration.

## Complexity Tracking

No constitution violations.

## Phase 0: Research

See [research.md](./research.md). Key decisions:

- Persist goals in a small user/year table with RLS and an atomic upsert path.
- Return quest progress and XP through one aggregate RPC to avoid N+1 client reads across activity tables.
- Derive XP from existing persisted activity rather than adding an XP ledger in v1.
- Use deterministic level thresholds with literary titles.

## Phase 1: Design

See:

- [data-model.md](./data-model.md)
- [contracts/reading-goals.sql.md](./contracts/reading-goals.sql.md)
- [contracts/reading-quest-rpc.md](./contracts/reading-quest-rpc.md)
- [contracts/profile-ui.md](./contracts/profile-ui.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **I. Memory Continuity**: PASS. Design does not alter recap content or spoiler boundaries.
- **II. Physical-to-Digital Bridge**: PASS. Existing page-based progress and total page metadata remain authoritative.
- **III. AI-First Recap Engine**: PASS. Existing recap generation is untouched; recaps only contribute derived XP counts.
- **IV. Data Integrity & Synchronization**: PASS. Goal persistence uses user/year uniqueness, RLS, and upsert; quest aggregates read persisted tables only.
- **V. PWA-First & Frictionless Portability**: PASS. UI is Profile-local and keeps interactions compact.
- **VI. Component Architecture & UI Standards**: PASS. Components are single-responsibility and PrimeVue-first for dialog, buttons, input, progress, and tags.
