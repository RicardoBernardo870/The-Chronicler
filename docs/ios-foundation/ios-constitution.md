<!--
This is a DROP-IN replacement for `.specify/memory/constitution.md` in the new `bookhero-ios` repo.
It adapts the PWA constitution (The Chronicler v1.1.0) to native iOS:
  - Principles I–IV preserved (platform-agnostic product truths).
  - Principle V rewritten: "PWA-First" → "Native iOS-First & Frictionless Reach".
  - Principle VI rewritten: "PrimeVue-First" → "Design-System-First (SwiftUI + HIG)".
  - Technical Stack and UX sections re-pointed to SwiftUI/Apple platforms.
Version reset to 1.0.0 for the iOS lineage.
-->

# BookHero iOS Constitution

## Core Principles

### I. Memory Continuity (NON-NEGOTIABLE)

Every feature MUST serve the app's singular purpose: eliminating the cognitive friction of returning to
a book after a break. AI recaps MUST be **spoiler-free** (never reference content beyond the reader's
current page percentage), **context-aware** (scoped to exact progress), and **three-tiered** (Memory
Jogger, Concept Watchlist, Thematic Bridge).

**Rationale:** the product's value collapses if a recap spoils future plot or misjudges where the reader is.

### II. Physical-to-Digital Bridge

Physical-book readers are first-class. ISBN scanning (VisionKit) MUST resolve edition metadata (title,
author, cover, total pages, genre). Progress tracking MUST operate on absolute page numbers and derive
percentage. Manual entry MUST remain a fallback. **Library import (CSV) is a first-class on-ramp** for
readers migrating from Goodreads/StoryGraph.

### III. AI-First Recap Engine

LLM features are core, not optional. The iOS client MUST NOT move AI generation on-device: it calls the
existing Supabase Edge Functions, sends the same minimum contract (title, author, progress), renders
streaming/staged loading states, and persists only server-approved outputs. No prompts or provider keys
on device.

### IV. Data Integrity & Synchronization

Reading progress and AI insights MUST persist reliably across sessions and devices. Supabase is the
remote source of truth. Progress writes are optimistic with rollback; offline mutations queue locally
(SwiftData `SyncOperation`) and drain FIFO on reconnect. **User data must never be lost** to an app
kill, token refresh, or device switch.

### V. Native iOS-First & Frictionless Reach (NON-NEGOTIABLE)

The app MUST feel indistinguishable from a first-party Apple app.

- **SwiftUI throughout.** No webviews, no cross-platform UI frameworks. UIKit only via
  `UIViewRepresentable` for VisionKit/StoreKit where required.
- **Apple HIG compliance** is the baseline; when the PWA and the HIG disagree, the HIG wins.
- Core actions (update progress, get/review a recap) MUST be reachable within **two taps** from a tab root.
- **Offline-capable** — the core reading loop works without network.
- Lazy-load heavy/non-critical surfaces; keep cold launch fast (see Performance budgets).

**Rationale:** native is the entire reason to leave the PWA. Anything that feels "web-wrapped" is a defect.

### VI. Design-System-First (NON-NEGOTIABLE)

All UI MUST compose the shared design system; screens do not invent look-and-feel.

- The design system (tokens + reusable components) is **feature #1** (`specs/001-ios-foundation`) and is a
  dependency of every subsequent feature. It is derived from `docs/ios-foundation/design-tokens.md` and
  `component-inventory.md`, and governed by `docs/ios-foundation/ios-design-brief.md`.
- No ad-hoc colors, type sizes, spacing, radii, or one-off controls. Use the token set
  (`Color.accent`, `Typography`, `Spacing`, `Radius`) and Dynamic Type — never hard points. **Glass is a
  system primitive**, reached via the one sanctioned `.appGlass()` availability-branch helper
  (`.glassEffect` iOS 26+, `Material` below — see `design-tokens.md §3`), never a hand-rolled rgba/blur
  modifier re-creating the PWA's emulated glass.
- A new shared component is PERMITTED only when nothing in the design system fits; the reason MUST be
  recorded in the feature's `plan.md` or a comment on the component.
- Prefer native system components (`TabView`, `List`, `.sheet`, `.swipeActions`, `Slider`, `Menu`,
  `confirmationDialog`) over custom reconstructions of PWA widgets.
- Every reusable view ships with a `#Preview`; the design system ships a preview gallery + snapshot baseline.
- **Single responsibility / componentization:** views over ~150 lines SHOULD decompose; pages orchestrate
  state and layout and delegate presentation to `Features/<X>/Views/` and `DesignSystem/Components/`.
- Naming is PascalCase and domain-named (`HeroBookCard`, `BookCover`, `ReadingQuestCard`), never `Box`/`Wrapper`.

**Rationale:** a shared system is the cheapest insurance against the exact failure mode of AI-generated
UI — N screens that each look slightly different. The system makes consistency a compile-time dependency.

## Technical Stack & Integration Standards

- **UI:** SwiftUI (iOS 18+), `@Observable`, SwiftData. `MeshGradient` available at the floor; real Liquid
  Glass (`.glassEffect`) on iOS 26+ with a `Material` fallback below, via the `.appGlass()` helper.
- **Backend / BaaS:** Supabase (PostgreSQL + Auth + Realtime + Storage) — **reused as-is from the PWA**.
  No breaking schema changes; iOS additions are additive (see `docs/backend-contract.md`).
- **AI Layer:** existing Supabase Edge Functions (Gemini 2.5 Flash) — zero rewrite, server-side only.
- **Book metadata:** Google Books (primary) + Open Library (gap-fill). ISBN-prioritized; ISBN-aware search
  uses the `isbn:` operator and drops language restriction for ISBN queries.
- **Auth:** Supabase Auth + **Sign in with Apple** (App Store requirement) + email fallback; tokens in Keychain.
- **Networking:** `supabase-swift` + `URLSession` (for streaming/multipart Edge Function calls).
- **OCR/Camera:** VisionKit / AVFoundation, on-device first, `ocr-page` fallback.
- **Later:** StoreKit 2 (subscriptions), WidgetKit, ActivityKit, UserNotifications/APNS.

All third-party integrations MUST degrade gracefully. ISBN-lookup or AI failures MUST NOT block core
progress tracking.

## UX & Design Philosophy

The UI MUST remain minimalist, calm, and reading-first (see `docs/ios-foundation/ios-design-brief.md`):

- Dark-first; legible in low light; one-handed reachable.
- Liquid-glass aesthetic via native `Material`; indigo (`#6366F1`) as the single accent.
- Every state designed — empty/loading/error/offline. Empty states onboard; never a blank screen.
- Gamification (XP/quest) is present but quiet; no social feeds in v1.
- Accessibility is part of the spec: Dynamic Type, VoiceOver labels, Reduce Motion (gate matched-geometry +
  gradients), Reduce Transparency (solid-surface fallback), 44pt targets.

## Governance

This constitution supersedes other guidance for the iOS app. Amendments require: a written rationale, a
semantic version bump (MAJOR remove/redefine a principle; MINOR add/expand; PATCH clarify), an updated
amendment date, and a propagation review of `.specify/templates/` and the `docs/ios-foundation/` artifacts.

Every `plan.md` MUST include a Constitution Check gate verifying Principles I–VI before Phase 0. Any custom
UI built in lieu of a design-system or native component MUST be justified in the plan's Complexity Tracking
table or a comment on the component. Design-direction changes land in the **Design Brief** first, then the
tokens, then code.

**Version:** 1.0.0 (iOS lineage; adapted from The Chronicler PWA constitution v1.1.0) | **Ratified:** TBD on iOS repo init | **Last Amended:** 2026-06-20
