# BookHero iOS — Design Brief

**Purpose:** the design direction for the native app. It captures the *intent* behind the PWA so the
iOS build has a north star, while explicitly licensing divergence. This is referenced by the iOS
constitution (Principle: Design-System-First) and is the answer to "I don't want the current PWA, but
it's a start."

> **The PWA is the reference, not the target.** Keep the soul (calm, frosted, indigo, reading-first).
> Rebuild the body in native iOS idioms. When the PWA and the HIG disagree, the HIG wins.

## 1. Product soul (non-negotiable — keep)

- **One job:** get a reader oriented and back into their book with minimal friction. Every screen is
  judged by whether it serves that.
- **Calm & legible in low light** — dark-first, high text contrast, generous spacing. People read at night.
- **Frosted "liquid glass" aesthetic** — translucent layered surfaces over a deep indigo gradient.
- **Indigo accent** (`#6366F1`) as the single brand color. Sparing, purposeful.
- **Two taps to the core action** — update progress / get a recap reachable fast from the home tab.
- **No clutter, no feeds-by-default** — gamification (XP/quest) is present but quiet, never nagging.

## 2. Visual language (keep, translated to native)

- **Glass → native iOS glass, used directly.** The PWA's glass CSS only *emulated* Liquid Glass; on
  device, use the real thing — `.glassEffect` (iOS 26+) or `Material` (earlier). **Don't re-emulate the
  rgba/blur recipe or wrap it in custom modifiers** (see `design-tokens.md §3`). The palette is the
  design token worth pinning down precisely; glass is a system primitive.
- **Background gradient** — the deep indigo radial gradient is core identity; reproduce it (`PageBackground`),
  may use `MeshGradient` directly (available at the iOS 18 floor).
- **Continuous corners** everywhere (`.continuous`), soft radii (20/16/6).
- **System typography + Dynamic Type** — the PWA already uses the system font; lean fully into Dynamic Type.

## 3. What to RECONSIDER for native (don't copy)

| PWA pattern | Native direction | Why |
|-------------|------------------|-----|
| Custom floating bottom nav (`AppBottomNav`) | `TabView` | System nav = free accessibility, consistency, less code |
| Custom swipe-to-reveal card (`SwipeableBookCard`) | `.swipeActions` | Native gesture users already know |
| PrimeVue dialogs | `.sheet` / `.confirmationDialog` | Native presentation, drag-to-dismiss, depth |
| Web progress slider | native `Slider` + `.sensoryFeedback` | Haptics + accessibility |
| `Toast` notifications | transient overlay + haptics | iOS has no toast convention; keep it subtle |
| Manual skeletons | `.redacted(reason: .placeholder)` + shimmer | Native idiom |
| Hover states | n/a → use press/long-press + context menus | Touch-first |
| Page max-width 680 | iPhone full-bleed (16pt insets); `NavigationSplitView` on iPad later | Respect device class |

## 4. Where iOS should pull AHEAD of the PWA

These are explicit opportunities to be *better*, not just to match:

- **Live Activity** for an active reading session (Dynamic Island + Lock Screen timer).
- **Widgets** — Currently Reading, Daily Word, page progress on the Lock Screen.
- **Haptics** — page save, milestone unlock, session end, recap-stream completion.
- **Matched-geometry** book-cover transition from library → detail.
- **On-device OCR** (VisionKit) for captures; faster, private, offline-capable.
- **Share Extension** for inline lexicon lookup from Apple Books/Kindle (the single highest-value Lexicon win).
- **Sign in with Apple** from day one.

## 5. Design principles (apply to every screen)

1. **Dark-first, legible** — verify contrast at night; never rely on color alone.
2. **Every state designed** — empty, loading, error, offline. Empty states onboard, never blank.
3. **Reach** — primary action within a thumb's reach; core actions ≤ 2 taps from a tab root.
4. **Motion with intent** — short, eased, meaningful; all gated on Reduce Motion.
5. **Compose, don't reinvent** — build from the design system; a new shared component needs a reason.
6. **Accessibility is the spec, not a pass** — Dynamic Type, VoiceOver labels, Reduce Transparency
   fallback (solid surfaces when transparency is reduced), 44pt touch targets.

## 6. Explicit non-goals for v1

- Not a pixel-port of the PWA. Visual parity is *not* a success metric — *feel* parity is.
- No webviews, no cross-platform UI frameworks.
- No community/social surfaces in v1 (backend exists; client deferred).
- No new brand exploration mid-build — if the brand evolves, update *this brief* first, then the tokens.

## 7. How this stays honest

- Changes to direction land **here first**, then propagate to `design-tokens.md` and the design system.
- Each phase runs the `design:design-critique` / `design:design-system` skills against screenshots.
- SwiftUI `#Preview` galleries + snapshot tests are the "did we hold the line?" gate.
