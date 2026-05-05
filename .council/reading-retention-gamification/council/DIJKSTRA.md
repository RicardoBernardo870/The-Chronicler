# DIJKSTRA — Systems Thinker

## Overview
Reading Pulse is scoped well: server-confirmed sessions, no new tables, and SWR invalidation keep v1 simple. The plan’s strength is resisting client-side truth while leaving a clean RPC seam for future clients.

## Pros
- Uses `progress_history.session_start_at` as the canonical source, avoiding divergent mobile/web counts.
- Read-only RPC limits blast radius and preserves migration discipline.
- Explicit offline-sync behavior prevents delayed celebration inconsistencies.

## Cons & Risks
- Timezone-local week logic in SQL is subtle and will age poorly without exhaustive fixtures.
- Default goal hardcoding will need a migration path once per-user goals arrive.
- Dashboard cache invalidation may couple progress writes to retention concerns.

## Critical Questions
1. What exact SQL contract defines local week boundaries across DST changes?
2. How will per-user goals be added without replacing this RPC response shape?
3. What telemetry proves the card refreshes correctly after offline sync?

## Verdict
APPROVE WITH RESERVATIONS — The design is appropriately conservative for v1, but timezone semantics and future goal customization need explicit contracts before this becomes sticky product state.

## Position After Debate
Still approve with reservations: define the RPC contract around canonical session identity, local-week semantics, and goal metadata now so future clients and per-user goals migrate cleanly.
