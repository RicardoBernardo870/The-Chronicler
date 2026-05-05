# Council Review

**Date:** 2026-05-05 · **Plan:** .council/reading-retention-gamification/PLAN.md

## Verdict
**PROCEED WITH ADJUSTMENTS**

Small v1 is shippable if timezone semantics, auth scoping, cache invalidation, and celebration rules are made explicit and tested.

## What must change before we ship
*(Blockers — fix these or stop.)*

- [ ] Define and test RPC local-week semantics with named DST/timezone fixtures — flagged by TURING, DIJKSTRA, HAMMURABI
- [ ] Enforce RPC identity via `auth.uid()` only; accept no client user IDs — flagged by TORVALDS
- [ ] Validate browser timezone input against known zones or safely fallback — flagged by TORVALDS, TURING
- [ ] Define canonical session identity/dedupe for offline replay before aggregation — flagged by TORVALDS, DIJKSTRA
- [ ] Centralize retention cache invalidation after online writes, offline replay, sign-out, and user switch — flagged by TURING, TORVALDS, HAMMURABI
- [ ] Document one testable rule for suppressing delayed-write celebrations — flagged by TURING, HAMMURABI

## What we'll watch as we ship
*(Manageable risks — mitigate in parallel, don't block.)*

- Fixed 3/week goal may discourage slower readers -> soften framing and avoid failure language
- Dashboard card may become visual noise -> keep reading CTA primary and verify mobile density
- Retention impact may be unclear -> track return behavior before expanding scope
- Future per-user goals may strain response shape -> reserve goal metadata without building customization
- Dashboard copy may become hidden business logic -> keep rules in typed RPC/composable boundaries

## What we're choosing to defer
*(Accepted debt — revisit when [condition].)*

- Custom goals — revisit when fixed 3/week shows retention signal or user complaints
- Badges, social surfaces, push, and durable achievements — revisit when Reading Pulse proves repeat use
- Full retention engine/state machine — revisit when more than one retention surface exists
- Public profile integration — revisit when privacy model is explicitly scoped

## Open questions for you
*(The council can't answer these — product/business context required.)*

- Which reader segment is Reading Pulse for: lapsed, casual, or already-active?
- What success metric proves this changed return behavior?
- What should users see when 3 sessions this week is impossible?

## How each advisor voted

| Advisor | Verdict | Held in debate? |
|---------|---------|-----------------|
| TURING | APPROVE WITH RESERVATIONS | ✅ |
| LOVELACE | APPROVE WITH RESERVATIONS | ✅ |
| TORVALDS | APPROVE WITH RESERVATIONS | ✅ |
| DIJKSTRA | APPROVE WITH RESERVATIONS | ✅ |
| HAMMURABI | APPROVE WITH RESERVATIONS | ✅ |

→ Full reports in `council/`. Debate transcript in `council/DEBATE.md`.

## Next 3 steps
1. Add RPC contract tests for auth, timezone fallback, local-week DST fixtures, and session dedupe.
2. Implement centralized SWR invalidation for progress writes, offline replay, sign-out, and user switch.
3. Ship softened Dashboard copy with explicit delayed-celebration suppression and return-behavior telemetry.
