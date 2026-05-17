# Quickstart: Completion Passport Session

## Prerequisites

- Use a test account with at least two books:
  - Book A: currently reading and close to completion.
  - Book B: queued or unread, with no saved page progress if possible.
- Ensure the app is online for Start Session checks.

## Validation Flow 1: Complete A Book And View Passport Prompt

1. Open Dashboard.
2. Select Book A as the active reading book.
3. Save progress at the final page.
4. Confirm Book A moves out of reading-now and into completed.
5. Confirm a completion prompt appears once.
6. Choose the prompt's View Journey / Book Passport action.
7. Confirm the app opens `/books/{bookAId}/passport`.
8. Return to Dashboard.
9. Refresh the app.
10. Confirm the prompt does not reappear for Book A just because of refresh.

## Validation Flow 2: Select New Book And Start Session Immediately

1. After Book A is completed, select Book B from the available library/up-next surface.
2. Do not save a page first.
3. Press Start Session.
4. Confirm the button changes to active session state.
5. Confirm Book B still shows page 0, or its existing current page if it had progress.
6. Save a later page.
7. Confirm the session ends normally and the capture prompt behavior remains unchanged.

## Validation Flow 3: Dismiss Prompt And Continue

1. Complete another test book or reset Book A below completion.
2. Save final-page progress.
3. Dismiss the completion prompt.
4. Confirm the app remains usable and no navigation occurs.
5. Confirm the completed book still exposes Book Passport from its normal completed/detail surface.

## Automated Checks

Run:

```bash
npm test
npm run build
```

Recommended focused test additions:

- `tests/unit/progressSession.spec.ts`: verifies Start Session upserts page-0 progress for a book without progress.
- `tests/unit/completionPassportPrompt.spec.ts`: verifies prompt eligibility only on below-100 to 100+ transitions.
