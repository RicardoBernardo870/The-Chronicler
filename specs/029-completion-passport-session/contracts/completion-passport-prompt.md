# Contract: Completion Passport Prompt

## Purpose

Define the user-facing completion prompt shown when a book newly reaches completion.

## Trigger

Prompt is eligible only when saved progress crosses from below 100% to 100% or above:

```text
previous percentage < 100
new percentage >= 100
```

Completed books already at 100% during hydration, refresh, import, or routine render must not trigger the prompt.

## Prompt Content

The prompt must:

- Celebrate completion.
- Include the book title when available.
- Explain that the reader can view their journey/Book Passport.
- Provide a primary action to view the Book Passport.
- Provide a secondary dismiss or continue action.

Suggested copy shape:

```text
Finished: {Book Title}
Your reading journey is ready. View your Book Passport to see the story so far.
[View Journey] [Continue]
```

## Primary Action

Routes to:

```text
{ name: "book-passport", params: { id: completedBookId } }
```

If passport content is pending, the destination handles loading or generation state.

## Secondary Action

Dismisses the prompt without changing:

- completed status,
- active replacement book,
- capture prompt state,
- recap/lore/passport generation side effects.

## UI Requirements

- Use PrimeVue-first primitives such as `ConfirmDialog`, `Dialog`, `Toast`, `Button`, or an existing project wrapper.
- Primary action must be visible on mobile without requiring scroll inside a tiny prompt.
- Prompt must not cover critical navigation permanently.
- Prompt must support keyboard and screen-reader interaction through the chosen PrimeVue primitive.

## Deduplication

- Prompt is consumed after either action.
- Prompt should not reappear for the same completion during background revalidation or page refresh.
- A second book completion later in the session can show a new prompt.

## Test Expectations

- Saving a book to 100% shows the prompt once.
- Clicking View Journey opens the passport route for that book.
- Dismissing leaves the completed book in completed list.
- Selecting a new book before dismissal does not replace the prompt's target book.
