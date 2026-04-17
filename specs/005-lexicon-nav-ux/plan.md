# Implementation Plan: Lexicon & Navigation UX Improvements

**Branch**: `005-lexicon-nav-ux` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-lexicon-nav-ux/spec.md`

## Summary

Fix lexicon word-book association (silent fallback eliminated), add in-context Add Word to Book Detail page, make Word of the Day deterministic per calendar day with a fallback for no-due-entries, and replace the top floating header with a modern floating bottom navigation bar preserving all existing actions.

All changes are client-side only. No database migrations required. Tech stack: TypeScript 6, Vue 3.5+, PrimeVue 4, Pinia 3, Supabase JS v2.

## Technical Context

**Language/Version**: TypeScript 6 + Vue 3.5+ (Composition API)
**Primary Dependencies**: PrimeVue 4, Pinia 3, Supabase JS v2, Vue Router 4, PrimeIcons 7, VueUse (`useColorMode`)
**Storage**: Supabase PostgreSQL (no schema changes) + `localStorage` (Word of the Day daily cache)
**Testing**: Manual (quickstart.md scenarios)
**Target Platform**: PWA — iOS, Android, desktop browser
**Project Type**: Web app (single-project Vue SPA)
**Performance Goals**: Nav renders synchronously with no async blocking; Word of the Day resolution adds ≤ 1ms (localStorage + in-memory lookup)
**Constraints**: Must not block existing recap, progress, or passport flows; safe-area-inset-bottom must be respected on notched devices
**Scale/Scope**: Single-user per session; ~10–100 lexicon entries per user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Memory Continuity | ✅ PASS | No changes to recap, AI prompts, or spoiler-free logic. |
| II. Physical-to-Digital Bridge | ✅ PASS | No changes to ISBN or page-count flows. `pageFound` default on Book Detail uses existing progress store data. |
| III. AI-First Recap Engine | ✅ PASS | No changes to recap generation pipeline. |
| IV. Data Integrity & Synchronization | ✅ PASS | Eliminates silent `book_id` fallback — this is a data integrity improvement. All lexicon entries will have an authoritatively set `book_id`. |
| V. PWA-First & Frictionless Portability | ✅ PASS | Bottom nav improves one-handed mobile usage (Principle V). All core interactions remain within 2 taps. New nav stays visible on scroll — no friction regression. |

**Post-Phase 1 re-check**: All gates still pass. No new violations introduced by the design decisions.

## Project Structure

### Documentation (this feature)

```text
specs/005-lexicon-nav-ux/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── ui-components.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
src/
├── components/
│   ├── shared/
│   │   ├── AppHeader.vue         ← REMOVE (replaced by bottom nav)
│   │   └── AppBottomNav.vue      ← NEW
│   └── lexicon/
│       └── AddWordDialog.vue     ← MODIFY (bookId optional, book selector, defaultPageFound prop)
├── layouts/
│   └── DefaultLayout.vue         ← MODIFY (swap AppHeader → AppBottomNav, adjust main padding)
├── pages/
│   ├── LexiconPage.vue           ← MODIFY (remove activeBookId fallback, fix AddWordDialog binding)
│   └── BookDetailPage.vue        ← MODIFY (Add Word button + lexicon count badge + AddWordDialog)
├── stores/
│   └── lexicon.ts                ← MODIFY (fetchEntriesForAllBooks, resolveWordOfTheDay, _wotdEntryId cache)
└── assets/
    └── main.css (or index.css)   ← MODIFY (add --app-nav-bottom-clearance CSS variable, update page padding)
```

## Implementation Details

### US1 — AddWordDialog book selector

**File**: `src/components/lexicon/AddWordDialog.vue`

Key changes:
- `bookId` prop becomes `bookId?: string`
- Add new prop `defaultPageFound?: number`
- Add internal `selectedBookId` ref (used when `bookId` prop is absent)
- Add `bookOptions` computed from `useBooksStore().books`
- Add `<Select>` field visible only when `!props.bookId`
- Validation: add `if (!effectiveBookId) errors.book = 'Please select a book'`
- `effectiveBookId` = `props.bookId ?? selectedBookId.value`
- `pageFound` initialized from `props.defaultPageFound ?? null`
- Emit `saved` with the created `LexiconEntry` (not void — callers may want to update count)

### US1 — LexiconPage fix

**File**: `src/pages/LexiconPage.vue`

Key changes:
- Delete `activeBookId` computed
- Change `<AddWordDialog :book-id="activeBookId"` → `:book-id="selectedBookId ?? undefined"`
- Update `@saved` handler to refresh count if needed (lexicon store already updates `entriesByBook` in `addEntry`)

### US2 — BookDetailPage Add Word

**File**: `src/pages/BookDetailPage.vue`

Key changes:
- Import `AddWordDialog`, `useLexiconStore`
- Add `addWordVisible = ref(false)`
- Add `lexiconCount = computed(() => lexiconStore.entriesByBook[bookId.value]?.length ?? 0)`
- Fetch lexicon entries for this book on `onMounted` (after existing fetches)
- Render "Add Word" button in progress section (below VelocityBadge, above the separator)
- Render lexicon count chip as `<RouterLink>` to `/lexicon?bookId=<id>` when `lexiconCount > 0`
- Mount `AddWordDialog` with `:book-id="bookId"` and `:default-page-found="progress?.currentPage"`

### US3 — Word of the Day (lexicon store)

**File**: `src/stores/lexicon.ts`

Key changes:
1. Add `fetchEntriesForAllBooks()` — single query for all user's entries, grouped into `entriesByBook`
2. Add `_wotdEntryId = ref<string | null>(null)` and `_wotdIsPreview = ref(false)`
3. Add `resolveWordOfTheDay(userId: string)` action:
   - Read `bookhero_wotd_${userId}` from localStorage
   - If `cache.date === today` → set `_wotdEntryId` from cache, return
   - Else: run selection (due first → fallback to soonest upcoming), persist cache
4. Change `wordOfTheDay` computed to return entry resolved from `_wotdEntryId`
5. Export `isWordOfTheDayPreview` computed
6. After `updateLeitner('advance')`, call `resolveWordOfTheDay` again to refresh selection (clear cache for today, re-pick)

**File**: `src/components/dashboard/WordOfTheDay.vue`

Key changes:
- Call `lexiconStore.resolveWordOfTheDay(authStore.user.id)` from `onMounted` (after `fetchEntriesForAllBooks` ensures entries are loaded)
- Show preview indicator: `<span v-if="lexiconStore.isWordOfTheDayPreview" class="wotd__preview-badge">Coming up</span>`
- Safe "from: <book>" fallback: `bookTitle || '(removed book)'`

**File**: `src/pages/DashboardPage.vue`

- Ensure `lexiconStore.fetchEntriesForAllBooks()` is called during mount (replacing or supplementing the per-book N+1 fetch)

### US4 — AppBottomNav (new)

**File**: `src/components/shared/AppBottomNav.vue`

Full new component. See contracts/ui-components.md for HTML structure. Key CSS points:
- `position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 0.75rem)`
- `left: 0.75rem; right: 0.75rem` (floating, not edge-to-edge)
- `border-radius: 18px` (matching existing glass-surface pill style)
- `height: 4rem`; each item `flex: 1; min-height: 44px`
- Active state: `color: var(--p-indigo-400)` + `opacity: 1` (inactive: `opacity: 0.5`)
- More sheet: absolute-positioned panel above the nav, `border-radius: 16px`, dismissed on outside click

**File**: `src/layouts/DefaultLayout.vue`
- Remove `import AppHeader` and `<AppHeader />`
- Add `import AppBottomNav` and `<AppBottomNav v-if="authStore.user" />`
- Import and use `useAuthStore`
- `default-layout__main` gets `padding-top: 1.5rem` restored (it was there before, put back since no top header)
- Global: add CSS variable `--app-nav-bottom-clearance: 5.5rem` in `main.css` or `:root`

**File**: `src/pages/*.vue` (all authenticated pages)
- Replace hardcoded `padding-bottom: 4rem` with `padding-bottom: var(--app-nav-bottom-clearance)` or increase to `5.5rem` on pages that had `4rem` (BookDetailPage, LexiconPage, DashboardPage, LibraryPage, etc.)

## Complexity Tracking

No Constitution violations — table not required.
