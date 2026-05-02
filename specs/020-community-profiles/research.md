# Research: Community Reader Profiles

## Decision: Create Minimal Follow Relationship In This Feature

**Decision**: Add an asymmetric minimal follow table now for follower-only privacy evaluation,
but do not build follower lists, counts, suggestions, or full follow management UI.

**Rationale**: The spec includes `followers` visibility for progress, currently reading,
lexicon highlights, and Reader DNA. Without a real relationship, that visibility option would
be untestable or misleading. A minimal relationship keeps privacy behavior honest while
preserving the larger follow graph as a later feature.

**Alternatives considered**:

- Treat follower-only as hidden until later: simpler but makes one of the shipped privacy
  choices functionally unusable.
- Remove follower-only from the profile feature: contradicts the community design notes and
  would require a later privacy migration.

## Decision: Split Progress From Currently Reading

**Decision**: Progress visibility controls aggregate stats only. Currently reading visibility
controls active book titles, covers, current page, total pages, and percent completion.

**Rationale**: Aggregate reading stats can be useful social currency without revealing which
book a user is currently reading. Combining these concepts would leak active reading identity
through a supposedly separate progress setting.

**Alternatives considered**:

- Progress controls all page/progress details: too broad and risks active-book leakage.
- Merge both controls: simpler UI but less privacy granularity.

## Decision: Usernames Are Mutable Without Reservations

**Decision**: Users may change usernames freely. Old usernames become available immediately
and do not redirect.

**Rationale**: The current product is still early and used by a small/select group. Avoiding
reservation and redirect tables keeps the foundation lighter while preserving case-insensitive
uniqueness for the current username.

**Alternatives considered**:

- Immutable usernames: too harsh for early users.
- Reserved username history with redirects: better for large social networks but unnecessary
  for this foundation slice and increases schema/task scope.

## Decision: Lexicon Highlights Are Recently Mastered Words

**Decision**: Public lexicon highlights show recently mastered words only.

**Rationale**: The community notes frame lexicon as social identity, not a raw activity log.
Mastered words are a stronger signal than words merely captured or added automatically.

**Alternatives considered**:

- Recently added words: easier, but exposes immature or accidental entries.
- User-curated words: expressive, but adds another management workflow.
- Rarest words: interesting, but depends on wider corpus metrics not in this slice.

## Decision: Public Profile RPC Omits Hidden Sections

**Decision**: Public profile read payloads include only allowed sections and omit hidden
sections without reason codes.

**Rationale**: Omission avoids leaking owner privacy settings, follower relationship state,
or block status. The frontend can render visible sections naturally and use a generic
unavailable state for inaccessible profiles.

**Alternatives considered**:

- Return hidden-section reason codes: helpful for UI copy, but leaks private relationship and
  privacy metadata.
- Return all section shells with `visible: false`: keeps layout stable but still discloses
  what exists behind privacy controls.

## Decision: Stable RPCs Own Public Read Authorization

**Decision**: Use stable RPC contracts for public profile reads and username availability,
while direct table access remains owner-only or otherwise non-leaking through RLS.

**Rationale**: RPCs centralize privacy, blocking, follower-only checks, and payload shaping.
They give the future iOS app one durable contract rather than forcing it to recompose PWA
queries and privacy predicates.

**Alternatives considered**:

- Client-side joins and filtering: rejected because privacy/blocking must be enforced
  server-side.
- Broad public table reads with RLS: possible for basic profile identity, but too easy to
  leak section metadata unless RPCs shape the payload.

## Decision: Supabase/Postgres RLS And Indexing Posture

**Decision**: Add RLS from the first migration, use `(select auth.uid())` in policies, create
indexes for every FK and common lookup/join path, and use partial indexes where lookups are
restricted to public profiles.

**Rationale**: This follows the project constitution and Supabase best-practice guidance:
indexes on WHERE/JOIN columns prevent table scans, and `(select auth.uid())` avoids
per-row auth evaluation in RLS policies.

**Alternatives considered**:

- Ship tables first and RLS later: rejected by constitution.
- Rely only on primary keys: insufficient for username lookup, relationship checks, and
  profile discovery filters.
