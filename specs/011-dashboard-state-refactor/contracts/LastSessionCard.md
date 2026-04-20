# Contract: `LastSessionCard.vue`

**Path**: `src/components/dashboard/LastSessionCard.vue`
**Feature**: 011-dashboard-state-refactor

## Purpose

Glanceable summary of the reader's most recent session across the library: recency phrase, pages read, VelocityBadge.

## Props

None — component self-hydrates via `useLastSession()`.

## Consumed composables

- `useLastSession()` → `Ref<LastSession | null>`
- `booksStore` → resolves book title for the session's `bookId`

## Rendered states

| `lastSession` | Rendered |
|---------------|---------|
| `null` | Nothing (component returns empty template) |
| present | Card with: book title, recency string, `{pagesDelta} pages`, `<VelocityBadge />` |

## Layout

- Positioned inside the Dashboard under the "Your Reading" hero card.
- Uses Chronicler card styling (same border radius, glass backdrop, typography) as sibling Dashboard cards.
- Must be readable one-handed on mobile (single column on narrow viewports).

## Recency formatter rules

| Delta | Output |
|-------|--------|
| < 2 min | "Just now" |
| 2–59 min | "{n} minutes ago" |
| 1–23 h (same calendar day) | "{n} hours ago" |
| Previous calendar day | "Yesterday" |
| 2–6 days | "{n} days ago" |
| ≥ 7 days | "{n} weeks ago" (integer weeks, min 1) |

## Tests

- Render with mocked `lastSession = null` → component output is empty.
- Render with a valid session 10 minutes ago → shows "10 minutes ago" and `"{n} pages"`.
- Render with a session 26 hours ago → shows "Yesterday".
- Render with a session 10 days ago → shows "1 weeks ago" (or implementation-rounded variant).
- Unmount during fetch → no dangling watchers (verified via Vue devtools warning check).
