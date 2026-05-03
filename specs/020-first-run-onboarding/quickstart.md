# Quickstart: First-Run Onboarding Validation

## Prerequisites

- A fresh test user account.
- Ability to add books manually or through ISBN lookup.
- Dashboard, Library, and Book Detail routes available.

## Validation Flow

### 1. No-Book Dashboard

1. Sign in as a user with no books.
2. Open the Dashboard.
3. Confirm only a compact first-book state appears.
4. Confirm the primary action opens the add-book flow.
5. Confirm in-progress, up-next, and completed sections are not shown as empty shells.

### 2. One Queued Book

1. Add one book with initial status "Want to read / queued".
2. Return to the Dashboard.
3. Confirm the book is not shown as a continue-reading hero.
4. Confirm the Dashboard offers a clear start/view action without redundant up-next clutter.

### 3. One Currently Reading Book

1. Add one book with initial status "Currently reading" and current page below total pages.
2. Return to the Dashboard.
3. Confirm the book appears as the hero automatically.
4. Confirm the same book is not repeated in the in-progress list.
5. Refresh the app and confirm the same hero is restored.

### 4. Progress From Book Detail

1. Start with one queued book.
2. Open the book detail page.
3. Save a current page greater than zero.
4. Navigate to the Dashboard.
5. Confirm the book is promoted to the hero automatically.

### 5. Completed Import

1. Add one book with initial status "Already completed".
2. Return to the Dashboard.
3. Confirm the book is acknowledged as completed, not active.
4. Confirm no continue-reading hero action appears for that book.
5. Confirm no session/capture/recap prompt is shown due only to the import.

### 6. Completed-Only Library

1. Add multiple books as already completed.
2. Return to the Dashboard.
3. Confirm the Dashboard shows a completed-library state and a clear action to add/start an active book.
4. Confirm no completed book is fabricated into an active hero.

### 7. Multiple Active Books

1. Add or progress two books into active reading.
2. Set or reorder the reading choice if that UI is available.
3. Return to the Dashboard and refresh.
4. Confirm explicit ordering is preserved.
5. If no explicit choice exists, confirm the chosen hero is deterministic and remaining active books appear as swap candidates.

## Expected Result

- New users never need to manually select their only in-progress book.
- Tiny libraries avoid duplicated or empty Dashboard sections.
- Completed imports feel like history, not active reading.
- Existing multi-book behavior remains predictable.
- TypeScript validation passes with `npx.cmd vue-tsc -b`.
