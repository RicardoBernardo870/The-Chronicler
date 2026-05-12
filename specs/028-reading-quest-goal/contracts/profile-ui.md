# Contract: Profile Reading Quest UI

## Components

### ReadingQuestCard

Responsibility: Show current-year goal state, progress, pace, projection, and friendly status.

Required states:

- No goal set
- Goal set with projection
- Goal set without enough history for projection
- Goal achieved
- Loading
- Save error

Required visible content when goal exists:

- Year
- Completed books / target books
- Percent complete
- Progress indicator
- Status label
- Required monthly pace
- Current monthly pace when available
- Projected year-end books when available
- Edit goal action

Required visible content when no goal exists:

- Inviting empty-state copy
- Set goal action

### ReadingGoalDialog

Responsibility: Let user set or edit current-year target.

Behavior:

- Opens from ReadingQuestCard.
- Pre-fills existing target when editing.
- Validates target is at least 1.
- Saves through the goal persistence path.
- Closes after successful save.
- Shows user-friendly error on failure.

PrimeVue-first components expected:

- Dialog for the modal
- InputNumber for target
- Button for actions
- InlineMessage or Message for validation/errors

### ReaderLevelStrip

Responsibility: Show total XP, level title, progress to next level, and next-level prompt.

Required visible content:

- Current level number
- Current level title
- Total XP
- Progress indicator toward next level
- XP remaining and next title when available

## Placement

The Reading Quest card should appear on Profile after the existing top identity/Reading DNA area and before lower analytical sections. The level strip may live inside the Reading Quest card or directly below it as a compact paired element.

## Accessibility and UX

- Goal setting must be keyboard accessible.
- Progress indicators must have text equivalents.
- Status labels must not rely on color alone.
- Copy must remain calm and non-punitive.
- Existing Profile cards must remain visible and readable.
