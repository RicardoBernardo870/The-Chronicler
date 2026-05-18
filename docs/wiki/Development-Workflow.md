# Development Workflow

Last updated: 2026-05-17

This page captures practical development conventions for BookHero.

## Common Commands

```bash
pnpm dev
pnpm test
pnpm test:watch
pnpm build
pnpm preview
```

Equivalent npm commands should work because scripts are defined in `package.json`:

```bash
npm run dev
npm test
npm run build
```

## Branching

The repository contains Spec Kit feature folders named like `specs/029-completion-passport-session`. Branch naming conventions are not fully documented in the application code, but current feature work follows numbered feature names.

Suggested convention:

```text
<number>-<short-feature-name>
```

Example:

```text
029-completion-passport-session
```

## Adding a Feature

1. Read the relevant existing stores, pages, composables, and migrations.
2. Add or update a Spec Kit feature under `specs/` when the change is significant.
3. Keep domain logic close to existing stores/composables.
4. Add focused unit tests for pure helpers, stores, and critical business rules.
5. Run tests and build before review.

## Code Style

- Use TypeScript with strict typing.
- Use Vue Composition API and `<script setup>`.
- Prefer existing PrimeVue components and local component patterns.
- Keep database row mapping in `src/types/index.ts`.
- Keep UI workflow state in pages/components and persistence in Pinia stores.
- Keep pure rules in `src/utils` when they need standalone tests.

## Database Changes

1. Add a migration under `supabase/migrations`.
2. Include RLS for new user-owned tables.
3. Add indexes for new user-scoped or time-ordered queries.
4. Update TypeScript types/mappers.
5. Update relevant stores and tests.

## Edge Function Changes

1. Edit the function under `supabase/functions/<name>`.
2. Keep provider secrets server-side.
3. Validate auth using the Supabase JWT.
4. Return structured errors where practical.
5. Update [[API Documentation]] if request or response contracts change.

## Debugging Tips

- Check browser console first for missing env variables or Supabase errors.
- Inspect Network tab for Edge Function status codes.
- Confirm the authenticated user exists before store fetches.
- Use Supabase logs for function failures.
- Use Supabase SQL editor to verify RPC availability.
- For PWA issues, test with a fresh browser profile or clear service worker/storage.

## Pull Request Checklist

- Tests pass.
- Build passes.
- New environment variables are documented.
- New tables have RLS.
- New RPCs are listed in [[API Documentation]] or [[Database Data Model]].
- User-facing behavior is documented in [[Features]].

