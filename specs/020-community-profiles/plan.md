# Implementation Plan: Community Reader Profiles

**Branch**: `020-community-profiles` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-community-profiles/spec.md`

## Summary

Add the first BookHero community foundation slice: signed-in users can create/edit a
public reader profile, choose granular privacy for public-facing reading sections, preview
the profile, and view another user's allowed public profile by username. The backend is the
durable source of truth for both the PWA and future iOS app: additive Supabase migrations
with RLS from the first migration, indexed follow/block compatibility tables, and stable RPC
contracts that omit hidden sections instead of leaking reason codes.

## Technical Context

**Language/Version**: TypeScript 6.x, Vue 3.5 Composition API, SQL for Supabase PostgreSQL  
**Primary Dependencies**: Vue Router 4, Pinia 3, Supabase JS v2, PrimeVue 4, existing SWR cache primitive  
**Storage**: Supabase PostgreSQL; no new client persistence beyond existing in-memory/SWR caches  
**Testing**: `npx.cmd vue-tsc -b`; manual PWA validation; SQL/RPC smoke checks in Supabase SQL editor or MCP  
**Target Platform**: Current Vue PWA first, stable backend contracts for future native iOS reuse  
**Project Type**: Single PWA repository with Supabase backend migrations and frontend routes/components  
**Performance Goals**: Username/public-profile lookups complete in one RPC round trip; indexed reads avoid full scans on social tables  
**Constraints**: Additive schema only; existing private Profile page behavior unchanged; no direct public table reads leaking private sections; hidden sections omitted without reason codes  
**Scale/Scope**: Foundation slice for public profiles, minimal follows, and block compatibility; no feed, discovery, reading circles, subscriptions, or full follow management UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Principle I: Memory Continuity unaffected. Public profile reads may summarize existing reading data but must never alter recap behavior.
- Principle II: Physical-to-Digital Bridge preserved. Current reading visibility may expose edition-specific title/cover/page details only when allowed.
- Principle III: AI-First Recap Engine unaffected. Reader DNA may be summarized, but generation remains existing private behavior.
- Principle IV: Data Integrity & Synchronization passes. Profile/follow/block data persists in Supabase; mutations are server-confirmed before UI success.
- Principle V: PWA-First portability passes. PWA UI is minimal and backed by contracts reusable by future iOS.
- Principle VI: Component Architecture passes. Planned UI uses PrimeVue form/input/message/card primitives and small profile components.
- Principle VII: Community Backend Contracts passes. Design is additive, RLS-first, indexed, privacy/blocking enforced server-side, and RPC-backed for iOS reuse.

No constitution violations identified.

## Project Structure

### Documentation (this feature)

```text
specs/020-community-profiles/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── rpc-contracts.md
│   └── sql-schema.md
└── tasks.md
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    └── <timestamp>_community_profiles.sql

src/
├── components/
│   └── community/
│       ├── PublicProfileCard.vue
│       ├── PublicProfilePreview.vue
│       ├── ProfilePrivacyControls.vue
│       └── UsernameField.vue
├── composables/
│   └── useCommunityProfile.ts
├── pages/
│   ├── CommunityProfileEditPage.vue
│   └── PublicProfilePage.vue
├── router/
│   └── index.ts
├── stores/
│   └── communityProfile.ts
└── types/
    └── index.ts
```

**Structure Decision**: Use the existing single PWA structure. Backend work lives in
`supabase/migrations`; frontend state follows the existing Pinia/composable pattern; reusable
UI lives under `src/components/community/`; routes are added to the existing router.

## Phase 0: Research

Research decisions are captured in [research.md](./research.md). All planning unknowns are
resolved: username lifecycle, follower-only privacy, hidden section payload shape, lexicon
highlight definition, and Supabase RLS/indexing posture.

## Phase 1: Design & Contracts

Design artifacts:

- [data-model.md](./data-model.md)
- [contracts/rpc-contracts.md](./contracts/rpc-contracts.md)
- [contracts/sql-schema.md](./contracts/sql-schema.md)
- [quickstart.md](./quickstart.md)

## Constitution Check (Post-Design)

- Principle VI remains satisfied: PrimeVue primitives are sufficient for the edit form, preview,
  visibility controls, unavailable state, and public profile card. No custom control is required.
- Principle VII remains satisfied: data model includes RLS-first tables, `(select auth.uid())`
  policy guidance, indexed FK/filter/join paths, stable RPC contracts, server-side privacy, and
  block/follow compatibility.
- No violations require Complexity Tracking entries.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
