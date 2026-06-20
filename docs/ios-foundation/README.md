# BookHero iOS — Design Foundation

These five documents are the **design direction** for the native iOS app, extracted from the live
PWA so the iOS build starts from a real, consistent foundation rather than inventing look-and-feel
per screen. They are version-controlled here (next to the source they're derived from); **copy them
into the new `bookhero-ios` repo** when you scaffold it.

| File | What it is | Where it goes in `bookhero-ios` |
|------|------------|----------------------------------|
| [`design-tokens.md`](design-tokens.md) | Colors, glass recipes, type scale, spacing, radii, motion — extracted from `src/assets/styles/{preset.ts,glass.css,main.css}`, with SwiftUI translations | Build into `DesignSystem/Tokens/` (spec `001-ios-foundation`) |
| [`component-inventory.md`](component-inventory.md) | The ~60 PWA components grouped by feature → SwiftUI view mapping; which become shared `DesignSystem` primitives | Drives `Features/<X>/Views/` + `DesignSystem/Components/` |
| [`screen-inventory.md`](screen-inventory.md) | Routes → screens, each with empty/loading/error states | Drives the navigation graph + per-screen specs |
| [`ios-design-brief.md`](ios-design-brief.md) | The *intent* (keep vs. reconsider for native). The "a start, not a copy" guardrail | Reference doc in the iOS constitution |
| [`ios-constitution.md`](ios-constitution.md) | Drop-in replacement for the Vue/PrimeVue constitution — SwiftUI + HIG + design-system-first | `.specify/memory/constitution.md` |

## Why this exists

> Letting Spec Kit generate screens with no shared design foundation produces N inconsistent views.
> The fix: **the design system is feature #1** (`specs/001-ios-foundation`), and the constitution makes
> every later feature depend on it.

## Order of operations (see the parent `docs/ios-implementation-plan.md`)

1. Scaffold `bookhero-ios` (Xcode, SwiftUI, iOS 18+, SwiftData, `supabase-swift`).
2. `specify init` → replace the constitution with [`ios-constitution.md`](ios-constitution.md).
3. Copy these five files + `docs/backend-contract.md` into the iOS repo's `docs/`.
4. Run the full Spec Kit pipeline on **`specs/001-ios-foundation`** (the design system) FIRST.
5. Then the phased features from `docs/ios-phase-prompts.md`, each composing the design system.

> **Source provenance:** extracted 2026-06-20 from BookHero PWA `master`. The PWA is the behavioral
> reference, **not** a pixel target — see the Design Brief for what to keep vs. rethink.
