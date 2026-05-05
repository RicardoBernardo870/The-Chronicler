# Council Debate

## Round 1 — Challenges
**TURING** → DIJKSTRA: "leaving a clean RPC seam for future clients" — A seam is not clean if week math, offline replay, and future goals all pile into one read path that wakes someone at 3am.
**LOVELACE** → TURING: "No retroactive celebration needs a crisp implementation rule" — Correct but incomplete, because the bigger product risk is a rigid 3/week frame making slower readers feel they already failed.
**TORVALDS** → LOVELACE: "Weekly sessions beat daily streaks because user feels momentum, not debt" — That claim ignores that exposed habit cadence is sensitive behavioral data unless auth scoping and cache isolation are proven.
**DIJKSTRA** → TORVALDS: "Offline sync could double-count if idempotency is weak" — The warning is right but too narrow, because the system contract must define canonical session identity before security can judge duplicates.
**HAMMURABI** → LOVELACE: "Ship v1 because scope is tight and reversible" — Reversible product scope still creates code debt if celebration suppression and goal framing leak into Dashboard copy branches.

## Round 2 — Responses and Rebuttals
**DIJKSTRA** responds to TURING: The RPC seam is only acceptable if its response shape explicitly reserves goal metadata and its SQL week contract is fixture-tested before any client depends on it.
**TURING** responds to LOVELACE: Fine, soften the 3/week language, but the implementation still needs one boring rule for delayed writes or support will debug vibes instead of state.
**LOVELACE** responds to TORVALDS: Privacy controls are table stakes, but if the card never motivates return behavior then a perfectly isolated cache is still a wasted feature.
**TORVALDS** responds to DIJKSTRA: Canonical session identity is exactly the security boundary, and I want server-side dedupe plus auth.uid-only filtering before trusting any aggregate.
**LOVELACE** responds to HAMMURABI: Keep business rules out of Dashboard copy, but do not slow the v1 learning loop by designing a full retention engine before proving the nudge works.

## Forced Convergence Points
- Ship only a small v1: read-only RPC, existing data, no badges, no social surface, no new persistence table.
- Use server-confirmed `progress_history.session_start_at` as the canonical source for counted sessions.
- Harden timezone/week semantics with explicit SQL contracts and named DST fixtures.
- Centralize cache invalidation and clear SWR state on auth changes/offline replay.
- Keep Dashboard UI secondary to reading action and avoid embedding business rules in copy.

## Irreconcilable Disagreements
- Whether fixed 3/week can ship as a harmless default or must be softened/customizable before validation.
- Whether future per-user goal support must be designed into the RPC shape now or deferred.
- How much retention state-machine structure is needed before the first Dashboard card ships.
