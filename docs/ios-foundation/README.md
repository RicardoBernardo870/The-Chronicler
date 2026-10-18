# The Chronicler for iOS — Design Foundation

Last updated: 2026-10-18

**The Chronicler** (internal code name **BookHero**, D-03) is getting a native iOS app: repository `bookhero-ios`, iOS 26+, iPhone first (D-04). It runs on the **same Supabase backend** as the live web PWA (D-05). This folder holds that app's **design and engineering foundation**, extracted from the PWA:

- the `CLAUDE.md` for the iOS repository ([ios-constitution.md](ios-constitution.md));
- the design intent ([ios-design-brief.md](ios-design-brief.md));
- the token values and the component and screen inventories.

The aim is that the iOS build starts from one consistent foundation and never invents its look and feel screen by screen.

> **The PWA is the behavioural reference, not a pixel target.** Keep its soul: calm, indigo, frosted, reading-first. Rebuild the body in iOS 26 idioms. Where the PWA and Apple's Human Interface Guidelines disagree, the HIG wins, unless a catalog rule marks the behaviour as a product rule.

## What this folder is — and what it is not

| Question | Where the answer lives |
|---|---|
| How must the app *behave*? (rules, limits, copy, edge cases) | [Business-rules catalog](../business-rules/README.md): numbered, stable rule IDs (`SES-24`, `REC-17`, …), plus known defects (`<PREFIX>-Dnn`) and open decisions (`<PREFIX>-Qnn`) per domain. The owner decisions log D-01 … D-17 is in its README. |
| What does the backend do *today*? | [Backend contract](../backend-contract.md) |
| What will the backend do *before the iOS build*? | [Backend consolidation plan](../backend-consolidation-plan.md): Phase 0A, work packages BC-01 … BC-15 |
| What is built in which phase, and when is a phase done? | [iOS implementation plan](../ios-implementation-plan.md) |
| What does one Claude Code session build? | [iOS phase prompts](../ios-phase-prompts.md): one ultracode kickoff brief per phase |
| How should it *look and feel*, and how do we build it? | **This folder** |

## Files

| File | What it is | Status (2026-10-18) | Role in `bookhero-ios` |
|---|---|---|---|
| [README.md](README.md) | This index: purpose, file status, order of operations | Current | — |
| [ios-constitution.md](ios-constitution.md) | Drop-in `CLAUDE.md` for the iOS repo. Covers product principles, the thin-client rule, data integrity, Liquid Glass design-system-first, accessibility, privacy and App Store compliance, multi-client parity, testing conventions, and working with Claude Code (ultracode). | **Current** (v2.0.1) | Copied to `bookhero-ios/CLAUDE.md`. There is no `.specify/` folder (D-02). |
| [ios-design-brief.md](ios-design-brief.md) | The design intent: product soul, naming, the native Liquid Glass approach, system appearance, keep vs. rethink for every current PWA surface, Dynamic Island / Live Activity for sessions, token additions, open design decisions | **Current** | Read before every UI phase. Look-and-feel changes land here first, then in the tokens, then in code. |
| [design-tokens.md](design-tokens.md) | Colour ramp, page background, text opacities, type scale, radii, spacing, motion. Extracted from `src/assets/styles/{preset.ts,glass.css,main.css}`, with SwiftUI translations. | **Current** (re-checked against the style sources; Liquid Glass mapping per D-04) | Phase 0B `DesignSystem/Tokens` (its §15 deliverable) |
| [component-inventory.md](component-inventory.md) | PWA components → SwiftUI views; which become shared design-system primitives | **Current** | Phase 0B components and the per-feature view checklist |
| [screen-inventory.md](screen-inventory.md) | PWA routes → iOS screens, each with its key states | **Current** | Navigation graph and per-screen state checklist |

### Precedence when documents disagree

1. **Owner decisions** D-01 … D-17 ([decisions log](../business-rules/README.md)).
2. **Business-rules catalog** for behaviour, and the **backend contract / consolidation plan** for backend facts.
3. **[iOS implementation plan](../ios-implementation-plan.md)** for phase scope and acceptance criteria.
4. **[ios-constitution.md](ios-constitution.md)** for how the app is built.
5. **[ios-design-brief.md](ios-design-brief.md)**, then **[design-tokens.md](design-tokens.md)**, then the two inventories, for look and feel.

All six files were rewritten on 2026-10-18 for D-02 and D-04. Any remaining mention of an **iOS 18 floor**, a `Material` fallback, the `.appGlass()` availability helper, Spec Kit steps, a `.specify/` folder or Spec Kit spec folders is a defect: D-02 and D-04 win. No such spec folders were ever created.

### What changed on 2026-10-18

`design-tokens.md`, `component-inventory.md` and `screen-inventory.md` were re-verified against web `master` @ `8d8701c` and rewritten. Each records its own changes: [design-tokens.md §14](design-tokens.md#14-changes-since-the-previous-version-2026-06-20-inventories-updated-2026-07-11), [component-inventory.md §3](component-inventory.md#3-removed-renamed-and-dead-since-2026-06-20) and [screen-inventory.md §7](screen-inventory.md#7-what-changed-since-the-previous-version-2026-07-11). The main corrections:

- iOS **26.0** minimum; `.glassEffect` / `GlassEffectContainer` directly, with no fallback branch and no glass helper (D-04). The token deliverable belongs to **Phase 0B**, not a Spec Kit spec folder (D-02).
- Light-mode accent text is `#4338CA`; semantic colours have AA light variants; the Focus-mode palette, opaque overlays and the glass-toast pill are recorded (tokens §1, §4–§7).
- Appearance: the web is dark by default with no "System" mode ([PLT-40](../business-rules/08-platform-auth-account.md#plt-40--two-themes-dark-by-default-no-system-mode)); the native default is open decision PLT-Q06 (recommendation: System).
- Components: 79 `.vue` files under `src/components/`, 75 of them live (dead: `HelloWorld.vue`, `capture/CaptureVerifyView.vue`, `recap/CompletedRecapImageCarousel.vue`, `recap/CompletedRecapImageSlide.vue`); 16 routed product screens (including the 404) plus one dead page (`LexiconPage.vue`). `RecapStream.vue` is gone: the recap sheet shows the persisted row ([REC-55](../business-rules/03-recaps.md#rec-55--the-modal-shows-the-persisted-row-never-the-stream)) and, on iOS, staged progress (BC-07).
- Navigation: tabs **Home · Library · Codex · Profile**; the PWA's "More" sheet becomes a `+` toolbar action and a Settings screen pushed from Profile; **TrophyRoomView** and **ReadingStatsView** are two screens; `/library/dnf` → **DnfListView**.
- There is **no progress slider**: page entry is the page sheet with a stepper and number pad ([SES-24](../business-rules/02-reading-sessions.md#ses-24--page-validation-in-the-sheet)).
- Sign in with Apple is decided scope (D-11); OCR is Apple Vision with the `ocr-page` fallback and recalibrated thresholds (D-15, CAP-Q07); profile edit is username + display name + avatar only (D-13).

## Order of operations (no Spec Kit, D-02)

The app is built with **Claude Code using Opus 5.5 in ultracode mode**. There is no Spec Kit initialisation, no `.specify/` folder, no Spec Kit command and no generated spec, plan or task files.

| # | Step | Done when |
|---|---|---|
| 1 | **Scaffold `bookhero-ios`.** Xcode 26, SwiftUI app target, deployment target **iOS 26.0**, iPhone only, portrait. Swift 6 language mode with complete strict concurrency. SwiftData. `supabase-swift` via SPM. Use the package layout of [plan §5](../ios-implementation-plan.md#5-project-structure): `ChroniclerCore`, `BackendKit`, `Persistence`, `DesignSystem`. Display name "The Chronicler" (D-03); repo and identifiers may use the code name. | The empty app builds and launches on an iOS 26 simulator |
| 2 | **Create `CLAUDE.md` from [ios-constitution.md](ios-constitution.md).** Copy the file to `bookhero-ios/CLAUDE.md`, fill in the *Docs root* and *Commands* placeholders, and keep the version line. With a submodule (step 3), `CLAUDE.md` can instead be a short file that keeps the repo-specific sections and imports the canonical text with Claude Code's `@path` import. | `CLAUDE.md` is committed at the repo root; no `.specify/` exists |
| 3 | **Make the canonical docs reachable.** The web repo stays the only place where they are edited. Pick one option (below). | `docs/business-rules/`, `docs/backend-contract.md`, `docs/backend-consolidation-plan.md` and every `docs/ios-*` file open from the iOS repo at a known web-repo commit |
| 4 | **Check Phase 0A (backend consolidation, web repo).** **Hard minimum: BC-01 (security hardening) and BC-02 (edge-function auth)**, with the BC-03 baseline, before any iOS build signs in against the shared backend. Phase 1 starts only when Waves 1–3 (BC-01 … BC-10) are done. External TestFlight needs Wave 4 (BC-11 … BC-15). See [plan §7 Phase 0A](../ios-implementation-plan.md#phase-0a--backend-consolidation-shared-prerequisite). | The Phase 0A status table in the plan says so |
| 5 | **Phase 0B — design system first.** This is the first ultracode session in `bookhero-ios`: tokens, Liquid Glass usage, components, preview gallery, snapshot baseline, then the app shell (auth gate → four-tab `TabView`, typed routes, Settings scaffold), the BackendKit and persistence skeletons, and CI. Work that uses only fixtures can run while Phase 0A is still in progress. | Plan Phase 0B acceptance criteria 0B-1 … 0B-5 pass and the owner has reviewed the gallery on a device |
| 6 | **Phases 1 → 6** per [ios-phase-prompts.md](../ios-phase-prompts.md). One kickoff brief per phase, one Claude Code session per brief, worked in vertical slices with tests named by rule ID. Follow the working loop in [plan §9.3](../ios-implementation-plan.md#93-working-loop-per-phase). | Each phase's acceptance criteria are green and its exit gate is met |

**Step 3 options — making the docs reachable**

| Option | How | Trade-off |
|---|---|---|
| **Git submodule** (recommended; [phase prompts §3.2](../ios-phase-prompts.md#32-how-the-ios-repo-reaches-them--recommendation-a-git-submodule), [plan §9.4](../ios-implementation-plan.md#94-keeping-the-ios-repos-docs-in-sync)) | `git submodule add -b master <web-repo-url> bookhero`. *Docs root* = `bookhero/docs`. | Pinned to a commit, visible to cloud sessions, worktrees and CI. Bump the pointer when a BC package lands or the catalog changes. The web repo becomes private (D-16), so CI needs read access. The kickoff prompts assume this path. |
| **Sibling checkout** (local work only) | Clone the web repo next to the iOS repo (`../BookHero`). *Docs root* = `../BookHero/docs`. | Always current, but invisible to cloud sessions and CI. Pin by recording the web commit in `SOURCE_COMMIT` whenever a phase starts; replace `bookhero/` with `../BookHero/` in the prompts. |
| **Vendored snapshot** | Copy the docs into `bookhero-ios/docs/`, plus a `SOURCE_COMMIT` file. | No cross-repo access needed. Must be refreshed manually and never edited in place. |

Whichever option is chosen, `CLAUDE.md` names the docs root. Rules are never edited in the iOS repo. A missing or wrong rule is fixed in the web repo's catalog first.

## Provenance

- First extracted **2026-06-20** from the PWA `master`, with inventories updated 2026-07-12.
- **Re-verified 2026-10-18** against web `master` @ `8d8701c` (PWA v3.9.1) and the live Supabase project `zlndhygpqacygceivuvk`. That pass covered the style sources (`src/assets/styles/preset.ts`, `glass.css`, `main.css`), the component and page inventory, the user-facing names and the session surfaces. It drew on the business-rules audit of the same day.
- All six files were rewritten on 2026-10-18 to apply the owner decisions of that day. Each extracted file records its own changes (see *What changed on 2026-10-18* above).
