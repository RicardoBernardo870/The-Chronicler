# Quickstart: Reading Quest Goal

## Prerequisites

- User is authenticated.
- User can open the Profile page.
- Test account has at least one book in the library.

## Scenario 1 - Set first yearly goal

1. Open Profile.
2. Find the Reading Quest card.
3. Choose the set-goal action.
4. Enter `24` as the current-year target.
5. Save.
6. Expected: The card shows `0 / 24` or the user's actual current-year completions, a progress indicator, and an edit action.
7. Refresh the page.
8. Expected: The same goal persists.

## Scenario 2 - Edit yearly goal

1. Open Profile with an existing current-year goal.
2. Choose edit goal.
3. Change the target to `12`.
4. Save.
5. Expected: The card updates to the new target and recalculates progress immediately.

## Scenario 3 - Invalid goal target

1. Open the goal dialog.
2. Enter `0`.
3. Try to save.
4. Expected: Save is blocked and a validation message explains the goal must be at least one book.

## Scenario 4 - Completed books count

1. Use an account with books completed in the current year.
2. Open Profile.
3. Expected: The completed count on the Reading Quest card matches the current-year completed books.
4. If completed count exceeds target, expected: card shows complete/celebratory state while still showing the actual completed count.

## Scenario 5 - Pace projection available

1. Use an account with enough current-year completion or pace history.
2. Open Profile.
3. Expected: The card shows required monthly pace, current monthly pace, projected year-end total, and one friendly status label.

## Scenario 6 - Pace projection unavailable

1. Use a new account with a goal but little or no reading history.
2. Open Profile.
3. Expected: The card shows goal progress and supportive copy indicating projections unlock with more logged progress.

## Scenario 7 - Reader level display

1. Use an account with pages read, sessions, captures, recaps, and lore cards.
2. Open Profile.
3. Expected: Level area shows current title, total XP, progress toward next level, and XP remaining.
4. Refresh the page.
5. Expected: XP and level are identical to the previous load.

## Scenario 8 - Existing Profile cards remain intact

1. Open Profile after enabling the feature.
2. Expected: Reading DNA, Lifetime Stats, Reading Forecast, and Library Breakdown still render.
3. Navigate away and back.
4. Expected: Reading Quest and existing cards reload without layout breakage.

## Implementation Validation Notes

- Automated unit tests passed with `npm.cmd test` on 2026-05-12.
- Production build passed with `npm.cmd run build` on 2026-05-12.
- Manual quickstart scenarios were not executed per project direction; no functional test pass was required for this implementation.
