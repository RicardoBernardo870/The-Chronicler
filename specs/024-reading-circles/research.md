# Research: Reading Circles

## Decision: Use Invitations Before Membership

Owners invite eligible followed readers, and readers become circle members only after accepting.

**Rationale**: Private Reading Circles are social spaces, so accepted membership gives explicit
consent and avoids silently adding a reader to a group. It also cleanly separates pending
invitation visibility from member-only reaction access.

**Alternatives considered**:

- Direct-add followed readers: simpler, but creates surprise membership and weaker consent.
- Mutual-follower direct add: more nuanced, but adds branching behavior without clear v1 value.

## Decision: Gate Spoilers By Normalized Percent-Through-Book

Reactions store the author's source page and total pages, then derive and persist a normalized
location in the range 0-100. Visibility compares reaction normalized location to the viewer's
current normalized location for their own edition.

**Rationale**: The constitution requires edition-aware physical-book support. Raw page numbers
are not comparable across hardcover, paperback, ebook, or translated editions. Percent-through
is not narratively perfect, but it is the best available v1 gate with the existing data model.

**Alternatives considered**:

- Raw page comparison only: rejected because it leaks across editions with different page counts.
- Require same ISBN/edition for all members: safer but blocks common real-world reading-circle use.
- Canonical location map: likely better later, but no current metadata source exists.

## Decision: Security-Definer RPCs For Circle Contracts

Expose stable authenticated RPCs for create, invite, accept/decline, list, detail, visible
reactions, add reaction, leave, and remove member.

**Rationale**: The PWA and future iOS client should call the same backend contract. RPCs let
the database enforce membership, follow eligibility, blocking, max-size, page validity, and
spoiler gates before returning or mutating data.

**Alternatives considered**:

- Client-side joins against RLS tables: rejected because hidden reaction content and member
  state are too sensitive for client-side filtering.
- Edge functions: useful later for orchestration, but database-local RPCs are simpler for
  transactional max-size and visibility checks.

## Decision: RLS On All New Tables With Least-Privilege Execute Grants

All new circle tables enable RLS in the first migration. RPCs use `security definer`, fixed
`search_path`, `(select auth.uid())` or local auth variables, and execute grants only for
`authenticated`.

**Rationale**: Supabase best practices call for RLS from the first migration, avoiding
per-row auth function calls, and minimizing public/anon grants. Reading Circles contain
private social data and page-specific reactions, so server-side enforcement is mandatory.

**Alternatives considered**:

- Temporarily permissive policies: rejected by the project constitution.
- Broad helper grants: avoided where helpers are internal implementation details.

## Decision: Safe Realtime Invalidation By Default

Realtime changes should send only non-sensitive event metadata or invalidation signals, then
the client refetches through `get_visible_circle_reactions`.

**Rationale**: Supabase Realtime table payloads can be difficult to shape per viewer when
visibility depends on each viewer's current progress. Invalidation/refetch preserves the
2-second product goal without risking ahead-of-progress reaction content.

**Alternatives considered**:

- Direct readable reaction payloads over Realtime: allowed only if implementation proves
  payloads are filtered per viewer by the same server-side gate.
- Polling only: safe but less responsive and more wasteful while a circle view is open.

## Decision: Composite And Partial Indexes For Access Paths

Use composite indexes with equality columns first and range/order columns last. Index every
foreign key and common RLS/join column.

**Rationale**: Supabase Postgres guidance highlights FK indexes, composite indexes for
multi-column filters, and RLS predicate indexes. Circle reads will filter by membership,
circle, book/work, invitation status, reaction location, and created time.

**Alternatives considered**:

- Separate single-column indexes only: rejected because Postgres may need slower bitmap
  combinations for common multi-column predicates.
- Over-indexing every column: rejected to avoid write overhead and duplicate indexes.
