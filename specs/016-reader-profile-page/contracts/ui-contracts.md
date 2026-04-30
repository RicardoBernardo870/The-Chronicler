# UI Contracts — Profile Page

Per Constitution Principle VI (PrimeVue-first), every component listed below maps to either a PrimeVue component or a justified custom component. All components live under `src/components/profile/` except `ProfilePage.vue` (in `src/pages/`).

## Page-level orchestrator

### `ProfilePage.vue` (`src/pages/ProfilePage.vue`)
- **Role**: Routes to `/profile`. Orchestrates state and layout only — delegates all visual blocks to children (Constitution VI: "Pages SHOULD primarily orchestrate state and layout").
- **PrimeVue elements used directly**: none — only `<section>` semantic landmarks for layout.
- **Children rendered (in vertical order on mobile)**:
  1. `<ReadingDnaCard />` (hero)
  2. `<VocabularyGardenCard />`
  3. `<LifetimeStatsGrid />`
  4. `<TopThemesCloud />`
  5. `<LibraryBreakdownCard />`
- **Loading state**: shows PrimeVue `<Skeleton>` placeholders for each section while initial Pinia stores hydrate.
- **Empty state**: when zero books finished AND zero captures, shows a centered `<InlineMessage>` with onboarding copy.

## Reading DNA family

### `ReadingDnaCard.vue`
- **PrimeVue base**: `<Card>` (PrimeVue 4 Card component).
- **Subcomponents used**:
  - `<MoodSignature />` for the emoji row.
  - `<BookSuggestionItem />` (×3–5) for each suggestion.
- **Empty / threshold states** (FR-013):
  - User < 3 books finished → `<InlineMessage severity="info">` showing "1 of 3 books finished" + PrimeVue `<ProgressBar :value="33" />`.
  - DNA exists → render full card.
  - DNA pending generation (in flight) → `<Skeleton>` for personality + suggestions.
  - DNA generation failed AND no prior DNA → `<InlineMessage severity="secondary">` with copy "We'll try again later" (FR-014).
- **No PrimeVue Button** for regenerate — there is no manual trigger (FR-012).

### `MoodSignature.vue`
- **Role**: Renders the 1–5 emoji glyphs + tone descriptor.
- **PrimeVue base**: PrimeVue `<Chip>` for the tone, plain `<span>` row for emojis (emojis are plain text glyphs — no PrimeVue equivalent applies).
- **Size**: well under 250 lines.

### `BookSuggestionItem.vue`
- **Role**: One suggestion row — title, author, one-sentence reason.
- **PrimeVue base**: `<Card>` with compact density (no header). Title in `<h3>`; author in `<Tag severity="secondary">`; reason in `<p>`.
- **No interactivity** in v1 (no "open in library", no "add to wishlist") — pure presentational.

## Vocabulary Garden

### `VocabularyGardenCard.vue`
- **PrimeVue base**: `<Card>`.
- **Header**: title "Vocabulary Garden" + total-count `<Tag>`.
- **Body**:
  - Leitner box distribution: row of 5 `<Chip>` elements (one per box), label = box number, count badge via PrimeVue `<Badge>` slot.
  - "Recently Learned" list: PrimeVue `<DataView>` (compact `list` layout) of latest 5 entries. Each row shows: term (bold), definition, source attribution as `<Tag severity="secondary">from {bookTitle}, p. {pageFound}</Tag>` (FR-022a).
- **Footer**: PrimeVue `<Button text>` "Open Lexicon" — navigates to existing `/lexicon` route (FR-024).
- **Empty state**: `<InlineMessage>` with "Capture your first page to begin building your vocabulary."

## Lifetime stats grid

### `LifetimeStatsGrid.vue`
- **PrimeVue base**: `<Card>` wrapper. Inner layout = CSS grid of `<StatTile>` (no PrimeVue grid component needed — semantic CSS grid is the right primitive).
- **Tiles** (7): Books finished, In progress, Total pages, Reading hours, All-time velocity (pages/hr), Current streak (days), Longest streak (days).

### `StatTile.vue`
- **PrimeVue base**: `<Card>` (small variant, no shadow). Icon via `<i class="pi pi-...">` (PrimeIcons), big number, label.

## Top Themes

### `TopThemesCloud.vue`
- **PrimeVue base**: row of `<Chip>` elements, font size scaled inline by theme weight (1×–2×). Tapping a chip is a no-op in v1 (future: filter library by theme).
- **Empty state**: `<InlineMessage>` "Your themes will appear after your first recap or lore card."

## Library breakdown

### `LibraryBreakdownCard.vue`
- **PrimeVue base**: `<Card>`. Inside, three sub-blocks:
  1. **Genre distribution**: row of `<Tag>` elements per genre with counts (sourced from `books.genre`, FR-004).
  2. **Authors total**: a `<Chip icon="pi pi-user">` showing "{N} authors".
  3. **Pace comparison**: per-book mini bars using PrimeVue `<ProgressBar>` (one row per book, label = book title, value = velocity normalized to 100).

## Routing

`src/router/index.ts` adds:
```ts
{ path: '/profile', name: 'profile', component: () => import('@/pages/ProfilePage.vue') }
```
Lazy-loaded per Constitution V (bundle minimization). Bottom navigation (existing) gets a new "Profile" tab pointing to `name: 'profile'`.

## PrimeVue import policy

Per Constitution VI: imports MUST be local to the component that uses them. Example for `ReadingDnaCard.vue`:
```ts
import Card from 'primevue/card'
import InlineMessage from 'primevue/inlinemessage'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
```

No global PrimeVue registration is added.

## Component size budget

Every component listed above is expected to stay under ~250 lines of `<script setup>` + `<template>` combined (Constitution VI). All components are ≤ 120 lines by estimate. **No custom components — every element is a PrimeVue primitive.**
