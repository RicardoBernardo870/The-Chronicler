# Implementation Plan: Dashboard UX & Lore Sync

**Branch**: `009-home-inline-cards` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/010-dashboard-ux-sync/spec.md`

## Summary

Improve the Dashboard reading UX with: (1) direct "View Book" navigation, (2) inline recap streaming with lock-gate parity to Book Details, (3) collapsible lore card on Book Details with reactive updates, and (4) global "New Lore" seen-state sync. A shared `useRecapLock` composable eliminates logic divergence between Dashboard and Book Details. No new backend tables or edge functions are required.

## Technical Context

**Language/Version**: TypeScript 6 (strict)  
**Primary Dependencies**: Vue 3.5 (Composition API, `<script setup>`), Pinia 3, PrimeVue 4, Vue Router 4, Supabase JS v2  
**Storage**: Supabase PostgreSQL (existing `recaps`, `lore_cards` tables — no schema changes)  
**Testing**: Manual smoke tests via `quickstart.md`  
**Target Platform**: PWA (mobile-first, iOS liquid glass aesthetic)  
**Project Type**: Web application (Vue SPA/PWA)  
**Performance Goals**: Reactive lore update < 1s after generation completes; recap stream begins within 3s  
**Constraints**: No navigation on recap trigger; abort signal must prevent partial data persistence  
**Scale/Scope**: Single-user feature; shared Pinia store singleton state

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Memory Continuity | ✅ PASS | Recap persisted only on full completion (FR-005, FR-007); no partial saves |
| II. Physical-to-Digital Bridge | ✅ PASS | No changes to ISBN/progress tracking |
| III. AI-First Recap Engine | ✅ PASS | Recap streaming preserved; AbortController added for mid-stream cancel |
| IV. Data Integrity | ✅ PASS | Completed recaps always written to Supabase; aborted recaps never written |
| V. PWA-First & Two-Tap Rule | ✅ PASS | Get Recap now reachable in 1 tap from Dashboard (previously 2+) |

No violations. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/010-dashboard-ux-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── useRecapLock.md
│   └── LoreChronoscopeCard.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── composables/
│   ├── useRecapLock.ts          ← NEW: shared recap lock logic
│   └── useCache.ts              (unchanged)
├── services/
│   └── recapService.ts          ← MODIFY: add AbortSignal support
├── stores/
│   ├── recaps.ts                ← MODIFY: pass AbortSignal to streamRecap; check aborted before insert
│   └── loreCards.ts             ← MODIFY: remove success toast (FR-010)
├── components/
│   └── lore/
│       └── LoreChronoscopeCard.vue  ← ALREADY UPDATED (collapsible pattern)
└── pages/
    ├── DashboardPage.vue        ← MODIFY: inline recap + lock + View Book + lore card
    └── BookDetailPage.vue       ← MINOR: replace lock logic with useRecapLock; add :initial-collapsed
```

**Structure Decision**: Single Vue SPA project. All changes are frontend-only; no backend modifications.

## Implementation Strategy

### Phase 1 — Shared Composable (useRecapLock)

Extract the recap lock logic from `BookDetailPage.vue` into `src/composables/useRecapLock.ts`. This composable accepts `bookId` and returns reactive `recapLocked`, `pagesUntilUnlock`, `recapLockedByPages`, and `daysSinceLastSession` refs. Both Dashboard and Book Details consume this composable.

**Input**: `bookId: string`  
**Output**: `{ recapLocked, pagesUntilUnlock, recapLockedByPages, daysSinceLastSession }`

### Phase 2 — AbortController Support in recapService + recaps store

`recapService.ts` gains an optional `signal?: AbortSignal` third parameter. The fetch call passes `{ signal }`. The read loop checks `signal?.aborted` and throws an AbortError to short-circuit. Returns `StreamRecapResult & { aborted: boolean }`.

`recaps.ts` `generateRecap` gains an optional `signal?: AbortSignal`. After `streamRecap` resolves, if `result.aborted === true`, set status to `'idle'`, clear text, and return without the Supabase insert.

### Phase 3 — Dashboard inline recap + lock + navigation

`DashboardPage.vue` gains:
- Import `useRecapLock`, `useRecapsStore`, `RecapStream`, `LoreChronoscopeCard`
- `recapTriggered`, `recapAbortController` local session refs
- `handleGetRecap()` creates AbortController, triggers `recapsStore.generateRecap(bookId, signal)`
- `handleRecapDismiss()` aborts controller, resets state
- `onUnmounted()` cleanup (abort active stream if any, clear inline lore)
- Lock-gated button (locked: show page count label, unlocked: "Get Recap")
- RecapStream rendered inline below hero card when `recapTriggered`
- "View Library" → "View Book" with `router.push({ name: 'book-detail', params: { id: currentBook.id } })`
- LoreChronoscopeCard `:collapsible="true"` rendered below hero card when `hasUnseenLore`
- `onMounted` fetch `recapsStore.fetchRecapsForBook(currentBook.id)` to hydrate lock state

Also remove toast from `loreCardsStore` (already done in prior session — verify).

### Phase 4 — Book Details minor updates

`BookDetailPage.vue`:
- Replace inline recap lock logic with `useRecapLock(bookId)` composable
- Verify `LoreChronoscopeCard` is already using `:collapsible="true" :initial-collapsed="false"` (already done)

### Phase 5 — New Lore seen sync

`markBookLoreSeen` already exists in `loreCardsStore` and is called on `BookDetailPage` mount. The `hasUnseenLore` getter is already reactive. No additional backend work needed — FR-011 and FR-012 are satisfied by the existing store method + reactive getter.
