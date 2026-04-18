# UI Contracts

Behavioural contracts for every user-facing surface the feature touches.

---

## 1. `<LoreChronoscopeCard>` — Book Detail Page discovery card

**File**: `src/components/lore/LoreChronoscopeCard.vue`

**Props**:
```typescript
{ bookId: string }
```

**Responsibilities**:
- On mount, ensure lore is fetched for this book via `loreCardsStore.fetchLoreForBook(bookId)` — SWR means this is cheap on return visits.
- Display one card at random via `loreCardsStore.randomLoreForBook(bookId)`.
- Provide a refresh affordance that cycles to another card.
- Clicking the card body navigates to `/lexicon?bookId=<bookId>&tab=lore`.

**Rendering states**:

| Condition | Rendered output |
|---|---|
| Store initially loading AND no lore in cache | `<Skeleton>` placeholder matching card dimensions (one-time only) |
| No lore exists for book | Hidden — renders nothing |
| Lore exists | Card with title, type badge, first 120 chars of content ellipsised, refresh icon, clickable body |

**Invariants**:
- Refresh icon is disabled (greyed) when there is exactly one card.
- Refresh selects a different card than the one currently shown (if > 1 card exists).
- Clicking the refresh icon does NOT navigate (stopPropagation).
- Clicking anywhere else on the card navigates to the Great Library.

**Performance contract**: On a return visit to the Book Detail Page (lore already cached from SWR), the card MUST render within 100 ms of the page mount (SC-005).

---

## 2. `GreatLibraryPage` — renamed `LexiconPage`

**File**: `src/pages/GreatLibraryPage.vue` (renamed from `LexiconPage.vue`)

**Route**:
- Path: `/lexicon` (unchanged — URL stability)
- Name: `'lexicon'` (unchanged — no upstream refactor)
- `<router-link>` usages across the app continue to work.

**Layout**:
```
<Tabs v-model:activeIndex="activeTab">
  <TabPanel header="Lexicon">
    <!-- existing vocabulary content, unchanged -->
  </TabPanel>
  <TabPanel header="Lore Cards">
    <LoreCardList :book-id="selectedBookId" />
  </TabPanel>
</Tabs>
```

**Query-param contract**:
- `?bookId=<uuid>` — book filter, shared across both tabs.
- `?tab=lexicon` or `?tab=lore` — optional; controls initial tab selection. Default: `lexicon`.

**Behaviour**:
- Switching tabs preserves `bookId` (FR-014).
- Book-filter dropdown is rendered once at the top, outside both tab panels, driving both tabs.
- Empty states:
  - Lexicon tab with no entries → existing "No words saved yet" state.
  - Lore Cards tab with no unlocked cards for selected book → "Keep reading to unlock your first lore card." (FR-017)
- Tabs component style matches PrimeVue default; no custom theming beyond what the app already uses.

---

## 3. `<LoreCardList>` — Lore Cards tab content

**File**: `src/components/lore/LoreCardList.vue`

**Props**: `{ bookId?: string }` — filter; if absent, shows all books' lore.

**Contract**:
- On mount, calls `loreCardsStore.fetchLoreForBook(bookId)` or `fetchLoreForAllBooks()` depending on whether `bookId` is provided.
- Sorts by `createdAt` descending (most recent first, FR-015).
- Each card shows: title, type badge, unlocked-at-milestone chip (`"Unlocked at 30%"`), excerpt (first 120 chars).
- Clicking a card expands it inline (not a modal) to reveal `<LoreCardDetail>` — the full content body, the full `linkedEntities` list, the creation date.
- No edit/delete affordances (FR: lore is read-only).

---

## 4. `<LoreCardDetail>` — expanded single-card view

**File**: `src/components/lore/LoreCardDetail.vue`

**Props**: `{ card: LoreCard }`

**Contract**: Pure presentational. Shows:
- Title (prominent)
- Type badge (colour-coded: History → indigo, Myth → amber, Geography → emerald)
- Full `content` body with good typography (line-height 1.6, max 680px width)
- "Mentions: {linked_entities.join(', ')}" chip row
- "Unlocked on {date} at {milestone}%" footer

---

## 5. "New Lore" indicator on Library book cards

**Location**: `src/components/library/BookCard.vue` (existing — add one prop-driven indicator)

**Data source**: `loreCardsStore.hasUnseenLore(book.id)` — reactive computed.

**Visual**: Small chip overlay in the top-right corner of the book card with label "New Lore" and a sparkle icon. Present when `hasUnseenLore === true`.

**Interaction**:
- Clicking the chip: `stopPropagation` + navigate to Book Detail Page (where the `markBookLoreSeen` fires on mount).
- Clicking the rest of the card: existing behaviour (also navigates to Book Detail, which also clears).
- Either way, the chip disappears after the navigation completes because `markBookLoreSeen` flips `seen = true`.

**Reactivity**: The chip is driven by the Pinia store; no manual subscription. Disappears automatically when `markBookLoreSeen` mutates local state.

---

## 6. Toast on successful lore unlock

**Trigger**: Inside `loreCardsStore.maybeUnlockForMilestone()` after a successful INSERT.

**Configuration**:
```typescript
toast.add({
  severity: 'success',
  summary: 'New Lore Unlocked',
  detail: book.title,
  life: 4000,
})
```

**Invariants**:
- Toast fires regardless of what screen the user is on.
- No toast fires on errors (FR-008).
- No toast fires on duplicate/skip branches (already-existing card, no Master Recap).
- Multiple back-to-back unlocks across different books produce multiple toasts (stacking — PrimeVue handles by default).

---

## 7. Bottom navigation label change

**File**: `src/components/shared/AppBottomNav.vue`

**Change**: Line 73 — `<span class="app-bottom-nav__label">Lexicon</span>` → `<span class="app-bottom-nav__label">Great Library</span>`.

**Invariant**: Item count, icon, path, and active-route detection (`isLexicon` computed) are all unchanged.

---

## 8. Book Detail Page integration

**File**: `src/pages/BookDetailPage.vue`

**Additions**:
1. Import `LoreChronoscopeCard`, `useLoreCardsStore`.
2. In `onMounted`, after existing fetches complete, call `loreCardsStore.markBookLoreSeen(bookId)` (idempotent).
3. Insert `<LoreChronoscopeCard :book-id="bookId" />` in the template between the Progress section and the Recap section.

**Card placement rationale**: Between progress (top, action-focused) and recap (middle, memory-focused) gives lore a "delight between two functional blocks" slot — natural discovery spot.

**State on rollback**: If `updateProgress` rolls back (optimistic update failure), no milestone fires (handled inside `updateProgress`, not at the store level).
