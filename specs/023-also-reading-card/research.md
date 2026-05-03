# Research: Also Reading Card

## Decision: Expose one stable read RPC for the card

**Decision**: Add `public.get_also_reading_for_book(...)` as an authenticated, read-only,
security-definer RPC that returns card-ready JSON.

**Rationale**: The feature combines follows, blocks, privacy, profile visibility, book
matching, and progress comparison. A single RPC prevents private intermediate data from
reaching the client and gives future iOS the same contract as the PWA.

**Alternatives considered**:

- Client-side joins through Supabase table reads: rejected because hidden progress/currently
  reading data would have to be filtered client-side.
- Edge function: rejected because the data is relational, synchronous, and best enforced close
  to RLS/indexed SQL.

## Decision: Reuse existing community privacy and graph tables

**Decision**: Use `community_profiles`, `community_profile_privacy`, `follows`, and `blocks`
created by prior community features.

**Rationale**: The existing foundation already models public profile identity, granular
visibility, follow relationships, and either-direction blocks. This feature is a read surface
on top of that graph, not a new relationship type.

**Alternatives considered**:

- Add an "also reading" materialized table: rejected because the data is derivable from
  current progress and would create synchronization risk.
- Add a new privacy field: rejected because existing `currently_reading_visibility` and
  `progress_visibility` map exactly to the required controls.

## Decision: Match by book id first, normalized ISBN second

**Decision**: Treat the same `books.id` as `same_book` and matching normalized non-null ISBN
as `same_isbn` when book ids differ.

**Rationale**: Direct book id is the strongest match within the app. ISBN handles separate
edition records and import paths while preserving the physical-book bridge. Normalization
removes punctuation/case differences without external lookup.

**Alternatives considered**:

- Title/author fuzzy matching: rejected for v1 because false positives would be socially
  confusing and harder to explain.
- External canonical work service: rejected because it adds dependency/failure modes outside
  this feature's scope.

## Decision: Compute relative labels inside the RPC

**Decision**: Return `relativeStatus` values of `ahead`, `behind`, `same_area`, or `null`.
`same_area` means the followed reader is within 10% of the viewer's progress.

**Rationale**: The label depends on whether progress is visible and comparable. Computing it
server-side keeps the response contract consistent for PWA and iOS, and avoids revealing hidden
raw progress to clients.

**Alternatives considered**:

- Client-side relative label calculation: rejected because the client would need comparable
  progress data even when future presentation rules change.
- Exact page comparison only: rejected because editions can differ and percentages better match
  the existing cross-edition progress model.

## Decision: Omit rows when current-reading identity is not visible, omit fields when progress is not visible

**Decision**: A followed reader appears only if currently-reading visibility allows the viewer.
Progress details and relative labels appear only if progress visibility also allows the viewer.

**Rationale**: The card's existence says "this person is reading this book", which is current
reading data. Page/percentage labels are a stricter progress surface and must be independently
gated.

**Alternatives considered**:

- Show anonymized counts for hidden users: rejected because the spec requires no empty/hidden
  leakage and the first invite-only version values trust over density.
- Show identity but hide book match metadata: rejected because identity in this card already
  reveals current-reading presence.

## Decision: Use bounded cursor pagination

**Decision**: Default the card query to 3 visible readers. Support `p_limit` clamped to 1-20
and `p_cursor` for "view more"; cursor sorts by followed reader's progress update time and
user id.

**Rationale**: Book detail should stay calm and fast. Cursor pagination avoids deep-offset
work and gives the view-more dialog a durable path if the invite group grows.

**Alternatives considered**:

- Return every matching reader: rejected because it can slow book detail and create visual
  noise.
- Offset pagination: rejected per Supabase/Postgres best practices because deeper pages scan
  skipped rows.

## Decision: Add partial/composite indexes for the read path

**Decision**: Verify or add indexes that support active progress reads, book owner/ISBN joins,
follow graph lookup, and block exclusion. Prefer partial indexes for `books.isbn is not null`
and active in-progress rows.

**Rationale**: Supabase/Postgres best practices require indexes on WHERE/JOIN columns and
foreign keys. Partial indexes keep write overhead lower when the query always excludes null
ISBNs or completed/unstarted progress.

**Alternatives considered**:

- Rely only on existing indexes: rejected unless EXPLAIN/advisors show the full also-reading
  plan already uses index scans for book/progress matching.
- Add broad single-column indexes only: rejected where composite indexes better match query
  filters and ordering.

## Decision: Keep UI ambient and independent from core book data

**Decision**: Mount the card after the primary progress panel and let it fetch asynchronously.
Hide the card when results are empty; show a compact non-blocking loading shell only inside the
card area if cached results already exist or a fetch is in flight.

**Rationale**: The feature must not interrupt reading or delay Book Detail. It should feel like
awareness, not a new required workflow.

**Alternatives considered**:

- Put the card above progress controls: rejected because it would compete with the reading
  workflow.
- Show a permanent empty card: rejected by the spec and success criteria.
