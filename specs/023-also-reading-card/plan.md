# Implementation Plan: Also Reading Card

**Branch**: `023-also-reading-card` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/023-also-reading-card/spec.md`

## Summary

Add a small "Also Reading" community awareness card to the Book Detail page. The feature
uses a stable, read-only Supabase RPC to return followed readers who are currently reading
the same canonical book record or same normalized ISBN. Privacy and either-direction blocking
are enforced inside the RPC, and the Vue PWA consumes the response through a focused community
store/composable so the card loads independently from core book details.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5 Composition API, PostgreSQL SQL/PLpgSQL for Supabase migration/RPC work  
**Primary Dependencies**: Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, existing SWR cache primitive, existing community profile/follow/block stores  
**Storage**: Supabase PostgreSQL; existing `books`, `reading_progress`, `community_profiles`, `community_profile_privacy`, `follows`, and `blocks`; no new data table required  
**Testing**: `npm.cmd test`; `npm.cmd run build`; targeted TypeScript checks if available; Supabase SQL smoke checks for privacy/block cases; Supabase security/performance advisors after migration; manual quickstart flows  
**Target Platform**: PWA first, with the RPC response contract stable for future native iOS clients  
**Project Type**: Vue PWA plus Supabase/Postgres backend migration and RPC contract  
**Performance Goals**: Book details render without waiting for community data; first visible card result set appears within 1 second for beta-sized follow graphs; default card shows up to 3 readers while RPC supports cursor-style "view more" pages up to 20 readers  
**Constraints**: Additive migration only; no client-side filtering of hidden community data; server-side privacy and blocking enforcement; no reading circles, reactions, notes, activity feed events, or notifications; no new npm package required  
**Scale/Scope**: Invite-only community feature designed with production-safe indexes, bounded result sizes, and a stable read contract for broader rollout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: Pass. The card is ambient and does not expose recap or spoiler content beyond progress labels.
- **II. Physical-to-Digital Bridge**: Pass. ISBN matching supports edition-aware physical-book use without changing ISBN lookup flows.
- **III. AI-First Recap Engine**: Pass. No AI generation changes.
- **IV. Data Integrity & Synchronization**: Pass. Feature is read-only; progress writes remain unchanged and the card tolerates stale/failed community reads without blocking core progress.
- **V. PWA-First & Frictionless Portability**: Pass. The UI is a small PWA card, lazy community data load, and a mobile-portable backend contract.
- **VI. Component Architecture & UI Standards**: Pass. Plan uses a dedicated `AlsoReadingCard` community component with PrimeVue Button/Avatar/Tag/Dialog or list primitives where appropriate.
- **VII. Production-Ready Community Backend Contracts**: Pass. Plan requires additive SQL, stable authenticated RPC, fixed `search_path`, least-privilege grants, indexed joins/filters, and server-side privacy/block checks.

## Project Structure

### Documentation (this feature)

```text
specs/023-also-reading-card/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- sql-schema.md
|   |-- rpc-contracts.md
|   `-- ui-contracts.md
`-- tasks.md
```

### Source Code (repository root)

```text
supabase/
`-- migrations/
    `-- <timestamp>_also_reading_card.sql

src/
|-- types/
|   `-- index.ts
|-- stores/
|   |-- communityGraph.ts
|   `-- alsoReading.ts
|-- composables/
|   |-- useCache.ts
|   `-- useAlsoReading.ts
|-- components/
|   `-- community/
|       |-- AlsoReadingCard.vue
|       `-- AlsoReadingListDialog.vue
`-- pages/
    `-- BookDetailPage.vue
```

**Structure Decision**: Use the existing Vue PWA and Supabase migration structure. Backend
behavior lives in one additive migration with a stable RPC and indexes; frontend state is a
small Pinia store/composable that follows existing SWR patterns. The Book Detail page only
orchestrates the card and keeps presentational logic inside community components.

## Complexity Tracking

No constitution violations or justified complexity exceptions.

## Phase 0: Research Summary

See [research.md](./research.md). Key decisions:

- Use a read-only `get_also_reading_for_book` RPC instead of exposing table joins to clients.
- Reuse existing community privacy fields and follow/block graph helpers.
- Match by direct book id first, then normalized ISBN.
- Return optional progress fields only when progress privacy allows it.
- Use bounded result sizes and cursor pagination for "view more".
- Add partial/composite indexes for active progress and non-null ISBN paths.

## Phase 1: Design Summary

See:

- [data-model.md](./data-model.md)
- [contracts/sql-schema.md](./contracts/sql-schema.md)
- [contracts/rpc-contracts.md](./contracts/rpc-contracts.md)
- [contracts/ui-contracts.md](./contracts/ui-contracts.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Principle VII RLS**: Pass. Existing table RLS remains enabled; the new RPC is `security definer`, authenticated-only, fixed `search_path`, and returns only pre-filtered JSON.
- **Principle VII Indexing**: Pass. Contracts require indexes for `reading_progress` active reads, book owner/ISBN matching, follow graph joins, and block exclusion.
- **Principle VII RPC Contracts**: Pass. `get_also_reading_for_book` is documented as a stable PWA/iOS read contract with bounded inputs and response fields.
- **Principle VII Privacy/Blocking**: Pass. Current-reading eligibility, progress visibility, public profile availability, and either-direction blocks are evaluated before rows enter the response.
- **Principle VI UI**: Pass. UI contracts use PrimeVue card/list/dialog/button/avatar/tag patterns and single-responsibility community components.
