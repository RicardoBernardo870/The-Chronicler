# Contributing

Last updated: 2026-10-18

The Chronicler (internal code name BookHero, D-03) is an active application with a business-rules catalog, migrations, unit tests, and a Vue/Supabase architecture. This page outlines contribution expectations.

## Before You Start

1. Read [[Getting Started]].
2. Run the app locally.
3. Read the relevant feature area in [[Features]].
4. Inspect existing stores, components, and migrations before adding new patterns.

## Code Style

- Use TypeScript and strict typing.
- Use Vue Composition API with `<script setup>`.
- Prefer existing PrimeVue and local component patterns.
- Keep persistence logic in Pinia stores or services.
- Keep reusable workflow logic in composables.
- Keep pure domain rules in `src/utils`.
- Keep user-owned database access protected by RLS.

## Pull Request Expectations

Every meaningful PR should include:

- Clear description of user-facing behavior.
- Tests for changed business rules where practical.
- Rule IDs from the [business-rules catalog](../business-rules/README.md), and catalog updates for changed rules.
- For backend changes: one new migration file, a regenerated `supabase/reference/` snapshot and a [backend-contract.md](../backend-contract.md) update (BC-03).
- Documentation updates for new env variables, APIs, or workflows.
- `pnpm test` result.
- `pnpm build` result.

## Review Checklist

| Check | Why it matters |
| --- | --- |
| Auth/RLS considered | Prevents cross-user data access. |
| Edge Function secrets server-side | Prevents provider key leakage. |
| Cache invalidation handled | Prevents stale dashboard/profile/library data. |
| Offline behavior considered | Protects progress-saving workflows. |
| Tests cover regressions | Keeps reading/session flows stable. |
| UI follows existing patterns | Keeps the app cohesive. |

## Issue Reporting

When reporting a bug, include:

- Route or screen.
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Browser/device.
- Console error, if present.
- Whether the issue involves Supabase, AI generation, camera/OCR, or offline sync.

## Feature Planning

Features are built with Claude Code (Opus 5.5; ultracode mode from a kickoff brief for large work), not Spec Kit (D-02). The `specs/` folders are historical reference only; do not add new ones. Start from the rules and decisions in the [business-rules catalog](../business-rules/README.md) and follow [[Development Workflow]].

## License

No license has been published yet. External contribution policy should be clarified before accepting broad public contributions.

