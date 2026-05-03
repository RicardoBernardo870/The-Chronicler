# Data Model: First-Run Onboarding

## Library Entry

**Purpose**: Represents a book saved by the user.

| Field | Rules |
|---|---|
| `id` | Stable book identifier |
| `title` | Required |
| `author` | Required |
| `totalPages` | Required positive integer for progress/status calculations |
| `coverUrl` | Optional |
| `genre` | Optional |
| `isbn` | Optional |

**Relationships**:

- May have one Reading Progress row for the current user.
- May appear in Reading Order Choice rows.
- May be shown in Dashboard first-run states.

## Reading State

**Purpose**: Derived state describing the user's relationship to a Library Entry.

| State | Derivation |
|---|---|
| `queued` | No progress row, current page missing, or current page is `0` |
| `currentlyReading` | Current page is greater than `0` and less than `totalPages` |
| `completed` | Current page is greater than or equal to `totalPages` |

**Validation rules**:

- Current page is clamped between `0` and `totalPages`.
- Completion must not produce percentages greater than `100`.
- Total pages must be present and positive before currently-reading or completed status can be saved.

## Initial Book Status

**Purpose**: Add-book form choice that determines the initial Reading State.

| Input option | Resulting state |
|---|---|
| Want to read / queued | Library Entry created; no active progress required |
| Currently reading | Library Entry created; progress saved with user-provided current page |
| Already completed | Library Entry created; progress saved at total pages |

**Side-effect rules**:

- Queued books do not become active hero books automatically.
- Currently-reading books may become automatic hero books when they are the only active book.
- Completed imports do not start session/capture/recap workflows.

## Primary Reading Focus

**Purpose**: The book displayed as the main Dashboard hero reading card.

**Selection rules**:

1. If the user has an explicit active/ordered reading choice and the book is still in progress,
   use that choice.
2. If no explicit choice exists and exactly one book is in progress, use that book.
3. If no explicit choice exists and multiple books are in progress, use deterministic order:
   reading order first when present, otherwise most recently updated progress.
4. Completed-only and queued-only libraries do not create an active continue-reading hero.

## First-Run Dashboard State

**Purpose**: Condensed Dashboard presentation for tiny or new libraries.

| State | Display behavior |
|---|---|
| No books | Compact add-first-book state |
| One queued book | Ready-to-start state with direct start/view action |
| One in-progress book | Hero book only; no duplicate in-progress list |
| Completed-only library | Completed-library acknowledgement with add/start next action |
| One active plus completed books | Active book hero, completed preview only if useful |
| Multiple active books | Hero plus remaining active books as swap candidates |

## Completed Import

**Purpose**: A Library Entry added as historical reading.

**Rules**:

- Saves progress at completion.
- Appears in completed/archive library surfaces.
- May contribute to completed counts and Reader DNA eligibility.
- Must not be treated as a fresh reading session.
- Must not emit session-ended events or capture prompts.

## Implementation Decision: No New Tables

The first-run onboarding implementation uses the existing `books` and
`reading_progress` tables. Initial add status is an application-level command
that either creates only a `books` row (`queued`) or creates a confirmed
`reading_progress` row without writing `progress_history`
(`currentlyReading` / `completed`). This keeps the feature additive without a
schema migration and avoids turning completed imports into session-like events.

## State Transitions

```text
No books -> Queued first book -> Start reading -> One active hero
No books -> Completed import -> Completed-only Dashboard state
Queued book -> Progress > 0 -> Active hero candidate
Active book -> Progress reaches total pages -> Completed; hero clears or promotes next active
Completed import -> User explicitly starts/re-reads -> Active reading flow begins
One active book -> Second active book added -> Explicit order or deterministic multi-book focus
```
