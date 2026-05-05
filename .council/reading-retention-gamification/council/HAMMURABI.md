# HAMMURABI — Code Quality Judge

## Overview
The plan is well-scoped and respects existing architecture: confirmed session rows, one read-only RPC, SWR cache, and no new persistence tables. Its success depends on keeping retention rules explicit and testable rather than scattering copy/state decisions across the Dashboard.

## Pros
- Clear slice boundaries with independently verifiable tests.
- Good separation between RPC data, composable cache state, and UI rules.
- Strong constraints around offline sync, privacy, and avoiding durable badge debt.

## Cons & Risks
- Timezone/week logic can become opaque without named fixtures and documented semantics.
- Cache invalidation touches progress and offline sync, increasing coupling.
- Celebration suppression rules may be hard to reason about in six months.

## Critical Questions
1. Where is the canonical retention state machine documented?
2. How will RPC response types stay aligned with Supabase changes?
3. Can invalidation be centralized instead of embedded in store flows?

## Verdict
APPROVE WITH RESERVATIONS — The scope is shippable and maintainable if retention rules remain isolated, typed, and heavily tested. Do not let Dashboard copy become business logic.

## Position After Debate
Still approve with reservations: isolate retention rules behind typed composable/RPC boundaries, document the state machine, and keep Dashboard copy from becoming hidden business logic.
