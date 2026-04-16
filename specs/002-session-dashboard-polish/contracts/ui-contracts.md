# UI Contracts: Session Persistence & Dashboard Polish

**Date**: 2026-04-16  
**Feature**: `002-session-dashboard-polish`

---

## Contract 1: AuthStore.initialize()

**Component**: `src/stores/auth.ts`  
**Called by**: `App.vue` on mount

```
initialize() → Promise<void>
  1. Calls supabase.auth.getSession()
  2. Sets user and session in Pinia state synchronously from result
  3. Subscribes to supabase.auth.onAuthStateChange(...)
     - On SIGNED_IN: update user + session
     - On SIGNED_OUT: clear user + session
     - On TOKEN_REFRESHED: update session
  4. Returns only after step 2 completes
     (router navigation guard must await this before evaluating auth state)
```

**Guarantee**: By the time any Vue Router navigation guard runs, `authStore.user` is either populated with a valid user or null. No race condition between session restore and route guard.

---

## Contract 2: ProgressStore — inProgress / completed selectors

**Component**: `src/stores/progress.ts`

```
inProgressBooks: ComputedRef<Array<{ book: Book; progress: Progress }>>
  - Entries where 0 < progress.percentage < 100
  - Sorted by progress.updatedAt descending

completedBooks: ComputedRef<Array<{ book: Book; progress: Progress }>>
  - Entries where progress.percentage === 100
  - Sorted by progress.updatedAt descending
```

---

## Contract 3: DashboardPage in-progress + completed sections

**Component**: `src/pages/DashboardPage.vue`

```
Section: "In Progress" (rendered only if inProgressBooks.length > 0)
  - Lists all inProgressBooks entries
  - Each item shows: cover thumbnail, title, author, progress bar, percentage

Section: "Completed" (rendered only if completedBooks.length > 0)
  - Shows completedBooks.slice(0, 2)
  - If completedBooks.length > 2: shows hint "and N more — check your Library"
    where N = completedBooks.length - 2
  - Hint links to /library
```

---

## Contract 4: LibraryPage sort order

**Component**: `src/pages/LibraryPage.vue`

```
sortedBooks: ComputedRef<Book[]>
  Input: booksStore.books joined with progressStore.progressByBook
  Sort key 1: progress.percentage ASC (books with no progress treated as 0%)
  Sort key 2: progress.updatedAt DESC (tie-breaker)
  Output: stable sorted array rendered in order
```

---

## Contract 5: Recap Accordion

**Components**: `src/components/recap/RecapStream.vue`, `src/components/recap/RecapCard.vue`

```
<Accordion :value="['0']" multiple>
  <AccordionPanel value="0">           ← Memory Jogger (open by default)
    <AccordionHeader>The Memory Jogger</AccordionHeader>
    <AccordionContent>
      <p>{{ memoryJogger }}</p>
    </AccordionContent>
  </AccordionPanel>

  <AccordionPanel value="1">           ← Concept Watchlist (closed by default)
    <AccordionHeader>Concept Watchlist</AccordionHeader>
    <AccordionContent>
      <div class="recap-section__chips">...</div>
    </AccordionContent>
  </AccordionPanel>

  <AccordionPanel value="2">           ← Thematic Bridge (closed by default)
    <AccordionHeader>Thematic Bridge</AccordionHeader>
    <AccordionContent>
      <p>{{ thematicBridge }}</p>
    </AccordionContent>
  </AccordionPanel>
</Accordion>

Behaviour:
- multiple=true: each panel toggles independently
- :value="['0']": only panel "0" is open on mount
- Same contract applies to RecapCard.vue for historical recaps
```
