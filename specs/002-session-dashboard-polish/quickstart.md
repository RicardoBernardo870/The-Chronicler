# Quickstart Test Scenarios: Session Persistence & Dashboard Polish

**Date**: 2026-04-16  
**Feature**: `002-session-dashboard-polish`

Use these scenarios to manually verify the feature end-to-end after implementation.

---

## Scenario 1: Session survives page refresh

**Setup**: Log in to The Chronicler in a browser tab.

**Steps**:
1. Confirm you are on the Dashboard (URL: `/`).
2. Press **F5** (or Cmd+R) to hard-refresh the page.

**Expected**: Dashboard loads immediately. No redirect to `/auth`. User is still recognised. Header shows logged-in state.

**Fail condition**: App redirects to the login screen after refresh.

---

## Scenario 2: Explicit logout clears session

**Steps**:
1. Log in.
2. Click Sign Out.
3. Navigate back to `/` directly.

**Expected**: Redirected to `/auth`. No ghost session.

---

## Scenario 3: Dashboard sections render correctly

**Setup**: Ensure the following books exist with these progress values:
- Book A: 0 pages read (0%)
- Book B: 150 / 300 pages (50%)
- Book C: 300 / 300 pages (100%) — completed most recently
- Book D: 400 / 400 pages (100%) — completed earlier

**Steps**:
1. Open the Dashboard.

**Expected**:
- Hero card shows the most recently updated in-progress book (Book B or A based on last touch).
- **In Progress** section shows Book A and Book B (both < 100%).
- **Completed** section shows Book C and Book D (the 2 most recently completed).
- No overflow hint (exactly 2 completed).

**Variation** — Add a 3rd completed book (Book E at 100%):
- Completed section shows only 2 most recent.
- Overflow hint: "and 1 more — check your Library" with a link to `/library`.

---

## Scenario 4: Library sort order

**Setup**: Same 4 books as Scenario 3.

**Steps**:
1. Navigate to the Library.

**Expected order** (top → bottom): Book A (0%) → Book B (50%) → Book C (100%) → Book D (100%).

For the two 100% books: the more recently updated one appears first.

---

## Scenario 5: Recap accordion default state

**Steps**:
1. Open any book detail page.
2. Click **Get Recap**.
3. Wait for generation to complete.

**Expected**:
- Three accordion panels appear: **Memory Jogger**, **Concept Watchlist**, **Thematic Bridge**.
- Memory Jogger panel is **expanded** (content visible).
- Concept Watchlist panel is **collapsed** (content hidden, only header visible).
- Thematic Bridge panel is **collapsed**.

**Steps** (interaction):
4. Click the Concept Watchlist header → panel expands.
5. Click Memory Jogger header → Memory Jogger collapses. Concept Watchlist remains expanded.
6. Click Thematic Bridge header → Thematic Bridge expands independently.

**Expected**: All three can be in any combination of open/closed simultaneously.

---

## Scenario 6: Recap history uses same accordion

**Steps**:
1. Generate at least one recap for a book.
2. Navigate to that book's Recap History page.

**Expected**: Each historical recap card in the history list shows the same three-panel accordion layout with Memory Jogger open by default.
