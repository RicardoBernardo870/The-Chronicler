# Research: First-Run Onboarding

## Decision: Treat One In-Progress Book As The Automatic Hero

**Decision**: If exactly one book is in progress and no explicit active reading choice exists,
the Dashboard should promote that book as the primary reading focus.

**Rationale**: A page update is a strong intent signal. Requiring a new user to select the
same book again from an in-progress list adds friction at the exact moment the app should feel
aware and helpful.

**Alternatives considered**:

- Require explicit up-next selection: rejected because it creates unnecessary setup work for a
  one-book library.
- Persist a new hero-selection row immediately: rejected for this slice because the existing
  `up_next_order` and active-book derivation can express the behavior without schema changes.

## Decision: Preserve Explicit Choices Once Multiple Active Books Exist

**Decision**: Automatic hero selection only fills an absent obvious choice. Existing explicit
reading order and active-book selection continue to win when multiple active books exist.

**Rationale**: Onboarding inference should feel helpful, not controlling. Established users
with multiple books need predictable control over the hero card.

**Alternatives considered**:

- Always pick most recently updated progress: simple, but can override a deliberate queue.
- Always use up-next order even for one active book: preserves old behavior but reproduces the
  first-run bug.

## Decision: Initial Book Status Is UI-Level Input Backed By Existing Book/Progress Rows

**Decision**: Add an initial status choice to the add-book flow without adding a new status
column. The existing `books` row plus optional `reading_progress.current_page` expresses the
status:

- Queued: book row exists, no progress row or current page `0`.
- Currently reading: progress row exists with current page between `1` and `total_pages - 1`.
- Completed: progress row exists with current page equal to total pages.

**Rationale**: This matches existing derived status logic used by library/dashboard RPCs and
avoids a duplicate source of truth.

**Alternatives considered**:

- Add `books.initial_status`: rejected because it can drift from actual progress.
- Add a separate import table: rejected because this slice only needs current library state,
  not import auditing.

## Decision: Completed Imports Should Not Create Reading Sessions

**Decision**: Adding a completed book should create or update current progress as complete,
but should not create a session-like history entry unless later implementation discovers a
hard dependency. If a history row is needed for existing statistics, it must be distinguishable
from active reading and must not trigger session-ended UI.

**Rationale**: Completed imports are historical logging, not a reading session. Treating them
as sessions would confuse Last Session, capture prompts, velocity, and recap/corpus logic.

**Alternatives considered**:

- Insert a progress history row for every completed import: easier for some stats, but it
  risks polluting velocity/session behavior.
- Do not create progress at all for completed imports: rejected because completed library
  sections and finished counts depend on progress reaching completion.

## Decision: Hide Redundant Sections Instead Of Rendering Empty Shells

**Decision**: Dashboard first-run states should omit empty/redundant sections and use compact
action states only when they provide a next step.

**Rationale**: For tiny libraries, showing the app's full established-user structure makes the
product feel unfinished. A focused state is more useful and more legible on mobile.

**Alternatives considered**:

- Keep all sections visible with empty copy: rejected because it creates visual noise and
  duplicates first-run guidance.
- Build a full tutorial: rejected as out of scope and contrary to the app-like UX goal.

## Decision: AI And Active-Reading Workflows Are Explicitly Context-Gated

**Decision**: Completed imports should not start recap generation, session prompts, capture
prompts, vocabulary extraction, lore unlocks, or continue-reading actions. Reader DNA may still
use completed books when existing eligibility rules allow it.

**Rationale**: Importing history is a different user intent from reading now. AI should appear
where expected and useful, not as a side effect of catalog cleanup.

**Alternatives considered**:

- Let existing completion side effects run: rejected because it causes confusing prompts and
  unnecessary AI work.
- Disable all AI contribution from completed imports: rejected because completed books are
  meaningful reader-identity data under existing Reader DNA rules.
