# UI State Contract: First-Run Dashboard And Add-Book Flow

This contract describes the observable user-facing states that implementation must preserve.
It is intentionally framework-neutral and can guide manual QA, component tests, or future iOS
parity.

## Add-Book Initial Status Contract

### Inputs

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Book title |
| `author` | Yes | Book author |
| `totalPages` | Yes | Positive integer |
| `initialStatus` | Yes | `queued`, `currentlyReading`, or `completed` |
| `currentPage` | Conditional | Required when `initialStatus` is `currentlyReading` |

### Expected outcomes

| `initialStatus` | Expected book state | Expected Dashboard behavior |
|---|---|---|
| `queued` | Not started | Does not show as continue-reading hero |
| `currentlyReading` | In progress at chosen page | Becomes hero if it is the only active book |
| `completed` | Finished at total pages | Appears in completed surfaces, not active hero |

### Forbidden side effects for `completed`

- No active reading session prompt.
- No page-capture prompt.
- No automatic recap generation.
- No continue-reading hero action.
- No session-ended event.

## Dashboard State Matrix

| Library condition | Hero area | Secondary sections |
|---|---|---|
| No books | First-book empty state | Hide in-progress, up-next, completed |
| One queued book | Ready-to-start state | Hide redundant up-next list |
| One in-progress book | Hero book | Hide duplicate in-progress list; hide empty up-next |
| One completed book only | Completed-only state | Completed preview/action only if useful |
| Completed books plus one active book | Active book hero | Completed preview may show; no duplicate active list |
| Multiple active books | Selected/inferred hero | Remaining active books may appear as swap candidates |

## Primary Focus Selection Contract

1. Use explicit user choice when valid.
2. If no valid explicit choice and exactly one active book exists, use it.
3. If no valid explicit choice and multiple active books exist, choose deterministically.
4. If no active books exist, do not fabricate an active hero from completed books.

## Cache And Refresh Contract

After any of these actions, Dashboard state must reflect the latest library/progress state on
navigation and refresh:

- Book added as queued.
- Book added as currently reading.
- Book added as completed.
- Progress updated from book detail.
- Book reaches completion.
- Book status changes through progress edits.

## Copy Contract

First-run copy should be short, action-oriented, and non-judgmental.

Avoid:

- Tutorial-length explanations.
- Marketing-style hero copy.
- Empty sections whose only purpose is to explain that they are empty.

Prefer:

- One clear primary action.
- Small supporting text.
- Existing app vocabulary: add, start, continue, library, completed.
