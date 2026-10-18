# iOS Phase Briefs — Claude Code (Opus 5.5, ultracode)

Last updated: 2026-10-18

> **What this is.** One brief per phase of the native build of **The Chronicler** (internal code name **BookHero**, D-03), plus a cross-cutting Notifications brief. Each brief gives the goal, the gates, the scope, the catalog rules to implement, the backend contract it depends on, testable acceptance criteria, how to verify, and a ready-to-paste **kickoff prompt** for a fresh Claude Code session running **Opus 5.5 in ultracode mode** (D-02). There is no Spec Kit step: no spec/plan/tasks pipeline, no `specs/` directories for iOS, no `.specify` constitution. The iOS repo gets a `CLAUDE.md` instead (§3.3).
>
> **How to use.** Pick the phase. Check its *Prerequisites*. Open a fresh Claude Code session in the repo the brief names. Paste the kickoff prompt. The prompt says what to read, what not to touch and which workflows to run. Long phases run as several sessions, one chunk each (§2.3).
>
> **Sources.** [Business-rules catalog](business-rules/README.md) (stable rule IDs, decisions log D-01 … D-17) · [Backend contract](backend-contract.md) · [Backend consolidation plan](backend-consolidation-plan.md) (BC-01 … BC-15) · [iOS implementation plan](ios-implementation-plan.md) · [iOS design foundation](ios-foundation/README.md) · [Legal & compliance review](legal-compliance-review.md).

## Contents

1. [Ground rules for every phase](#1-ground-rules-for-every-phase)
2. [How to run a phase with ultracode](#2-how-to-run-a-phase-with-ultracode)
3. [Where the docs live](#3-where-the-docs-live)
4. [When to re-read what](#4-when-to-re-read-what)
5. Phase briefs: [0A](#phase-0a--backend-consolidation-shared-backend-repo) · [0B](#phase-0b--design-system--app-shell) · [1](#phase-1--mvp) · [2](#phase-2--ai--memory-parity) · [3](#phase-3--native-polish--app-store-v10) · [4](#phase-4--monetization-undecided) · [5](#phase-5--community-much-later) · [6](#phase-6--platform-expansion) · [Notifications](#cross-cutting--notifications)

---

## 1. Ground rules for every phase

### 1.1 Owner decisions the briefs apply (2026-10-18)

The decisions log in the [catalog README](business-rules/README.md) is authoritative. Where an older document disagrees, the decisions and the catalog win. (The `ios-foundation/` files were rewritten on 2026-10-18 to apply D-02 and D-04.)

| ID | Decision | Consequence for the briefs |
|---|---|---|
| D-01 | Numbered business-rules catalog in `docs/business-rules/`; `docs/wiki/Features.md` is an overview linking into it | Rule IDs are the unit of scope, acceptance and test naming |
| D-02 | No Spec Kit. Claude Code, Opus 5.5, ultracode | Phases start from these briefs. The iOS repo's `CLAUDE.md` is a copy of [`ios-foundation/ios-constitution.md`](ios-foundation/ios-constitution.md), a drop-in that already applies the decisions |
| D-03 | App Store / product name **The Chronicler**; **BookHero** = code name | User-facing strings say "The Chronicler". Repo `bookhero-ios`, targets, schemes and identifiers may say BookHero |
| D-04 | iOS 26+, iPhone first; native Liquid Glass is the only glass | `.glassEffect` / `GlassEffectContainer` and system controls. No pre-iOS-26 branch, no emulated blur. Reduce Transparency and Increase Contrast respected |
| D-05 | PWA stays live; iOS + Android + web on one Supabase backend | Backend changes are client-agnostic and backward compatible, made only in the shared repo. The PWA migrates to new RPCs too |
| D-06 | Core logic moves server-side before the iOS build | Native clients are thin: call the RPC or edge function, render the result |
| D-07 | Reader's IANA time zone for every day/week/month/year boundary | `set_my_time_zone` at launch and on change; `p_timezone` on every stats RPC |
| D-08 | Any forward page change counts for pages, streaks and charts, including offline saves replayed at their original time. Session XP, session-count badges and the Last Session card need a real timed session | Offline queue replays `save_progress` with `occurredAt` + idempotency key |
| D-09 | Deployed edge functions are canonical (`generate-lore` v18 at temperature 0.35; `generate-reading-dna` v8 with Google Search grounding) | Phase 0A syncs repo sources to deployed |
| D-10 | Immediate hard account deletion via a new `delete-account` edge function, confirm + re-auth, on web and iOS | Web in Phase 0A, iOS in Phase 1 |
| D-11 | Sign in with Apple + email/password; password reset on both clients; magic and reset links via universal links; "Link Apple ID" in settings | Phase 1 auth chunk |
| D-12 | Insights fall back to captures or spoiler-guarded metadata; skipped, offline or failed milestones are backfilled | Server-side (BC-08). Clients list and mark seen |
| D-13 | iOS v1 profile = username + display name + avatar only | No bio, privacy settings or public toggle in v1. Follow graph, discovery and circles stay dormant |
| D-14 | Subscriptions / paywall undecided | Phase 4 is gated. Every tier table is a non-binding draft |
| D-15 | iOS OCR: Apple Vision on device first, `ocr-page` fallback on low confidence; the 0.90 / 0.70 thresholds are Gemini-calibrated and must be recalibrated | Phase 2 capture chunk; open decision [CAP-Q07](business-rules/04-capture-resume-quiz.md#open-decisions) |
| D-16 | Read-only live-schema snapshot at [`supabase/reference/live-baseline-2026-10-18.sql`](../supabase/reference/README.md); repo will be private | Security findings may be documented in full |
| D-17 | Scope exclusion recorded in the decisions log | Nothing in these briefs touches it |

### 1.2 Phase map

| Phase | Repo | May start when | Ends with | Release |
|---|---|---|---|---|
| **0A** Backend consolidation | `BookHero` (this repo: Supabase + PWA) | Now | Waves 1–3 landed (gate for Phase 1); Wave 4 landed (gate for external TestFlight); BC-11 before App Store submission | PWA releases per wave |
| **0B** Design system & app shell | `bookhero-ios` | Now, in parallel with 0A | Design-system module + gallery, app shell, `CLAUDE.md`, CI | — |
| **1** MVP | `bookhero-ios` | 0B done; Waves 1–3 landed; BC-11 auth items before the auth chunk; BC-15 before the search and import chunks | Library, sessions (with Focus mode), offline saves, auth and account | Internal TestFlight (external once Wave 4 has landed) |
| **2** AI & memory parity | `bookhero-ios` | Phase 1 on internal TestFlight; BC-05/07/08/09/10 flags on and the PWA migrated | AI consent, recaps, captures, warm-up, Codex, Insights, profile identity, Profile & stats | External TestFlight |
| **3** Native polish & App Store v1.0 | `bookhero-ios` | Phase 2 done; Wave 4 landed; legal pages live | Live Activity, widgets, intents, notifications, accessibility, privacy, submission | App Store v1.0 |
| **4** Monetization [undecided] | both | D-14 decided | StoreKit 2 + server entitlements | v1.x |
| **5** Community [much later] | both | Community backend hardening landed; product go-ahead | Profiles, discovery, follows, circles, moderation | v2.0 |
| **6** Platform expansion | `bookhero-ios`, Android repo | v1.0 stable | Per sub-track | v2.x |
| **Notifications** (cross-cutting) | both | Local: Phase 3. Push: after a new backend package | Reminders, Word-of-the-Day actions, push | With Phase 3 / later |

The consolidation plan says "the iOS build starts when Waves 1–3 are done" ([§2.1](backend-consolidation-plan.md#21-waves)). Phase 0B makes no backend call and contains no business logic, so it runs in parallel with 0A. Phase 1 is the first phase that calls the backend, and it waits for the gate.

### 1.3 Backend gates per phase

R = must be landed (and the PWA migrated, where the package changes it) before the phase starts · C = must be landed before the named chunk · G = part of the Waves 1–3 gate although the phase does not call it · — = not needed.

| BC | Package | Ph 1 | Ph 2 | Ph 3 | Ph 4 | Note |
|---|---|---|---|---|---|---|
| [BC-01](backend-consolidation-plan.md#bc-01--security-hardening) | Security hardening | R | R | R | R | No native build may run against the IDOR RPCs |
| [BC-02](backend-consolidation-plan.md#bc-02--edge-function-auth) | Edge-function auth | R | R | R | R | Also required before Sign in with Apple (base64url defect) |
| [BC-03](backend-consolidation-plan.md#bc-03--source-of-truth--drift) | Source of truth & drift | R | R | R | R | — |
| [BC-04](backend-consolidation-plan.md#bc-04--atomic-progress--session-rpcs) | Atomic progress & session RPCs | R | R | R | R | iOS writes progress only through these RPCs |
| [BC-05](backend-consolidation-plan.md#bc-05--server-owned-completion--lifecycle-effects) | Completion & lifecycle effects | R | R | R | R | Passport rows, DNA jobs, purge |
| [BC-06](backend-consolidation-plan.md#bc-06--timezone-standardisation) | Timezone standardisation | R | R | R | R | — |
| [BC-07](backend-consolidation-plan.md#bc-07--recap-eligibility--persistence-server-side) | Recap eligibility & persistence | G | R | R | R | — |
| [BC-08](backend-consolidation-plan.md#bc-08--insights-orchestration-server-side--fallback) | Insights orchestration | G | R | R | R | — |
| [BC-09](backend-consolidation-plan.md#bc-09--achievements-server-side) | Achievements | G | R | R | R | — |
| [BC-10](backend-consolidation-plan.md#bc-10--review-leitner-rpc) | Review (Leitner) RPC | G | R | R | R | "Recommended"; the catalog recommends it before iOS v1 ([LEX-Q27](business-rules/05-codex-lexicon.md#open-decisions)) |
| [BC-11](backend-consolidation-plan.md#bc-11--account-lifecycle--auth) | Account lifecycle & auth | C (items 1–6) | R (items 8, 9 added) | R (all items) | R | Blocks App Store submission |
| [BC-12](backend-consolidation-plan.md#bc-12--entitlements--ai-usage-foundation) | Entitlements & AI usage | — | R (guard, allow-all) | R | R (+ ingestion) | — |
| [BC-13](backend-consolidation-plan.md#bc-13--storage-hygiene--ai-job-robustness) | Storage hygiene & AI jobs | C (book delete) | R | R | R | Image cleanup on book delete; image-job robustness |
| [BC-14](backend-consolidation-plan.md#bc-14--sync--realtime-readiness) | Sync & realtime | C (library fields) | Optional (Realtime) | R (decision; `device_tokens` if push) | — | Adds `sessionPausedAt` and `completedAt` to `get_library_with_progress` |
| [BC-15](backend-consolidation-plan.md#bc-15--book-data-hygiene) | Book data hygiene | C (search, import) | R | R | R | [CL-Q01](business-rules/12-client-logic-register.md#open-decisions): no Google key in the binary |

### 1.4 Conventions used in the briefs

- **Rule IDs.** `<PREFIX>-NN` = rule, `<PREFIX>-Dnn` = known defect, `<PREFIX>-Qnn` = open decision, all from the [catalog](business-rules/README.md). `CL-NN` = a row of the [client-logic register](business-rules/12-client-logic-register.md). A range such as `LIB-66…LIB-86` means every rule of that section; IDs inside a section are not always contiguous, so always read the section.
- **Phase 0.** The catalog and the consolidation plan call the backend work "Phase 0"; in these briefs and the implementation plan it is **Phase 0A** (Phase 0B is the iOS design system and shell).
- **Target vs today.** A catalog rule can carry a *Target* line: the behaviour after Phase 0. Native clients implement the Target, never the PWA's current behaviour, unless a brief says otherwise.
- **Acceptance rows.** `01-1` … `15-5` refer to the acceptance tables of the consolidation plan. Phase criteria here are numbered `P0A-01`, `P1-01`, … and cite rule IDs. They refine the [implementation plan's](ios-implementation-plan.md#7-phased-roadmap) acceptance criteria (numbered `0B-1`, `1-1`, `2-1`, …); a phase is done only when both lists are met and the plan's exit gate is passed.
- **Paths.** iOS prompts use the read-only docs submodule at `bookhero/` (§3.2). With a sibling checkout, replace `bookhero/` with `../BookHero/`.
- **Truth hierarchy.** Live database and deployed edge functions > repo code > docs. When they disagree, the session reports it; it never silently picks one.

**Test naming (a rule counts as covered when at least one test whose name starts with its ID passes):**

| Stack | Where | Pattern | Example |
|---|---|---|---|
| Postgres (pgTAP, `supabase test db`) | `supabase/tests/database/` | assertion text starts with rule ID(s), then the BC row | `'SES-30 · 04-1 · save_progress writes progress, history and session end in one transaction'` |
| Edge functions (Deno) | next to the function | `Deno.test("<RULE-ID> · …")` | `Deno.test("REC-21 · rejects an unsigned token")` |
| PWA (Vitest) | `tests/unit/` | `describe("<RULE-ID> · …")` | `describe("SES-24 · page validation")` |
| iOS unit (Swift Testing) | `Tests/` | `@Test("<RULE-ID> · …")` | `@Test("SES-59 · hero prefers Up Next order, then recency")` |
| iOS UI (XCUITest) | `UITests/` | `test_<PREFIX>_<NN>_<behaviour>` | `test_SES_14_warmUpRunsBeforeStart` |
| Shared golden fixtures (recommended, [CL-Q03](business-rules/12-client-logic-register.md#open-decisions)) | BookHero repo, `tests/fixtures/rules/` | file named by rule ID | `SES-59.json`, run by the PWA, iOS and Android suites |

Each repo keeps a **generated** coverage table (rule ID → tests). In `bookhero-ios` it is `docs/rule-coverage.md`, produced by a script that scans test names; it is never edited by hand.

---

## 2. How to run a phase with ultracode

### 2.1 Session setup

1. **One fresh session per phase or chunk.** The working directory is the repo the brief names: Phase 0A runs in this repo; Phases 0B–6 run in `bookhero-ios` (Phase 6's Android track in the Android repo).
2. **Model and mode.** Opus 5.5; the kickoff prompt starts with the word `ultracode`. The prompt spells out the workflows itself, so it works however the mode schedules them.
3. **Fresh docs.** In `bookhero-ios`, bump the docs submodule before the session (§3.2) so it reads the current catalog. In this repo, pull `master`.
4. **Check the gate.** Read the BC Status lines ([plan §2.4](backend-consolidation-plan.md#24-summary)) and the decisions log against the brief's *Prerequisites*. If a gate is not met, run the phase's design-only part or stop.
5. **Tools.** iOS: Xcode 26 with an iOS 26 simulator and at least one physical iPhone on iOS 26. Phase 0A: Supabase CLI linked to the project, a Supabase branch (or staging project) for rehearsals, read-only SQL for verification.

### 2.2 Workflow shapes

Every kickoff prompt asks for the same five workflows, in order.

| # | Workflow | Run as | Output | Exit gate |
|---|---|---|---|---|
| 1 | **Understand** | Parallel read-only readers: one per catalog file in scope, one for the contract, one for the reference implementation (live database for 0A, the PWA source for iOS) | **Scope ledger**: every in-scope rule ID → target home (server or client), contract call, defects to avoid (`-Dnn`), open decisions (`-Qnn`, `OP-xx.n`) | Every in-scope rule is classified; blocking decisions are raised to the owner |
| 2 | **Design** | One designer plus one critic | **Design note**: modules, data flow, API call map with error codes → copy, persistence and cache keys, chunk plan, test plan (every rule ID → ≥ 1 test) | The owner has approved any deviation or decision |
| 3 | **Implement** | Chunk by chunk, tests first | Code, tests named after rule IDs, snapshots, updated coverage table | Build, all tests, snapshots and lint pass |
| 4 | **Adversarial review** | Independent reviewers, each with one lens: rule conformance; thin client and D-xx; security and privacy; compatibility (the PWA for 0A, web + iPhone on one account for iOS); accessibility and HIG (iOS) or data integrity (0A) | Findings, each with a file, a rule ID and a concrete failure scenario; each finding verified before it is fixed | No confirmed finding remains |
| 5 | **Sync** | One session | Catalog, contract and plan updates (0A: in the same PR; iOS: a drafted change for the BookHero repo), coverage table, phase status | Docs describe what shipped |

Recommended shape by kind of work:

| Kind | Shape |
|---|---|
| Backend package (0A, the Phase 5 hardening) | Understand (verify against live, read-only) → Design (expand / migrate / contract, rollback) → Implement on a branch → Review (security, PWA compatibility, advisors) → Sync |
| Client feature (Phases 0B–3, 6) | Understand → Design → Implement in vertical slices → Review → Sync |
| Decision-gated (Phases 4, 5) | Understand → decision memo for the owner. Implement only once the decision is recorded |

### 2.3 Splitting a phase into chunks

- A **chunk** is a vertical slice that can ship on its own: one area, its rule IDs, its acceptance rows and its tests, small enough for one reviewable PR.
- Order chunks by dependency: foundations (store, networking, auth) → read paths → writes → offline → polish.
- Each rule ID belongs to exactly one chunk; other chunks may depend on it.
- Every chunk ends with the adversarial review. The next chunk does not start while confirmed findings are open.
- Each brief suggests a chunk list; the design note fixes it.

**Chunk kickoff template** (for every session after the first one of a phase; replace the angle-bracket parts):

```text
ultracode

Continue <PHASE> of The Chronicler, chunk <CHUNK-ID> "<chunk title>", as planned in docs/phases/<phase>/design.md (Phase 0A: the package's design note in the PR description).
Re-read: CLAUDE.md; the chunk's section of the design note and of the scope ledger; the catalog sections for its rule IDs (<RULE-IDS>), including Known defects, Open decisions and Notes for native clients; the backend-contract sections it calls.
Do: write the tests first (named after the rule IDs), implement, run every gate, then run the adversarial review on this chunk (rule conformance, thin client and D-xx, security and privacy, offline and multi-device, accessibility) until no confirmed finding remains.
Do not: start another chunk, change files outside the chunk, or edit the bookhero/ docs submodule.
Finish with: the regenerated rule-coverage table, the chunk's acceptance rows marked met or unmet, and any question for me.
```

### 2.4 Keeping the catalog in sync when behaviour changes

1. **Catalog first.** If a phase needs behaviour the catalog does not state, or states differently, stop. Change the catalog in the BookHero repo (rule text, *Target* line, defect, or decision), then implement. The iOS repo never holds a private variant of a rule.
2. **Same PR (shared repo).** A backend or PWA change updates, in the same PR: the affected rules (today / target), the [client-logic register](business-rules/12-client-logic-register.md) target home, [backend-contract.md](backend-contract.md) (move the §16 row into the live sections), the BC Status line, and a new dated live snapshot in `supabase/reference/`.
3. **Stable IDs.** Never renumber or reuse an ID. A new rule takes the next free number of its domain file. A retired rule stays, marked "Retired YYYY-MM-DD — reason, replaced by …".
4. **Defects.** When a `-Dnn` is fixed, mark it fixed with the BC or phase and the date; do not delete it.
5. **Decisions.** When the owner decides a `-Qnn` or an `OP-xx.n`, record it in the README decisions log as the next `D-NN` and update every rule it touches.
6. **Tests follow rules.** A behaviour change that leaves tests named after the old behaviour is a review finding.
7. **From the iOS repo.** Draft the change (rule IDs in the title, proposed text, evidence), open it against the BookHero repo, wait for it to merge, then bump the submodule.
8. **Golden fixtures** change only together with their rule.

### 2.5 Stop and ask (every session)

- Applying a migration to production, deploying an edge function, flipping an F-1 flag, running a contract step (revoking privileges), changing Auth settings, rotating keys.
- Any change to numbers existing users see ([plan §7, R-1](backend-consolidation-plan.md#7-risks)).
- An open decision the brief marks as blocking.
- A backend change discovered from the iOS repo.
- Adding a third-party dependency.
- External TestFlight distribution, App Store Connect changes, submission.
- Deleting data other than test fixtures.

---

## 3. Where the docs live

### 3.1 Canonical docs (all in this repo)

| Document | Role |
|---|---|
| [`docs/business-rules/`](business-rules/README.md) | The catalog: README (index, legend, glossary, decisions log) + 01-library (LIB) · 02-reading-sessions (SES) · 03-recaps (REC) · 04-capture-resume-quiz (CAP) · 05-codex-lexicon (LEX) · 06-insights (INS) · 07-profile-stats-goals (PRO) · 08-platform-auth-account (PLT) · 09-database-invariants (BE) · 10-community-circles (COM) · 11-cross-domain (XD) · 12-client-logic-register (CL) |
| [`docs/backend-contract.md`](backend-contract.md) | What the live backend does (§1–§15) and planned changes (§16) |
| [`docs/backend-consolidation-plan.md`](backend-consolidation-plan.md) | Phase 0 work packages BC-01 … BC-15, waves, acceptance rows, PWA changes |
| [`docs/ios-implementation-plan.md`](ios-implementation-plan.md) | Roadmap: what and why per phase |
| `docs/ios-phase-prompts.md` (this file) | How to start each phase |
| [`docs/ios-foundation/`](ios-foundation/README.md) | Design tokens, component and screen inventories, design brief, constitution (source of the iOS `CLAUDE.md`) |
| [`docs/legal-compliance-review.md`](legal-compliance-review.md) | Privacy and copyright invariants; App Store compliance |
| [`supabase/reference/`](../supabase/reference/README.md) | Read-only live-schema snapshot (not a migration) |
| [`docs/wiki/Features.md`](wiki/Features.md) | Product overview that links into the catalog |
| [`docs/ios-native-migration-details.md`](ios-native-migration-details.md), [`docs/community-design-notes.md`](community-design-notes.md) | Background only; the catalog and the contract win on any conflict |

### 3.2 How the iOS repo reaches them — recommendation: a git submodule

**Recommended:** add this repo to `bookhero-ios` as a **read-only git submodule at `bookhero/`**.

Why the submodule over a sibling checkout:

- **Visible to every session.** Cloud sessions, worktrees and CI only see the repo's own working directory. A sibling folder (`../BookHero`) is outside it: invisible remotely and subject to extra permission prompts locally.
- **Pinned.** Each iOS commit records which catalog version it implements. When a rule changes, `git diff` between two submodule pointers shows exactly what moved.
- **Stable paths.** Prompts and `CLAUDE.md` can use one path (`bookhero/docs/...`) everywhere.
- **Cost.** The pointer has to be bumped deliberately, which is also the moment to re-read what changed (§4).

A sibling checkout is acceptable for purely local work; replace `bookhero/` with `../BookHero/` in the prompts.

```bash
# once, in bookhero-ios
git submodule add -b master <BookHero repository URL> bookhero
git commit -m "Add BookHero docs submodule (read-only)"

# before each phase or chunk
git submodule update --remote bookhero
git -C bookhero log --oneline -5
git add bookhero && git commit -m "Bump BookHero docs to <short sha>"

# in every new worktree or clone
git submodule update --init
```

Rules: never edit files inside `bookhero/` (changes go through a PR in the BookHero repo, §2.4). The app target never references files inside `bookhero/`; nothing shipped is compiled from it. Test targets may read the shared golden fixtures from `bookhero/tests/fixtures/rules/` as test resources. CI needs the submodule only for those tests; give CI read-only access (the repo is private, D-16).

### 3.3 The iOS repo's `CLAUDE.md`

Phase 0B creates it from [`ios-foundation/ios-constitution.md`](ios-foundation/ios-constitution.md). That file is already a drop-in `CLAUDE.md` with the owner decisions applied (D-02 no Spec Kit, D-04 iOS 26 and native glass only, D-06 thin client, D-15 Vision OCR). Use one of two forms ([ios-foundation/README.md](ios-foundation/README.md), step 2):

- **Copy** the constitution to `bookhero-ios/CLAUDE.md` and fill in its *Docs root* (`bookhero/docs`) and *Commands* placeholders. Re-copy it when the canonical file changes.
- **Short file with an import**, possible because the submodule makes the canonical text reachable: keep only the repo-specific sections and import the constitution with Claude Code's `@path` syntax. Do not `@`-import the large catalog files; point to them by path.

```markdown
# The Chronicler — iOS (code name BookHero)

@bookhero/docs/ios-foundation/ios-constitution.md

## Repo-specific
- Docs root: bookhero/docs (read-only submodule; never edit it).
- Phase brief: bookhero/docs/ios-phase-prompts.md · roadmap: bookhero/docs/ios-implementation-plan.md.
- Rule coverage: docs/rule-coverage.md is generated by scripts/rule-coverage; never edit it by hand.

## Commands
xcodebuild -scheme <AppScheme> -destination 'platform=iOS Simulator,name=<iPhone simulator>' test
swiftlint --strict
```

---

## 4. When to re-read what

| Moment | Re-read | Why |
|---|---|---|
| Start of every phase | `CLAUDE.md`; this file (§1–§4 + the phase brief); the phase section of the implementation plan; the decisions log | Scope, gates, decisions taken since the last phase |
| After bumping the submodule | `git -C bookhero diff <old>..<new> -- docs/business-rules docs/backend-contract.md docs/backend-consolidation-plan.md` | Rules and contracts that changed under you |
| Before working in a domain | That domain file in full: Rules, Flows, Known defects, Open decisions, Notes for native clients; its rows in the client-logic register | The rule text, and which PWA behaviour not to copy |
| Before calling or changing an RPC or edge function | Contract §8 / §10 and §15; the BC section that owns it | Signatures, error codes, auth, retries |
| Before writing to a table | Contract §3, §5 and §15.3; the register's list of client-owned tables | Ownership and conflict targets |
| Before building UI | Design brief, tokens, component and screen inventories; the DS gallery | Composition and every state (empty, loading, error, offline) |
| When the PWA and the catalog disagree | Catalog → live database (read-only) → ask the owner | Truth hierarchy (§1.4) |
| Before anything that changes stats users see | Plan §7 (R-1); PRO and BE stat rules | Retroactive number changes |
| After a backend package lands | Its Status line, contract §16, the rules it changed | Switch from interim to target behaviour |
| When an open decision blocks you | The decisions log, then the domain's Open decisions table | It may already be decided |
| Before external TestFlight or submission | Legal review; PLT-79 … PLT-81; the Phase 3 compliance list | App Review |

---

## 5. Phase briefs

---

### Phase 0A — Backend consolidation (shared backend repo)

**Goal.** Land BC-01 … BC-15 on the one shared Supabase backend so that native clients can stay thin: no cross-user reads, no forgeable AI endpoints, repo == live, one atomic, server-clocked write path for progress and sessions, one server owner for completion effects, reader-time-zone boundaries, server-enforced recap eligibility, server-side Insights, achievements and review maths, and the platform pieces the App Store and a second client need. The PWA keeps working throughout and migrates to the new paths (D-05).

**Repo.** This repo (Supabase project `zlndhygpqacygceivuvk` + the live Vue PWA). Not the iOS repo.

**Prerequisites.**

- Decisions D-01 … D-17 recorded; live snapshot committed (D-16, done 2026-10-18).
- Supabase CLI linked; a Supabase branch or staging project for rehearsals; read-only SQL for verification.
- BC-05: `pg_net` and `pg_cron` enabled (neither is installed today); Vault secret `job_runner_secret`.
- BC-11: Apple Developer team with Sign in with Apple (Services ID, Key ID, private key — entered only in Supabase Auth settings / Vault); the canonical web domain that serves `apple-app-site-association` ([OP-11.7](backend-consolidation-plan.md#bc-11--account-lifecycle--auth), [PLT-Q05](business-rules/08-platform-auth-account.md#open-decisions)); an SMTP provider.
- BC-15: a server-side Google Books key under the secret name `GOOGLE_BOOKS_API_KEY`; the old client key rotated and restricted.
- Earlier phases: none.

**Waves** ([plan §2](backend-consolidation-plan.md#2-sequencing)): Wave 1 BC-03 (baseline first) → BC-01, BC-02 · Wave 2 BC-04 → BC-06 → BC-05 · Wave 3 BC-07, BC-08, BC-09, BC-10 · Wave 4 BC-11 (may start right after BC-02), BC-12, BC-13, BC-14, BC-15.

**Suggested chunks.**

| Chunk | Content |
|---|---|
| 0A-1 | BC-03: baseline migration, migration repair, edge sources synced to deployed (D-09), `deno.json` pins |
| 0A-2 | BC-01: one `bc01_security_hardening` migration |
| 0A-3 | BC-02: in-function verification first, then `verify_jwt = true` + `supabase/config.toml` |
| 0A-4 / 0A-5 | BC-04 expand (schema + RPCs) / migrate the PWA (progress store, per-user offline queue with `occurredAt` + idempotency key) |
| 0A-6 | BC-06 together with BC-04 section C (counting contract) and release notes (R-1) |
| 0A-7 | BC-05: job queue J-1, lifecycle triggers L-1, passports, DNA; flags off → PWA release → flags on |
| 0A-8 … 0A-11 | BC-07, BC-08, BC-09, BC-10, each with its PWA migration |
| 0A-12 … 0A-16 | BC-11 … BC-15 |
| Contract steps | Per package, only after 14 days of zero `legacy_client` writes |

**In scope.** Every *Scope* item of BC-01 … BC-15; the PWA changes in [plan §4](backend-consolidation-plan.md#4-pwa-changes-required) (the required ones before the matching flag flip or contract step); tests; doc sync (§2.4).

**Out of scope.** [Plan §6](backend-consolidation-plan.md#6-out-of-scope-for-phase-0): community and circles defects, the dormant weekly goal, sending push notifications, subscription tiers and prices (D-14), the offline capture queue, `get_session_warmup`, server-side vocabulary extraction. Any iOS code. Anything the decisions log scopes out.

**Rules to implement.** The *Why* table of each package is the complete list; key IDs:

| BC | Catalog files | Key rule IDs | Defects closed (examples) |
|---|---|---|---|
| BC-01 | 09, 08, 02, 07, 01, 04, 06, 10 | BE-01, BE-02, BE-05, BE-06, BE-07, PLT-76, PLT-77, SES-84, SES-85, PRO-17, PRO-25, PRO-31, LIB-116, CAP-41, CAP-89, INS-32, COM-14 | BE-D01 … BE-D07, BE-D14, LIB-D01, SES-D01, PRO-D01 … PRO-D05 |
| BC-02 | 03, 04, 06, 08, 09 | REC-20, REC-21, REC-72, INS-22, INS-23, CAP-81, CAP-84, PLT-39, PLT-61, PLT-78, BE-75, BE-78, BE-80 | BE-D08 … BE-D11, PLT-D04, REC-D01 … REC-D03, CAP-D01, INS-D01 |
| BC-03 | 06, 07, 03, 09 | INS-26, INS-27, PRO-61, PRO-62, REC-26, BE-79, BE-84 | BE-D40, BE-D41, INS-D12 … INS-D14, PRO-D37 |
| BC-04 | 02, 08, 07, 03, 01, 09 | SES-01 … SES-36, SES-75 … SES-78, SES-87, SES-89, SES-93, SES-94, PLT-43 … PLT-49, PRO-04, PRO-09, PRO-10, PRO-21, PRO-22, PRO-91, PRO-99, PRO-100, REC-05b, REC-05c, LIB-13 … LIB-17, LIB-90 … LIB-92, BE-13 … BE-16 | SES-D04 … SES-D09, BE-D15 … BE-D20, BE-D25, BE-D26 |
| BC-05 | 02, 11, 04, 07, 06, 09 | SES-39 … SES-52, XD-13 … XD-24, BE-19 … BE-23, BE-87, CAP-41 … CAP-47, PRO-52 … PRO-60, INS-06 | SES-D10 … SES-D14, BE-D21, BE-D22, REC-D22, LIB-D15, LIB-D16 |
| BC-06 | 08, 07, 05, 09, 02 | PLT-62 … PLT-66, PLT-83, BE-41, BE-42, PRO-09, PRO-24, PRO-32 … PRO-35, LEX-45, LEX-98, SES-90 | BE-D27, PLT-D30, PRO-D32, LEX-D13 |
| BC-07 | 03 | REC-02 … REC-19, REC-22 … REC-31, REC-36 … REC-42 | REC-D04 … REC-D11, REC-D13, REC-D15, REC-D17, REC-D18, REC-D24, REC-D30 |
| BC-08 | 06, 03 | INS-01 … INS-21, INS-37 … INS-41, INS-50, INS-51, INS-58, INS-59, REC-58, REC-59 | INS-D02 … INS-D11, INS-D25 |
| BC-09 | 07 | PRO-04, PRO-47 … PRO-51 | PRO-D08, PRO-D09, PRO-D24 |
| BC-10 | 05 | LEX-24 … LEX-47, LEX-63, LEX-67, LEX-68 | LEX-D07, LEX-D09, LEX-D10, LEX-D13, LEX-D14, LEX-D16, LEX-D17, LEX-D41, LEX-D42, LEX-D49 |
| BC-11 | 08, 11, 10, 07, 09 | PLT-01 … PLT-08, PLT-71 … PLT-75, PLT-79, PLT-81, PLT-82, XD-54 … XD-57, COM-14, BE-52, BE-73 | BE-D13, BE-D38, PLT-D09, PLT-D17, PLT-D18, PLT-D47 |
| BC-12 | 08, 04, 03 | PLT-85, CAP-88, REC-11 | BE-D12, REC-D04, INS-D15, PRO-D06 |
| BC-13 | 09, 03, 07, 05, 04 | BE-69 … BE-71, BE-78, BE-80, REC-42, REC-45, REC-48, REC-63, PRO-86, LEX-91 | BE-D36, BE-D37, BE-D44, REC-D15, REC-D23, PRO-D13, LEX-D24 |
| BC-14 | 08, 02, 09, 03 | PLT-84, SES-20, BE-17, REC-48 | BE-D39, REC-D16 |
| BC-15 | 01, 09 | LIB-04, LIB-05, LIB-117, LIB-24, LIB-27 … LIB-43, LIB-66 … LIB-86, BE-09, BE-12 | LIB-D02, LIB-D17 … LIB-D19, LIB-D26, LIB-D28, LIB-D30, BE-D32 |

Every rule touched moves from "client-only" to "server-enforced" in the register in the same PR (P5).

**Backend contract dependencies.** Reads and updates [contract §1](backend-contract.md#1-connection-auth--runtime-limits), [§3](backend-contract.md#3-tables), [§4](backend-contract.md#4-cascades--lifecycle-effects), [§5](backend-contract.md#5-row-level-security), [§8](backend-contract.md#8-rpc-catalogue), [§9](backend-contract.md#9-triggers--internal-functions), [§10](backend-contract.md#10-edge-functions), [§12](backend-contract.md#12-security-status), [§13](backend-contract.md#13-drift-migrations--deployed-sources), [§14](backend-contract.md#14-advisors--performance), [§16](backend-contract.md#16-planned-changes).

| Kind | Names |
|---|---|
| New RPCs | `start_session`, `pause_session`, `resume_session`, `cancel_session`, `save_progress`, `set_session_note`, `mark_dnf`, `resume_dnf`, `set_initial_status` (BC-04) · `get_my_jobs`, `request_dna_refresh` (BC-05) · `set_my_time_zone` (BC-06) · `get_recap_eligibility`, `get_recap_request` (BC-07) · `mark_insights_seen` (BC-08) · `sync_achievements` (BC-09) · `review_lexicon_entry`, `undo_lexicon_review`, `get_todays_review`, `request_more_reviews`, `record_anki_session` (BC-10) · `record_ai_consent` (BC-11) · `get_my_entitlements` (BC-12) · `get_library_changes`, `register_device_token` (BC-14) · `import_library`, `find_library_duplicates` (BC-15) |
| Changed RPCs | `get_library_with_progress`, `get_library_breakdown`, `get_last_session`, `get_reading_velocity` (owner checks; velocity gains `p_timezone`; library gains `sessionPausedAt`, `completedAt`) · `get_reading_quest_summary` (NULL-safe guard, `p_timezone`, `completed_at`) · `get_reading_stats` (`p_timezone`, counting contract) · `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, `get_book_passport_stats` (default zone → stored zone) · `upsert_my_community_profile` (partial updates, display name ≤ 60, avatar URL check) |
| Edge functions | New: `process-jobs`, `delete-account`, `store-apple-token`, `app-store-notifications` or `revenuecat-webhook`, `book-search`, optional `export-my-data`. Changed: all seven use `_shared/auth.ts` `requireUser`; `generate-recap` adds `apiVersion: 2` (NDJSON); `generate-lore` v2 is called server-to-server |
| Tables / columns | `background_jobs`, `backend_flags`, `progress_write_requests`, `recap_requests`, `achievement_definitions`, `lexicon_review_events`, `review_allotments`, `entitlements`, `ai_usage`, `ai_usage_policies`, `device_tokens`, `deleted_records`, `book_metadata_cache`, `private.storage_cleanup_queue`, Apple refresh-token storage (OP-11.4) · `reading_progress.completed_at`, `progress_history.kind` / `client_occurred_at` / `write_source`, `user_settings.time_zone` / `ai_consent_at` / `ai_consent_version`, `book_passports.stats_frozen_at` / `summary_status`, `lore_cards.context_source`, `books.updated_at` |
| Dropped or locked | `after_page_capture_saved`, `prune_page_captures_for_book`, policy `follows_follower_insert`, the direct INSERT/UPDATE policies on `community_profiles`; `circle_*` / `community_*` helpers moved to schema `private` |

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P0A-01 | Every acceptance row `01-1` … `15-5` of the plan passes and is proven by tests named after its rule IDs and row number | all cited |
| P0A-02 | Wave 1 exit: security advisor clean for the allowlist; `supabase db diff --linked` empty; `supabase/config.toml` committed; all seven edge functions reject unsigned, foreign-key, expired and anon-key tokens | BE-06, BE-07, PLT-61, PLT-78 (01-3, 02-1, 02-5) |
| P0A-03 | Wave 2 exit: the PWA writes progress only through the BC-04 RPCs; the six completion paths plus an RPC save produce identical server effects | SES-30, XD-14 (04-11, 05-1) |
| P0A-04 | Wave 3 exit: no AI call is possible outside the server eligibility rules; Insights and achievements are written only by the server | REC-11, INS-32, PRO-50 (07-1, 08-6, 09-4) |
| P0A-05 | Wave 4 exit: account deletion works on the web with re-auth; every AI call is ledgered; no orphaned Storage object; a repeated import is a no-op | PLT-72 … PLT-74, PLT-85, BE-71, LIB-75 (11-1, 11-2, 12-1, 13-1, 15-3) |
| P0A-06 | The PWA is never broken: `npm test` and `npm run build` pass on every PR, and a staging smoke test of every route passes before each production apply; tabs on the previous build keep working during overlaps | D-05, R-2 |
| P0A-07 | Docs in sync: every touched rule shows its new today/target state; register target homes, contract (§16 row moved), BC Status line and a new dated snapshot are in the same PR | D-01, P5, P7 |
| P0A-08 | Contract steps run only after 14 days of zero `legacy_client` rows for the table | P2, R-11 |
| P0A-09 | Numbers users see change only with release notes, and the owner has chosen recalculation or an XP freeze before BC-04 section C and BC-06 ship | R-1, PRO-04, PRO-24 |

**Verification.**

- **Automated.** pgTAP on a reset local stack (`supabase test db`); Deno tests for every edge function; Vitest for PWA changes; security and performance advisors; `supabase db diff --linked`.
- **Read-only checks** named in the acceptance rows: anon-executable function count = 0, `legacy_client` counters, orphaned Storage objects, `pending` image rows, cross-user child rows.
- **Staging smoke (PWA):** sign in/out, Dashboard, Library (list, grid, search, reorder), DNF list, Add Book (scan, manual, search, import), Book Detail (session start / pause / resume / cancel / end, pencil edit, completion), recap, capture, Memory Check, Codex and review, Insights, Passport, Profile, Trophy Room, Reading Stats, Profile edit.
- **Manual probes:** forged and expired tokens against each edge function on staging; Sign in with Apple, password reset and delete-account on the web; a cross-user RPC call returns 403.

**Kickoff prompt.**

```text
ultracode

Phase 0A — Backend consolidation for The Chronicler (code name BookHero). You are in the SHARED BACKEND repo: the Supabase project plus the live Vue PWA. Goal: land work packages BC-01…BC-15 so native clients can stay thin, without ever breaking the PWA.

Read first, in this order:
1. CLAUDE.md (repo conventions; its "Active Technologies" list is generated history, and it mentions `npm run lint`, which does not exist — the gates are `npm test` and `npm run build`).
2. docs/backend-consolidation-plan.md, all of it: principles P1–P8, conventions §1.3, waves §2, every BC section, PWA changes §4, what stays client-side §5, out of scope §6, risks §7.
3. docs/business-rules/README.md (legend, glossary, decisions log D-01…D-17), then, per package, every catalog file its "Why" table cites (01-library … 12-client-logic-register), including Known defects and Open decisions.
4. docs/backend-contract.md §1, §3–§5, §8–§10, §12–§16.
5. supabase/reference/README.md and live-baseline-2026-10-18.sql (read-only snapshot, not a migration).
6. docs/ios-phase-prompts.md §1–§4 and "Phase 0A".

Session scope: work wave by wave. Start with the first package whose Status line in backend-consolidation-plan.md §2.4 is not "landed", finish that package (one expand / migrate / contract step per chunk), then stop and report.

Constraints:
- D-05: every change is client-agnostic and backward compatible — expand → migrate → contract. Keep existing RPC signatures for the PWA (p_user_id stays but must equal auth.uid()); new edge behaviour sits behind apiVersion 2. The PWA (src/) migrates in the same wave per plan §4. Contract steps only after 14 days of zero legacy_client writes.
- Apply D-06…D-15 exactly as recorded in the decisions log. D-14: tier tables stay non-binding and ai_usage_policies stays empty (allow-all).
- Least privilege (P6): SECURITY DEFINER, pinned search_path, identity from (select auth.uid()); revoke from public and anon; explicit grant to authenticated; helpers in schema private.
- Migration discipline (P7): every change is a new timestamped migration in supabase/migrations; no dashboard SQL; rehearse on a Supabase branch; `supabase db diff --linked` must be empty before any deploy; write a new dated live snapshot after each schema change.
- Edge functions: deployed sources are canonical (D-09); pin npm:@google/genai; use the shared requireUser and guardAiCall modules; no internal error text in responses; secrets are referenced by env var NAME only, never printed or committed.
- TypeScript, Deno and PWA code: arrow functions only (no `function` keyword); follow the PWA's existing patterns.
- Respect every entry of the decisions log; add no documentation or code for anything the catalog scopes out.
- Production is read-only unless I approve. STOP AND ASK before applying a migration to production, deploying an edge function, flipping an F-1 flag, running a contract step, changing Auth settings, rotating keys, or shipping anything that changes numbers users see (plan risk R-1).

Workflows, in order, for each chunk:
1. UNDERSTAND (parallel read-only readers): build a scope ledger for the package — every rule and defect ID its "Why" table cites; the live objects it touches, verified with read-only SQL and the deployed edge-function sources; every PWA call site (grep src/); its acceptance rows; its open points (OP-xx.n) with their catalog decision IDs. Ask me about any open point that blocks the chunk before designing.
2. DESIGN: migration plan (expand / migrate / contract), SQL and edge changes, PWA changes, rollback, and a test plan mapping every acceptance row and rule ID to at least one test.
3. IMPLEMENT on a branch, tests first: pgTAP via `supabase test db` (assertion text starts with rule IDs and the BC row, e.g. 'SES-30 · 04-1 · …'), Deno.test("REC-21 · …") for functions, Vitest describe("SES-24 · …") for the PWA. Gates: npm test, npm run build, supabase test db, Deno tests, advisors.
4. ADVERSARIAL REVIEW with independent reviewers: (a) security — cross-user reads and writes, anon calls, forged or expired tokens, privilege drift from default ACLs; (b) PWA compatibility — every call site, tabs on the previous build during overlaps; (c) rule conformance — each cited rule ID against SQL and tests; (d) data integrity — idempotency, concurrency, the 8 s statement_timeout, time-zone fixtures. Verify every finding, fix the confirmed ones, re-review until none remain.
5. SYNC in the same PR: catalog rules (today / target), defects marked fixed, decided open points moved to the decisions log, 12-client-logic-register target homes, backend-contract.md (move the §16 row into the live sections), the BC Status line, a new dated live snapshot. Then report what landed, the rule-ID coverage, and what needs my approval next.
```

---

### Phase 0B — Design system & app shell

**Goal.** Create `bookhero-ios` with everything later phases compose: `CLAUDE.md`, the docs submodule, the Xcode project, a design system built on native Liquid Glass, a gallery, the app shell (root states, tabs, typed navigation for every screen, Settings), shared formatting helpers, and the engineering scaffolding (tests, snapshots, rule coverage, CI). No backend calls and no business logic.

**Repo.** `bookhero-ios` (new).

**Prerequisites.** D-02, D-03, D-04 recorded. Apple Developer team; bundle identifier (code name, e.g. `<reverse-domain>.bookhero`) with display name "The Chronicler". Xcode 26. Read access to this repo for the submodule. No BC package needed. Earlier phases: none (runs in parallel with 0A).

**Suggested chunks.** 0B-1 repo bootstrap (project, submodule, `CLAUDE.md`, CI, test targets, rule-coverage script) · 0B-2 tokens · 0B-3 components + gallery + snapshots · 0B-4 app shell and routes · 0B-5 formatting and date helpers.

**In scope.**

- **Bootstrap.** iOS 26.0 deployment target, iPhone only, portrait (PWA parity: portrait-only manifest). Swift 6 language mode. Targets: app, unit tests (Swift Testing), UI tests, snapshot tests. `Config/*.xcconfig` holding only the publishable Supabase URL and anon key (public by design; nothing else). String Catalog (English). SwiftLint / swift-format. CI: build, tests, snapshots. `scripts/rule-coverage` → `docs/rule-coverage.md`. `CLAUDE.md` per §3.3.
- **Tokens** from [design-tokens.md](ios-foundation/design-tokens.md) §1–§12, delivered as the files of its §15: indigo accent ramp, text roles, the semantic colours the PWA uses (success, warning, danger, caution, open-thread quote, opaque dialog surface), `PageBackground` (`MeshGradient` allowed), typography roles mapped to Dynamic Type, spacing, continuous radii, motion constants gated on Reduce Motion. The Liquid Glass mapping is tokens §5.2; the PWA's rgba/blur recipes (§5.1) are reference only (D-04).
- **Glass.** Components call `.glassEffect(…)` (`.interactive()` where touchable) and group with `GlassEffectContainer`; standard controls use the system glass styles. No `if #available(iOS 26…)` branch, no material/blur/opacity recipes. Text-dense surfaces (dialogs, menus, long prose) stay opaque. Snapshots verify Reduce Transparency and Increase Contrast; add an explicit opaque fallback only where legibility fails.
- **Components** (from [component-inventory.md](ios-foundation/component-inventory.md)): BookCover (2:3, initials placeholder; an empty-string URL counts as missing), Chip / Badge (genre, "Imported", "Set page count"), ProgressTrack, SectionHeader with count, EmptyState, primary and secondary buttons, Shimmer / redacted placeholder, StatTile, StatPill (compact numbers), status banner replacing the PWA's glass toast (success 5 s, warning 6 s, loading until dismissed), confirmation patterns.
- **Gallery** screen previewing every token and component.
- **App shell.** Root states (launching / signed out / signed in) driven by a stub. `TabView` with **Home, Library, Codex, Profile**. The PWA's "More" sheet becomes toolbar "+" buttons (Add Book) and a Settings screen pushed from Profile (theme, account, legal, about). One `NavigationStack` per tab with a typed `Route` covering: dashboard, library, dnfList, addBook (sheet), searchDetail(source, key), bookDetail(id), recapHistory(id), passport(id), codex(bookId?, tab?), review, profile, trophyRoom, readingStats, profileEdit, settings. Back pops to the origin. Universal-link parser for `/auth/callback`, `/auth/reset`, `/books/<id>`, `/lexicon?bookId=…&tab=lore`; unknown paths open Home.
- **Helpers** (pure functions): relative time, absolute dates, plurals, compact numbers (≥ 10 000 → `12.3k`), floating `YYYY-MM-DD` dates (never UTC midnight). Theme setting stub per [PLT-Q06](business-rules/08-platform-auth-account.md#open-decisions) (recommendation: a "System" default plus explicit Light / Dark).

**Out of scope.** Networking, the Supabase client, auth flows, SwiftData models, real feature content, widgets, Live Activities, notifications.

**Rules to implement.**

| Catalog file | Rule IDs |
|---|---|
| [08 · Platform](business-rules/08-platform-auth-account.md) | PLT-18 … PLT-23 (routing, back navigation, bottom nav → tabs + Settings, Codex deep links), PLT-37 (toast semantics), PLT-40 … PLT-42a (theme and tokens), PLT-67 … PLT-70 (formatting, language), PLT-87 (product name) |
| [07 · Profile](business-rules/07-profile-stats-goals.md) | PRO-41 (stat-pill formatting) |
| [12 · Register](business-rules/12-client-logic-register.md) | CL-08 (floating dates), CL-09 (theme), CL-87 (device preferences), CL-95 (back navigation), CL-96 (copy formatting), CL-100 (search-detail route key) |
| [ios-foundation](ios-foundation/README.md) | design-tokens §1–§12 and §15, component-inventory primitives, screen-inventory routes and states |

**Backend contract dependencies.** None. The date helper follows [contract §15.1](backend-contract.md#15-notes-for-native-clients) (ISO-8601 with 0–6 fractional digits; `YYYY-MM-DD` as calendar dates).

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P0B-01 | The gallery renders every token and component in light and dark, at the largest accessibility text size, with Reduce Transparency, Increase Contrast and Reduce Motion each on; snapshot baselines are committed for each combination | PLT-42a, D-04 |
| P0B-02 | No hard-coded colours, point sizes or radii outside `DesignSystem/Tokens` (a test scans the sources) | — |
| P0B-03 | No glass emulation: no `if #available(iOS 26` branch, no material or blur recipe in the design system (a test scans the sources) | D-04 |
| P0B-04 | A sample book row is assembled only from design-system components | — |
| P0B-05 | Four tabs labelled Home, Library, Codex, Profile; every `Route` case is reachable from a debug menu; back returns to the origin; Settings is reachable from Profile | PLT-22, CL-95 |
| P0B-06 | The link parser maps the four paths to routes, decodes the search-detail key segment, and opens Home for unknown paths | PLT-23, CL-100 |
| P0B-07 | Formatting fixtures pass for relative time, dates, plurals and compact numbers; floating dates never shift across time zones | PLT-67, PLT-68, PLT-69, PRO-41, CL-08 |
| P0B-08 | Every user-facing string says "The Chronicler"; the app is portrait-only on iPhone | PLT-87, D-03 |
| P0B-09 | Every interactive component has an accessibility label and trait and a ≥ 44 pt hit target | — |
| P0B-10 | CI is green; `docs/rule-coverage.md` is generated; `CLAUDE.md` points to `bookhero/` paths | D-02 |

**Verification.** Swift Testing for tokens and helpers; the snapshot matrix; a UI test that walks every tab and route. On a physical iPhone on iOS 26: light and dark, maximum Dynamic Type, Reduce Transparency, Increase Contrast, Reduce Motion, a VoiceOver pass over the gallery.

**Kickoff prompt.**

```text
ultracode

Phase 0B — Design system & app shell for The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo; if it is empty, bootstrap it. Goal: everything later phases compose — CLAUDE.md, the docs submodule, the Xcode project, a design system on native Liquid Glass, a gallery, the app shell with typed navigation for every screen, formatting helpers, tests and CI. No backend calls and no business logic in this phase.

Read first, in this order (paths are inside the read-only docs submodule bookhero/; if it is missing, add it as described in §3.2 of the brief below):
1. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 0B" (this brief; §3.3 says how CLAUDE.md is created).
2. bookhero/docs/ios-implementation-plan.md — the Phase 0B section and the architecture sections (§3–§5).
3. bookhero/docs/ios-foundation/ — README, ios-constitution.md, design-tokens.md, component-inventory.md, screen-inventory.md, ios-design-brief.md. Where they mention iOS 18, an availability branch, `.appGlass`, material fallbacks, Spec Kit or `.specify`, decisions D-02 and D-04 override them.
4. bookhero/docs/business-rules/README.md (decisions log), then 08-platform-auth-account.md sections on routing, theme, formatting and the PWA metadata rules (PLT-18…PLT-23, PLT-37, PLT-40…PLT-42a, PLT-67…PLT-70, PLT-87), and 12-client-logic-register.md rows CL-08, CL-09, CL-87, CL-95, CL-96, CL-100.
5. bookhero/docs/backend-contract.md §15.1 (date decoding only).

Constraints (non-negotiable):
- iOS 26.0 minimum, iPhone only, portrait; Swift 6 language mode; SwiftUI, Observation.
- Liquid Glass is native only: .glassEffect, GlassEffectContainer and system control styles. No pre-iOS-26 branch, no material/blur/opacity recipes, no re-emulation of the PWA's CSS glass. Text-dense surfaces stay opaque. Respect Reduce Transparency, Increase Contrast, Reduce Motion, Dynamic Type and VoiceOver (D-04).
- Every colour, size, radius and motion comes from DesignSystem tokens; Dynamic Type only, never fixed point sizes for text.
- User-facing name "The Chronicler"; "BookHero" only in code identifiers (D-03).
- No secrets: xcconfig holds only the publishable Supabase URL and anon key; nothing else, ever.
- CLAUDE.md is a copy of bookhero/docs/ios-foundation/ios-constitution.md, or a short file that @-imports it (brief §3.3). No Spec Kit files.
- bookhero/ is read-only. Stop and ask before adding any third-party dependency other than a snapshot-testing library.

Workflows, in order:
1. UNDERSTAND (parallel read-only readers: foundation docs, platform rules, PWA styles in bookhero/src/assets/styles as a visual reference only): produce docs/phases/phase-0b/scope-ledger.md — every token, component, route and rule ID in scope, and every place where a foundation doc conflicts with D-02/D-04.
2. DESIGN: docs/phases/phase-0b/design.md — module layout per the plan's §5 (App/, Packages/ChroniclerCore, BackendKit, Persistence, DesignSystem, Features/, Tests/), token API, component APIs, Route enum and link parser, the snapshot matrix, the chunk plan (0B-1…0B-5) and the test plan (rule ID → test).
3. IMPLEMENT chunk by chunk, tests first: Swift Testing @Test("PLT-67 · …"), snapshot tests for every component state in light/dark × default/accessibility text × Reduce Transparency × Increase Contrast × Reduce Motion, a UI test walking every tab and route. Gates: build, tests, snapshots, lint.
4. ADVERSARIAL REVIEW with independent reviewers: (a) D-04 compliance — any emulated glass, any availability branch, legibility under Reduce Transparency and Increase Contrast; (b) HIG and accessibility — labels, traits, 44 pt targets, Dynamic Type truncation, VoiceOver order; (c) composition — hard-coded values, one-off controls; (d) navigation — every route reachable, back returns to the origin, link parsing. Fix confirmed findings; re-review until none remain.
5. SYNC: generate docs/rule-coverage.md; list (do not apply) any foundation-doc correction for the BookHero repo; report against acceptance rows P0B-01…P0B-10.
```

---

### Phase 1 — MVP

**Goal.** A reader can sign up (Sign in with Apple or email), add or import books, read in timed sessions on the server clock (with the tab-bar mini timer and Focus mode), save pages online or offline, use the Library and the Dashboard, shelve a book as DNF, edit and delete books, and delete their account. Internal TestFlight.

**Repo.** `bookhero-ios`.

**Prerequisites.**

- Phase 0B done.
- Backend: Waves 1–3 landed (BC-01 … BC-10, the plan's gate). Hard dependencies: the BC-04 RPCs, BC-05 completion effects, BC-06 `set_my_time_zone`, and the BC-14 additive library fields (`sessionPausedAt`, `completedAt` on `get_library_with_progress`).
- Auth chunk: BC-11 items 1–6 (delete-account, Sign in with Apple + `store-apple-token`, identity linking, password reset, redirect URLs + `apple-app-site-association` on the canonical domain, custom SMTP and the email-confirmation decision).
- Library-writes chunk: BC-13 image cleanup on book delete.
- Search and import chunks: BC-15 `book-search`, `import_library`, `find_library_duplicates`. [CL-Q01](business-rules/12-client-logic-register.md#open-decisions) recommendation: the proxy is a prerequisite; no Google key ships in the binary.
- Decisions recorded, or the catalog recommendation accepted: [PLT-Q01](business-rules/08-platform-auth-account.md#open-decisions) sign-out scope · [PLT-Q06](business-rules/08-platform-auth-account.md#open-decisions) theme default · [SES-Q01](business-rules/02-reading-sessions.md#open-decisions) hero persistence · [CL-Q04](business-rules/12-client-logic-register.md#open-decisions) offline write scope · [CL-Q05](business-rules/12-client-logic-register.md#open-decisions) offline completion dialog · OP-04.5 replay window · OP-04.8 Last Update card · OP-05.2 passport gate · OP-11.5 Hide-My-Email handling.

**Suggested chunks.**

| Chunk | Content | Main rules |
|---|---|---|
| 1.1 Foundations | Per-user SwiftData store with a full wipe on user change and identity-bound tasks; networking policy (timeouts ≥ 10 s, one refresh-and-retry on 401, one retry of reads on `57014`, `P0001` code → copy, never auto-retry AI calls); time-zone registration; freshness (TTLs, refresh on foreground, invalidation from RPC responses) | CL-02, CL-07, CL-10, CL-85, CL-86, CL-111, PLT-24 … PLT-39, PLT-62 … PLT-66, PLT-83, PLT-86, XD-41 … XD-46 |
| 1.2 Auth & account | Sign in with Apple (`signInWithIdToken` + `store-apple-token`), email/password sign-in and sign-up, magic link and password reset through universal links (PKCE), "Link Apple ID" in Settings, Hide-My-Email guidance, sign-out (local wipe even offline), delete account (confirmation, re-auth, `delete-account`, local wipe). The AI-consent sheet ships in Phase 2 (chunk 2.0) | PLT-01 … PLT-17a, PLT-82, PLT-71 … PLT-75, XD-54 … XD-57, CL-01, CL-03, CL-91 … CL-93 |
| 1.3 Library (read) | `get_library_with_progress` (own uid), list and grid from the RPC status, order and tie-break, search, DNF header icon and DNF list, badges, days-left forecast (`get_reading_velocity` with `p_timezone`, cached per book), empty / loading / error states | LIB-44 … LIB-54, LIB-94, LIB-99 … LIB-109, LIB-112 … LIB-114, LIB-116, CL-04, CL-05, CL-06, CL-36, CL-101, CL-102, CL-110 |
| 1.4 Add book | ISBN scan (VisionKit, EAN-13 with 978/979 prefix; AVFoundation fallback), typed ISBN, manual form, search and detail through `book-search`, recommendations, duplicate notice (`find_library_duplicates`), initial status (`set_initial_status`) | LIB-01 … LIB-43, LIB-103, LIB-105 … LIB-107, LIB-110, LIB-111, LIB-117, CL-28 … CL-31, CL-41 |
| 1.5 Book detail & sessions | Hero and description (backfill through `book-search`), progress panel, start / pause / resume / cancel via BC-04 RPCs, timer from server timestamps, page sheet, pencil edit, session note (`set_session_note`), completion prompt from the save response ("Continue" only; "View Journey" and the Passport view arrive in Phase 2), the tab-bar mini timer (`.tabViewBottomAccessory`), Focus mode (full-screen cover, idle timer off only while visible, overlay dim after 30 s, goal chips 15/30/45/60 with chime, haptic and overtime; the session keeps running) | SES-01 … SES-36, SES-39 … SES-43, SES-79 … SES-98, XD-13 … XD-24, XD-47 … XD-53, CL-11 … CL-19, CL-24, CL-35, CL-38, CL-97, CL-99 |
| 1.6 Offline page saves | Per-user queue of `save_progress` calls with `occurredAt` and an idempotency key; drain on foreground and when the network path is satisfied; handling of `replayed`, `stale` and permanent errors (dead letter); persistent "pending sync" indicator; offline completion dialog | SES-76 … SES-78, SES-91, SES-92, PLT-43 … PLT-49, CL-27, D-08 |
| 1.7 Dashboard | Greeting, onboarding states, hero inference and selection, hero controls, forecast line ("N pages left · finish by ~date"; the Insight nudge waits for Phase 2), Last Session card, In Progress, Up Next shelf, Completed row | SES-53 … SES-67, SES-70 … SES-74, SES-90, CL-21 … CL-26, CL-94 |
| 1.8 Library writes | Up Next reorder (dense positions), edit (metadata; clears `page_count_estimated` when pages change), delete (confirmation, local purge, cancel the book's tasks), DNF shelve / resume (`mark_dnf`, `resume_dnf`); online-only with clear copy | LIB-55 … LIB-65, LIB-87 … LIB-93, LIB-95, LIB-115, XD-03 … XD-12, XD-25 … XD-32, CL-23, CL-34, CL-37, CL-39, CL-40, CL-103 |
| 1.9 Import | `.fileImporter` for CSV, RFC-4180 parsing, format detection and row mapping, then `import_library`; progress and summary UI | LIB-66 … LIB-86, XD-33 … XD-40, CL-32 |
| 1.10 Profile tab shell | Profile tab root with the Settings entry; deleting the account removes the profile data. The identity header, profile edit and the rest of Profile arrive in Phase 2 (chunk 2.10) | PLT-22, PRO-105 |
| 1.11 Hardening | Performance, accessibility, crash reporting choice ([PLT-Q15](business-rules/08-platform-auth-account.md#open-decisions)), internal TestFlight | — |

**In scope.** The chunks above.

**Out of scope.** Recaps, captures and OCR, the "Previously" resume, Memory Check, Codex, Word of the Day and review, Insights (including the hero nudge), DNA, Trophy Room, Reading Stats, achievements, recap gallery, the AI-consent sheet, the Passport view and profile identity editing (Phase 2) · Live Activity, widgets, notifications (including the Focus-goal notification), App Intents (Phase 3) · subscriptions (Phase 4) · bio, privacy settings, public toggle and every community surface (Phase 5, D-13) · iPad (Phase 6).

**Rules to implement.**

| Catalog file | Rule IDs |
|---|---|
| [01 · Library](business-rules/01-library.md) | LIB-01 … LIB-117. Server-owned after Phase 0 and only consumed: LIB-04, LIB-05, LIB-117 (ISBN normalisation), LIB-27 … LIB-43 (`book-search`), LIB-75 … LIB-83, LIB-85, LIB-86 (`import_library`, passport gate) |
| [02 · Reading sessions](business-rules/02-reading-sessions.md) | SES-01 … SES-36, SES-39 … SES-43, SES-53 … SES-67, SES-70 … SES-98 (Phase 2: SES-37, SES-38 capture, SES-44 … SES-52 passport, SES-68, SES-69 Insight nudge) |
| [07 · Profile](business-rules/07-profile-stats-goals.md) | PRO-105 (account deletion and profile data); the identity rules ship in Phase 2 |
| [08 · Platform](business-rules/08-platform-auth-account.md) | PLT-01 … PLT-49 (native equivalents per its Notes for native clients), PLT-62 … PLT-75, PLT-82, PLT-83, PLT-86 (PLT-79 … PLT-81 consent and legal surfaces: Phases 2 and 3) |
| [11 · Cross-domain](business-rules/11-cross-domain.md) | XD-01 … XD-57 (client side of each flow) |
| [12 · Register](business-rules/12-client-logic-register.md) | CL-01 … CL-41, CL-85 … CL-87, CL-91 … CL-97, CL-99 … CL-103, CL-110, CL-111, and the "What a new client must still implement" list items 1–5, 6 (timer only), 10, 13, 14. Rows whose target home is server-side (e.g. CL-12, CL-19, CL-20) are consumed, not re-implemented |

Defects not to copy: every `LIB-Dnn`, `SES-Dnn`, `PLT-Dnn` and `XD` defect the domain files list — in particular the lossy offline replay, the unscoped queue, sign-out that keeps local data, the shared velocity cache and the uncapped client percentage.

**Backend contract dependencies.** [Contract §1](backend-contract.md#1-connection-auth--runtime-limits), [§3.1 / §3.6](backend-contract.md#3-tables), [§4](backend-contract.md#4-cascades--lifecycle-effects), [§7](backend-contract.md#7-storage), [§8.2 / §8.4](backend-contract.md#8-rpc-catalogue), [§15](backend-contract.md#15-notes-for-native-clients), [§16](backend-contract.md#16-planned-changes).

| Kind | Names |
|---|---|
| RPCs | `get_library_with_progress`, `get_library_changes` (optional, BC-14), `get_reading_velocity`, `get_last_session`, `start_session`, `pause_session`, `resume_session`, `cancel_session`, `save_progress`, `set_session_note`, `mark_dnf`, `resume_dnf`, `set_initial_status`, `set_my_time_zone`, `import_library`, `find_library_duplicates`, `get_my_community_profile` (Home greeting) |
| Edge functions | `book-search`, `delete-account`, `store-apple-token` |
| Tables (direct) | `books` (insert, update, delete), `up_next_order` (upsert), `reading_progress` (select only) |
| Auth | Apple provider, email/password, OTP magic link with redirect, `resetPasswordForEmail`, `linkIdentity`, universal links for `/auth/*` |

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P1-01 | The app never writes `reading_progress` or `progress_history`; every session, page, DNF and initial-status action is exactly one BC-04 RPC call (source scan + request log) | SES-30, SES-75, SES-87, LIB-16, D-06 |
| P1-02 | Online writes carry no client timestamp; the timer derives from `session_start_at` / `session_paused_at` and is correct after kill and relaunch | SES-12, SES-17 … SES-21, CL-97 |
| P1-03 | Start on a complete or DNF book shows the catalog copy for `book_complete` / `book_dnf`; the page sheet blocks out-of-range and unchanged pages and maps `page_out_of_range`, `page_unchanged`, `no_pages_read` | SES-10, SES-24 … SES-27 |
| P1-04 | A save in airplane mode is queued with `occurredAt` and an idempotency key; on reconnect it creates exactly one history row at the original time; a replay older than a newer web save leaves `current_page` unchanged and shows no error; the queue drains within 30 s of reconnect | PLT-43 … PLT-49, SES-76 … SES-78, D-08 (04-3, 04-4) |
| P1-05 | Switching accounts wipes the local store, queue, caches and in-flight tasks; nothing of account A is visible to account B | CL-02, XD-41 … XD-46 |
| P1-06 | A completing save shows the completion prompt from `completion.completedNow` once ("Continue" only; "View Journey" arrives with passports in Phase 2), rotates the hero and raises no capture prompt | SES-39, SES-41, OP-05.2 |
| P1-07 | Hero inference, onboarding states, Up Next and Completed row match the shared golden fixtures | SES-55, SES-59 … SES-65, CL-Q03 |
| P1-08 | A ~100-row Goodreads or StoryGraph CSV imports in < 2 min; a second import adds 0 books; DNF rows land on the DNF shelf; imported "read" books add nothing to this year's quest | LIB-69 … LIB-86, XD-33 … XD-40, PRO-97 |
| P1-09 | The scanner accepts only EAN-13 with the 978/979 prefix; a duplicate shows a non-blocking notice | LIB-19, LIB-24 |
| P1-10 | After deleting a book no local artefact of it remains (lists, caches, queued saves) and its tasks are cancelled | LIB-87 … LIB-89, XD-03 … XD-12, CL-39 |
| P1-11 | Sign in with Apple, email/password, magic-link and reset links open the app; an existing email user links an Apple ID and sees the same library | PLT-01 … PLT-08, PLT-82 (11-4, 11-5) |
| P1-12 | Delete account requires re-auth, removes the account and leaves no local data; it is reachable from Settings | PLT-71 … PLT-75, XD-54 … XD-57 (11-1) |
| P1-13 | `set_my_time_zone` runs at first launch and on a zone change; velocity is requested with `p_timezone`; finish dates use the local calendar | PLT-62 … PLT-66, PLT-83, SES-90, D-07 |
| P1-14 | Focus mode keeps the screen awake only while visible, dims after 30 s without touches, and at goal end plays the chime and haptic and shows "Time's up" while the session keeps running; opening or closing Focus mode never changes the session | SES-79 … SES-83, CL-99 |
| P1-15 | While a session runs, the tab-bar accessory shows the live timer on every tab with pause / resume and End → page sheet, and matches the server state after a foreground refresh | SES-19, SES-20, CL-97 |
| P1-16 | A new user adds a first book within 90 s of first launch; the library shows from cache in < 0.5 s warm and < 1.5 s cold with 100 books; a page save updates the UI in < 50 ms and reconciles with the RPC response; queue reorder shows no flicker | — |
| P1-17 | A strings scan of the built app finds only the publishable Supabase URL and anon key; no Google Books key | CL-Q01 |
| P1-18 | Crash-free sessions ≥ 99.5 % on internal TestFlight before Phase 2 starts | — |

**Verification.**

- **Unit (Swift Testing, named by rule ID):** RPC error mapping, queue state machine, hero and onboarding derivations against golden fixtures, search normalisation, CSV parsing, formatting.
- **UI tests:** sign-in flows against a test project or stubbed auth, add book (manual and search), session lifecycle, offline save and replay (stubbed network), import, DNF, delete book, delete account on a throwaway account.
- **On device:** airplane mode during a save; kill during a session; the same account on the web and the iPhone (start a session on the web, foreground the iPhone; pause on the iPhone, refresh the web); change the time zone in Settings; Network Link Conditioner (100 % loss, high latency) to see the 8 s statement-timeout path; VoiceOver and the largest Dynamic Type on Library, Dashboard and Book Detail.

**Kickoff prompt.**

```text
ultracode

Phase 1 — MVP of The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo; the design system and app shell from Phase 0B exist. Goal: a reader can sign up (Sign in with Apple or email), add or import books, read in timed sessions on the server clock (with the tab-bar mini timer and Focus mode), save pages online or offline, use the Library and the Dashboard, shelve a book as DNF, edit and delete books, and delete their account. Ends with an internal TestFlight build.

Read first, in this order (paths are inside the read-only docs submodule bookhero/):
1. CLAUDE.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 1 — MVP" (chunks, rules, contract, acceptance P1-01…P1-18).
3. bookhero/docs/ios-implementation-plan.md — the Phase 1 section.
4. bookhero/docs/business-rules/README.md (legend, glossary, decisions log D-01…D-17); then in full 01-library.md, 02-reading-sessions.md, 08-platform-auth-account.md, 11-cross-domain.md and 12-client-logic-register.md; then PRO-105 in 07-profile-stats-goals.md (account deletion). Read Rules, Flows, Known defects, Open decisions and Notes for native clients. Implement each rule's Target, not the PWA's current behaviour.
5. bookhero/docs/backend-contract.md §1, §3.1, §3.6, §4, §7, §8.2, §8.4, §15, §16; bookhero/docs/backend-consolidation-plan.md BC-04, BC-05, BC-06, BC-11, BC-14 (library fields) and BC-15 — signatures, response objects and typed errors.
6. bookhero/docs/ios-foundation/screen-inventory.md and component-inventory.md (Library, Dashboard, Add Book, Book Detail, Profile, Settings); D-04 overrides any iOS 18 or availability-branch wording.

Before designing, check the gates in the brief: BC-01…BC-10 landed (Status lines in backend-consolidation-plan.md §2.4); BC-11 items 1–6 before the auth chunk; BC-13 before the library-writes chunk; BC-14 library fields; BC-15 before the search and import chunks. If a gate is not met, design everything, implement only the chunks whose gates are met, and tell me what is blocked.

Constraints (non-negotiable):
- iOS 26+, iPhone first, portrait; Swift 6, SwiftUI, Observation, SwiftData; compose only the Phase 0B design system.
- Liquid Glass native only; respect Reduce Transparency, Increase Contrast, Reduce Motion, Dynamic Type, VoiceOver (D-04).
- Thin client (D-06): if a rule's target home in 12-client-logic-register.md is server-side, call the RPC or edge function and render its result — never re-implement it. Never write reading_progress or progress_history; use start/pause/resume/cancel_session, save_progress, set_session_note, mark_dnf, resume_dnf, set_initial_status.
- Time (D-07, D-08): call set_my_time_zone at launch and on zone change; pass TimeZone.current.identifier as p_timezone; online writes send no timestamps; offline page saves queue per user and replay through save_progress with occurredAt and an idempotency key.
- Every async task is bound to the user who started it; a user change (sign-out, account switch, account deletion) wipes all per-user state (CL-02).
- No secrets: only the publishable Supabase URL and anon key; no Google Books key (use book-search).
- No AI on device; this phase calls no AI function and shows no AI-consent sheet (Phase 2). Server-side AI jobs triggered by saves follow the BC-11 consent flag (ai_consent_enforced), which stays off until both clients show the sheet.
- No profile editing in this phase (Phase 2; D-13 limits it to username, display name and avatar). No paywall (D-14). User-facing name "The Chronicler" (D-03).
- Auth (D-10, D-11): Sign in with Apple + email/password, magic and reset links via universal links (PKCE), Link Apple ID in Settings, delete account with confirmation and re-auth.
- bookhero/ is read-only. A missing or wrong rule or contract → stop and draft the change for the BookHero repo; never work around the backend.
- Stop and ask before: adding a dependency, deviating from a catalog rule, any open decision listed in the brief's Prerequisites that is still open, external TestFlight.

Workflows, in order:
1. UNDERSTAND (parallel read-only readers: one per catalog file in scope, one for the contract and plan, one for the PWA in bookhero/src as a behaviour reference only): write docs/phases/phase-1/scope-ledger.md — every in-scope rule ID with its target home (server or client), the RPC or edge call it uses, the defects not to copy, and open decisions. Ask me about blocking decisions before designing.
2. DESIGN: docs/phases/phase-1/design.md — modules and repositories, per-user SwiftData store and wipe, networking policy (timeouts ≥ 10 s, one refresh-and-retry on 401, retry reads once on 57014, P0001 message → copy, never auto-retry AI), the offline queue state machine, cache freshness and invalidation from RPC responses, the API call map with every typed error → copy, the chunk plan 1.1…1.11 with rule IDs and acceptance rows per chunk, and the test plan (every rule ID → at least one test; golden fixtures where the brief names them).
3. IMPLEMENT chunk by chunk, tests first: Swift Testing @Test("<RULE-ID> · …"), XCUITest test_<PREFIX>_<NN>_…, snapshots for every new view state (empty, loading, error, offline). Gates per chunk: build, all tests, snapshots, lint.
4. ADVERSARIAL REVIEW per chunk and for the phase, with independent reviewers: (a) rule conformance — each rule ID against code and tests; (b) thin client and D-xx — no direct writes to server-owned tables, no client timestamps online, no re-implemented server rules; (c) security and privacy — secrets, wipe on user change, identity-bound tasks, no logging of titles, notes or emails; (d) offline and multi-device — airplane mode, kill and relaunch, the same account on the web and the iPhone, clock skew, stale replays; (e) HIG and accessibility. Verify findings, fix confirmed ones, re-review until none remain.
5. SYNC: regenerate docs/rule-coverage.md; draft (do not apply) any catalog or contract correction for the BookHero repo; report against P1-01…P1-18 and list what blocks internal TestFlight.
```

---

### Phase 2 — AI & memory parity

**Goal.** Every memory feature at parity with the PWA, on the server-owned contracts, behind a one-time AI-consent sheet: recaps (eligibility, v2 stream, sheet, history, images, gallery), captures (Vision-first OCR, review, auto-save, capture prompt), the session warm-up (Memory Check, "Previously"), vocabulary auto-extraction, the Codex (browse, add, Word of the Day, review, Anki), Insights (list, seen, banner, nudge), the Book Passport (view and summary), and the full Profile (identity header and edit limited to username, display name and avatar, DNA, recommendations, Trophy Room, achievements, Reading Stats, recap memories).

**Repo.** `bookhero-ios`.

**Prerequisites.**

- Phase 1 on internal TestFlight with P1-01 … P1-18 met.
- BC-05, BC-07, BC-08, BC-09 landed, F-1 flags on, the PWA migrated. BC-10 landed ([LEX-Q27](business-rules/05-codex-lexicon.md#open-decisions)); otherwise the client implements CL-62 … CL-66 and CL-109 exactly. BC-12 guard live (allow-all), the BC-11 consent record (item 9) and partial profile update (item 8). BC-13 landed (image-job robustness). BC-14 Realtime optional ([PLT-Q12](business-rules/08-platform-auth-account.md#open-decisions)).
- Decisions: [PLT-Q03](business-rules/08-platform-auth-account.md#open-decisions) consent placement · [CAP-Q07](business-rules/04-capture-resume-quiz.md#open-decisions) Vision calibration (chunk 2.2 produces the evidence; the decision must be recorded before the chunk ships) · [CAP-Q01](business-rules/04-capture-resume-quiz.md#open-decisions) / [XD-Q01](business-rules/11-cross-domain.md#open-decisions) which saves raise the capture prompt · [CAP-Q08](business-rules/04-capture-resume-quiz.md#open-decisions) offline captures (v1: no) · [REC-Q07](business-rules/03-recaps.md#open-decisions) Get Recap during a session on Book Detail · [INS-Q05](business-rules/06-insights.md#open-decisions) naming · [INS-Q06](business-rules/06-insights.md#open-decisions) seen semantics · [PRO-Q04](business-rules/07-profile-stats-goals.md#open-decisions) level display · [PRO-Q15](business-rules/07-profile-stats-goals.md#open-decisions) calendar week start · [LEX-Q26](business-rules/05-codex-lexicon.md#open-decisions) dictionary attribution.

**Suggested chunks.**

| Chunk | Content | Main rules |
|---|---|---|
| 2.0 AI consent | One-time consent sheet before the first AI feature (capture, recap, Insight, DNA, quiz, resume, vocabulary), naming Google (Gemini, including Google Search grounding) and OpenAI; `record_ai_consent`; consent status in Settings; declining keeps every non-AI feature working | PLT-79 … PLT-81, PLT-Q03, CL-112 |
| 2.1 Recaps | Lock labels from `get_recap_eligibility`, re-queried when `unlockAt` passes; Get Recap visibility; inferred-recap warning on the server's window; `generate-recap` `apiVersion: 2` NDJSON (accepted, progress, recap, error; heartbeats); dismiss and background keep a paid recap ("once paid, finish and save"); reconnect via `get_recap_request`; sheet states and copy; history; watchlist chips; images (signed URLs, cache bytes not URLs, capped polling or Realtime, terminal states); book carousel | REC-01 … REC-73 (client: REC-01, REC-02, REC-09, REC-17, REC-36 … REC-40, REC-46 … REC-57, REC-60, REC-61, REC-63 … REC-70, REC-73), CL-51 … CL-58, CL-106, CL-107, CL-114 |
| 2.2 Capture & OCR | Capture prompt after a history-writing save, gated by `effects.captureAllowed`; camera (document camera or AVFoundation) and upload (PhotosPicker, Files); images only in memory; Apple Vision first, `ocr-page` fallback on low confidence; save decision on the recalibrated thresholds; persistence (one row per page, text length counted in Unicode scalars, `word_count` recomputed); vocabulary and resume jobs in a background task; local purge on completion | CAP-01 … CAP-47, CAP-81 … CAP-85, CAP-88 … CAP-90, SES-37, SES-38, CL-42 … CL-46, CL-50, CL-104, D-15 |
| 2.3 Session warm-up | Start order Memory Check → "Previously" → start; the timer starts only on Begin / Skip; swipe-dismiss aborts; connectivity check first; resume selection and backfill; Memory Check eligibility, generation, answering, scoring; quiz payload validation | CAP-48 … CAP-80, CAP-86, CAP-87, SES-14, SES-15, CL-47 … CL-49, CL-98, CL-105 |
| 2.4 Codex | Browse, search, filters, sort, header counts; add word and quote; dictionary lookup with attribution; book-delete cascades | LEX-01 … LEX-23, LEX-70 … LEX-82, LEX-93 … LEX-103, CL-68, CL-70, CL-71 |
| 2.5 Review | Word of the Day card and today's set from `get_todays_review`; answers through `review_lexicon_entry`; undo; "Review more" (`request_more_reviews`); Anki prompt, deck and session (`record_anki_session`); en-US pronunciation | LEX-24 … LEX-69, CL-62 … CL-67, CL-109 |
| 2.6 Vocabulary auto-extraction | Client pipeline (Phase-0 exception): ledger, `extract-vocabulary`, proper-noun filter, dedupe, insert | LEX-83 … LEX-92, CL-69, CL-Q06 |
| 2.7 Insights | Book Detail card and Codex tab; "New Lore" chip; `mark_insights_seen`; banner from `effects.insightMilestonesQueued` + `get_my_jobs`; hero nudge | INS-37 … INS-56, SES-68, SES-69, CL-59 … CL-61, CL-108 |
| 2.8 Passport | Passport view (frozen stats) and "View Reading Journey" exactly when a passport row exists; summary rendering by `summary_status`; Share Journey via `ShareLink` | SES-44 … SES-52, OP-05.2 |
| 2.9 Profile & stats | Identity ring and level; DNA strip and sheet through `request_dna_refresh` (never blocking first paint); recommendations; stat pills; Trophy Room (quest hero, goal dialog, XP/level, achievements via `sync_achievements` with a celebration for `newlyEarned`); Reading Stats (Your year, calendar, lifetime, records, book lengths, breakdown); recap memories | PRO-01 … PRO-72, PRO-91, PRO-93 … PRO-103, PRO-106, CL-72 … CL-78 |
| 2.10 Profile identity (D-13) | Identity header with initials fallback; "Set up your reader profile" CTA; profile edit with username, display name and avatar only (availability check, reserved names, avatar ≤ 512 px JPEG: upload → save → only then clean up older files); the BC-11 item 8 partial write (until it ships, read the profile and send bio, `isPublic` and privacy back unchanged); new profiles are not public | PRO-73 … PRO-80, PRO-84 … PRO-90, PRO-92, PRO-104, COM-01 … COM-13, COM-15, COM-99, COM-100, COM-105, COM-109, CL-79 … CL-83 |

**In scope.** The chunks above.

**Out of scope.** Live Activity, widgets, notifications (Phase 3) · offline captures ([CAP-Q08](business-rules/04-capture-resume-quiz.md#open-decisions)) and offline review ([LEX-Q28](business-rules/05-codex-lexicon.md#open-decisions)) · bio and privacy (D-13) · public sharing of recap images · recap formats and continuity, which need new backend (Phase 6).

**Rules to implement.**

| Catalog file | Rule IDs |
|---|---|
| [03 · Recaps](business-rules/03-recaps.md) | REC-01 … REC-73 (server-owned and consumed: REC-03 … REC-08, REC-10 … REC-16, REC-18 … REC-35, REC-41 … REC-45) |
| [04 · Capture, resume & quiz](business-rules/04-capture-resume-quiz.md) | CAP-01 … CAP-90 |
| [05 · Codex & lexicon](business-rules/05-codex-lexicon.md) | LEX-01 … LEX-103 |
| [06 · Insights](business-rules/06-insights.md) | Client: INS-37 … INS-56. Consumed from the server: INS-01 … INS-36, INS-57 … INS-61 |
| [07 · Profile](business-rules/07-profile-stats-goals.md) | PRO-01 … PRO-104, PRO-106; not PRO-81 bio, PRO-82 public toggle or PRO-83 privacy (D-13); PRO-36 and PRO-103 describe the dormant weekly goal — not built |
| [08 · Platform](business-rules/08-platform-auth-account.md) | PLT-79 … PLT-81 (AI consent; the legal surfaces finish in Phase 3) |
| [10 · Community](business-rules/10-community-circles.md) | Identity subset: COM-01 … COM-13, COM-15, COM-99, COM-100, COM-105, COM-109 |
| [02 · Reading sessions](business-rules/02-reading-sessions.md) | SES-14, SES-15, SES-37, SES-38, SES-44 … SES-52, SES-68, SES-69 |
| [12 · Register](business-rules/12-client-logic-register.md) | CL-42 … CL-83, CL-88 … CL-90, CL-98, CL-104 … CL-109, CL-112 … CL-114; list items 6 (explicit confirm, warm-up order), 7–9, 11, 12, 15 of "What a new client must still implement" |

**Backend contract dependencies.** [Contract §3.2 … §3.5](backend-contract.md#3-tables), [§4.4, §4.5, §4.10](backend-contract.md#4-cascades--lifecycle-effects), [§7](backend-contract.md#7-storage), [§8.2, §8.3](backend-contract.md#8-rpc-catalogue), [§10.2 … §10.8](backend-contract.md#10-edge-functions), [§15.4, §15.5](backend-contract.md#15-notes-for-native-clients).

| Kind | Names |
|---|---|
| Edge functions (client calls) | `generate-recap` (`apiVersion: 2`), `ocr-page`, `generate-page-resume`, `generate-book-quiz`, `extract-vocabulary`. Never called by clients: `generate-lore`, `generate-reading-dna`, `process-jobs` |
| RPCs | `get_recap_eligibility`, `get_recap_request`, `get_my_jobs`, `mark_insights_seen`, `request_dna_refresh`, `sync_achievements`, `review_lexicon_entry`, `undo_lexicon_review`, `get_todays_review`, `request_more_reviews`, `record_anki_session`, `get_reading_quest_summary`, `get_reading_stats`, `get_reading_calendar`, `get_monthly_reading`, `get_reading_records`, `get_library_breakdown` (with `p_timezone` where taken), `record_ai_consent`, `get_my_community_profile`, `is_username_available`, the partial identity write of BC-11 item 8 (`upsert_my_community_profile` keeping absent keys) |
| Tables | Select: `recaps`, `lore_cards`, `book_passports`, `reading_dna`, `achievements`. Write (client-owned): `page_captures` (upsert on `user_id, book_id, page`; resume update), `book_quizzes` (upsert on `user_id, book_id`; score), `vocabulary_extractions` (ledger), `lexicon_entries` (insert), `reading_goals` (upsert on `user_id, year`) |
| Storage | `recap-images` signed URLs (batch); `community-avatars/{uid lowercased}/avatar-{epochMs}.jpg` — upload → save → only then delete older files |
| Realtime | `recaps` updates filtered by id, only if BC-14 publishes the table |

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P2-01 | While locked, Get Recap shows the server reason and label and sends no `generate-recap` request; at `unlockAt` it unlocks without a relaunch | REC-03 … REC-10, REC-Q12 (07-1, 07-2) |
| P2-02 | Dismissing the sheet or backgrounding after `accepted` still yields one persisted recap in history; reopening finds it via `get_recap_request`; a repeated `requestId` creates no second recap | REC-38 (07-5) |
| P2-03 | Inferred generations show staged progress (extracting, composing), never a frozen shimmer; a corpus request receives `accepted` within 2 s on Wi-Fi; every error line maps to catalog copy, never raw server text | REC-30b, REC-70, CL-114 |
| P2-04 | Image status polling is capped (backoff, ≤ 3 min) or uses Realtime; `failed_safety` / `failed_transient` render as terminal; signed URLs are never cached beyond their TTL | REC-46 … REC-49 |
| P2-05 | The capture page is the progress page; one row per page; the 10 000-character cap is counted in Unicode scalars; image bytes never reach disk or Photos | CAP-28, CAP-30, CAP-32a, CAP-90 |
| P2-06 | OCR runs Vision first and falls back to `ocr-page` below the recalibrated threshold; auto-save, review and warning follow the values recorded for CAP-Q07 | CAP-20 … CAP-24, D-15 |
| P2-07 | No capture prompt after the completing save (`captureAllowed = false`) | CAP-02, CAP-43, OP-05.3 |
| P2-08 | Warm-up decisions (Memory Check eligibility, resume selection, fresh-recap suppression) match the shared fixtures; the timer starts only on Begin / Skip; swipe-dismiss aborts the start | CAP-48 … CAP-66, CL-98 |
| P2-09 | Every review answer is one `review_lexicon_entry` call with surface `wotd` or `anki`; the 20/day tally uses the local day; "Review more" persists across devices for that day; undo restores box, date and mastery | LEX-24 … LEX-43, LEX-63 (10-1 … 10-6) |
| P2-10 | Quotes never appear in review or Word of the Day; the dictionary source is attributed | LEX-33, LEX-47, LEX-103 |
| P2-11 | Vocabulary extraction is idempotent per capture and completes when the app is backgrounded right after a save; auto words appear in the Codex within 10 s online | LEX-84, LEX-91, CL-Q06 |
| P2-12 | Insights generated on the server appear without any client generation; opening Book Detail marks the book's cards seen through `mark_insights_seen`; the banner clears when the card arrives or after 60 s | INS-37 … INS-41, INS-60 (08-6) |
| P2-13 | Profile renders before DNA resolves; `request_dna_refresh` is the only trigger; two devices opening Profile at once cause one AI call | PRO-55 … PRO-57 (05-6) |
| P2-14 | The Trophy Room shows the server catalog and the same earned set as the web; each newly earned badge is celebrated once | PRO-47 … PRO-51 (09-1) |
| P2-15 | Stats screens show the same numbers as the web for the same account and zone (fixture accounts) | PRO-21 … PRO-35, D-07 |
| P2-16 | With `ai_consent_enforced` on in staging and no consent, no AI call is made and the consent sheet appears | PLT-81 (11-8) |
| P2-17 | The app never writes `recaps`, `lore_cards`, `book_passports`, `reading_dna` or `achievements` (source scan) | D-06 |
| P2-18 | Profile edit changes only username, display name and avatar and never alters bio, `is_public` or privacy values set on the web (partial write once BC-11 item 8 ships; read-then-round-trip before that); reserved and invalid usernames show the catalog copy | COM-03 … COM-08, COM-14, PRO-104, D-13 (11-6) |
| P2-19 | The first AI action shows the consent sheet; declining keeps every non-AI feature working; accepting records consent server-side, visible from the web too | PLT-79 … PLT-81, PLT-Q03 (11-8) |

**Verification.**

- **Unit (by rule ID):** NDJSON parser and stream state machine, lock-label formatting, warm-up decision functions, Leitner presentation (deck order), extraction pipeline, stats formatting.
- **Golden fixtures** shared with the PWA tests for warm-up, review presentation and stats display.
- **UI tests** with a stubbed backend (URL protocol): recap success, locked, safety error, disconnect after `accepted`; capture auto-save vs review vs fallback; review with undo; Trophy Room celebration.
- **On device:** OCR on 30+ real pages (paper in good and low light, glare, ebook screenshots), recording the Vision score next to the `ocr-page` confidence as CAP-Q07 evidence; background the app mid-recap; two devices reviewing the same day; VoiceOver on flashcards; largest Dynamic Type on recap prose.

**Kickoff prompt.**

```text
ultracode

Phase 2 — AI & memory parity for The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo; Phase 1 is on internal TestFlight. Goal: every memory feature at parity with the PWA on the server-owned contracts — the AI-consent sheet, recaps, captures with Vision-first OCR, the session warm-up (Memory Check, "Previously"), vocabulary auto-extraction, the Codex with Word of the Day, review and Anki, Insights, the Passport view and summary, and the full Profile (identity limited to username, display name and avatar, DNA, recommendations, Trophy Room, achievements, Reading Stats, recap memories).

Read first, in this order (paths are inside the read-only docs submodule bookhero/):
1. CLAUDE.md and docs/rule-coverage.md (what Phase 1 already covers).
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 2 — AI & memory parity" (chunks 2.0…2.10, rules, contract, acceptance P2-01…P2-19).
3. bookhero/docs/ios-implementation-plan.md — the Phase 2 section.
4. bookhero/docs/business-rules/README.md (decisions log), then in full 03-recaps.md, 04-capture-resume-quiz.md, 05-codex-lexicon.md, 06-insights.md, 07-profile-stats-goals.md, plus 02-reading-sessions.md (SES-14, SES-15, SES-37, SES-38, SES-44…SES-52, SES-68, SES-69), 08-platform-auth-account.md (PLT-79…PLT-81), 10-community-circles.md (identity sections A, R, U), 11-cross-domain.md (completion) and 12-client-logic-register.md rows CL-42…CL-83, CL-88…CL-90, CL-104…CL-114. Read Rules, Flows, Known defects, Open decisions and Notes for native clients; implement Targets.
5. bookhero/docs/backend-contract.md §3.2–§3.5, §4.4, §4.5, §4.10, §7, §8.2, §8.3, §8.4, §10.2–§10.8, §15.4, §15.5; bookhero/docs/backend-consolidation-plan.md BC-05, BC-07, BC-08, BC-09, BC-10, BC-11 (items 8, 9), BC-12, BC-13, BC-14.
6. bookhero/docs/ios-foundation/screen-inventory.md and component-inventory.md (Recaps, Capture, Codex, Review, Lore, Profile, Profile Edit, Passport, AI consent).

Gates: BC-05, BC-07, BC-08, BC-09, BC-10 landed with their F-1 flags on; BC-12 guard, BC-13 and the BC-11 consent record and partial profile update live. If BC-10 has not landed, stop and ask me before implementing client Leitner maths. CAP-Q07 (Vision thresholds) must be decided before chunk 2.2 ships: produce the calibration evidence and ask me.

Constraints (non-negotiable):
- iOS 26+, iPhone first, portrait; Swift 6, SwiftUI, Observation, SwiftData; compose only the design system.
- Liquid Glass native only; respect Reduce Transparency, Increase Contrast, Reduce Motion, Dynamic Type, VoiceOver (D-04).
- Thin client (D-06): recap eligibility, recap persistence, Insights, passports, DNA and achievements are server-owned — call get_recap_eligibility, generate-recap apiVersion 2, get_recap_request, mark_insights_seen, get_my_jobs, request_dna_refresh, sync_achievements, review_lexicon_entry, undo_lexicon_review, get_todays_review, request_more_reviews, record_anki_session, and render. Never write recaps, lore_cards, book_passports, reading_dna or achievements; never call generate-lore or generate-reading-dna.
- Client-side Phase-0 exceptions you DO implement exactly as catalogued: session warm-up (CAP-48…CAP-80), vocabulary extraction pipeline (LEX-83…LEX-92), capture persistence (CAP-28…CAP-35).
- No AI on device except OCR: Apple Vision first, ocr-page fallback on low confidence, thresholds recalibrated (D-15). Page images live only in memory.
- Never auto-retry generate-recap or other paid AI calls; one refresh-and-retry on 401 only.
- No secrets; time zone and p_timezone on every stats RPC (D-07); every async task bound to its user (CL-02).
- No paywall or client gating (D-14). User-facing name "The Chronicler".
- The AI-consent sheet (record_ai_consent) comes before the first AI feature; declining keeps every non-AI feature working.
- Profile v1 = username, display name, avatar only (D-13); never alter bio, isPublic or privacy values set on the web.
- bookhero/ is read-only. A missing or wrong rule or contract → stop and draft the change for the BookHero repo.
- Stop and ask before: adding a dependency, deviating from a catalog rule, any still-open decision listed in the brief's Prerequisites.

Workflows, in order:
1. UNDERSTAND (parallel read-only readers, one per catalog file in scope, one for the contract and plan, one for the PWA in bookhero/src as a behaviour reference): write docs/phases/phase-2/scope-ledger.md — each in-scope rule ID → target home, call used, defects not to copy, open decisions. Ask me about blocking decisions.
2. DESIGN: docs/phases/phase-2/design.md — recap stream client (NDJSON, heartbeats, reconnect), image status strategy (capped polling or Realtime), capture pipeline (Vision → fallback → decision → save → background jobs), warm-up orchestration, review flows, Insights banner, Profile data loading without blocking on DNA, the consent sheet and profile identity edit, the API call map with every error → copy, chunk plan 2.0…2.10 and the test plan (every rule ID → at least one test; shared fixtures for warm-up and review presentation).
3. IMPLEMENT chunk by chunk, tests first: Swift Testing @Test("<RULE-ID> · …"), XCUITest with a stubbed backend, snapshots for every state. Gates per chunk: build, all tests, snapshots, lint.
4. ADVERSARIAL REVIEW per chunk and for the phase, with independent reviewers: (a) rule conformance per rule ID; (b) thin client — no re-implemented server rule, no write to a server-owned table, no paid call retried; (c) privacy — page images never persisted, no titles, words or recap text in logs or analytics, consent before AI; (d) spoilers — nothing beyond the reader's page is shown, inferred-recap warning present; (e) multi-device and background — recap finishes when backgrounded, review tally across devices; (f) accessibility and HIG. Verify, fix confirmed findings, re-review until none remain.
5. SYNC: regenerate docs/rule-coverage.md; draft the CAP-Q07 resolution and any other catalog correction for the BookHero repo; report against P2-01…P2-19.
```

---

### Phase 3 — Native polish & App Store v1.0

**Goal.** Make the app feel first-party and ship v1.0: Focus-mode extras (the goal notification while locked, real dimming per SES-Q13), a Live Activity with Dynamic Island, session-accessory polish, widgets, App Intents and Shortcuts, quick actions, Spotlight (optional; may slip to Phase 6), haptics and transitions, share sheets, local notifications, an accessibility and localisation pass, privacy manifest and App Privacy labels, legal surfaces, crash reporting, App Store assets, external TestFlight and submission.

**Repo.** `bookhero-ios`.

**Prerequisites.**

- Phase 2 done (P2-01 … P2-19).
- Wave 4 landed: BC-11 complete (Apple token revocation, consent enforcement plan), BC-12 ledger, BC-13, BC-14 decision ([PLT-Q12](business-rules/08-platform-auth-account.md#open-decisions)), BC-15.
- Privacy policy, terms and support URL live ([PLT-Q04](business-rules/08-platform-auth-account.md#open-decisions)); the App Store name "The Chronicler" cleared ([legal review](legal-compliance-review.md)); the Gemini key confirmed on a paid tier (legal review §4).
- Decisions: [SES-Q19](business-rules/02-reading-sessions.md#open-decisions) Live Activity in v1 (recommended: yes) · [SES-Q13](business-rules/02-reading-sessions.md#open-decisions) Focus mode details · [LEX-Q17](business-rules/05-codex-lexicon.md#open-decisions) Lock Screen content and notification actions · [PLT-Q08](business-rules/08-platform-auth-account.md#open-decisions) localisation · [PLT-Q15](business-rules/08-platform-auth-account.md#open-decisions) crash reporting · [LEX-Q26](business-rules/05-codex-lexicon.md#open-decisions) dictionary provider · [SES-Q01](business-rules/02-reading-sessions.md#open-decisions) hero persistence (widgets).

**Suggested chunks.**

| Chunk | Content | Main rules |
|---|---|---|
| 3.1 Focus mode extras | Focus mode itself ships in Phase 1. Adds: real dimming through the window scene's screen if SES-Q13 adopts it, restored on exit and whenever the scene leaves the foreground (the only reliable hook before a kill), keeping the black overlay for OLED; a local notification at goal end while locked or backgrounded | SES-81 … SES-83, CL-99 |
| 3.2 Live Activity & Dynamic Island | Attributes {bookId, title, author, totalPages}; state {sessionStartAt (shifted), pausedAt, currentPage}; `Text(timerInterval:pauseTime:)`, so no periodic updates; Pause / Resume through App Intents calling `pause_session` / `resume_session`; End deep-links to the page sheet; ends on save, cancel, DNF, completion, delete, sign-out and stale sessions; the 8 h system limit handled | SES-17 … SES-22, SES-89, OP-04.7 |
| 3.3 Session accessory polish | The Phase 1 tab-bar accessory adapts to the `.inline` placement when the tab bar minimizes and stays consistent with the Live Activity | SES-19 |
| 3.4 Widgets | Currently Reading (small, medium), Lock Screen inline "p. 142/380", Word of the Day, yearly quest ring; read only an App Group cache written by the app; reload after every save and review; empty after sign-out | SES-58 … SES-62, LEX-44 … LEX-53, PRO-37, XD-41 … XD-46 |
| 3.5 App Intents | "Start reading {book}", "Log page {n} for {book}" (`save_progress` with an idempotency key), "Add book by ISBN", "Review today's words"; book `AppEntity`; Home Screen quick actions "Current read" and "Add book"; Spotlight for books and Codex entries (optional; may slip to Phase 6) | SES-24 … SES-27, LEX-36 … LEX-43 |
| 3.6 Interaction polish | Haptics (save, block, session end, milestone, badge); zoom transition from cover to detail; context menus; pull-to-refresh; `ShareLink` (journey text, optional rendered card); symbol effects; everything gated on Reduce Motion | — |
| 3.7 Local notifications | See the [Notifications brief](#cross-cutting--notifications) (local part) | SES-83, LEX-Q17 |
| 3.8 Accessibility & localisation | Full VoiceOver pass, largest accessibility text sizes, Reduce Transparency, Increase Contrast, 44 pt targets, complete String Catalog, locale-aware dates per PLT-Q08 | PLT-67 … PLT-70 |
| 3.9 Compliance | Privacy manifest (required-reason APIs actually used, SDK manifests, no tracking); App Privacy labels (processors: Supabase, Google Gemini including Search grounding for inferred recaps, OpenAI for recap images, Google Books, Open Library, dictionaryapi.dev); AI disclosure and consent copy (Guideline 5.1.2(i)); account deletion discoverable (5.1.1(v)); Apple token revocation on deletion; dictionary attribution; AI-generated content labels; age rating; legal links in Settings | PLT-79 … PLT-81, LEX-103 |
| 3.10 Release | Crash reporting; App Store Connect metadata, screenshots and an App Preview featuring the Live Activity; external TestFlight with ≥ 50 testers for ≥ 7 days without critical bugs; submission with review notes (test account, AI explanation) | — |

**In scope.** The chunks above.

**Out of scope.** Push notifications (Notifications brief, later backend) · subscriptions (Phase 4) · iPad layouts (Phase 6) · community (Phase 5).

**Rules to implement.** SES-17 … SES-22, SES-58 … SES-62, SES-81 … SES-83 (Focus extras), SES-89 ([02](business-rules/02-reading-sessions.md)) · LEX-36 … LEX-53, LEX-103 ([05](business-rules/05-codex-lexicon.md)) · PRO-37 ([07](business-rules/07-profile-stats-goals.md)) · PLT-14 … PLT-16, PLT-67 … PLT-70, PLT-79 … PLT-81, PLT-87 ([08](business-rules/08-platform-auth-account.md)) · XD-03 … XD-12, XD-41 … XD-46 ([11](business-rules/11-cross-domain.md)) · CL-97 … CL-99, CL-112 ([12](business-rules/12-client-logic-register.md)) · the [legal review](legal-compliance-review.md) priority list.

**Backend contract dependencies.** `pause_session`, `resume_session`, `save_progress` (intents and Live Activity), `get_library_with_progress` or `get_library_changes`, `get_reading_quest_summary` and `get_todays_review` (widget caches, filled by the app), `delete-account` with Apple revocation, `record_ai_consent`, the BC-14 Realtime decision, `register_device_token` only if push ships. [Contract §1.2](backend-contract.md#1-connection-auth--runtime-limits), [§15.6, §15.8](backend-contract.md#15-notes-for-native-clients), [§16](backend-contract.md#16-planned-changes).

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P3-01 | If SES-Q13 adopts real dimming, brightness is restored on exit and whenever the scene leaves the foreground; the goal notification fires while locked and is cancelled on clear or end | SES-81 … SES-83 |
| P3-02 | The Live Activity renders from server timestamps with no periodic updates; Lock Screen pause / resume call the RPCs and show in the app; the activity ends on save, cancel, DNF, completion, delete, sign-out, and when a foreground refresh shows the session ended elsewhere | SES-17 … SES-22, SES-89 |
| P3-03 | Widgets reload after every save and review, show nothing user-specific after sign-out, and follow the LEX-Q17 decision for Word of the Day content | LEX-44 … LEX-53, XD-41 … XD-46 |
| P3-04 | "Log page" goes through `save_progress` with an idempotency key and the same validation copy as the page sheet | SES-24 … SES-27 |
| P3-05 | VoiceOver users complete sign-in, add book, session start → end, recap, capture, review and delete account; nothing truncates at the largest accessibility size on primary screens | — |
| P3-06 | Reduce Motion disables the zoom transition, shimmer sweep and dim fades without breaking navigation | — |
| P3-07 | The privacy manifest and App Privacy labels match the processor list; consent copy names Google (Gemini, Search grounding) and OpenAI | PLT-79 … PLT-81 |
| P3-08 | Account deletion is reachable from Settings in ≤ 3 taps; the Apple token is revoked on deletion | PLT-72 (11-3) |
| P3-09 | Crash-free sessions ≥ 99.7 % over 7 days of external TestFlight with ≥ 50 testers; no open critical bug | — |
| P3-10 | Cold launch to a visible library < 1.5 s on the oldest supported iPhone; a widget timeline loads from cache in < 100 ms and renders within 2 s of being added | — |
| P3-11 | App Store review passes; v1.0 released | — |

**Verification.** Unit tests for activity-state mapping, widget timeline providers (fixture caches) and intents; UI tests for Focus mode states. On device: Lock Screen and Dynamic Island interactions, a session longer than 8 h, brightness restore, the goal notification while locked, Accessibility Inspector audits, a VoiceOver pass, widgets in airplane mode, App Store Connect validation, TestFlight feedback triage.

**Kickoff prompt.**

```text
ultracode

Phase 3 — Native polish & App Store v1.0 for The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo; Phases 1 and 2 are done. Goal: make the app feel first-party and ship v1.0 — Focus-mode extras (goal notification, real dimming per SES-Q13), Live Activity and Dynamic Island, session-accessory polish, widgets, App Intents and Shortcuts, quick actions, Spotlight (optional), haptics and transitions, share sheets, local notifications, an accessibility and localisation pass, privacy manifest and App Privacy labels, legal surfaces, crash reporting, App Store assets, external TestFlight and submission.

Read first, in this order (paths are inside the read-only docs submodule bookhero/):
1. CLAUDE.md and docs/rule-coverage.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4, "Phase 3", and "Cross-cutting — Notifications" (local part only).
3. bookhero/docs/ios-implementation-plan.md — the Phase 3 and release sections.
4. bookhero/docs/business-rules/README.md (decisions log); 02-reading-sessions.md (SES-17…SES-22, SES-58…SES-62, SES-79…SES-83, SES-89 and its Notes for native clients); 05-codex-lexicon.md (LEX-36…LEX-53, LEX-103, LEX-Q17); 08-platform-auth-account.md (PLT-14…PLT-16, PLT-67…PLT-70, PLT-79…PLT-81, PLT-87); 11-cross-domain.md (XD-03…XD-12, XD-41…XD-46); 12-client-logic-register.md (CL-97…CL-99, CL-112).
5. bookhero/docs/backend-contract.md §1.2, §15.6, §15.8, §16; bookhero/docs/backend-consolidation-plan.md BC-11 and BC-14.
6. bookhero/docs/legal-compliance-review.md and bookhero/docs/ios-foundation/ios-design-brief.md §8 ("pull ahead").

Gates: Wave 4 landed (BC-11 complete, BC-12, BC-13, BC-14 decision, BC-15); privacy policy, terms and support URL live; SES-Q19, SES-Q13, LEX-Q17, PLT-Q08, PLT-Q15, LEX-Q26 decided or their recommendations accepted. Ask me about any that are open.

Constraints (non-negotiable):
- iOS 26+, iPhone first, portrait; Swift 6, SwiftUI, Observation, SwiftData, WidgetKit, ActivityKit, App Intents; compose only the design system; Liquid Glass native only (D-04).
- Session state is server-owned: the Live Activity and widgets render from server timestamps (Text(timerInterval:pauseTime:)) and call pause_session, resume_session and save_progress — never a local timer as truth, never per-minute updates.
- Widgets and extensions read only an App Group cache the app writes; they hold no long-lived user token unless strictly needed for an intent, and they are emptied on sign-out.
- Restore screen brightness and the idle timer on every exit path; schedule the focus-goal notification only after contextual permission.
- Privacy: no titles, words or recap text in logs, analytics or crash reports; Lock Screen content follows LEX-Q17.
- No secrets; no AI on device except OCR; no paywall (D-14); user-facing name "The Chronicler" (D-03).
- bookhero/ is read-only. A missing or wrong rule or contract → stop and draft the change for the BookHero repo.
- Stop and ask before: adding a dependency (including the crash reporter), App Store Connect changes, external TestFlight, submission.

Workflows, in order:
1. UNDERSTAND (parallel read-only readers): docs/phases/phase-3/scope-ledger.md — every in-scope rule ID, every App Store requirement (5.1.1(v), 5.1.2(i), 4.8, privacy manifest, App Privacy labels, age rating), and the open decisions.
2. DESIGN: docs/phases/phase-3/design.md — targets and App Group, the Live Activity lifecycle (start, update on state change, end on every terminal event), widget timelines and cache contract, intents, Focus-mode extras, notification scheduling, the compliance checklist with owners, chunk plan 3.1…3.10 and the test plan.
3. IMPLEMENT chunk by chunk, tests first (Swift Testing @Test("<RULE-ID> · …"), UI tests, snapshots including widgets). Gates: build, tests, snapshots, lint, Accessibility Inspector audit for new screens.
4. ADVERSARIAL REVIEW with independent reviewers: (a) rule conformance; (b) session truth — any path where the Live Activity, widget or accessory disagrees with the server; (c) privacy and compliance — manifest, labels, Lock Screen content, logging; (d) accessibility — VoiceOver flows, largest text, Reduce Motion, Reduce Transparency, Increase Contrast; (e) battery and performance — no polling loops, no per-second extension updates. Fix confirmed findings; re-review until none remain.
5. SYNC: regenerate docs/rule-coverage.md; draft any catalog change (for example the LEX-Q17 or SES-Q13 resolutions) for the BookHero repo; report against P3-01…P3-11 and prepare the App Review notes.
```

---

### Phase 4 — Monetization [undecided]

> **Status: UNDECIDED (D-14).** Do not build a paywall until the owner records the decision (tiers, prices, trials, Family Sharing, whether web purchases exist, entitlement source — [OP-12.1](backend-consolidation-plan.md#bc-12--entitlements--ai-usage-foundation) / [PLT-Q14](business-rules/08-platform-auth-account.md#open-decisions)). Earlier drafts (Free / Scholar / Chronicler tiers with monthly and yearly products and a feature-gate matrix) are **non-binding** (D-14). The implementation plan's Phase 4 keeps only a non-binding list of possible gate dimensions, and nothing is seeded into `ai_usage_policies` before the decision.

**Goal (once decided).** StoreKit 2 purchases mirrored to server entitlements; every gate enforced server-side by the BC-12 guard; the app only renders entitlement state and maps `402` / `429` to copy.

**Repo.** Both: entitlement ingestion and policies in this repo; StoreKit and UI in `bookhero-ios`.

**Prerequisites.** v1.0 shipped (Phase 3); D-14 decided; BC-12 complete including ingestion (`app-store-notifications` with App Store Server Notifications v2, or `revenuecat-webhook`); App Store Connect paid-apps agreement.

**Possible before the decision.** A design memo for the owner; StoreKit configuration file and purchase plumbing behind a disabled flag; `appAccountToken` = the Supabase user id (lowercased UUID); entitlement status shown in Settings from `get_my_entitlements`; `402` / `429` copy mapping. No paywall UI ships.

**In scope (after the decision).** Products; purchase, restore and "Manage subscription"; entitlement refresh on launch, foreground and purchase; contextual paywall shown when the server answers `402 entitlement_required`; quota copy for `429 quota_exceeded`; trial indicator; Family Sharing per the decision; offline behaviour that never unlocks from client state.

**Out of scope.** Any client-only gate; price experiments before the decision.

**Rules to implement.** PLT-85 ([08](business-rules/08-platform-auth-account.md)) · CAP-88 ([04](business-rules/04-capture-resume-quiz.md)) · REC-11 ([03](business-rules/03-recaps.md)) · CL-113 ([12](business-rules/12-client-logic-register.md)) · [BE-Q08](business-rules/09-database-invariants.md#open-decisions) (abuse ceiling) · plan acceptance rows 12-1 … 12-3.

**Backend contract dependencies.** Tables `entitlements`, `ai_usage`, `ai_usage_policies`; RPC `get_my_entitlements`; edge `app-store-notifications` or `revenuecat-webhook`; guard responses `402 {"error":"entitlement_required","feature":…}` and `429 {"error":"quota_exceeded","feature":…,"resetAt":…}`. [Plan BC-12](backend-consolidation-plan.md#bc-12--entitlements--ai-usage-foundation), [contract §16](backend-contract.md#16-planned-changes).

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P4-01 | A sandbox purchase creates or updates the purchaser's `entitlements` row (matched by `appAccountToken`) within 10 s | PLT-85 (12-3) |
| P4-02 | When a policy denies, the server answers 402 / 429 before any provider call and the app shows the mapped copy; the app contains no product check guarding an AI call | CL-113, REC-11 (12-2) |
| P4-03 | Restore on a new device recovers the entitlement | — |
| P4-04 | Offline, a gated feature is never unlocked from cached client state | CL-113 |
| P4-05 | With an empty policy table the app behaves exactly like v1.0 | (12-2) |

**Verification.** StoreKit testing in Xcode with a local configuration; sandbox accounts; App Store Server Notification test events against staging; pgTAP and Deno tests for ingestion and the guard; unit tests for the entitlement state machine.

**Kickoff prompt.**

```text
ultracode

Phase 4 — Monetization for The Chronicler (code name BookHero). Decision D-14 says subscriptions and the paywall are UNDECIDED. First read bookhero/docs/business-rules/README.md (decisions log). If D-14 has not been replaced by a recorded decision on tiers, prices, trials, Family Sharing, web purchases and the entitlement source, do NOT build any paywall: produce docs/phases/phase-4/decision-memo.md for me (options, App Store rules, the BC-12 policy design each option implies, risks) and, only if I confirm, plumbing behind a disabled flag. Then stop.

If the decision is recorded, you are in the bookhero-ios repo (server work goes to the BookHero repo as a separate Phase 0A-style session). Read first, in this order:
1. CLAUDE.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 4".
3. bookhero/docs/ios-implementation-plan.md — the Phase 4 section (any tier table there is a draft unless the decisions log says otherwise).
4. bookhero/docs/backend-consolidation-plan.md BC-11 (consent) and BC-12; bookhero/docs/backend-contract.md §10, §12, §16.
5. bookhero/docs/business-rules/08-platform-auth-account.md (PLT-85, PLT-Q14), 12-client-logic-register.md (CL-113), 09-database-invariants.md (BE-Q08).

Constraints (non-negotiable):
- Entitlements are server truth: StoreKit 2 transactions are mirrored to the entitlements table by the ingestion function; appAccountToken = the Supabase user id (lowercased UUID). The app never gates an AI call on client state; it renders get_my_entitlements and maps 402 entitlement_required and 429 quota_exceeded to copy.
- Offline never unlocks a gated feature. Restore and "Manage subscription" are always reachable.
- iOS 26+, Liquid Glass native, design system only; no secrets (no App Store shared secret or server keys in the app); user-facing name "The Chronicler".
- bookhero/ is read-only. Stop and ask before any App Store Connect change, any price, and any policy row.

Workflows, in order: UNDERSTAND (scope ledger of rule IDs and App Store rules) → DESIGN (purchase and entitlement state machine, paywall triggers from server responses, test plan with StoreKit configuration files) → IMPLEMENT (tests first, named after rule IDs: @Test("CL-113 · …")) → ADVERSARIAL REVIEW (bypass attempts — offline, clock changes, refunds, family sharing, account switch; App Review guideline 3.1) → SYNC (rule coverage, drafted catalog changes, report against P4-01…P4-05).
```

---

### Phase 5 — Community [much later]

> **Status: much later (D-13).** The community backend exists but is dormant: `community_profiles`, `community_profile_privacy`, `community_follow_counts`, `follows`, `blocks`, `reading_circles`, `circle_invitations`, `circle_members`, `circle_reactions` and 21 RPCs ([contract §8.6](backend-contract.md#8-rpc-catalogue)). Known defects are deferred ([plan §6](backend-consolidation-plan.md#6-out-of-scope-for-phase-0)).

**Goal.** The social layer: public profiles (bio, privacy, public toggle), reader search, follow / unfollow, blocking, follower and following lists, "also reading", reading circles with invitations and spoiler-gated reactions, and moderation — then, with new backend, a following feed and book clubs.

**Repos.** First the shared backend repo (community hardening, a Phase 0A-style package), then `bookhero-ios`. The PWA pioneers each surface first (validated rollout order: discovery → circles + invite links → feed → clubs; a feed before discovery launches empty).

**Prerequisites.**

- v1.0 stable (Phase 3); product go-ahead.
- **Community hardening landed** in the shared repo: the deferred defects (pagination skipping items, unescaped `LIKE` in search, a block evicting circle owners, public-profile privacy gaps), report / hide / moderation storage and RPCs (App Store Guideline 1.2), external invite links (new), and every decision below.
- Decisions: [COM-Q01](business-rules/10-community-circles.md#open-decisions) default discoverability · COM-Q05 profile requirement for social writes · COM-Q08 circle survival · COM-Q10 reaction moderation · COM-Q12 spoiler unit · COM-Q14 username policy (no profanity filter exists today; reserved list) · COM-Q18 private profiles in circles · [BE-Q07](business-rules/09-database-invariants.md#open-decisions) circle cascade.

**Suggested sub-releases.** 5a profiles, privacy, follow, blocks, lists, search · 5b also reading, circles, invitations · 5c reactions with the spoiler gate · 5d moderation (ships with 5a, not after) · 5e following feed (new `activity_feed` backend; explicit consent and a public asset copy for shared images; progress-bracket spoiler blur) · 5f book clubs (new backend).

**In scope.** The sub-releases whose backend has landed.

**Out of scope.** Any surface whose moderation path does not exist; push for community events until the Notifications backend exists.

**Corrections to earlier drafts.** Username uniqueness and the reserved list already live in `is_username_available` (COM-03 … COM-08); there is no profanity filter. Circle tables already exist. Reaction visibility is gated by normalised location (`get_visible_circle_reactions`, COM-88 … COM-93), not by comparing raw page numbers.

**Rules to implement.** COM-01 … COM-110 ([10](business-rules/10-community-circles.md)) · BE-51 … BE-68 ([09](business-rules/09-database-invariants.md)) · PRO-81 … PRO-83 (bio, public toggle, privacy — [07](business-rules/07-profile-stats-goals.md)) · XD-12 (deleting a book can delete a circle — [11](business-rules/11-cross-domain.md)).

**Backend contract dependencies.** `get_public_profile_by_username`, `search_community_readers`, `follow_community_user`, `unfollow_community_user`, `block_community_user`, `unblock_community_user`, `get_community_relationship_state`, `can_community_users_interact`, `list_community_followers`, `list_community_following`, `list_my_blocked_users`, `get_also_reading_for_book`, `create_reading_circle`, `invite_reading_circle_members`, `respond_to_reading_circle_invitation`, `leave_reading_circle`, `remove_reading_circle_member`, `get_reading_circle_detail`, `list_my_reading_circles`, `add_circle_reaction`, `get_visible_circle_reactions`, plus the hardening package's moderation RPCs. Cursors are opaque and passed back verbatim. [Contract §3.6, §8.6](backend-contract.md#8-rpc-catalogue).

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P5-01 | No reaction beyond the viewer's normalised location is ever returned or rendered (fixtures at, just below and just above the boundary) | COM-88 … COM-93 |
| P5-02 | A block hides the user from every surface (search, lists, also reading, circles, reactions) | COM-38 … COM-40 |
| P5-03 | Profiles and reactions can be reported and hidden, with a documented response process | Guideline 1.2, COM-Q10 |
| P5-04 | Pagination returns every item exactly once across pages; cursors are sent back byte-for-byte | COM-52 … COM-55 |
| P5-05 | Every payload respects the owner's privacy settings | COM-19 … COM-32 |
| P5-06 | New profiles get the default decided in COM-Q01 | COM-15, COM-Q01 |
| P5-07 | Deleting a book or the account warns when it removes a circle the reader owns | XD-12, COM-94, COM-95 |

**Verification.** pgTAP for every gate in the shared repo; Swift tests with fixtures; manual tests with three test accounts (follow, block, circle at different pages); moderation dry runs.

**Kickoff prompt — community backend hardening (shared repo).**

```text
ultracode

Phase 5 prerequisite — Community backend hardening for The Chronicler (code name BookHero). You are in the SHARED BACKEND repo. The community and circles backend is live but dormant (D-13). Goal: make it safe to put in front of users on the web and iOS, without breaking anything the PWA uses today.

Read first: CLAUDE.md; docs/ios-phase-prompts.md §1–§4 and "Phase 5"; docs/business-rules/README.md (decisions log); docs/business-rules/10-community-circles.md in full (Rules, Flows, Known defects, Open decisions); docs/business-rules/09-database-invariants.md BE-51…BE-68; docs/backend-contract.md §3.6, §5, §8.6, §12; docs/backend-consolidation-plan.md §1 (principles), BC-01 (what was already locked) and §6 (deferred items).

Scope: fix the deferred community defects (pagination skips, unescaped LIKE in search, block evicting circle owners, public-profile privacy gaps), add report / hide / moderation storage and RPCs (App Store Guideline 1.2), external invite links if the owner has asked for them, and every COM open decision the owner has recorded. Only with my go-ahead: the following feed or clubs (new tables).

Constraints: the same as Phase 0A — client-agnostic and backward compatible (D-05), least privilege, migration discipline, tests named after rule IDs (pgTAP 'COM-88 · …'), docs and catalog synced in the same PR, arrow functions only in TypeScript/Deno, and STOP AND ASK before any production apply, deploy or policy change. Ask me about every COM-Qnn that blocks the work before designing.

Workflows: UNDERSTAND (scope ledger verified read-only against live) → DESIGN (migrations, RPC changes, moderation model, test plan) → IMPLEMENT on a branch → ADVERSARIAL REVIEW (privacy leaks between users, spoiler leaks across the location boundary, block bypasses, pagination correctness, abuse of invitations) → SYNC (catalog, contract, snapshot, report).
```

**Kickoff prompt — iOS.**

```text
ultracode

Phase 5 — Community for The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo. Before anything else, check bookhero/docs/business-rules/README.md (decisions log) and bookhero/docs/backend-consolidation-plan.md for the community hardening package: if it has not landed, or COM-Q01, COM-Q05, COM-Q08, COM-Q10, COM-Q12, COM-Q14 or COM-Q18 is undecided, stop and tell me what is missing.

Read first, in this order:
1. CLAUDE.md and docs/rule-coverage.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 5".
3. bookhero/docs/ios-implementation-plan.md — the Phase 5 section.
4. bookhero/docs/business-rules/10-community-circles.md in full, 07-profile-stats-goals.md PRO-73…PRO-90, 09-database-invariants.md BE-51…BE-68, 11-cross-domain.md XD-12.
5. bookhero/docs/backend-contract.md §3.6, §8.6 (including cursor formats and error codes), §15.

Session scope: the first sub-release in the brief (5a…5f) whose backend has landed and which I have approved; moderation ships with the first social surface.

Constraints (non-negotiable):
- Every call goes through the community RPCs; never read community tables directly. Cursors are opaque and sent back verbatim. Count text limits in Unicode scalars. Avatar paths use the lowercased user id.
- Spoiler safety: never show a reaction the server did not return; flush pending offline page saves before posting a reaction.
- Every social surface has report, hide and block before it ships (Guideline 1.2).
- iOS 26+, Liquid Glass native, design system only; thin client; no secrets; user-facing name "The Chronicler".
- bookhero/ is read-only. Stop and ask before deviating from a COM rule or shipping a surface without moderation.

Workflows, in order: UNDERSTAND (scope ledger) → DESIGN (relationship state, pagination, privacy rendering, moderation flows, test plan) → IMPLEMENT (tests first: @Test("COM-88 · …")) → ADVERSARIAL REVIEW (privacy and spoiler leaks with three accounts, block bypasses, pagination duplicates or gaps, UGC moderation, accessibility) → SYNC (rule coverage, drafted catalog changes, report against P5-01…P5-07).
```

---

### Phase 6 — Platform expansion

**Goal.** Take The Chronicler beyond the iPhone without forking the rules: every new client implements the same catalog against the same backend (D-05), and anything new goes into the catalog first.

**Repos.** `bookhero-ios` for Apple platforms; a new Android repo for 6g, set up like `bookhero-ios` (docs submodule, `CLAUDE.md`, rule-ID tests).

**Sub-tracks.**

| ID | Sub-track | Prerequisites and notes | Key rules |
|---|---|---|---|
| 6a | iPad: `NavigationSplitView`, keyboard and pointer, Stage Manager, orientation decision | D-04 says iPhone first; edit and delete must not be touch-only ([LIB-Q06](business-rules/01-library.md#open-decisions)) | PLT-22, LIB-102 |
| 6b | Mac (Designed for iPad, or Mac Catalyst) | After 6a | — |
| 6c | Apple Watch: current-read complication, session start / pause / end, Word of the Day | RPCs only; review answers with surface `widget` or `notification` | SES-08 … SES-22, LEX-44 … LEX-53 |
| 6d | Share Extension: look up a selected word and "Add to Codex for {current book}" | App Group, add-word rules | LEX-10 … LEX-19, LEX-103 |
| 6e | Audio recaps (speech synthesis, background playback, Now Playing) | Gating only if the D-14 decision says so | REC-50 … REC-57 |
| 6f | visionOS | Low priority | — |
| 6g | **Android** (Kotlin, Jetpack Compose, `supabase-kotlin`, WorkManager queue drain, ML Kit for barcodes and the on-device OCR decision) | Long-term goal of D-05; uses the Platform-agnostic Notes for native clients of every catalog file and the shared golden fixtures ([CL-Q03](business-rules/12-client-logic-register.md#open-decisions)) | The whole catalog |
| 6h | Smart recommendations ("readers like you") | New backend package; needs community data | PRO-64 … PRO-68 |
| 6i | Recap quality (formats, continuity across recaps) | New backend: there is no `context_digest` today ([REC-Q06](business-rules/03-recaps.md#open-decisions), [REC-Q17](business-rules/03-recaps.md#open-decisions)) | REC-13 … REC-35 |
| 6j | Lexicon quality (memory hooks, contextual review, rare-word badges) | New backend for generated content | LEX-24 … LEX-92 |

**Prerequisites.** v1.0 stable; the sub-track's notes above; for 6h–6j a backend package designed and landed in the shared repo first.

**In scope / out of scope.** One sub-track per session. Out: new rules invented on the client; anything needing backend that has not landed.

**Rules to implement.** Per sub-track (table above). For 6g, the whole catalog; start with the "What a new client must still implement" list in the [client-logic register](business-rules/12-client-logic-register.md#notes-for-native-clients).

**Backend contract dependencies.** Same contract as Phases 1–3 ([§15](backend-contract.md#15-notes-for-native-clients) covers `supabase-kotlin`); new packages for 6h–6j.

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| P6-01 | The sub-track's rule IDs pass on the new platform with the same golden fixtures as the web and iOS | CL-Q03 |
| P6-02 | No rule is implemented differently from the catalog; every new behaviour has a catalog entry before release | §2.4 |
| P6-03 | 6a: the iPad layout passes App Review for iPad; every action is reachable with keyboard and pointer | LIB-Q06 |
| P6-04 | 6c: the Watch app installs from the iPhone; complications show the current read; session actions round-trip through the RPCs | SES-08 … SES-22 |
| P6-05 | 6d: the extension shows a definition in < 2 s and returns the reader to the source app | LEX-10 … LEX-19 |
| P6-06 | 6g: the Android client passes the Phase 1 acceptance rows P1-01 … P1-15 on Android | Phase 1 rules |

**Verification.** The phase's unit and UI tests on the new platform; the shared fixtures; manual device checks per sub-track (iPad multitasking, Watch pairing, extension from Apple Books and Safari, Android offline queue under WorkManager).

**Kickoff prompt.**

```text
ultracode

Phase 6 — Platform expansion for The Chronicler (code name BookHero).
SUB-TRACK = 6a iPad   (replace with one row ID from the Phase 6 table: 6a…6j)

You are in the bookhero-ios repo (for 6g Android: the Android repo, set up like bookhero-ios with the bookhero/ docs submodule and a CLAUDE.md). Goal: deliver exactly one sub-track without forking any business rule.

Read first, in this order (paths are inside the read-only docs submodule bookhero/):
1. CLAUDE.md and docs/rule-coverage.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Phase 6" (the sub-track row, acceptance P6-01…P6-06).
3. bookhero/docs/ios-implementation-plan.md — the Phase 6 section.
4. bookhero/docs/business-rules/README.md (decisions log) and every catalog file the sub-track row cites, including Notes for native clients (for 6g: the Platform-agnostic notes of every file and the client-logic register's "What a new client must still implement").
5. bookhero/docs/backend-contract.md §8, §10, §15.
For 6h, 6i and 6j: if the backend package does not exist yet, stop after UNDERSTAND and write the backend brief for the BookHero repo instead.

Constraints (non-negotiable):
- Same backend, same rules (D-05, D-06): call the RPCs and edge functions, render the results; new behaviour goes into the catalog first.
- Apple platforms: iOS 26+ family, Liquid Glass native, design system only. Android: Material 3 equivalents, the same thin-client rules, WorkManager for the per-user offline queue.
- No secrets; no AI on device except OCR; user-facing name "The Chronicler"; no paywall unless the D-14 decision exists.
- bookhero/ is read-only. Stop and ask before adding a dependency or deviating from a rule.

Workflows, in order: UNDERSTAND (scope ledger for the sub-track) → DESIGN (platform adaptation, shared fixtures, test plan) → IMPLEMENT (tests first, named after rule IDs) → ADVERSARIAL REVIEW (rule parity with web and iOS on the same fixtures, platform HIG, accessibility, offline and multi-device) → SYNC (rule coverage, drafted catalog changes, report against P6-01…P6-06).
```

---

### Cross-cutting — Notifications

**Goal.** One notification system: local notifications (focus-goal end, reading reminder, review reminder, streak nudge), interactive Word of the Day with actions that go through the review RPC, and later remote push (Insight or recap ready, community events) plus ActivityKit push for sessions started on another device.

**Repos.** `bookhero-ios` (local, actions, extensions); the shared repo for the push backend.

**Prerequisites.**

- Local notifications: Phase 3 (they ship with v1.0); BC-06 (local days); BC-10 (`review_lexicon_entry` with surface `notification`).
- Remote push: BC-14 `device_tokens` + `register_device_token`; a **new backend package** (not part of BC-01 … BC-15): notification preferences storage, a sender edge function with APNs credentials stored as edge-function secrets, schedules on the `pg_cron` introduced by BC-05; owner go-ahead ([OP-14.3](backend-consolidation-plan.md#bc-14--sync--realtime-readiness)).
- Decisions: [LEX-Q17](business-rules/05-codex-lexicon.md#open-decisions) (Lock Screen content; recommended: the word only when previews are allowed, otherwise a generic line; "I know this" = advance, "Still learning" = reset) · [INS-Q07](business-rules/06-insights.md#open-decisions) Insight arrival feedback · [SES-Q13](business-rules/02-reading-sessions.md#open-decisions) focus-goal notification · [PLT-Q12](business-rules/08-platform-auth-account.md#open-decisions) Realtime vs refresh.

**In scope.**

- Permission requested at the first contextual moment (first goal chip, first reminder toggle), never at cold launch.
- Preferences per category: reading reminder (time), streak nudge, review reminder, Word of the Day (time), Insight arrival; community events later.
- Local scheduling recomputed on foreground, time-zone change and day change; focus-goal notification as time-sensitive only where allowed.
- Word of the Day notification with "I know this" (advance) and "Still learning" (reset) actions through `review_lexicon_entry`, counted in the daily tally.
- Deep links from every notification to the right screen (book, review, Codex).
- Push (once the backend exists): token registration, rich notifications with a cover via a Notification Service Extension, ActivityKit push tokens for cross-device sessions.
- Sign-out removes pending local notifications and deletes the device token.

**Out of scope.** Marketing notifications; any notification whose content shows words, quotes or recap text on the Lock Screen against the LEX-Q17 decision.

**Rules to implement.** SES-83 ([02](business-rules/02-reading-sessions.md)) · LEX-36 … LEX-53 and LEX-Q17 ([05](business-rules/05-codex-lexicon.md)) · INS-Q07 ([06](business-rules/06-insights.md)) · PRO-24 (streak day; local under BC-06 — [07](business-rules/07-profile-stats-goals.md)) · PLT-14 … PLT-16, PLT-62 … PLT-66 ([08](business-rules/08-platform-auth-account.md)) · XD-41 … XD-46 ([11](business-rules/11-cross-domain.md)).

**Backend contract dependencies.** `review_lexicon_entry` (surface `notification`), `get_todays_review`, `get_reading_stats` (`p_timezone`, streaks), `register_device_token`, table `device_tokens`; future: preferences table and sender function (new package). [Plan BC-10, BC-14](backend-consolidation-plan.md#bc-14--sync--realtime-readiness), [contract §16](backend-contract.md#16-planned-changes).

**Acceptance criteria.**

| # | Criterion | Rules |
|---|---|---|
| N-01 | Notification permission is requested only at a contextual moment, never at cold launch | — |
| N-02 | A reminder fires within 1 min of its configured local time and is rescheduled after a time-zone change | PLT-62 … PLT-66, D-07 |
| N-03 | The streak nudge fires at most once per local day and never after a day with reading | PRO-24 |
| N-04 | "I know this" calls `review_lexicon_entry` with outcome `advance` and surface `notification`; "Still learning" resets; both count toward the 20/day tally | LEX-25, LEX-26, LEX-36 … LEX-43, LEX-Q17 |
| N-05 | With previews hidden, the Lock Screen shows no word, definition, quote or recap text | LEX-Q17 |
| N-06 | Turning a category off stops it within 1 min (local) or at the next send (push) | — |
| N-07 | Sign-out removes pending local notifications and deletes the device token | PLT-14 … PLT-16, XD-41 … XD-46 |
| N-08 | Every notification tap opens the right screen | — |

**Verification.** Unit tests with a fake notification centre (scheduling, rescheduling on zone and day change, action handling); UI tests for the permission moment and preferences; on device: locked-screen delivery, Focus modes, preview settings, a time-zone change; APNs sandbox once the push backend exists.

**Kickoff prompt.**

```text
ultracode

Cross-cutting — Notifications for The Chronicler iOS (code name BookHero). You are in the bookhero-ios repo. Goal: local notifications (focus-goal end, reading reminder, review reminder, streak nudge) and an interactive Word of the Day; remote push only if its backend package has landed in the BookHero repo — otherwise design it and write the backend brief for the BookHero repo, then stop.

Read first, in this order (paths are inside the read-only docs submodule bookhero/):
1. CLAUDE.md and docs/rule-coverage.md.
2. bookhero/docs/ios-phase-prompts.md — §1–§4 and "Cross-cutting — Notifications" (acceptance N-01…N-08).
3. bookhero/docs/business-rules/README.md (decisions log); 05-codex-lexicon.md LEX-24…LEX-53 and LEX-Q17; 02-reading-sessions.md SES-79…SES-83 and SES-Q13; 06-insights.md INS-Q07; 07-profile-stats-goals.md PRO-24; 08-platform-auth-account.md PLT-14…PLT-16, PLT-62…PLT-66; 11-cross-domain.md XD-41…XD-46.
4. bookhero/docs/backend-consolidation-plan.md BC-06, BC-10, BC-14; bookhero/docs/backend-contract.md §8 and §16.

Constraints (non-negotiable):
- Ask for permission only at a contextual moment; respect Focus modes and preview settings; time-sensitive only for the focus goal.
- Lock Screen privacy follows LEX-Q17: no word, definition, quote or recap text when previews are hidden.
- Actions go through review_lexicon_entry (surface notification); never compute Leitner state on the client.
- Schedules use the reader's local day (D-07) and are recomputed on foreground, time-zone change and day change.
- Sign-out removes pending notifications and the device token; every async task is bound to its user.
- iOS 26+, design system only, no secrets (APNs credentials live only in edge-function secrets), user-facing name "The Chronicler".
- bookhero/ is read-only. Stop and ask before requesting new entitlements or capabilities and before any backend work.

Workflows, in order: UNDERSTAND (scope ledger) → DESIGN (categories, scheduling model, action handling, deep links, push architecture if in scope, test plan) → IMPLEMENT (tests first: @Test("LEX-25 · notification advance …")) → ADVERSARIAL REVIEW (privacy on the Lock Screen, duplicate or missed notifications across zone and day changes, action idempotency, sign-out cleanup, accessibility) → SYNC (rule coverage, drafted catalog changes such as the LEX-Q17 resolution, report against N-01…N-08).
```
