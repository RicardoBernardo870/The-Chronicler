# Implementation Plan: Reading Circles

**Branch**: `024-reading-circles` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/024-reading-circles/spec.md`

## Summary

Add private Reading Circles where owners invite eligible followed readers, invited readers
accept before membership, and accepted members can leave short reactions pinned to their
edition-specific page. The backend uses additive Supabase/Postgres tables plus stable
security-definer RPC contracts to enforce membership, invitation acceptance, blocks, max
circle size, and spoiler-safe reaction visibility by normalized percent-through-book rather
than raw page number. The PWA surface stays minimal and refetches visible reactions through
safe RPCs when realtime events cannot safely include readable content.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5 Composition API, PostgreSQL SQL/PLpgSQL for Supabase migration/RPC work  
**Primary Dependencies**: Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, existing SWR cache primitive, existing community profile/follow/block stores, existing also-reading/book detail surfaces  
**Storage**: Supabase PostgreSQL; existing `books`, `reading_progress`, `community_profiles`, `community_profile_privacy`, `follows`, and `blocks`; new `reading_circles`, `circle_invitations`, `circle_members`, and `circle_reactions` tables  
**Testing**: `npm.cmd test`; `npm.cmd run build`; targeted TypeScript checks if available; Supabase SQL smoke checks for RLS, invitation, max-member, block, and spoiler-gate cases; Supabase security/performance advisors after migration; manual quickstart flows  
**Target Platform**: PWA first, with RPC response contracts stable for future first-party iOS clients  
**Project Type**: Vue PWA plus Supabase/Postgres backend migration and RPC contract  
**Performance Goals**: Circle list and detail RPCs respond within 1 second for invite-only beta data; visible reaction reads use bounded range/page windows and indexed membership/location paths; realtime-visible reactions refresh within 2 seconds in at least 95% of tested circle sessions  
**Constraints**: Additive migration only; no client-side filtering of private reactions; server-side membership, invitation, block, max-size, and spoiler-gate enforcement; private circles only; 10 accepted members max; 280 character reactions; no public circles, feeds, threaded discussion, push notifications, or new npm package required  
**Scale/Scope**: Small invite-only community with production-safe RLS/index/RPC design suitable for broader PWA and future mobile rollout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: Pass. Reactions are page/location-gated and must not expose content ahead of the viewer's normalized progress.
- **II. Physical-to-Digital Bridge**: Pass. The design explicitly supports different editions by storing source page plus normalized percent-through-book.
- **III. AI-First Recap Engine**: Pass. No AI recap generation changes.
- **IV. Data Integrity & Synchronization**: Pass. Circle state, memberships, invitations, and reactions are persisted in Supabase; realtime is optional safe invalidation/refetch rather than a source of truth.
- **V. PWA-First & Frictionless Portability**: Pass. The first PWA UI is minimal, lazy, and uses stable mobile-portable backend contracts.
- **VI. Component Architecture & UI Standards**: Pass. Plan uses focused community components and PrimeVue Dialog/Button/Avatar/Tag/Input/Textarea/InlineMessage patterns where applicable.
- **VII. Production-Ready Community Backend Contracts**: Pass. Plan requires additive SQL, RLS on every community table, fixed `search_path`, least-privilege grants, indexed FK/join/filter paths, stable RPC contracts, and server-side privacy/block/spoiler enforcement.

## Project Structure

### Documentation (this feature)

```text
specs/024-reading-circles/
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
    `-- <timestamp>_reading_circles.sql

src/
|-- types/
|   `-- index.ts
|-- stores/
|   |-- communityGraph.ts
|   `-- readingCircles.ts
|-- composables/
|   |-- useCache.ts
|   `-- useReadingCircles.ts
|-- components/
|   `-- community/
|       |-- ReadingCirclesPanel.vue
|       |-- ReadingCircleDialog.vue
|       |-- ReadingCircleInviteDialog.vue
|       |-- CircleReactionList.vue
|       `-- CircleReactionComposer.vue
`-- pages/
    `-- BookDetailPage.vue
```

**Structure Decision**: Use the existing Vue PWA and Supabase migration layout. Backend
behavior lives in one additive migration with tables, RLS, indexes, triggers, and stable RPCs.
Frontend state lives in a focused Pinia store/composable following the existing SWR pattern.
Book Detail mounts a compact Reading Circles entry point while dialog/list/composer behavior
stays inside dedicated community components.

## Complexity Tracking

No constitution violations or justified complexity exceptions.

## Phase 0: Research Summary

See [research.md](./research.md). Key decisions:

- Use accepted membership plus pending invitations instead of direct-add membership.
- Store source page and normalized percent-through-book on reactions.
- Enforce spoiler visibility in security-definer RPCs and RLS-safe predicates.
- Treat realtime payloads as safe invalidation/refetch unless readable delivery can be proven safe.
- Use composite and partial indexes for membership, invitation, book/work, reaction page/location, and FK paths.

## Phase 1: Design Summary

See:

- [data-model.md](./data-model.md)
- [contracts/sql-schema.md](./contracts/sql-schema.md)
- [contracts/rpc-contracts.md](./contracts/rpc-contracts.md)
- [contracts/ui-contracts.md](./contracts/ui-contracts.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Principle I/II Spoiler and Edition Safety**: Pass. Reactions store raw author page for display plus normalized percent-through-book for cross-edition visibility.
- **Principle IV Data Integrity**: Pass. Server-side checks reject invalid pages, missing total pages, ahead-of-author reactions, membership overflow, and blocked pair access before data is persisted or returned.
- **Principle VI UI**: Pass. UI contracts use PrimeVue-first components and small community components.
- **Principle VII RLS**: Pass. Every new table has RLS; direct table reads never expose private reaction content outside accepted safe membership.
- **Principle VII Indexing**: Pass. Design documents indexes for every FK and common join/filter path, including circle membership, pending invitations, book/work lookup, reaction location lookup, and block/follow joins.
- **Principle VII RPC Contracts**: Pass. Stable contracts cover create circle, invite readers, respond to invitations, list my circles, get circle detail, get visible reactions, add reaction, remove member, and leave circle.
- **Principle VII Privacy/Blocking**: Pass. Follow eligibility, invitation acceptance, either-direction blocks, and normalized progress gates are enforced server-side.
