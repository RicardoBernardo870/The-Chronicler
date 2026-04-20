# Research: Dashboard UX & Lore Sync

**Date**: 2026-04-20  
**Feature**: 010-dashboard-ux-sync

## Decision 1: AbortController pattern for mid-stream cancellation

**Decision**: Pass `AbortSignal` through from `DashboardPage` → `recapsStore.generateRecap` → `recapService.streamRecap` → `fetch`. Check `result.aborted` before the Supabase insert.

**Rationale**: The native `AbortController`/`AbortSignal` Web API is the idiomatic cancellation mechanism for `fetch`. It allows the read loop to short-circuit without leaking network connections. Returning `{ aborted: true }` as part of the result type (rather than throwing) keeps the store logic clean and avoids swallowed errors.

**Alternatives considered**:
- Using a `cancelled` reactive ref inside the store — rejected because it creates race conditions when multiple books trigger generation concurrently.
- Not supporting mid-stream cancel — rejected because FR-007 explicitly requires that no partial recap is saved.

---

## Decision 2: `useRecapLock` composable

**Decision**: Extract `recapLocked`, `pagesUntilUnlock`, `recapLockedByPages`, and `daysSinceLastSession` into `src/composables/useRecapLock.ts`. The composable reads from `useProgressStore` and `useRecapsStore` internally and returns computed refs.

**Rationale**: The identical logic appearing in two pages (BookDetailPage + DashboardPage) violates DRY and is an explicit spec requirement (FR-013). A composable is the Vue 3 idiomatic way to share stateful reactive logic without a store. The composable itself is stateless (no local refs) — it merely exposes derived computeds, making it testable in isolation.

**Alternatives considered**:
- Duplicating logic in both pages — rejected (FR-013 prohibits divergence).
- Adding helper functions to `recapsStore` — rejected because the logic combines `progressStore` + `recapsStore` state; mixing concerns would bloat the store.
- A Vuex-style module getter — not applicable (project uses Pinia).

---

## Decision 3: Lore reactivity via computed (not ref)

**Decision**: In `LoreChronoscopeCard.vue`, `currentCard` is a `computed` derived from `loreStore.loreForBook(bookId)` (which is itself reactive Pinia state). The `cards.value.length` watcher auto-jumps to the newest card when a new one arrives.

**Rationale**: A `ref` assigned on `onMounted` would not update when new lore cards arrive in the background. A `computed` re-evaluates automatically when the underlying Pinia reactive map changes. This satisfies FR-010 (instant reactivity) without any polling or manual refresh.

**Status**: Already implemented in `LoreChronoscopeCard.vue`.

**Alternatives considered**:
- `watch(() => loreStore.loreByBook[bookId], ...)` with manual ref update — works but adds boilerplate; `computed` is simpler.
- Supabase Realtime subscription for new lore — over-engineered; the store already receives the new card synchronously via `maybeUnlockForMilestone`.

---

## Decision 4: Inline lore on Dashboard (component reuse)

**Decision**: Dashboard renders `<LoreChronoscopeCard :book-id="currentBook.id" :collapsible="true" />` conditionally when `loreStore.hasUnseenLore(currentBook.id)` is true. No new component needed.

**Rationale**: `LoreChronoscopeCard` already handles the collapsible/expand pattern, cycling, and skeleton loading. Reusing it avoids duplicating card rendering logic on the Dashboard.

**Alternatives considered**:
- A dedicated `DashboardLoreCard` component — rejected (no functional difference; violates component reuse principle).
- Showing all lore cards on Dashboard — rejected (Dashboard is single-card surface; cycling covers the multi-card use case).

---

## Decision 5: "New Lore" seen sync

**Decision**: `markBookLoreSeen(bookId)` is called on `BookDetailPage` `onMounted`. The `hasUnseenLore(bookId)` computed in the store is reactive, so all components that reference it (Dashboard chip, Library card badge) automatically hide when the flag clears.

**Rationale**: The `seen` flag is already a DB-backed field on `lore_cards`. `markBookLoreSeen` already does a Supabase UPDATE and optimistic local mutation. No new infrastructure is required — FR-011 and FR-012 are satisfied by existing code paths.

**Alternatives considered**:
- A separate "mark seen" button on the Dashboard lore card — rejected (spec requires automatic clearance on Book Details mount).
- Clearing seen state when the Dashboard lore card is dismissed — acceptable but spec says clearance happens on Book Details mount; Dashboard lore card dismissal is purely UI-local.
