# Research: Community Follows And Blocks

## Decision: Extend the existing community graph foundation

**Decision**: Reuse the `follows` and `blocks` tables created by the community profile foundation and add only the missing production behavior: counts, helper predicates, RPC contracts, search support, and management UI.

**Rationale**: The prior profile migration already introduced the core relationship tables with primary keys, no-self checks, reverse indexes, RLS, and basic participant policies. Reusing them avoids duplicate schema and preserves compatibility for existing public-profile privacy checks.

**Alternatives considered**:

- Create new `community_follows` / `community_blocks` tables: rejected because it would duplicate the existing foundation and create migration ambiguity.
- Store social graph in profile rows as arrays: rejected because uniqueness, count maintenance, blocking checks, and pagination would be fragile.

## Decision: Durable follow-count table maintained by writes

**Decision**: Add a `community_follow_counts` table keyed by `user_id` with `followers_count`, `following_count`, and `updated_at`, maintained by follow insert/delete and block-side follow removal.

**Rationale**: The spec explicitly rejects count-on-read patterns at scale. A small count row per profile gives O(1) profile count reads, stable contracts for future iOS, and simple reconciliation if counts ever drift.

**Alternatives considered**:

- Count from `follows` on every profile read: rejected because profile reads are frequent and counts would become expensive as the graph grows.
- Materialized view refreshed on a schedule: rejected because follow/unfollow should update visible state within 1 second.
- Denormalized columns on `community_profiles`: viable, but a separate count table keeps profile identity and relationship counters distinct and avoids broad profile-row writes.

## Decision: Server-side interaction predicates are canonical

**Decision**: Add reusable server-side helper predicates for block checks, profile visibility checks, and "can these users interact/see each other" decisions. RPCs must use these predicates instead of duplicating logic client-side.

**Rationale**: Blocking must apply across search, profile, lists, feeds, circles, and later features. Centralizing the decision prevents drift and satisfies the constitution's server-side privacy requirement.

**Alternatives considered**:

- Client-side filtering after broad reads: rejected because it can leak social/private data.
- Per-feature custom predicates: rejected because future surfaces would become inconsistent.

## Decision: Blocking deletes follows in both directions

**Decision**: Creating a block removes any existing follow relationships in both directions and unblocking does not restore them.

**Rationale**: This is the clarified product behavior. It keeps counts intuitive, avoids hidden retained relationships, and makes future feed/circle eligibility easier to reason about.

**Alternatives considered**:

- Hide retained follows during block: rejected because counts and future graph reads become harder to reason about.
- Delete only the blocker-to-blocked follow: rejected because the blocked-to-blocker relationship would remain socially meaningful after a safety action.

## Decision: Cursor pagination for lists

**Decision**: Followers, following, and blocked-users lists use cursor pagination with `(created_at, user_id)` style cursors.

**Rationale**: Supabase/Postgres guidance recommends cursor pagination over deep `OFFSET` scans. Social lists can grow, and cursor contracts are easy for both PWA and iOS to consume.

**Alternatives considered**:

- Offset pagination: rejected because performance degrades with page depth.
- Return full lists: rejected because it caps growth and increases payload size.

## Decision: Indexed text search for usernames and display names

**Decision**: Add a search index over normalized username/display-name text. Search results are filtered by profile visibility and blocks server-side.

**Rationale**: Reader search is a core flow. Indexed search avoids full scans as profile count grows. The search contract can remain stable while implementation evolves from simple prefix search to richer full-text matching if needed.

**Alternatives considered**:

- Client-side search after loading all profiles: rejected because it leaks hidden profiles and does not scale.
- Unindexed `ILIKE '%query%'`: rejected because wildcard scans degrade quickly.

## Decision: RPC-first contracts for community graph reads/writes

**Decision**: Use stable RPCs for search, follow/unfollow, block/unblock, follower/following lists, blocked-users list, and interaction checks.

**Rationale**: The future iOS app should not reverse-engineer table structure or RLS behavior. RPCs also give one place to return typed relationship state and user-facing result codes.

**Alternatives considered**:

- Direct table reads/writes from clients: rejected because privacy, blocking, and count behavior would become client-coupled.
- Edge functions for every relationship action: rejected because Postgres functions are closer to the data, transactional, and simpler for this use case.
