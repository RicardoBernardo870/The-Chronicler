<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0
Modified principles: N/A (initial ratification — no prior principles)
Added sections:
  - Core Principles (5 principles: I–V)
  - Technical Stack & Integration Standards
  - UX & Design Philosophy
  - Governance
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check gates align with principles I–V
  ✅ .specify/templates/spec-template.md — Functional requirements pattern aligns with FR nomenclature
  ✅ .specify/templates/tasks-template.md — Task phases reflect PWA, AI, and data integrity concerns
  ⚠ .specify/templates/commands/ — No command files present; no updates required
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm exact date stakeholders formally adopted this constitution
    (using today 2026-04-15 as default)
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

## Technical Stack & Integration Standards

- **Frontend**: Vue (TypeScript) PWA with service worker for offline support.
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
- UI must be inspired by iOS liquid glass

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
compliance with Principles I–V before Phase 0 research begins. Any justified deviation from
a principle MUST be documented in the plan's Complexity Tracking table with explicit rationale.

**Version**: 1.0.0 | **Ratified**: 2026-04-15 | **Last Amended**: 2026-04-15
