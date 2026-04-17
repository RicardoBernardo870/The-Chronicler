# Tasks: SWR Data Caching & Instant Navigation

**Input**: Design documents from `/specs/006-swr-data-caching/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cache-api.md ✅, quickstart.md ✅

**Tests**: Unit tests included for the cache primitive (the most complex, pure-function surface). No TDD for store refactors — store changes are wiring, not logic.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 but US1 (reads) must precede US2 (writes) because mutations depend on the cache being in place.

**AI exclusion guardrail**: Tasks T010 and T015 explicitly scope what is and is NOT touched in recaps.ts. Any task that touches recaps.ts must re-read FR-009 before starting.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Cache Primitive)

**Purpose**: Create the `useCache()` composable — the one new piece of infrastructure everything else builds on.

- [X] T001 Create `src/composables/useCache.ts`: implement `CacheEntry<T>`, `CacheHandle<T>`, `CacheOptions` types and the five public functions (`swr`, `mutate`, `invalidate`, `clearAll`, `revalidate`) plus the `cacheKeys` helpers object (`books`, `progress`, `lexicon`, `lexiconAll`, `recaps`, `bookPassport`, `upNext`) per `specs/006-swr-data-caching/contracts/cache-api.md`. Module-level `Map<string, CacheEntry>` singleton. Deduplicate concurrent `swr()` calls for the same key via `inflight` promise ref.
- [X] T002 [P] Create `tests/unit/useCache.spec.ts` implementing all 10 contract tests from `specs/006-swr-data-caching/contracts/cache-api.md § Testing contract`: (1) fresh hit skips fetcher, (2) stale serves data + triggers revalidation, (3) concurrent dedup, (4) mutate updates + resets fetchedAt, (5) invalidate marks stale, (6) prefix invalidate, (7) clearAll empties, (8) auth change triggers clearAll, (9) revalidate forces fetch even when fresh, (10) error preserves previous data.

---

## Phase 2: Foundational (Auth Wiring + Dev Observability)

**Purpose**: Wire the cache to the auth lifecycle (mandatory for safety) and expose the dev debug surface. MUST be complete before any store adoption.

**⚠️ CRITICAL**: Skipping T003 means old user data will bleed through on re-login (SC-005 / FR-008 violation).

- [X] T003 Wire `clearAll()` to auth user-change in `src/stores/auth.ts`: add a `watch(() => authStore.user?.id, (newId, oldId) => { if (newId !== oldId) clearAll() })` that fires when the authenticated user id transitions (login, logout, or switch). Import `clearAll` from `src/composables/useCache.ts`.
- [X] T004 [P] Add dev-only observability proxy to `src/composables/useCache.ts`: at module bottom, wrap with `if (import.meta.env.DEV)` and assign `window.__bookheroCache = { keys: () => [...entries.keys()], get: (k) => entries.get(k), stats: () => ({ hits, misses, revalidations }) }`. Track `hits`/`misses`/`revalidations` counters internally.

**Checkpoint**: Foundation ready — useCache primitive exists, auth wiring is live, dev tools available.

---

## Phase 3: User Story 1 — Instant Return Navigation (Priority: P1) 🎯 MVP

**Goal**: Previously-visited pages render their cached data immediately with no skeleton/spinner on return navigation.

**Independent Test**: Load Library → navigate to book detail → navigate back to Library. The book list must appear instantly. Smoke 1 and Smoke 2 in `quickstart.md`.

- [X] T005 [P] [US1] Refactor `src/stores/books.ts`: replace `books = ref<Book[]>([])` + manual `loading` ref with `swr(cacheKeys.books(uid), fetcher, { ttlMs: 60_000 })` handle. Expose `books` as `computed(() => handle.value?.data.value ?? [])` and `isInitialLoading` as `computed(() => handle.value?.isInitialLoading.value ?? false)`. Keep `fetchLibrary()` as a no-op shim for backward compatibility.
- [X] T006 [P] [US1] Refactor `src/stores/progress.ts`: replace `progressMap = ref<Record<string, Progress>>({})` + manual `loading` with `swr(cacheKeys.progress(uid), fetcher, { ttlMs: 30_000 })`. Expose `progressForBook(id)` as a computed accessor on the cached map. Keep `fetchProgress()` as no-op shim.
- [X] T007 [P] [US1] Refactor `src/stores/lexicon.ts`: replace `entriesByBook` map population in `fetchEntriesForBook` and `fetchEntriesForAllBooks` with `swr(cacheKeys.lexicon(uid, bookId), ...)` and `swr(cacheKeys.lexiconAll(uid), ...)` respectively (ttlMs: 60 000 each). Expose `entriesByBook` and `allEntries` as derived computeds from cache handles.
- [X] T008 [P] [US1] Refactor `src/stores/bookPassport.ts`: replace manual fetch + loading with `swr(cacheKeys.bookPassport(uid, bookId), fetcher, { ttlMs: 60_000 })`. Expose `passport(bookId)` accessor.
- [X] T009 [P] [US1] Refactor `src/stores/upNext.ts`: replace manual fetch + loading with `swr(cacheKeys.upNext(uid), fetcher, { ttlMs: 60_000 })` if the store has a list fetch. Expose `upNextList` as cached computed.
- [X] T010 [US1] Refactor `src/stores/recaps.ts` fetchRecapsForBook ONLY: replace the per-book history list fetch with `swr(cacheKeys.recaps(uid, bookId), fetcher, { ttlMs: 60_000 })`. **STRICT EXCLUSION**: `generateRecap`, `generationStatus`, `streamingFragments`, and all stream-handler code in this file MUST remain completely untouched. Verify by grepping: `rg "useCache|swr\(" src/stores/recaps.ts` must match ONLY the fetchRecapsForBook function body.
- [X] T011 [US1] Update page components to use `isInitialLoading` instead of `loading` for skeleton rendering: `src/pages/LibraryPage.vue`, `src/pages/LexiconPage.vue`, `src/pages/BookDetailPage.vue`, `src/pages/DashboardPage.vue`, `src/pages/RecapHistoryPage.vue`, `src/pages/BookPassportPage.vue`. Replace every `v-if="storeX.loading"` skeleton guard with `v-if="storeX.isInitialLoading"`.

**Checkpoint**: US1 complete. Smoke 1–2 in quickstart.md must pass.

---

## Phase 4: User Story 2 — Lists Stay in Sync After Mutations (Priority: P1)

**Goal**: Every add/edit/delete immediately updates the affected cache keys so no list ever shows stale data after a user action.

**Independent Test**: Add a book → Library shows it immediately without reload. Delete a lexicon word → it's gone on return to Lexicon. Smoke 3–4 in `quickstart.md`.

- [X] T012 [US2] Add mutation cache effects to `src/stores/books.ts`: (a) `addBook` → after server confirms, call `mutate(cacheKeys.books(uid), prev => [created, ...prev])`. (b) `updateBook` → `mutate(cacheKeys.books(uid), prev => prev.map(b => b.id === id ? {...b, ...changes} : b))`. (c) `removeBook` → after server confirms, call `mutate(filter)` on `cacheKeys.books`, then `invalidate(cacheKeys.progress(uid))`, `invalidate('lexicon:'+uid, { prefix: true })`, `invalidate(cacheKeys.recaps(uid, id))`, `invalidate(cacheKeys.bookPassport(uid, id))`.
- [X] T013 [US2] Add mutation cache effects to `src/stores/lexicon.ts`: `addEntry` → `mutate(cacheKeys.lexicon(uid, bookId), append)` AND `mutate(cacheKeys.lexiconAll(uid), append)`. `deleteEntry` → `mutate` both keys filtering out the deleted id.
- [X] T014 [P] [US2] Add mutation cache effect to `src/stores/progress.ts` `updateProgress`: after server write succeeds, call `mutate(cacheKeys.progress(uid), prev => ({...prev, [bookId]: { ...prev[bookId], currentPage: page, percentage: ... }}))` with the server-confirmed values.
- [X] T015 [P] [US2] Add recap-completion cache invalidation to `src/stores/recaps.ts`: in the post-stream success handler (after `generateRecap` stream closes successfully), call `invalidate(cacheKeys.recaps(uid, bookId))` so the next Recap History visit refetches the now-updated list. **This is the ONLY permitted cache write in recaps.ts** — no `swr()` or `mutate()` in streaming paths.
- [X] T016 [P] [US2] Add mutation cache effect to `src/stores/upNext.ts` `reorder`: after server confirms, call `mutate(cacheKeys.upNext(uid), newOrder)`.

**Checkpoint**: US1 + US2 complete. Smokes 1–4 must pass.

---

## Phase 5: User Story 3 — Data Freshness Guarantees (Priority: P2)

**Goal**: App revalidates stale cached data automatically when the user refocuses the tab, without causing visible loading states.

**Independent Test**: Load Library, wait > 60 s (or temporarily lower TTL), background the tab, re-focus — Network tab shows a background fetch. Smoke 8 in `quickstart.md`.

- [X] T017 [US3] Add subscriber tracking to `src/composables/useCache.ts` `swr()`: maintain a `subscriberCount: number` field on each `CacheEntry`. Inside `swr()`, use Vue's `getCurrentInstance()` or `onScopeDispose()` to increment on call and decrement on consumer teardown. Subscriber count ≥ 1 means the key is "live".
- [X] T018 [US3] Implement `visibilitychange` listener in `src/composables/useCache.ts` (registered once at module init): when `document.visibilityState === 'visible'`, iterate all cache entries where `subscriberCount > 0` AND `now - fetchedAt > ttlMs`; for each, call `revalidate(key)`. Errors from background revalidation are caught silently (FR-005).

**Checkpoint**: US1–US3 complete. Smoke 8 must pass.

---

## Phase 6: User Story 4 — Optimistic Updates (Priority: P3)

**Goal**: Progress saves and Leitner advances reflect instantly in the UI (< 50 ms), with automatic rollback on server error.

**Independent Test**: Disconnect network, click Save on Book Detail progress → UI updates immediately, then rolls back when request fails with error toast. Smoke 5–6 in `quickstart.md`.

- [X] T019 [US4] Add optimistic update to `src/stores/progress.ts` `updateProgress`: (1) snapshot current cache value `const rollback = cache.get(key)`. (2) `mutate(key, optimisticValue)` immediately. (3) Call server. (4) On error: `mutate(key, rollback)` to restore, surface error (throw or emit). On success: `mutate(key, serverConfirmedValue)` to reconcile.
- [X] T020 [US4] Add optimistic update to `src/stores/lexicon.ts` `updateLeitner`: (1) snapshot current entriesByBook entry. (2) `mutate` both lexicon cache keys with box-advanced entry immediately. (3) Call server. (4) On error: restore snapshot via `mutate` and rethrow so callers (WordOfTheDay, LexiconCard) can show error state.

**Checkpoint**: All four user stories complete. Smokes 5–6 must pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Static-asset cache headers, AI exclusion audit, final smoke run.

- [X] T021 [P] Add `Cache-Control` headers for static assets: create/update `vercel.json` (or `vite.config.ts` `server.headers`) — `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`; `index.html` → `Cache-Control: no-cache`. Per `specs/006-swr-data-caching/research.md § Decision 7`.
- [X] T022 [P] Run AI exclusion grep audit as specified in `specs/006-swr-data-caching/quickstart.md § Regression checklist`: `rg "useCache|swr\(|mutate\(|invalidate\(" src/stores/recaps.ts` must show zero hits inside streaming/generation code. `rg "useCache" supabase/functions/` must return zero matches. Document results in a PR comment.
- [X] T023 Run all 10 quickstart.md smokes manually and confirm each passes. Check bundle size delta (compare `dist/assets/*.js` sizes before/after; delta must be < 5 KB gz). Confirm `npx vitest run` passes with zero failures.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1. T003 (auth wiring) BLOCKS all story work — without it, user-switch leaks are possible.
- **US1 (Phase 3)**: Depends on Phase 2 complete. T005–T009 are parallel. T010 (recaps) must be done carefully after T005–T009 establish the pattern. T011 must come after T005–T009 so it has the `isInitialLoading` properties to bind.
- **US2 (Phase 4)**: Depends on US1 complete — mutations need the cache handles created in T005–T010.
- **US3 (Phase 5)**: Depends on US1 complete (needs subscriber-aware swr handles). Independent of US2.
- **US4 (Phase 6)**: Depends on US2 complete for progress (T014 lays the direct-mutate groundwork T019 extends) and US1 for lexicon.
- **Polish (Phase 7)**: After all desired user stories complete.

### User Story Dependencies

- **US1 (P1)** — no story dependencies, starts after Phase 2.
- **US2 (P1)** — depends on US1 (needs swr handles in place to mutate).
- **US3 (P2)** — depends on US1 (subscriber tracking extends swr). Independent of US2.
- **US4 (P3)** — depends on US2 (optimistic + server-confirm pattern builds on direct-mutate from US2) and US1.

### Within Each Phase

- T001 before T002 (tests validate the implementation, not vice versa for a composable this size).
- Within US1: T005–T009 are fully parallel (different store files). T010 sequential after T005 to ensure the pattern is established. T011 sequential after T005–T010.
- Within US2: T012–T016 are mostly parallel (different store files). T012 and T013 share no files.

### Parallel Opportunities

- T001 and T002 can start at the same time (write tests and composable together).
- T003 and T004 can run in parallel.
- T005, T006, T007, T008, T009 — all in parallel (different stores, different files).
- T012, T013, T014, T015, T016 — mostly parallel (different store files).
- T021, T022 — parallel (different concerns, different files).

---

## Parallel Example: Phase 3 (US1)

```
Parallel batch: T005 (books.ts) + T006 (progress.ts) + T007 (lexicon.ts) + T008 (bookPassport.ts) + T009 (upNext.ts)
Then sequential: T010 (recaps.ts — needs established pattern + AI exclusion attention)
Then sequential: T011 (page components — needs isInitialLoading from all stores)
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: `useCache.ts` primitive.
2. Complete Phase 2: Auth wiring.
3. Complete Phase 3: US1 — all pages render instantly on return.
4. **STOP + VALIDATE**: Smokes 1–2 pass.
5. Complete Phase 4: US2 — mutations keep lists in sync.
6. **STOP + VALIDATE**: Smokes 3–4 pass.
7. Deploy / demo.

### Incremental Delivery

1. Phase 1 + 2 → Cache primitive ready.
2. Phase 3 (US1) → Instant navigation (biggest perceived UX win). **Deploy.**
3. Phase 4 (US2) → Lists stay in sync. **Deploy.**
4. Phase 5 (US3) → Tab-focus revalidation. **Deploy.**
5. Phase 6 (US4) → Optimistic updates (polish). **Deploy.**
6. Phase 7 → Headers + audit.

### Single-Developer Strategy

Work sequentially: Phase 1 → 2 → 3 (batch the 5 parallel stores) → 4 → 5 → 6 → 7. After each phase, run the relevant quickstart smokes before proceeding.

---

## Notes

- **[P]** = different files, no intra-phase dependency — safe to implement in one agent batch.
- **[USN]** = traceability to spec.md user story N.
- T010 is the most sensitive task — re-read FR-009 and SC-006 before touching recaps.ts.
- If `upNextStore` has no async list fetch (just local state), T009 is a no-op — skip and mark complete.
- The `fetchLibrary()` / `fetchProgress()` no-op shims in T005/T006 preserve component `onMounted` calls that still call these functions — they simply return immediately since the cache handles the fetch on first access.
- Bundle size gate: `useCache.ts` must stay under 200 source lines (excluding types/comments). If approaching this limit, split types into `src/composables/useCache.types.ts`.
