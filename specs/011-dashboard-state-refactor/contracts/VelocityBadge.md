# Contract: `VelocityBadge.vue` (audited)

**Path**: `src/components/pulse/VelocityBadge.vue`
**Feature**: 011-dashboard-state-refactor

## Purpose

Display a reader's recent pages-per-hour. Must never render `NaN`, `Infinity`, or empty numeric strings.

## Props

```ts
defineProps<{
  bookId: string
  totalPages: number
  currentPage: number
}>()
```

## Rendered output matrix

| Condition | Rendered |
|-----------|---------|
| `velocity` is `null`, `undefined`, `NaN`, or `Infinity` | Fallback chip ("—" or "Calculating…") |
| Qualifying session but `durationSeconds < 60` | Fallback chip |
| Qualifying session and `pagesDelta < 1` | Fallback chip |
| Valid velocity | `"${Math.round(pph)} pages/hr"` |

## Finish prediction

- `null` guard when `totalPages <= 0`, `currentPage > totalPages`, or `velocity === null`.
- When computable, format: `"~${days}d left"` / `"~${hours}h left"` (existing format retained).

## Invariants

- No code path renders the literal string `"NaN"`, `"Infinity"`, `"-Infinity"`, or `"undefined"` to the DOM.
- `onMounted(() => pulse.fetchHistory())` is retained; no eager fetch in `setup()` to keep SSR-safe.
- Component is pure: no reads from route/router; fully driven by props + pulse composable.

## Tests

- Unit: pass each of `[null, undefined, NaN, Infinity, 0, 0.5, 50]` to a mocked `velocity` ref; assert fallback vs formatted output.
- Unit: `totalPages: 0, currentPage: 0` → `prediction === null`.
- Unit: `totalPages: 100, currentPage: 150` → `prediction === null`.
