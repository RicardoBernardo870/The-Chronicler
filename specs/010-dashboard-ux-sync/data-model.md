# Data Model: Dashboard UX & Lore Sync

**Date**: 2026-04-20  
**Feature**: 010-dashboard-ux-sync

> No new database tables or schema changes are required. This feature is purely frontend — it introduces a new composable and modifies existing page/component/store logic.

## Existing Entities Used

### Recap

**Table**: `recaps`  
**Relevant fields**:
- `progress_snapshot` (number) — percentage at time of generation; used to compute the `lastRecapPct` lock gate
- `page_snapshot` (number) — page number at time of generation; used as `from_page` for incremental recaps
- `created_at` (ISO timestamp)

**State transition for this feature**:
```
[stream starts]
  → if aborted before completion: no row inserted
  → if stream completes successfully: row inserted → appears in recap history
```

### LoreCard

**Table**: `lore_cards`  
**Relevant fields**:
- `seen` (boolean) — false when first created; set to true by `markBookLoreSeen(bookId)`
- `unlocked_at_milestone` (number) — percentage milestone that triggered generation
- `created_at` (ISO timestamp) — used for sorting (most recent first)

**State transition for this feature**:
```
[lore card created by background job, seen = false]
  → hasUnseenLore(bookId) = true  → Dashboard chip visible, LoreChronoscopeCard shown
  → user mounts BookDetailPage
  → markBookLoreSeen(bookId) called
  → seen = true for all unseen cards of this book
  → hasUnseenLore(bookId) = false → all chips/badges disappear reactively
```

### ReadingProgress

**Table**: `progress` (via `progressStore`)  
**Relevant fields**:
- `current_page` (number)
- `updated_at` (ISO timestamp) — used for 3-day time escape hatch in recap lock

**No changes** to this entity.

## New In-Memory Entities (component-local state)

### RecapSessionState (DashboardPage local)

Lives only in `DashboardPage.vue` component refs — no store, no persistence.

| Field | Type | Description |
|-------|------|-------------|
| `recapTriggered` | `ref<boolean>` | True while an inline recap stream is active/completed on Dashboard |
| `recapAbortController` | `ref<AbortController \| null>` | Active AbortController; null when no stream |

**Lifecycle**: Created on "Get Recap" tap; cleared on dismiss or `onUnmounted`.

## Composable Interface

### useRecapLock(bookId: string)

Pure derived state — no local refs, reads from `progressStore` + `recapsStore`.

| Output | Type | Description |
|--------|------|-------------|
| `recapLocked` | `ComputedRef<boolean>` | True when both page threshold AND time escape fail |
| `pagesUntilUnlock` | `ComputedRef<number>` | Pages remaining before page threshold is met |
| `recapLockedByPages` | `ComputedRef<boolean>` | True when page threshold not met |
| `daysSinceLastSession` | `ComputedRef<number>` | Days since `progress.updatedAt` |

**Lock formula**:
```
lastRecapPct = latestRecap.progressSnapshot (0 if none)
unlockPage   = ceil((lastRecapPct + 5) / 100 * totalPages)
lockedByPages = lastRecapPct > 0 && currentPage < unlockPage
locked = lockedByPages && daysSinceLastSession < 3
```
