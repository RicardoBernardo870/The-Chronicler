# Testing

Last updated: 2026-10-18

The PWA has **unit tests only**: Vitest 4 with jsdom, globals and `@vue/test-utils`. There is no lint script, no CI workflow, no end-to-end suite, no database (pgTAP) tests and no edge-function (Deno) tests. Tests were last inventoried on web `master` @ `8d8701c`; this inventory is static (the suite was not executed while writing this page).

---

## Configuration

| File | Purpose |
|---|---|
| `vitest.config.ts` | `environment: 'jsdom'`, `globals: true`, `@` alias → `src` |
| `package.json` | `test` = `vitest run`, `test:watch` = `vitest` |
| `tests/unit/*.spec.ts` | All current tests |
| `src/composables/__tests__/`, `src/components/capture/__tests__/`, `src/components/session/__tests__/` | Empty. Vitest's default include pattern would pick up `*.spec.ts` / `*.test.ts` files placed here |

## Run tests

```bash
pnpm test                 # run once
pnpm test:watch           # watch mode
pnpm exec vitest run tests/unit/progressSession.spec.ts   # one file
pnpm exec vitest run -t "swrRun"                          # by test name
```

`CLAUDE.md` lists `npm test; npm run lint`: there is no `lint` script, and the repo uses pnpm (PLT-D41). Type-checking happens in `pnpm build` (`vue-tsc -b`).

---

## Test map

26 spec files, about 121 cases.

| Area | Spec file | Cases | Unit under test |
|---|---|---|---|
| **Platform** | `useCache.spec.ts` | 11 | SWR states (fresh / background / loading), concurrent de-duplication, touch, invalidate + prefix, `clearAll`, revalidate, error path |
| | `retryingFetch.spec.ts` | 6 | One retry on a `/rest/v1/` 401, no retry elsewhere, persistent-failure callback |
| **Library** | `bookSearchService.spec.ts` | 5 | `mapGoogleVolume`, `searchBooks`, `getBookDetail` |
| | `useBookSearch.spec.ts` | 3 | Search composable state |
| | `cleanDescription.spec.ts` | 5 | Description cleaning |
| | `duplicateBook.spec.ts` | 4 | `isDuplicateBook` (ISBN / title + author) |
| | `searchText.spec.ts` | 3 | Accent- and case-insensitive library search |
| | `importCsvFormat.spec.ts` | 4 | `detectImportSource` |
| | `importDedupe.spec.ts` | 6 | `cleanIsbn`, `makeDedupeKey`, `parsePages`, `mapStatusToInitial`, `firstAuthor` |
| | `importGoodreadsParser.spec.ts` | 5 | `parseGoodreadsRow` |
| | `importStorygraphParser.spec.ts` | 4 | `parseStorygraphRow` |
| **Sessions & progress** | `progressSession.spec.ts` | 2 | `progressStore.startSession` (mocked Supabase) |
| | `activeBookCompletion.spec.ts` | 2 | `useActiveBook` hand-off after completion |
| | `pageSave.spec.ts` | 6 | `checkPageSave` (page-sheet validation) |
| | `completionPassportPrompt.spec.ts` | 4 | Completion → passport prompt eligibility |
| **Recaps** | `masterRecap.spec.ts` | 10 | `buildMasterRecap` |
| | `recapLockIdleUnlock.spec.ts` | 3 | `useRecapLock` 72 h idle unlock |
| **Capture** | `useCaptureImport.spec.ts` | 3 | `useCapture.importImage` |
| **Insights** | `milestoneDetect.spec.ts` | 16 | `detectCrossedMilestone` |
| | `milestoneNudge.spec.ts` | 5 | `pagesToNextInsight` |
| **Codex** | `leitnerDue.spec.ts` | 3 | `useLeitner.getDueWord` |
| | `ankiDueCards.spec.ts` | 1 | `useAnkiSession.dueCards` |
| | `dailyReviewLimit.spec.ts` | 2 | Daily review tally (`DAILY_REVIEW_LIMIT`) |
| | `todaysReviewSet.spec.ts` | 2 | `eligibleReviewWords`, today's set cap |
| | `dueTodayCount.spec.ts` | 1 | `lexiconStore.dueTodayCount` |
| **Profile** | `readingQuest.spec.ts` | 5 | Quest status, reader level, response mapping |

### Not covered

| Gap | Why it matters | Rules |
|---|---|---|
| Auth store (3 s init timeout, user snapshot, `clearAll` on user change, sign-out failure) | Cold-start and account-switch regressions | PLT-09 … PLT-17 |
| Router guard (order, redirects) | Deep links, signed-out access | PLT-18, PLT-19 |
| Offline queue + drain (enqueue, FIFO replay, `pendingSync`, concurrent drains) | Silent data loss | PLT-43 … PLT-49 |
| Service worker (precache, navigation fallback, Background Sync relay, update reload) | Offline shell, deploy behaviour | PLT-50 … PLT-54 |
| Theme, glass toast, load-failure cooldown | UI regressions | PLT-35, PLT-37, PLT-40 |
| Online `updateProgress` side effects (history, session clear, passport, Insight) | Core write path | [02 · Reading sessions](../business-rules/02-reading-sessions.md) |
| RPC contracts and RLS | Security (BC-01) and stats formulas | [09 · Database invariants](../business-rules/09-database-invariants.md) |
| Edge functions (validation, auth, error bodies) | Security (BC-02) and AI cost | [backend contract §10](../backend-contract.md#10-edge-functions) |
| End-to-end flows | Cross-domain effects (delete, complete, DNF, import, sign-out) | [11 · Cross-domain](../business-rules/11-cross-domain.md) |

Tracked as PLT-D41.

---

## Writing unit tests

Patterns used by the existing suite:

- **Mock the Supabase client module**, not the network: `vi.mock('@/services/supabase', () => ({ supabase: { from: fromMock, auth: { … } } }))`, with chainable mocks created through `vi.hoisted` (see `progressSession.spec.ts`).
- **Mock side-effect composables** such as `@/composables/useOfflineSync` when testing a store.
- **Fresh Pinia per test**: `setActivePinia(createPinia())` in `beforeEach`.
- **Module singletons keep state between tests** (`useCache`, `useActiveBook`, `useBookSearch`, `useGlassToast`, …). Reset them explicitly (for example `clearAll()` for the cache) or re-import with `vi.resetModules()`.
- **Time**: use `vi.useFakeTimers()` / `vi.setSystemTime()` for TTLs, cooldowns (6 h recap, 72 h idle, 48 h Memory Check) and day boundaries; set `process.env.TZ` when a rule depends on the local zone.
- **Name tests after rule IDs** from the [business-rules catalog](../business-rules/README.md) (for example `it('PLT-28 invalidate forces a loading fetch', …)`) so a failing test points at the rule it protects.

Good candidates: pure rules in `src/utils/`, store actions with mocked Supabase responses, composables with real state transitions, and regression tests for progress, completion, cache invalidation and route state.

---

## Manual verification (until automated)

| Behaviour | How to check |
|---|---|
| Service worker, precache, update reload | `pnpm build && pnpm preview` (the SW is disabled under `pnpm dev`). DevTools → Application → Service workers; deploy a second build and confirm one reload on `controllerchange` |
| Offline queue | DevTools → Network → Offline; save a page; inspect IndexedDB `chronicler-offline` → `progress_queue`; go online and confirm the record is replayed and deleted |
| Background Sync | Chromium only: Application → Background services → Background Sync, tag `progress-sync` |
| SWR cache | Dev build: `window.__bookheroCache.keys()`, `.get(key)`, `.stats()` |
| Edge-function errors | Network tab: status and JSON `{ error }` body; Supabase function logs |
| RPC caller checks | Read-only SQL in the Supabase SQL editor (`pg_get_functiondef`, `has_function_privilege`) |

---

## Phase 0 test strategy (target)

The [consolidation plan](../backend-consolidation-plan.md) makes **rule IDs the acceptance tests** (principle P5):

| Layer | Tooling | Scope |
|---|---|---|
| Database | pgTAP via `supabase test db` on a local stack reset from the BC-03 baseline | RLS (own vs foreign rows, book-ownership checks), RPC caller checks (signed-in other user, `anon`), function grants, lifecycle triggers, `save_progress` idempotency and server clock, time-zone boundaries |
| Edge functions | Deno tests per function | 401 for unsigned / foreign-key / expired / anon-key tokens with no AI call; base64url `-`/`_` tokens accepted; no internal error text; ownership before cost (BC-02 acceptance 02-1 … 02-5) |
| PWA | Vitest + manual regression list per package | Each BC lists a PWA regression criterion (for example 02-6: recap, Insight, OCR capture and passport generation still succeed) |
| Catalog | Same PR as the code | When a package lands, the affected rules change from "client-only" to "server-enforced" |

Recommended additions now: a `lint` script (`vue-tsc --noEmit` + ESLint) and a CI workflow running `pnpm test` and `pnpm build` on every PR.
