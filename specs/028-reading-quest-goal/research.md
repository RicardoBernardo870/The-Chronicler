# Research: Reading Quest Goal

## Decision 1 - Persist yearly goals in `reading_goals`

**Decision**: Add a small `reading_goals` table with one row per user/year and a unique constraint on `(user_id, year)`.

**Rationale**: A goal is user-authored state, not derivable activity. A dedicated table keeps it separate from reading progress, supports future historical year views, and allows atomic insert/update through a unique key. Supabase best practices support using constraints and `insert ... on conflict` for race-free upserts.

**Alternatives considered**:

- Store current goal in local storage: rejected because goals must persist across devices.
- Store goal in a generic profile/settings JSON blob: rejected because querying by year and validating target values becomes weaker.
- Store one global goal without year: rejected because yearly goal history and calendar rollover would be ambiguous.

## Decision 2 - Use RPC for quest and XP aggregation

**Decision**: Add a single `get_reading_quest_summary(p_user_id uuid, p_year int)` RPC that returns goal, progress, pace, projection, XP, level, and source counts.

**Rationale**: The Profile page already uses RPCs for reading stats and library breakdown. A single aggregate RPC avoids N+1 client queries across `books`, `reading_progress`, `progress_history`, `recaps`, `page_captures`, and `lore_cards`. This follows Supabase guidance to batch work server-side and add indexes on filtered/joined columns.

**Alternatives considered**:

- Query each table from the client and aggregate in TypeScript: rejected due to many round trips and higher RLS/query overhead.
- Materialize a profile stats table: rejected for v1 because XP and quest are cheap to derive and materialization introduces synchronization risk.
- Extend `get_reading_stats`: rejected to keep existing consumers stable and avoid overloading a lifetime-stats contract with goal-specific state.

## Decision 3 - XP is derived, not written incrementally

**Decision**: Compute XP from existing persisted activity every time the quest summary is requested.

**Rationale**: Derived XP is deterministic and avoids backfill complexity. It also avoids a new activity ledger table and prevents double-awarding XP when a user retries an action.

**Alternatives considered**:

- Write XP events at the time of each activity: rejected because every existing feature would need mutation hooks and replay/backfill logic.
- Store only total XP on the profile: rejected because correcting historical data or deleted books would not be reflected.

## Decision 4 - XP source rules for v1

**Decision**: Use these deterministic v1 XP weights:

- 1 XP per page read, based on `greatest(current_page, 0)` from reading progress capped by each book's total pages.
- 25 XP per completed book.
- 10 XP per qualifying reading session, counted from progress history rows.
- 5 XP per page capture.
- 20 XP per recap.
- 15 XP per lore card.

**Rationale**: These sources map directly to persisted tables and the user's requested rules. Page XP rewards sustained reading; artifact XP rewards BookHero-specific memory-building behavior.

**Alternatives considered**:

- Count vocabulary XP in v1: deferred because the user removed vocabulary from the requested XP list and review activity availability is less clear.
- Award XP by pages-per-session deltas only: rejected because current page progress is a simpler lifetime page-read proxy and handles completed imports.

## Decision 5 - Completion date fallback

**Decision**: Count current-year completed books by reading progress rows whose percentage is complete and whose best available completion timestamp falls in the selected year. In v1, the best available timestamp is the progress row's `updated_at` unless a more exact completion signal is present during implementation.

**Rationale**: The spec explicitly allows `reading_progress.updated_at` when exact completion date is unavailable. This keeps the feature shippable without retroactive schema changes.

**Alternatives considered**:

- Infer completion from `progress_history` first 100 percent crossing: potentially more exact, but more expensive and not guaranteed for completed imports.
- Add a `completed_at` column before this feature: useful future improvement, but not required for v1.

## Decision 6 - Pace and projection model

**Decision**: Use current-year completion pace for quest projection when enough completion data exists, and current reading forecast pages/book pace as a secondary signal only for copy or future refinement. Required pace is target books divided across the remaining year/months.

**Rationale**: The quest goal is measured in books, so book completion pace is easier for users to understand than pages/hour. The existing reading forecast remains useful context but should not be the sole source of goal status.

**Alternatives considered**:

- Use pages-per-month divided by average book length for all projections: rejected as the only method because it can predict books before any completion has occurred and may feel less trustworthy.
- Use all-time pace: rejected because yearly goals should reflect the current year's rhythm.

## Decision 7 - Level threshold curve

**Decision**: Use a deterministic increasing curve with named titles. V1 can use 500 XP for early levels and progressively larger thresholds after level 5, while always returning exact current/next thresholds from the RPC.

**Rationale**: A curve creates satisfying early progress without making later levels too easy. Returning thresholds from the aggregate contract keeps UI simple and testable.

**Alternatives considered**:

- Flat 500 XP per level forever: simpler, but long-term levels become too frequent for active users.
- Fully configurable levels: rejected for v1 because there is no product need for admin-configured thresholds.

## Decision 8 - Supabase performance and RLS patterns

**Decision**: Add indexes matching access patterns: `(user_id, year)` unique index/constraint on goals, and rely on or add composite indexes for activity filters by `user_id` and date/book where needed. RLS policies use `(select auth.uid()) = user_id` and an index on `user_id`.

**Rationale**: Supabase best practices emphasize indexes on WHERE/JOIN columns, composite indexes for multi-column filters, and optimized RLS policies that avoid per-row function calls. The quest RPC will filter by user and year/date ranges, so those paths must be indexed.

**Alternatives considered**:

- Rely only on existing indexes: rejected until implementation verifies all aggregate filters are covered.
- Client-only authorization checks: rejected because user-owned goal rows require database-enforced isolation.
