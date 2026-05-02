<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 -> 1.2.0
Bump rationale: MINOR - added a new Core Principle (VII. Production-Ready Community
Backend Contracts) for additive, RLS-first Supabase/Postgres community feature work.

Modified principles: None renamed or redefined.
Added sections:
  - Core Principle VII: Production-Ready Community Backend Contracts
Removed sections: None.

Templates requiring updates:
  - Updated .specify/templates/plan-template.md to include explicit Principle VII
    community backend gates.
  - Updated .specify/templates/spec-template.md to prompt community/social specs for
    backend contract, RLS, privacy, and blocking requirements.
  - Updated .specify/templates/tasks-template.md to include RLS, FK index, RPC contract,
    privacy, and blocking tasks for backend/social features.
  - .specify/templates/commands/ directory not present; no command templates updated.

Follow-up TODOs:
  - None. All placeholders previously resolved (RATIFICATION_DATE confirmed at v1.0.0).
-->
# The Chronicler Constitution

## Core Principles

### I. Memory Continuity (NON-NEGOTIABLE)

Every feature MUST serve the app's singular purpose: eliminating the cognitive friction of
returning to a book after a break. Summaries and recaps MUST be:

- Spoiler-free — content MUST NOT reference events beyond the user's current page percentage.
- Context-aware — output MUST be scoped to the user's exact progress (page number →
  percentage → content window).
- Three-tiered — every AI-generated recap MUST include: **The Memory Jogger** (recent events),
  **The Concept Watchlist** (key figures/ideas), and **The Thematic Bridge** (current narrative
  vibe).

**Rationale**: The entire value proposition collapses if a recap spoils future plot points or
fails to reflect where the reader actually is. This principle is the product's existential
constraint.

### II. Physical-to-Digital Bridge

The app MUST support physical book readers as first-class citizens. This means:

- ISBN scanning MUST resolve edition-specific metadata: title, author, cover art, total page
  count, and genre.
- Progress tracking MUST operate on absolute page numbers and derive percentage dynamically,
  ensuring accuracy across editions with differing page counts.
- Manual entry MUST remain available as a fallback when ISBN lookup fails or returns no result.

**Rationale**: Ignoring physical books excludes the majority of the target audience. Edition
awareness is required because page 200 of a hardcover is not the same narrative point as
page 200 of a mass-market paperback.

### III. AI-First Recap Engine

LLM integration is a core system component, not an optional enhancement. Requirements:

- The Recap Engine MUST accept title, author, and current progress percentage as its minimum
  input contract.
- Prompts MUST be engineered to enforce the spoiler-free constraint at the model instruction
  level, not just in post-processing.
- Recap generation latency MUST be acceptable for interactive use (target: response begins
  streaming within 3 seconds on a standard mobile connection).
- Recap outputs MUST be persisted per session so users can review historical recaps without
  re-invoking the LLM.

**Rationale**: The AI pipeline is the product's primary differentiator. Treating it as a
bolted-on feature would produce inconsistent quality and undermine trust.

### IV. Data Integrity & Synchronization

All reading progress and AI-generated insights MUST be persisted reliably across sessions and
devices:

- Supabase MUST be used as the primary datastore and real-time sync layer.
- Progress updates MUST be written synchronously before the UI confirms the update to the user.
- The app MUST handle offline gracefully: locally buffer progress updates and sync when
  connectivity is restored.
- User data (progress, recaps, library) MUST never be lost due to a browser refresh or device
  switch.

**Rationale**: A reading companion that loses progress is worse than no companion at all.
Data loss directly destroys the Memory Continuity mission.

### V. PWA-First & Frictionless Portability

The Chronicler MUST be delivered as a Progressive Web App (PWA) with no required native app
store installation:

- The app MUST be installable on iOS, Android, and desktop via standard PWA mechanisms.
- Core interactions (viewing current read, updating progress, triggering a recap) MUST be
  reachable within two taps/clicks from the home screen.
- The PWA MUST achieve a Lighthouse PWA score of ≥ 90.
- Bundle size MUST be minimized; lazy-load all non-critical features.

**Rationale**: Requiring an app store install adds friction that contradicts the "frictionless
portability" pillar. PWA enables instant access on any device the reader happens to have
nearby when they pick up a book.

### VI. Component Architecture & UI Standards (NON-NEGOTIABLE)

All new UI work MUST follow a **PrimeVue-first, single-responsibility** discipline. The intent
is to keep the codebase consistent, accessible, themable, and readable as it grows.

**PrimeVue-First Rules**:

- Before building any custom UI element, the developer MUST check the official PrimeVue
  documentation (https://primevue.org/) for an existing component that fits the requirement.
- The PrimeVue component MUST be used when one exists for the use case (Button, Dialog, Tabs,
  Accordion, DataTable, Image, Toast, Chip, Tag, InlineMessage, Panel, Card, etc.). Native
  HTML elements MAY be used for trivial structural primitives (`<section>`, `<header>`,
  `<article>`, semantic landmarks) where no PrimeVue equivalent is appropriate.
- Custom-built components are PERMITTED ONLY when (a) no PrimeVue component covers the
  requirement, OR (b) the closest PrimeVue component is fundamentally unsuited (e.g., its
  API forces a state model that conflicts with the feature's needs). The reasoning MUST be
  recorded in the feature's plan.md or as an inline code comment on the custom component.
- Styling MUST extend PrimeVue's design tokens and CSS variables wherever possible rather
  than overriding with hard-coded values; this preserves dark-mode and theme consistency
  required by Principle V's UX Philosophy.

**Vue Componentization Rules**:

- Each Vue component MUST have a **single, named responsibility**. Components that exceed
  ~250 lines of `<script setup>` + `<template>` combined SHOULD be decomposed into smaller
  units unless the complexity is intrinsic to the domain (e.g., a chart with many props).
- Page-level components MUST delegate substantive UI sections to dedicated child components
  living under `src/components/<feature-or-domain>/`. Pages SHOULD primarily orchestrate state
  and layout — they SHOULD NOT contain large blocks of presentational template logic.
- Reusable presentational logic MUST be extracted into `<script setup>` composables under
  `src/composables/` when shared by two or more components.
- Component naming MUST be PascalCase, multi-word (Vue style guide rule), and reflect the
  domain noun the component represents (e.g., `LastSessionCard`, `RecapCard`,
  `SessionCaptureField`) — not generic names like `Wrapper`, `Box`, `Container`.
- Imports of third-party components SHOULD be local to the component that uses them
  (per-component PrimeVue import) rather than global registration, to keep the bundle tree
  shakeable and the dependency surface explicit at the call site.

**Rationale**: PrimeVue is the project's UI foundation. Reinventing components that already
exist costs engineering time, fragments the design system, and creates accessibility
regressions because PrimeVue handles ARIA, keyboard nav, and theming out of the box. Likewise,
a Vue codebase that lets pages balloon into thousand-line components becomes unreadable,
untestable, and slow to iterate. A small-component, single-responsibility discipline is the
cheapest investment available in long-term maintainability.

### VII. Production-Ready Community Backend Contracts (NON-NEGOTIABLE)

All community and social feature backend work MUST be designed as additive, production-ready
Supabase/Postgres infrastructure from its first migration. These rules apply to public
profiles, follows, feeds, reading circles, book clubs, social lexicon features, discovery,
blocking, privacy, and any future iOS-facing community contract.

- Backend additions MUST be additive and MUST NOT break existing PWA behavior, tables, routes,
  or cached client data contracts.
- Supabase/Postgres schema changes MUST include RLS from the first migration; no community
  table may ship with a later "RLS follow-up" task.
- RLS policies MUST avoid per-row expensive auth calls where possible by using
  `(select auth.uid())`, indexed helper checks, or stable helper functions with a fixed
  `search_path`.
- Every foreign key and common filter/join column MUST have a matching index unless the plan
  documents a measurable reason not to add one.
- Public/social reads SHOULD expose stable RPC contracts where they reduce client coupling,
  so the future iOS app can consume the same backend without reverse-engineering PWA queries.
- Privacy and blocking MUST be enforced server-side through RLS, RPC predicates, or both;
  client-side filtering alone is never sufficient for social data.
- PWA UI for community features MAY be minimal during early validation, but backend data
  contracts SHOULD be final or close to final before implementation begins.

**Rationale**: Community features make private reading identity visible to other users. A
social backend that is merely "good enough for the PWA" will leak implementation details,
create migration pain for the future iOS app, and risk privacy failures that cannot be fixed
with frontend checks. Production-ready RLS, indexing, and stable contracts are the minimum
foundation for safe reader-to-reader features.

## Technical Stack & Integration Standards

- **Frontend**: Vue (TypeScript) PWA with service worker for offline support.
- **UI Library**: PrimeVue 4 — the canonical component library per Principle VI.
- **Backend / BaaS**: Supabase (PostgreSQL + Auth + Realtime + Storage).
- **AI Layer**: Claude API (Anthropic) — default to the latest capable model for recap
  generation; include prompt caching to reduce latency and cost on repeated lookups.
- **ISBN Metadata**: Open Library API (primary) with fallback to Google Books API.
- **Authentication**: Supabase Auth (email/password + magic link at minimum).
- **Hosting**: Static PWA deployment (Vercel or equivalent CDN-backed host).

All third-party integrations MUST have clearly defined fallback behavior. Failures in ISBN
lookup or AI generation MUST degrade gracefully without blocking core progress tracking.

## UX & Design Philosophy

The Chronicler's UI MUST remain minimalist and distraction-free:

- The dashboard MUST surface exactly two primary actions: **Update Current Read Progress**
  and **Get Recap / Review Historical Recaps**.
- No gamification, social features, or discovery feeds in v1. Scope additions only when
  validated by user research.
- The app MUST be fully usable one-handed on a mobile device.
- Color scheme and typography MUST prioritize legibility in low-light reading environments
  (dark mode MUST be supported from day one).
- Empty states MUST provide clear, actionable onboarding copy — never a blank screen.
- UI must be inspired by iOS liquid glass.
- All UI elements MUST adhere to Principle VI (PrimeVue-first + componentization).

**Rationale**: Complexity is the enemy of the use case. A reader reaching for the app has
one goal: get oriented and get back to reading. Every extra click is a failure.

## Governance

This Constitution supersedes all other written or verbal project guidance. Amendments require:

1. A written rationale explaining why the change is necessary.
2. An updated version number following semantic versioning:
   - **MAJOR**: Removal or redefinition of a Core Principle.
   - **MINOR**: Addition of a new principle or materially expanded guidance to an existing one.
   - **PATCH**: Clarifications, wording improvements, or non-semantic refinements.
3. An updated `LAST_AMENDED_DATE`.
4. Propagation review: all templates and command files MUST be checked for consistency after
   any MAJOR or MINOR amendment.

All implementation plans (`plan.md`) MUST include a Constitution Check gate that verifies
compliance with Principles I-VII before Phase 0 research begins. Any justified deviation from
a principle MUST be documented in the plan's Complexity Tracking table with explicit rationale.
For Principle VI specifically, any custom UI component built in lieu of an available PrimeVue
component MUST be justified in the plan's Complexity Tracking table or as a dedicated comment
on the custom component file. For Principle VII specifically, community/social plans MUST
document RLS, indexing, RPC contracts, privacy enforcement, blocking enforcement, and PWA
compatibility before Phase 1 design is considered complete.

**Version**: 1.2.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-05-02
