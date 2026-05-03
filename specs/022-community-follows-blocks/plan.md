# Implementation Plan: Community Follows And Blocks

**Branch**: `022-community-follows-blocks` | **Date**: 2026-05-03 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/022-community-follows-blocks/spec.md`

## Summary

Add the BookHero asymmetric social graph on top of the existing community profile foundation.
The implementation expands the already-created `follows` and `blocks` foundation with durable
follow counts, stable server-side relationship RPCs, blocked-user management, visible-reader
search, and follower/following list contracts. Privacy and blocking are enforced server-side so
the current PWA and future native iOS app can share the same backend behavior.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5 Composition API, PostgreSQL SQL/PLpgSQL for Supabase migrations  
**Primary Dependencies**: Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, existing SWR cache primitive  
**Storage**: Supabase PostgreSQL; existing `community_profiles`, `community_profile_privacy`, `follows`, and `blocks`; new additive follow-count and search/index support  
**Testing**: `npx.cmd vue-tsc -b`; Supabase SQL smoke checks; Supabase security/performance advisors after migration; manual quickstart flows  
**Target Platform**: PWA first, with backend contracts designed for future native iOS clients  
**Project Type**: Vue PWA plus Supabase/Postgres backend migrations and RPC contracts  
**Performance Goals**: Follow/unfollow state visible within 1 second; reader search for up to 50 visible matches within 1 second; follower/following list pages load without deep-offset scans  
**Constraints**: Additive migration only; RLS from first migration change; block/privacy enforcement server-side; no client-only filtering for social visibility; no activity feed, recommendations, notifications, or reading circles in this feature  
**Scale/Scope**: Early community graph for beta/select users, designed with production-safe indexes, idempotent writes, durable counts, and stable contracts for larger rollout

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Memory Continuity**: Pass. Feature does not change recap/progress behavior and does not introduce spoiler-bearing surfaces.
- **II. Physical-to-Digital Bridge**: Pass. No ISBN/progress model changes.
- **III. AI-First Recap Engine**: Pass. No AI generation changes.
- **IV. Data Integrity & Synchronization**: Pass. Relationship writes are confirmed before UI success; counts are server-owned and durable.
- **V. PWA-First & Frictionless Portability**: Pass. UI remains PWA-first and backend contracts are mobile-portable.
- **VI. Component Architecture & UI Standards**: Pass. Planned UI uses PrimeVue primitives and small community components/composables.
- **VII. Production-Ready Community Backend Contracts**: Pass. Plan requires additive migrations, RLS-aware RPCs, `(select auth.uid())` patterns, indexed FK/search paths, server-side privacy/blocking, and stable RPC contracts.

## Project Structure

### Documentation (this feature)

```text
specs/022-community-follows-blocks/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sql-schema.md
│   ├── rpc-contracts.md
│   └── ui-contracts.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── <timestamp>_community_follows_blocks.sql

src/
├── types/
│   └── index.ts
├── stores/
│   └── communityGraph.ts
├── composables/
│   └── useCommunityGraph.ts
├── components/
│   └── community/
│       ├── FollowButton.vue
│       ├── FollowCounts.vue
│       ├── ReaderSearchDialog.vue
│       ├── FollowListDialog.vue
│       └── BlockedUsersPanel.vue
└── pages/
    ├── PublicProfilePage.vue
    └── CommunityProfileEditPage.vue
```

**Structure Decision**: Use the existing Vue PWA and Supabase migration structure. Backend
contracts live in `supabase/migrations` and are consumed through a dedicated community graph
store/composable. Presentational pieces stay under `src/components/community/`; pages only
orchestrate profile and account-management surfaces.

## Complexity Tracking

No constitution violations or justified complexity exceptions.

## Phase 0: Research Summary

See [research.md](./research.md). Key decisions:

- Extend existing `follows` and `blocks` tables instead of recreating them.
- Add durable `community_follow_counts` maintained by triggers/functions.
- Centralize visibility/blocking in server-side helper predicates and RPCs.
- Use cursor pagination for follower/following and blocked-user lists.
- Use indexed text search for username/display-name search.

## Phase 1: Design Summary

See:

- [data-model.md](./data-model.md)
- [contracts/sql-schema.md](./contracts/sql-schema.md)
- [contracts/rpc-contracts.md](./contracts/rpc-contracts.md)
- [contracts/ui-contracts.md](./contracts/ui-contracts.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

- **Principle VII RLS**: Pass. Contracts require RLS on new table, owner-only mutation policies, and security-definer RPCs with fixed `search_path`.
- **Principle VII Indexing**: Pass. Contracts include indexes for count lookups, both relationship directions, blocks, and profile search.
- **Principle VII RPC Contracts**: Pass. Search, follow/unfollow, block/unblock, list reads, blocked-user management, and interaction checks are defined as stable RPC contracts.
- **Principle VII Privacy/Blocking**: Pass. RPC contracts require server-side exclusion for blocked pairs and hidden profiles.
- **Principle VI UI**: Pass. UI contracts use PrimeVue dialogs, buttons, lists, empty states, and existing community page composition.
