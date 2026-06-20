# Design Tokens — extracted from the PWA

Source of truth in the PWA: `src/assets/styles/preset.ts` (PrimeVue "Liquid Glass" preset extending
Lara Dark), `src/assets/styles/glass.css` (glass utilities), `src/assets/styles/main.css` (page
background, type, layout). Below is the distilled token set with a SwiftUI translation for each.

> **The palette is the part that matters here — and it's well-defined.** The glass/blur values are
> emulation artifacts (see §3): on native iOS you use the system glass effect directly, so don't port
> them. What's worth pinning down precisely is the **color system** (§1, §2, §4) and the type/spacing/radii
> scales. Build the color tokens into `DesignSystem/Tokens/` as the first foundation task.

## 1. Brand / accent

| Token | Value | SwiftUI |
|-------|-------|---------|
| Accent (primary) | **indigo** ramp; primary-500 = `#6366F1` (`rgb 99,102,241`) | `Color.accent` asset = `#6366F1`; use as `.tint(.accent)` app-wide |
| Accent (text/icon) | primary-300 `#A5B4FC` (dark), primary-600 `#4F46E5` (light) | `Color("AccentText")` light/dark variants in asset catalog |
| Accent fills | `rgba(99,102,241, 0.12–0.22)` for chips/active pills | `Color.accent.opacity(0.12...0.22)` |

Provide the full indigo ramp (50–950) as named colors so badges/borders match the PWA.

## 2. Page background (dark-first)

Dark (`main.css`): two radial gradients over a near-black base.
```
radial(ellipse at 20% 20%, #1a1040 → transparent 60%)
radial(ellipse at 80% 80%, #0d1a3a → transparent 60%)
base #0a0a14
```
Light: `#e8e0f8` / `#dce8f8` over `#f0f4ff`.

**SwiftUI:** a reusable `PageBackground` view — `ZStack` of two `RadialGradient`s over a base color,
ignoring safe area. `MeshGradient` is available at the iOS 18 floor, so you may use it directly for a
richer gradient (no fallback branch needed). Dark is the default; light mode swaps the three colors.

## 3. Surfaces — use native glass directly, don't re-emulate

The PWA's `glass-*` CSS exists **only to fake iOS Liquid Glass in a browser**. On device you have the
real material system, so **do not port the rgba/blur recipes and do not wrap them in custom
`.glassCard()`/`.glassElevated()` modifiers** — that's re-emulating an emulation. Reach for the system glass:

- **iOS 26+ (Liquid Glass):** `.glassEffect(in: .rect(cornerRadius: 20, style: .continuous))`, with
  `GlassEffectContainer` when grouping several glass elements. This *is* the effect the PWA was approximating.
- **iOS 18–25 fallback:** `Material` — `.ultraThinMaterial` (cards), `.regularMaterial` (sheets/elevated),
  `.thinMaterial` (subtle/list items), clipped to a `.continuous` rounded rectangle.
- **Opaque overlays** (menus, dialogs, dropdowns): keep opaque — native `.sheet`/`Menu`/`.alert` are
  already correct. Don't put glass behind text-dense popovers.

The only things that carry over from the PWA are the **role → weight mapping** (cards lighter than
sheets; list items lightest), the **corner radii**, and the **tint** — never the literal blur/rgba values.

> **Resolved: support both, via availability branching — not a deployment-target tradeoff.** Minimum
> Deployments is **iOS 18.0** (same device reach as 17 — iPhone XS/XR and later — but fewer fallback
> branches; only drops the small group still on 17). Every glass call site branches with
> `if #available(iOS 26.0, *)`: real `.glassEffect(in:)` on 26+, `Material` below. Both branches are
> native system primitives — this is not re-emulation, it's progressive enhancement. Wrap it once as a
> `View` extension (e.g. `.appGlass(cornerRadius:)`) so call sites stay clean and nobody hand-rolls the
> branch per screen. Build this wrapper in `specs/001-ios-foundation`; it is the **one** allowed
> "glass helper" — its existence is justified by the availability branch, not by re-creating the rgba/blur
> recipe.

## 4. Text

| Token | Dark | Light |
|-------|------|-------|
| Primary text | `white 0.90` | `#0F0F1E 0.90` |
| Muted text | `white 0.55` | `#0F0F1E 0.55` |
| On-accent | `#ffffff` | `#ffffff` |

**SwiftUI:** `Color.primaryText` / `Color.mutedText` asset pairs; on glass, prefer
`.foregroundStyle(.primary)` / `.secondary` which already adapt.

## 5. Typography

Font: system (`-apple-system` / SF Pro) — **already native**, so just use the system font + Dynamic Type.

| Role | PWA | SwiftUI (Dynamic Type) |
|------|-----|------------------------|
| Page title | 1.75rem / 700 / `-0.03em` | `.largeTitle.bold()` (tracking `-0.5`) |
| Heading (h1–h6) | 600 / `-0.02em` / lh 1.2 | `.title`/`.title2`/`.headline` semibold, tracking `-0.3` |
| Section label | 0.75rem / 600 / UPPERCASE / `+0.06em` / opacity 0.70 | `.caption.weight(.semibold)` + `.textCase(.uppercase)` + `.tracking(1)` + `.secondary` |
| Body | 1rem / lh 1.5 | `.body` |
| Caption/meta | ~0.7–0.8rem / opacity 0.55 | `.caption` / `.caption2` + `.secondary` |

**Always Dynamic Type** — never hard-point sizes (constitution requirement).

## 6. Radii

| Token | Value | SwiftUI |
|-------|-------|---------|
| Card | 20 | `RoundedRectangle(cornerRadius: 20, style: .continuous)` |
| Subtle / inner | 16 | `…cornerRadius: 16` |
| Book cover | 6 | `…cornerRadius: 6` |
| Pill / track / badge | 999 | `Capsule()` |

Use `.continuous` corner style everywhere — it matches iOS squircles and the PWA's soft radii.

## 7. Spacing & layout

| Token | Value | SwiftUI |
|-------|-------|---------|
| Base rhythm | 0.5 / 0.75 / 1 / 1.25 rem (8/12/16/20 pt) | `Spacing.xs/sm/md/lg` constants (8/12/16/20) |
| Content max width | 680 px | cap content width on iPad; iPhone is full-bleed with 16pt insets |
| Page horizontal padding | 1rem (16pt) | `.padding(.horizontal, 16)` |
| Bottom safe clearance | `6rem + safe-area` (for floating nav) | native `TabView` handles this — no manual clearance |

## 8. Motion

| Token | PWA | SwiftUI |
|-------|-----|---------|
| Standard transition | 0.15–0.22s ease | `.easeInOut(duration: 0.2)` |
| Streaming shimmer | 1.6s linear loop | `.linear(duration: 1.6).repeatForever` on a gradient mask, or a `.redacted` shimmer |
| Reduce Motion | — | gate `matchedGeometryEffect` + gradients on `@Environment(\.accessibilityReduceMotion)` |

## 9. Component recipes to bake in (from PWA usage)

- **Progress track**: `Capsule().fill(.white.opacity(0.08))` with an indigo→violet gradient fill
  (`linear-gradient(90deg, indigo-400, violet-400 #a78bfa)`).
- **Genre/Imported chip**: capsule, `Color.accent.opacity(0.15)` bg, `caption` uppercase accent text.
- **Book cover**: aspect ~2:3, radius 6, subtle drop shadow; initials-on-gradient placeholder
  (`linear-gradient(135deg, indigo .3, violet .2)`) when no cover.

## Deliverable for `specs/001-ios-foundation`

`DesignSystem/Tokens/` files: `Color+Tokens.swift` (asset catalog + indigo ramp + text/surface roles),
`PageBackground.swift`, `Typography.swift`, `Spacing.swift`, `Radius.swift`, `Motion.swift` — each with a
`#Preview` and a snapshot baseline.

**One glass helper, not a glass system.** `GlassEffect.swift` — a single `View` extension
(`.appGlass(cornerRadius:)`) that branches `if #available(iOS 26.0, *)` between real `.glassEffect(in:)`
and `Material`. That's the only wrapper; it exists to express the availability branch once, not to
re-create the PWA's rgba/blur recipe. The color palette is still the priority artifact.
