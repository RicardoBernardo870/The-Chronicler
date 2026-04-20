# Contract: LoreChronoscopeCard Component

**File**: `src/components/lore/LoreChronoscopeCard.vue`  
**Status**: ALREADY IMPLEMENTED (collapsible pattern) — contract documents expected interface.

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `bookId` | `string` | Yes | — | The book ID to fetch and display lore for |
| `collapsible` | `boolean` | No | `false` | Enables click-to-expand mode |
| `initialCollapsed` | `boolean` | No | `false` | Starting state when `collapsible=true` |

## Emits

None. The component is self-contained.

## Behaviour Contracts

- Renders a skeleton while lore is being fetched on `onMounted`.
- Renders nothing (`<template v-else />`) when no lore cards exist for the book.
- In `collapsible` mode: clicking the card toggles expanded/collapsed state.
- In `collapsible` mode: clicking the cycle button shows a random different card without collapsing.
- Card index updates reactively when new lore cards are added to the store (no refresh needed).
- Non-collapsible mode: clicking navigates to `{ name: 'lexicon', query: { bookId, tab: 'lore' } }`.

## Usage (Dashboard — collapsible, start expanded)

```html
<LoreChronoscopeCard :book-id="currentBook.id" :collapsible="true" />
```

## Usage (Book Details — collapsible, start expanded)

```html
<LoreChronoscopeCard :book-id="bookId" :collapsible="true" :initial-collapsed="false" />
```
