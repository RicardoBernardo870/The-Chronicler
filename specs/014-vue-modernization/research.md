# Research: Vue Codebase Modernization (014)

## Decision 1 — Date library: `date-fns`

**Decision**: Install `date-fns` v4 (tree-shakeable ESM build).

**Rationale**:
- Zero runtime overhead beyond the functions actually imported — Vite's tree-shaking eliminates unused code at build time.
- Full TypeScript types included (no `@types/*` install needed).
- Locale-aware formatting without a global configuration object (unlike `dayjs` plugins).
- `formatDistanceToNow`, `differenceInSeconds`, `differenceInHours`, `format`, `parseISO`, `startOfDay`, `isSameDay`, `compareDesc` cover every existing manual operation in the codebase.
- The existing `useRelativeTime.ts` buckets ("Just now", "Yesterday", etc.) map cleanly to `formatDistanceToNow` with `addSuffix: true`, with one override for the sub-2-min "Just now" bucket.

**Alternatives considered**:
- `dayjs` — smaller base bundle but relies on plugins for duration/format extras; plugin system is less TypeScript-ergonomic.
- Internal `src/utils/date.ts` with no new dependency — viable, but re-implements what `date-fns` provides with better correctness guarantees (timezone edge cases, leap years).

**Excluded from migration**: `useCache.ts` — its `Date.now()` calls are performance-timing primitives (cache TTL arithmetic), not human-readable date formatting. They should remain unchanged.

---

## Decision 2 — Wrapper module: `src/utils/date.ts`

**Decision**: Introduce a thin wrapper module rather than importing `date-fns` directly throughout the codebase.

**Rationale**:
- Centralises any project-specific formatting decisions (locale, bucket labels) in one file.
- If `date-fns` is ever swapped out, only `src/utils/date.ts` changes — not 10+ call sites.
- Enforces the "one canonical import path" requirement from US3.

**Functions to expose** (all delegate to `date-fns`):

| Export | date-fns function | Replaces |
|--------|-------------------|---------|
| `formatRelativeToNow(date)` | `formatDistanceToNow` + "Just now" override | `useRelativeTime.ts` `formatRelative()` |
| `formatShortDate(isoStr)` | `format(parseISO(...), 'MMM d, yyyy')` | `toLocaleDateString(undefined, {...})` calls |
| `formatISODate(date)` | `format(date, 'yyyy-MM-dd')` | `toISOString().split('T')[0]` |
| `diffInSeconds(a, b)` | `differenceInSeconds` | `(new Date(a).getTime() - new Date(b).getTime()) / 1000` |
| `diffInHours(a, b)` | `differenceInHours` | manual `/ MS_PER_HOUR` |
| `diffInDays(a, b)` | `differenceInDays` | manual `/ MS_PER_DAY` |
| `isSameCalendarDay(a, b)` | `isSameDay` | `toISOString().split('T')[0]` comparisons |
| `startOfCalendarDay(date)` | `startOfDay` | `new Date(); setHours(0,0,0,0)` |
| `sortDescByDate(arr, key)` | `compareDesc` | `new Date(b[key]).getTime() - new Date(a[key]).getTime()` |

---

## Decision 3 — Shared utility: `src/utils/coverFallback.ts`

**Decision**: Extract the `coverFallback` function — currently copy-pasted in `BookCard.vue`, `BookGridCard.vue`, `BookDetailPage.vue`, and `DashboardPage.vue` — into a single shared utility.

**Rationale**: Identical 3-line function copied verbatim 4+ times. Any change (e.g., replace `style.display = 'none'` with a placeholder image) currently requires editing 4 files.

**Implementation**: `export const coverFallback = (e: Event): void => { (e.target as HTMLImageElement).style.display = 'none' }`

---

## Decision 4 — Component decomposition targets and extraction map

**Decision**: Prioritise by line count and user-visible impact. Extract self-contained UI sections as named child components. Stop extraction when the child would need more than 2 prop levels or a full store re-plumbing.

**Target components and their extractions**:

### `DashboardPage.vue` (1049 → target ≤ 300 lines)

| Extracted component | File | Responsibility |
|---------------------|------|----------------|
| `HeroBookCard` | `src/components/dashboard/HeroBookCard.vue` | Cover, title, author, progress bar, page input + save, session buttons, continuity warning, offline badge, recap actions |
| `InProgressSection` | `src/components/dashboard/InProgressSection.vue` | "In Progress" list of swappable books |
| `UpNextSection` | `src/components/dashboard/UpNextSection.vue` | Drag-to-reorder "Up Next" list |
| `CompletedSection` | `src/components/dashboard/CompletedSection.vue` | Completed books grid + overflow hint |

DashboardPage becomes an orchestrator: fetches stores, owns `activeBookId`/`currentBook`, passes data down, handles events up.

### `BookDetailPage.vue` (611 → target ≤ 250 lines)

| Extracted component | File | Responsibility |
|---------------------|------|----------------|
| `BookDetailHeader` | `src/components/book/BookDetailHeader.vue` | Cover, title, author, genre chip, stats row |
| `BookProgressPanel` | `src/components/book/BookProgressPanel.vue` | Progress bar, page input + save, session start/note flow, justSaved confirmation |

### `LoreChronoscopeCard.vue` (336 → target ≤ 180 lines)

Already a self-contained component. Internal refactor only: extract the collapsible body into `LoreChronoscopeBody` sub-component or named slot — evaluate during implementation.

### `RecapStream.vue` (332 lines)

Anchor check panel (`ChapterConfirmStep`, `VibeCheckPanel`) is already sub-componentised. Internal refactor: move `anchorPhase`/`vibeSlot` derived computeds into a `useRecapAnchor` composable to slim the script block.

### `BookCard.vue` (322 lines)

Extract `BookCardProgress` (progress bar + percentage row) and `BookCardLoreChip` into sub-components. Reduces template complexity.

---

## Decision 5 — PrimeVue replacement candidates

**Decision**: Replace the following custom elements with PrimeVue equivalents. Keep glass-surface card wrappers custom (theme override cost exceeds consistency benefit).

| Custom element | PrimeVue replacement | Location |
|----------------|---------------------|---------|
| `LoreGenerationBanner` loading/error state | `Message` (severity="info/error") | `src/components/lore/LoreGenerationBanner.vue` |
| Inline genre tag (custom `<span class="genre">`) in BookCard, BookDetailPage, DashboardPage | `Chip` | Multiple |
| Custom "Finished" badge in Dashboard completed list | `Tag` (severity="success") | `DashboardPage.vue` |
| Offline sync badge | `Tag` (severity="warn") | `DashboardPage.vue`, `BookDetailPage.vue` |
| Continuity warning pill | `InlineMessage` (severity="warn") | `DashboardPage.vue` |

**Explicitly kept custom** (override complexity too high):
- All `glass-surface` card wrappers — PrimeVue `Card` requires deep theme token overrides to match the iOS-liquid-glass aesthetic.
- `AppBottomNav` — no PrimeVue Dock/Menubar equivalent matches the fixed bottom tab bar pattern.
- `EmptyState` — no PrimeVue equivalent for a full-bleed empty state with custom action slot.
- `VelocityBadge` — highly specific computed display, not a generic badge.

---

## Decision 6 — Refactoring increment order

**Decision**: Execute in this order to minimise regression risk:

1. **Install `date-fns` + create `src/utils/date.ts`** (no UI changes, trivially reversible)
2. **Extract `coverFallback` utility** (surgical, low risk)
3. **Migrate date logic in composables** (`useRelativeTime`, `useLastSession`, `useReadingPulse`, `useLeitner`) — logic-only, no template changes
4. **Migrate date logic in components** (`WordOfTheDay`, `LoreCardDetail`, `LoreCardList`, `RecapCard`) — small isolated changes, build check after each
5. **PrimeVue replacements** — genre chips, tags, inline messages across components
6. **DashboardPage decomposition** — largest, highest-risk; done after date/PrimeVue work stabilises confidence
7. **BookDetailPage decomposition** — second largest
8. **BookCard + LoreChronoscopeCard + RecapStream internal refactors** — lower impact, done last
