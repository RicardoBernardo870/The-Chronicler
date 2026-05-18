# Testing

Last updated: 2026-05-17

BookHero uses Vitest with Vue Test Utils and jsdom.

## Test Configuration

| File | Purpose |
| --- | --- |
| `vitest.config.ts` | Vitest setup, jsdom environment, aliases. |
| `tests/unit/*` | Unit tests. |
| `package.json` | `test` and `test:watch` scripts. |

## Run Tests

```bash
pnpm test
```

Watch mode:

```bash
pnpm test:watch
```

## Existing Test Coverage

Current unit tests cover:

| Test file | Area |
| --- | --- |
| `tests/unit/useCache.spec.ts` | SWR cache primitive. |
| `tests/unit/readingQuest.spec.ts` | Reading quest calculations. |
| `tests/unit/progressSession.spec.ts` | Session start/progress behavior. |
| `tests/unit/milestoneDetect.spec.ts` | Reading milestone detection. |
| `tests/unit/masterRecap.spec.ts` | Master recap selection. |
| `tests/unit/completionPassportPrompt.spec.ts` | Completion prompt helper behavior. |
| `tests/unit/activeBookCompletion.spec.ts` | Active book behavior around completion. |

## Writing New Tests

Prefer focused tests for:

- Pure business rules in `src/utils`.
- Store behavior with mocked Supabase responses.
- Composables with meaningful state transitions.
- Regression tests for bugs involving progress, completion, cache invalidation, and route state.

Example command for a single file:

```bash
pnpm vitest run tests/unit/progressSession.spec.ts
```

If `pnpm vitest` is unavailable in your shell, use:

```bash
pnpm exec vitest run tests/unit/progressSession.spec.ts
```

## Test Data Strategy

The codebase currently uses hand-built mocks and fixtures inside unit tests. A shared fixture factory strategy is not currently documented.

## Integration and E2E Tests

Integration and end-to-end test setup is not currently documented in the codebase. Add coverage here if Playwright, Cypress, or Supabase integration tests are introduced.

## CI Behavior

CI configuration is not currently documented in the codebase; no `.github` workflow files were present during inspection.

