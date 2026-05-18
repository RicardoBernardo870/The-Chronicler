# Contributing

Last updated: 2026-05-17

BookHero is an active application with feature planning artifacts, migrations, unit tests, and a Vue/Supabase architecture. This page outlines contribution expectations.

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
- Migration updates for schema changes.
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

The repository uses numbered feature folders under `specs/`. Significant changes should add or update the relevant spec, plan, task list, contracts, and quickstart where appropriate.

## License

No license has been published yet. External contribution policy should be clarified before accepting broad public contributions.

