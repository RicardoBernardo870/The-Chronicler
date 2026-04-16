# Research: Session Persistence & Dashboard Polish

**Date**: 2026-04-16  
**Feature**: `002-session-dashboard-polish`

---

## Decision 1: Supabase Auth Session Persistence in a Vue PWA

**Decision**: Use `supabase.auth.getSession()` in the auth store `initialize()` method (already called from `App.vue`) combined with `supabase.auth.onAuthStateChange()` to reactively update Pinia state. Supabase JS v2 automatically persists the session in `localStorage` — the bug is that `initialize()` must `await getSession()` before the router guard runs, otherwise the guard sees an empty session and redirects to `/auth`.

**Rationale**:
- Supabase JS v2 stores tokens in `localStorage` by default (`supabase.auth.persistSession = true`). The session is already there after login — it just isn't being read correctly on boot.
- The fix is to ensure `initialize()` awaits `getSession()` and sets `user` and `session` in Pinia before the router navigation guard fires.
- `onAuthStateChange` handles token refresh (JWT expiry) transparently without additional code.

**Alternatives considered**:
- Cookie-based session storage: more complex, requires server changes, unnecessary for a SPA.
- Polling `getSession()` on a timer: wasteful; `onAuthStateChange` already fires on token refresh.

---

## Decision 2: Dashboard In-Progress & Completed Sections

**Decision**: Add two computed selectors to `useProgressStore`: `inProgressBooks` (0 < percentage < 100, sorted by last updated descending) and `completedBooks` (percentage === 100, sorted by last updated descending). `DashboardPage.vue` consumes both. The completed list is sliced to 2 items in the component, with an overflow count derived from the full array length.

**Rationale**:
- Progress data is already loaded by `progressStore.fetchProgress()` on mount. No extra query needed.
- Keeping the filtering logic in the store (not the component) keeps the component thin and makes the selectors reusable by other pages.
- `last_updated` on the `reading_progress` table is updated by Supabase automatically on each `upsert` — already available.

**Alternatives considered**:
- Separate Supabase queries per section: adds 2 extra round trips per Dashboard load; unnecessary.
- Filtering inside `DashboardPage.vue`: works but duplicates logic if Library page needs same selectors.

---

## Decision 3: Library Sort Order

**Decision**: Sort the books list in `LibraryPage.vue` using a computed property that sorts by `progress.percentage` ascending, with `lastUpdated` descending as tie-breaker. The sort is applied to the existing `booksStore.books` array joined with progress data from `progressStore`.

**Rationale**:
- No backend query change needed — all data is already in client memory after initial fetches.
- Computed sort is reactive and automatically re-orders when progress updates.
- Ascending percentage (0% first) puts books needing the most attention at the top, matching reading-app conventions (e.g., Goodreads, StoryGraph).

**Alternatives considered**:
- `.order()` in the Supabase query: would require joining `books` and `reading_progress` in a single query — adds query complexity with no benefit since both are already fetched.

---

## Decision 4: PrimeVue Accordion for Recap Sections

**Decision**: Replace the three `<div class="recap-section glass-subtle">` blocks in `RecapStream.vue` and `RecapCard.vue` with PrimeVue 4's `<Accordion>` and `<AccordionPanel>` components. Set `value="0"` on `<Accordion>` to open only the first panel (Memory Jogger) by default. Each panel maps directly to the existing recap field.

**PrimeVue 4 Accordion API**:
```vue
<Accordion :value="['0']" multiple>
  <AccordionPanel value="0">
    <AccordionHeader>...</AccordionHeader>
    <AccordionContent>...</AccordionContent>
  </AccordionPanel>
</Accordion>
```
- `multiple` prop allows independent open/close of each panel.
- `:value="['0']"` opens only the first panel by default (index-based).
- No custom toggle logic needed — PrimeVue handles state internally.

**Rationale**:
- Native PrimeVue component is already in the dependency tree — no new packages.
- Handles keyboard accessibility, ARIA attributes, and animation out of the box.
- `multiple` mode matches FR-012 (panels are independent).

**Alternatives considered**:
- Custom accordion with `v-show`: more control but duplicates accessibility work PrimeVue already provides.
- Single-open accordion (no `multiple`): violates FR-012 (collapsing one must not affect others).
