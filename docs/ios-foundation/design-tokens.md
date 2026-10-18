# Design Tokens — extracted from the PWA, mapped to SwiftUI (iOS 26)

Last updated: 2026-10-18

**Source:** web `master` @ `8d8701c` (PWA v3.9.1):

- `src/assets/styles/preset.ts` — PrimeVue preset extending **Lara**, `primary` = indigo;
- `src/assets/styles/glass.css` — glass utilities;
- `src/assets/styles/main.css` — page background, base type, overlay overrides (the only global stylesheet; `src/style.css` is an unused Vite scaffold);
- component-level `<style scoped>` blocks (Focus mode, toasts, chips, cards, charts) and the Lara primitives in `@primeuix/themes` 2.0.3.

**Values are what the browser renders**, not the fallbacks written in the source. For example, `var(--p-border-radius-xl, 16px)` resolves to Lara's **12 px**, and `var(--p-primary-color)` resolves to **indigo-400** in dark mode.

**On iOS (D-04):** iOS 26 is the minimum. Native Liquid Glass (`.glassEffect`, `GlassEffectContainer`, glass button styles) **is** the glass implementation; there is no `Material` fallback and no availability helper. The palette, type, spacing, radii and motion below become `DesignSystem/Tokens/` in Phase 0B. The PWA's rgba + blur recipes are documented only so the intent is clear; they are **not** ported ([constitution §7][constitution]). Design intent and open look-and-feel choices live in the [design brief][brief].

---

## 1. Brand & accent

| Role | PWA value | Where it is used | SwiftUI token |
|---|---|---|---|
| Brand tint | indigo-500 `#6366F1` (`rgb 99,102,241`) | `primary` ramp root; rgba tints throughout | `Color.accent` (asset), `.tint(.accent)` app-wide |
| Interactive fill (`--p-primary-color`) | **dark: indigo-400 `#818CF8`**; light: indigo-500 `#6366F1` (Lara semantic `primary.color`) | Primary buttons (white label), ring strokes, End Session, Focus End | `accentStrong` for prominent controls — see the contrast note below |
| Hover / active (Lara) | dark: indigo-300 / indigo-200; light: indigo-600 / indigo-700 | Web hover states | Not needed (no hover on iOS) |
| Accent text & icons, dark | indigo-300 `#A5B4FC` (111 uses). About 45 of them, in 21 files (session timer, genre chips, WotD, page sheet, capture prompt, Library cards, charts…), have **no light-mode override**, so light mode shows indigo-300 on `#F0F4FF` at 1.81:1 | Timers, percentages, chips, badges, section icons | `accentText` — one adaptive asset (dark `#A5B4FC`, light `#4338CA`); never a fixed dark value |
| Accent text, light | **Two values in use:** indigo-600 `#4F46E5` (greeting, Up Next, library badges, Book Lengths, review page, tab menu) and primary-700 `#4338CA` (Focus mode, Memory Check, Session Resume, recap sheet and card, hero, progress panel) | — | `accentText` (light) = **`#4338CA`** (7.18:1 on the light page, 6.23:1 on a 12 % accent fill) |
| Active tab | Bottom nav: indigo-400 in both schemes (inactive items at 50 % opacity). Codex tab menu: primary-300 (dark) / primary-600 (light) on an accent .20 / .13 pill | Bottom nav, Codex tabs | System tab bar and segmented control use `.accent` |
| Accent fills | `rgba(99,102,241, α)` with α .06 (subtle) · .12 (chip, hover, timer card) · .15 (genre chip, badge) · .18 (soft button, recap range) · .20 (active pill) · .22 (count badge) · .24 (soft-button hover) | Chips, badges, soft buttons, timer card | `accentFill(.subtle / .chip / .soft / .strong)` = `accent.opacity(0.06 / 0.12 / 0.18 / 0.22)` |
| Accent border | `rgba(99,102,241, .25–.5)` | Timer card .3, active goal chip .7, dashed goal chip .4 | `accentStroke` = `accent.opacity(0.3)` |
| On-accent | `#FFFFFF` (Lara `contrastColor` forced white in both schemes, button label forced white) | Primary button labels | `.white` |

**Full ramp (Lara indigo):** 50 `#EEF2FF` · 100 `#E0E7FF` · 200 `#C7D2FE` · 300 `#A5B4FC` · 400 `#818CF8` · 500 `#6366F1` · 600 `#4F46E5` · 700 `#4338CA` · 800 `#3730A3` · 900 `#312E81` · 950 `#1E1B4B`. Ship it as named colours so badges and charts can match. Secondary hue **violet** (queue, gradients, Insight pulse): 300 `#C4B5FD` · 400 `#A78BFA` · 500 `#8B5CF6` · 600 `#7C3AED`.

**Contrast note.** White on the dark-mode primary fill `#818CF8` is **2.98:1** and fails WCAG AA; white on `#6366F1` is 4.47:1, just under 4.5. Recommendation for Phase 0B: tint prominent buttons with **`accentStrong` = indigo-600 `#4F46E5`** (6.29:1 with white) in both schemes, and keep `#6366F1` as the app tint for icons, links and selection. Confirm in the gallery.

---

## 2. Page background & appearance

| | Dark (web default) | Light |
|---|---|---|
| Base | `#0A0A14` | `#F0F4FF` |
| Glow 1 | radial ellipse at 20 % / 20 %: `#1A1040` → transparent at 60 % | `#E8E0F8` |
| Glow 2 | radial ellipse at 80 % / 80 %: `#0D1A3A` → transparent at 60 % | `#DCE8F8` |
| Body text | `rgba(255,255,255,.90)` | `rgba(15,15,30,.90)` |
| Browser chrome (`theme-color`) | `#0A0A14` | `#F0F4FF` |

The gradient sits on `<html>` so it fills behind the notch; content is pushed below `safe-area-inset-top`.

**SwiftUI.** `PageBackground`: a `ZStack` of two `RadialGradient`s over the base colour, `.ignoresSafeArea()`, behind every screen. `MeshGradient` may replace it for a richer field (available on iOS 26). No fallback branch.

**Appearance.** The web has two themes, **dark by default**, a manual toggle persisted per device (`bookhero_theme`), and never reads the system setting ([PLT-40][PLT]). iOS: Settings → Appearance **System · Light · Dark**, with System as the default for new installs (PLT-Q06 recommendation; applied with `.preferredColorScheme` at the root). Artwork stays dark-first; light mode is first-class.

---

## 3. Text

| Token | Dark | Light | Notes |
|---|---|---|---|
| Primary text | `rgba(255,255,255,.90)` ≈ `#E7E7E8` on the base | `rgba(15,15,30,.90)` ≈ `#252634` | Lara `text.color` |
| Hover text | `.95` | `.95` | Web only |
| Muted text | `rgba(255,255,255,.55)` ≈ `#919195` (6.27:1) | `rgba(15,15,30,.55)` ≈ `#747683` (**4.09:1 — fails AA** on the light page) | Lara `text.mutedColor` |
| Hover muted | `.70` | `.70` | Web only |
| Placeholder | `.35` | `.38` | Form fields |
| Disabled | `.35` | `.35` | Form fields |
| Content opacity steps used inline | .4 · .45 · .5 · .55 · .6 · .65 · .75 · .85 · .9 | same | Section labels sit at .65 |

**SwiftUI.** Prefer hierarchical styles (`.foregroundStyle(.primary / .secondary / .tertiary)`) on tokened surfaces. Where a fixed colour is needed: `textPrimary` and `textSecondary` asset colours. Light `textSecondary` uses **≥ .62** opacity (5.16:1) instead of .55. Every token gets an Increase Contrast variant.

---

## 4. Semantic colours

| Role | PWA value (dark) | Where | iOS dark | iOS light (AA on `#F0F4FF`) |
|---|---|---|---|---|
| Success | green-400 `#4ADE80` | Glass-toast check, scanner "Barcode detected!", import done, username available, review "Knew it", Memory Check correct | `#4ADE80` | green-700 `#15803D` (4.56:1) |
| Success (alt) | emerald-400 `#34D399` | WotD "done" icon; Memory Check fallback value | fold into Success | — |
| Warning | amber-400 `#FBBF24` | Glass-toast warning, "Set page count", Culture badge, quote badge | `#FBBF24` | amber-700 `#B45309` (4.56:1); the web keeps amber-400 in light (1.52:1) |
| Danger | red-400 `#F87171` | Errors, stop (cancel session) icon, "Cancel session — no progress saved", review "Didn't know", Memory Check wrong, recap error icon, form errors | `#F87171` | red-700 `#B91C1C` (5.88:1); the web keeps red-400 (2.51:1) |
| Caution | orange-400 `#FB923C` | Character counters near their limit (note ≤ 10 left, capture ≤ 200 left) | `#FB923C` | orange-700 `#C2410C` (4.71:1) |
| Info | accent | Info messages, quest "on track" | `accent` | `accentText` |
| Open thread / byline | emerald-300 `#6EE7B7` | Recap byline "From your captures …" | `#6EE7B7` | emerald-700 `#047857` (the web uses emerald-600 `#059669`, 3.77:1) |
| Success fill | `rgba(52,211,153,.14)` + border `.6` | Memory Check correct option | `success.opacity(0.14)` | same |
| Danger fill | `rgba(248,113,113,.12)` + border `.6` | Memory Check wrong option | `danger.opacity(0.12)` | same |

Colour is never the only signal: pair each with an SF Symbol (checkmark, exclamationmark.triangle, xmark).

---

## 5. Surfaces & Liquid Glass

### 5.1 What the PWA does (reference only — do not port the recipes)

| PWA surface | Recipe | Used by |
|---|---|---|
| `.glass-surface` | `rgba(18,18,28,.50)` + `blur(20px) brightness(1.08) saturate(1.6)`, border `1px rgba(255,255,255,.12)`, radius 20, shadow `0 8px 32px rgba(0,0,0,.35)` + inset highlight; light `rgba(255,255,255,.55)`, border `.60`, shadow `.12` | 47 component/page files: cards, panels, hero, nav, toasts |
| `.glass-subtle` | `rgba(255,255,255,.04)` + `blur(8px) brightness(1.04)`, border `.06`, radius 16; light `.08` fill, border `rgba(0,0,0,.17)` | 12 files: stat tiles, pills, list items, empty states |
| `.glass-elevated` | `rgba(28,28,42,.65)` + blur 30 | **Unused** |
| `.glass-track` | `rgba(255,255,255,.08)`, radius 999 | Progress tracks |
| `.glass-shimmer` | gradient sweep 1.6 s | **Unused** (components use PrimeVue `Skeleton` and their own shimmer) |
| Opaque overlays | Menus, dialogs, confirm dialogs, select popups forced opaque: dark `#1C1C2E`, border `rgba(255,255,255,.10)`, shadow `0 16px 48px rgba(0,0,0,.60)`; light `#FFFFFF`, border `rgba(0,0,0,.10)` | Every PrimeVue overlay |
| Dialog mask (Lara) | dark `rgba(0,0,0,.6)`, light `rgba(0,0,0,.4)` | Behind dialogs |
| Bottom nav | `rgba(18,18,28,.74)` glass, radius 18, height 64, floating 12 px from the edges | `AppBottomNav` |
| Sticky headers | blur 14 px | Library search bar, list tabs, grid section headers |
| Content / form tokens (Lara overrides) | content `rgba(18,18,28,.55)` / light `rgba(255,255,255,.65)`; borders `rgba(255,255,255,.10)` / `rgba(0,0,0,.08)`; fields `rgba(255,255,255,.08)` / `.75`, field border `.18` / `rgba(0,0,0,.15)`, focus border indigo-400 / indigo-500 | Inputs, panels |

### 5.2 iOS mapping (D-04)

| Layer | iOS | Tokens |
|---|---|---|
| Tab bar, navigation bars, toolbars, sheets, menus, alerts, confirmation dialogs | **System Liquid Glass** — free; never restyle | — |
| Floating controls: toast banner, Insight-generation capsule, floating actions, control chips | `.glassEffect(.regular, in: .capsule)` (`.interactive()` when tappable; `.tint(.accent)` only for one primary action); group neighbours in `GlassEffectContainer`; morph with `.glassEffectID(_:in:)` | — |
| Buttons | `.buttonStyle(.glassProminent)` tinted `accentStrong` (primary) · `.buttonStyle(.glass)` (secondary) · `.borderless` (tertiary links) · `role: .destructive` | §1 |
| Running-session accessory | `.tabViewBottomAccessory` (system glass) | — |
| **Content cards** (hero, book rows, stats, recap story, Codex cards, empty states) | **Not glass.** Tokened surface: `RoundedRectangle(cornerRadius: Radius.card, style: .continuous)` fill + hairline stroke | `surfaceCard` dark `#161620` (white 5 % over the base), stroke `#23232C` (white 10 %); light `#FFFFFF` at .7 over the base ≈ `#FAFBFF`, stroke black 8 % ≈ `#DDE0EB` |
| Subtle tiles (stat tiles, pills, list items) | Same, lighter | `surfaceSubtle` dark `#14141D` (white 4 %), stroke white 6 %; light white .55 ≈ `#F8FAFF`, stroke black 8 % |
| Tracks (progress, chart backgrounds) | Capsule fill | `surfaceTrack` dark white 8 % ≈ `#1E1E27`; light black 6 % |
| Text-dense overlays that are not system sheets (capture review, Focus mode) | Opaque | `surfaceElevated` dark `#1C1C2E`; light `#FFFFFF` |
| Reduce Transparency | System glass adapts automatically. Custom glass reads `@Environment(\.accessibilityReduceTransparency)` and swaps to `surfaceElevated` | — |
| Increase Contrast | `@Environment(\.colorSchemeContrast) == .increased` → strokes at 2× opacity, `textSecondary` → `textPrimary` | High-contrast asset variants |

**Forbidden:** `Material` as a glass stand-in; re-creating the rgba/blur recipes; an `.appGlass()`-style availability helper; glass on glass; glass behind text-dense content.

---

## 6. Focus-mode palette

From `src/components/session/FocusModeOverlay.vue`. Focus mode is a full-screen cover; on iOS its surface is **opaque**, not glass.

| Element | Dark | Light | iOS |
|---|---|---|---|
| Background | `radial-gradient(120% 90% at 50% 0%, rgba(99,102,241,.16), transparent 60%)` over `rgba(11,13,22,.93)` + blur 24 (≈ `#0B0D16`) | same gradient at `.12` over `rgba(246,247,251,.93)` (≈ `#F6F7FB`) | `focusBackground` `#0B0D16` / `#F6F7FB` + `RadialGradient` (accent .16 / .12) from the top centre |
| Cover | 2:3, `min(38vw, 150px)` wide, radius 12, shadow `0 12px 32px rgba(0,0,0,.45)`; empty cover = accent .14 fill + indigo-300 book glyph | same; glyph `#4338CA` | `BookCover(.focus)` |
| Title / author | 1.15 rem / 700, 2-line clamp · 0.82 rem at .6 | same | `.title3.bold()` · `.subheadline` secondary |
| Timer | 3.4 rem (54 px) / 800, tabular, indigo-300; paused at .55 opacity | `#4338CA` | `.system(size: 54, weight: .heavy, design: .rounded)` scaled with `@ScaledMetric(relativeTo: .largeTitle)`, `.monospacedDigit()`, `accentText` |
| Elapsed under a goal | 0.78 rem, tabular, .45 | same | `.footnote.monospacedDigit()` tertiary |
| Status | 0.72 rem / 600, uppercase, +0.08 em, .5; "Time's up" at full opacity in indigo-300 | `#4338CA` | `.caption.weight(.semibold)` uppercase |
| Goal chips | Capsule, 1 px **dashed** `rgba(99,102,241,.4)`, text indigo-300, 0.78 rem / 600; hover fill .12; active: **solid** border `.7` + fill `.2` | text `#4338CA` | `Chip` variant `.goal(selected:)`; selection also announced to VoiceOver |
| Pause button | 48 pt circle, outlined | same | `.buttonStyle(.glass)` circle |
| End Session | Fill `--p-primary-color`, white, radius 8, weight 700; at time-up a 1.6 s pulse ring `0 → 6px rgba(99,102,241,.35)` | same | `.glassProminent` tinted `accentStrong`; pulse via `.symbolEffect` or a scale/glow loop (off under Reduce Motion) |
| Dim layer | `rgba(0,0,0,.94)` over everything; timer 2.6 rem / 700 at `rgba(178,183,250,.6)`; hint "tap to wake" 0.66 rem / 600, uppercase, +0.12 em, `rgba(255,255,255,.16)` (1.44:1, decorative) | same (dim is always dark) | Real brightness dimming via the window scene's screen (SES-Q13), keeping a black overlay to swallow the wake tap; fade in 1.2 s, wake 0.15 s |

---

## 7. Component palettes & gradients

| Item | Value | iOS |
|---|---|---|
| Progress fill | `linear-gradient(90deg, indigo-400 #818CF8, violet-400 #A78BFA)` on the track; PrimeVue `ProgressBar` elsewhere uses the flat primary colour | `progressFill` gradient for all tracks |
| Cover placeholder | `linear-gradient(135deg, rgba(99,102,241,.3), rgba(139,92,246,.2))` + initials 1.2 rem / 700 | `coverPlaceholder` gradient |
| "New Lore" chip | `linear-gradient(135deg, rgba(99,102,241,.85), rgba(167,139,250,.85))`, white text, 0.65 rem | `newInsightChip` gradient |
| Now-reading panel tint | `linear-gradient(135deg, rgba(99,102,241,.08), rgba(167,139,250,.04))`; hover .14 / .08 | `nowReadingTint` |
| Section accent bars (3×14, radius 2) | Reading: indigo-500 + glow `0 0 6px rgba(99,102,241,.7)` · Queue: violet-400 · Completed/DNF: white .2 | `sectionAccent(.reading / .queue / .archive)` |
| Count badges | Reading: fill accent .22, text indigo-300, border .25 (light: fill .10, text indigo-600) · Queue: violet .18 / violet-300 / border .22 (light: violet .12 / violet-600) · Archive: white .07 / white .40 / border .10 | `Chip(.count(kind))` |
| Pill tabs | Track white .05; active pill `rgba(18,18,36,.88)` + shadow (light: white .9); active count accent .22 | System segmented `Picker` |
| Completed grid | opacity .65 + saturate .7 | `.opacity(0.65).saturation(0.7)` |
| Insight type badges | History accent .18 / indigo-400 · Culture amber .18 / amber-400 · Geography emerald .18 / emerald-400 · Technology cyan .18 / cyan-400 (`#22D3EE`) · Lore violet .18 / violet-400 | `Chip(.insightType)`; light variants use the -700 shades |
| Codex entry badges | Dictionary teal fill `rgba(20,184,166,.15)` / `#2DD4BF` · Quote (labelled "Lore" today, LEX-D27) amber .15 / `#FBBF24` · Mastered accent .15 / indigo-300 | `Chip(.entryType)`, `Chip(.mastered)` |
| Genre chart palette | `#6366F1`, `#A78BFA`, `#818CF8`, `#C4B5FD`, `#4F46E5` (cycled) | `chartGenre[0…4]` |
| Reading Journey button | `linear-gradient(135deg, #34D399, #A78BFA)` | `journeyGradient` |
| Passport accents | header `linear-gradient(135deg, #34D399 0%, #A78BFA 50%, #FBBF24 100%)`; tiles/rule `#34D399 → #FBBF24` | `passportGradient` |
| Recap image placeholder | `linear-gradient(135deg, rgba(99,102,241,.18), rgba(16,185,129,.14))` | `recapPlaceholder` |
| Image caption scrim | `linear-gradient(to top, rgba(6,4,24,.82), transparent)`; grid title scrim `rgba(10,10,20,.85) → transparent` | `captionScrim` |
| Camera controls | black background; bottom gradient `transparent → rgba(0,0,0,.72)`; buttons white .14 / .22 + blur 16 | System camera UI |
| Capture review | `linear-gradient(180deg, rgba(10,10,14,.98), rgba(18,18,25,.98))` | `surfaceElevated` |
| Glass toast | Top-centre capsule, `safe-area-top + 0.85rem`, padding 12×21, shadow `0 6px 24px rgba(0,0,0,.18)`, max width `100vw − 2rem`; icon 1.35 rem (success green-400, warning amber-400, loading indigo-300 spinner); summary 0.9 rem / 600; detail 0.78 rem at .65, one line | `ToastBanner` (glass capsule) |
| Insight banner | Same position (z-index just below the toast — the two can overlap); violet-400 dot with a 1.6 s pulse ring `rgba(167,139,250,.55)`; label 0.78 rem / 600; book 0.7 rem at .6 | `ToastBanner(.generating)` — one queue, never overlapping |
| Shadows in use | cards `0 8px 32px rgba(0,0,0,.35)`; covers `0 2px 10px rgba(0,0,0,.3)` / hero `0 4px 20px rgba(0,0,0,.35)`; accent glow `0 4px 20px rgba(99,102,241,.08–.12)` | Covers only: `.shadow(radius: 6, y: 2)`; cards rely on stroke + surface |

---

## 8. Motion

| Token | PWA | SwiftUI |
|---|---|---|
| `quick` | 0.15 s ease — opacity, colour, nav items, wake from dim | `.easeInOut(duration: 0.15)` |
| `standard` | 0.18–0.25 s ease (PrimeVue default 0.2 s) — state switches; sections enter with `opacity 0 → 1` + `translateY(8–10px → 0)` | `.smooth(duration: 0.22)`; transition `.opacity.combined(with: .offset(y: 8))` |
| `reveal` | 0.4 s ease — recap content fade + 6 px rise | `.easeOut(duration: 0.4)` |
| `flip` | 0.45–0.5 s `cubic-bezier(0.4, 0.2, 0.2, 1)`; height 0.35 s same curve | `.timingCurve(0.4, 0.2, 0.2, 1, duration: 0.5)` |
| `pop` | 0.35 s `cubic-bezier(0.34, 1.56, 0.64, 1)`, scale .4 → 1 (toast icon) | `.spring(response: 0.35, dampingFraction: 0.6)` or `.symbolEffect(.bounce)` |
| `swipe` | 0.22 s `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | System swipe actions |
| `ringFill` | 0.6 s (identity ring) / 0.7 s (quest ring) ease | `.easeOut(duration: 0.65)` |
| `shimmer` loop | 1.6 s ease-in-out, infinite | Shimmer modifier; static under Reduce Motion |
| `sessionPulse` loop | 2 s ease-in-out; glow `0 → 3px rgba(99,102,241,.2)` on the timer card; off while paused | Subtle opacity/glow loop or none; never under Reduce Motion |
| `insightPulse` loop | 1.6 s ease-out ring on the banner dot | `.symbolEffect(.pulse)` |
| `focusEndPulse` loop | 1.6 s at time-up | As above |
| `dim` | fade in 1.2 s, wake 0.15 s | Brightness ramp + overlay fade |

**Reduce Motion.** Of the 50 live component/page/style files that animate or transition, only 24 honour `prefers-reduced-motion` today. On iOS every loop, zoom transition, ring fill and dim fade reads `@Environment(\.accessibilityReduceMotion)` ([constitution §8][constitution]).

---

## 9. Radii & sizes

### 9.1 Corner radii

| PWA value (rendered) | Where | iOS token |
|---|---|---|
| 20 px | `.glass-surface` default (cards without an override: book rows, lifetime stats, quest hero, DNA strip, empty states) | `Radius.card` = **20** |
| 16 px | `.glass-subtle`, Word of the Day, skeleton cards | `Radius.inner` = **16** |
| 12 px | `var(--p-border-radius-xl)` → Lara **12** (hero, progress panel, recap card, Last Session, achievements, dashboard empty cards); modal radius; Focus cover | Covered by `Radius.card` on iOS (unify) |
| 14 px | Stat pills, carousel cards, Codex skeletons | `Radius.tile` = **14** |
| 8 px | `var(--p-border-radius-lg)` → Lara **8** (End Session, Get Recap, Focus link, timer card); hero cover | `Radius.control` = 12 for non-capsule controls; iOS 26 glass buttons are capsules by default |
| 4–10 px | Covers by size: 4 (24×34), 5 (44×62), 6 (48–64 wide), 7 (shelf), 8 (hero 96×142), 10 (detail 128×188, DNA covers), 12 (Focus) | `Radius.cover(size)`: 4 · 6 · 8 · 10 · 12 |
| 999 px / 50 % | Chips, badges, tracks, toasts, goal chips, avatars, stepper buttons | `Capsule()` / `Circle()` |
| Lara `md` 6 px | Form fields, overlays | System `Form` fields |

Always `RoundedRectangle(cornerRadius:style: .continuous)`. Inside sheets and containers prefer concentric shapes (`ConcentricRectangle` / container-relative corners on iOS 26) so inner radii follow the container.

### 9.2 Cover sizes (2:3 unless noted)

| Preset | PWA size | Used by |
|---|---|---|
| `thumb` | 24×34 | Completed row fan, calendar cells (fill) |
| `row` | 44×62 (search results 44×64) | In Progress, queue reorder, search results, Book Lengths |
| `dnf` | 48×68 | DNF list |
| `wide` | 52×75 | Grid "Now Reading" wide card |
| `list` | 64×92 | Library list row |
| `hero` | 96×142 | Home hero |
| `detail` | 128×188 (search detail 116×174) | Book Detail, Search Detail |
| `shelf` / `grid` | 2:3 fill (grid min column 100 px; recommendation posters 104×156) | Up Next, grid, DNA covers, recommendations |
| `focus` | min(38 % width, 150 px) | Focus mode |
| Avatar | 76 ring (identity), 96 (edit), greeting avatar | `ReaderAvatar(size:)` |

---

## 10. Iconography (PrimeIcons 7 → SF Symbols)

The PWA uses PrimeIcons. iOS uses SF Symbols (Dynamic Type-scaled, hierarchical rendering). Suggested mapping — verify each name in the SF Symbols app for the iOS 26 SDK.

| PrimeIcons | SF Symbol | Used for |
|---|---|---|
| `pi-home` | `house` | Home tab |
| `pi-th-large` | `square.grid.2x2` | Library tab, grid view |
| `pi-language` | `character.book.closed` | Codex tab |
| `pi-user` | `person.crop.circle` | Profile tab, avatar fallback |
| `pi-ellipsis-h` | `ellipsis` | (web "More") |
| `pi-book` / `pi-book-open` | `book.closed` / `book` | Books, placeholders, Words chip |
| `pi-list` | `list.bullet` | List view |
| `pi-plus` / `pi-minus` | `plus` / `minus` | Add, stepper |
| `pi-pencil` | `pencil` | Edit page, note, edit profile |
| `pi-play` / `pi-pause` | `play.fill` / `pause.fill` | Session |
| `pi-stop-circle` | `stop.circle` | Cancel session |
| `pi-expand` | `arrow.up.left.and.arrow.down.right` | Focus mode |
| `pi-clock` | `clock` | Up Next, Time, cooldown, Deep dive |
| `pi-history` | `clock.arrow.circlepath` | Recap history, Last Session |
| `pi-sparkles` | `sparkles` | Recap, Insights, DNA, New Lore |
| `pi-bolt` | `bolt.fill` | Memory check, velocity, Review more, streak badge |
| `pi-camera` / `pi-upload` | `camera` / `photo.on.rectangle.angled` | Capture |
| `pi-image` / `pi-images` | `photo` / `photo.stack` | Recap memories, Archivist |
| `pi-check` / `pi-check-circle` | `checkmark` / `checkmark.circle.fill` | Success, completed |
| `pi-times` / `pi-times-circle` | `xmark` / `xmark.circle.fill` | Close, wrong, username taken |
| `pi-exclamation-triangle` / `pi-exclamation-circle` / `pi-info-circle` | `exclamationmark.triangle.fill` / `exclamationmark.circle` / `info.circle` | Warnings, errors, info |
| `pi-refresh` | `arrow.clockwise` | Retry, cycle Insight, retake |
| `pi-undo` | `arrow.uturn.backward` | Review undo |
| `pi-search` | `magnifyingglass` | Search |
| `pi-sort-alt` / `pi-sort-alpha-down` | `arrow.up.arrow.down` / `textformat.abc` | Reorder, A–Z sort |
| `pi-chevron-right/left/down/up` · `pi-arrow-left/right` · `pi-angle-down` | `chevron.*` · system back · `arrow.right` | Navigation |
| `pi-bookmark` | `bookmark` | Queue, "Previously" |
| `pi-ban` | `nosign` | Did Not Finish |
| `pi-file-import` | `square.and.arrow.down` | Import, "Imported" |
| `pi-share-alt` | `square.and.arrow.up` | Share Journey |
| `pi-trash` | `trash` | Delete |
| `pi-sign-out` | `rectangle.portrait.and.arrow.right` | Sign out |
| `pi-sun` / `pi-moon` | `sun.max` / `moon` | Appearance, Night owl |
| `pi-volume-up` | `speaker.wave.2` | Pronounce |
| `pi-clone` | `rectangle.on.rectangle` | Vocabulary Review |
| `pi-chart-bar` / `pi-chart-pie` | `chart.bar` / `chart.pie` | Stats, "This sitting" |
| `pi-calendar` / `pi-calendar-plus` | `calendar` / `calendar.badge.plus` | Calendar, Regular, Devoted |
| `pi-flag` | `flag` | Goal, forecast, First victory |
| `pi-trophy` · `pi-shield` · `pi-star` · `pi-crown` · `pi-verified` · `pi-lock` | `trophy` · `shield` · `star` · `crown` · `checkmark.seal` · `lock` | Trophy Room, achievements, records |
| `pi-file` · `pi-database` · `pi-gauge` · `pi-forward` · `pi-eye` | `doc` · `square.stack.3d.up` · `speedometer` · `forward.fill` · `eye` | Achievement badges (Thousand-pager, Ten-thousand club, Century day, Devoured, Lorekeeper) |
| `pi-arrows-v` | `arrow.up.and.down` | Book Lengths |
| `pi-spinner` | `ProgressView` | Loading |

Achievement icons will come from the server catalog once BC-09 lands; keep this table as the client-side icon map.

---

## 11. Typography

The PWA uses the system stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Display', …`), root 16 px, body line-height 1.5, headings weight 600 with −0.02 em tracking and line-height 1.2. iOS uses SF Pro through **Dynamic Type text styles only** — no fixed point sizes ([constitution §8][constitution]). `main.css` also defines `.page-title`, `.section-title` and `.page-container`, but **no component uses them**; the values below are the ones components actually render.

| Role | PWA (rendered) | Examples | SwiftUI |
|---|---|---|---|
| Tab-root title | 1.6 rem / 800 / −0.02 em | "Library", "Codex" | Navigation large title (`.largeTitle`) |
| Greeting | 1.6 rem / 600 / −0.02 em; date 0.8 rem | Home | `.title.weight(.semibold)` + `.footnote` secondary |
| Brand | 1.6 rem / 700 / −0.03 em | "The Chronicler" on sign-in | `.largeTitle.bold()` |
| Journey title | 1.75 rem / 800 / −0.03 em | Passport | `.title.weight(.heavy)` |
| Detail-screen title | 1.25–1.35 rem / 700–800 / −0.01 to −0.02 em | Trophy Room, Reading Stats, Profile Edit, DNF, Recap History, Add a Book, Book Detail title, reader name | Inline navigation title or `.title2.bold()` |
| Card title | 1.15 rem / 700 (hero); 1 rem / 600 (panel and section titles); 0.95 rem / 700 (book row) | Hero, "Reading Progress", book rows | `.title3.bold()` · `.headline` · `.subheadline.bold()` |
| Section label | 0.85 rem / 700 / uppercase / +0.06 em / .65 opacity | "In Progress", "Up Next", "Last Session", "Lifetime Stats", "Recap memories" | `.footnote.weight(.bold)` + `.textCase(.uppercase)` + `.tracking(0.8)` + `.secondary` |
| Small label | 0.7–0.72 rem / 700–800 / uppercase / +0.05–0.09 em | Library section labels, WotD label, pill tabs, "Keep an eye on" | `.caption2.weight(.bold)` uppercase, tracking 0.8–1 |
| Chip text | 0.6–0.72 rem / 600–700 (genre/badges uppercase +0.06 em) | Genre, Imported, counts, status | `.caption2.weight(.bold)` |
| Body | 0.85–0.95 rem, line-height 1.45–1.65 | Recap prose (0.9–0.95, lh 1.65), description (0.85 at .75), definitions (0.88) | `.body` / `.callout` with `lineSpacing(4)` for prose |
| Meta / caption | 0.72–0.8 rem at .5–.6 | Dates, "Page X of Y", hints | `.footnote` / `.caption` secondary |
| Large numbers | Focus timer 3.4 rem / 800 · dim timer 2.6 / 700 · quest count 2.1 / 800 · page-sheet value 1.6 / 800 · Memory score 1.6 / 800 · stat tile 1.5 / 700 · stat pill 1.05 / 700 · session timer 1 / 800 | Focus, quest ring, sheets, tiles | `.largeTitle`–`.headline` weights `.heavy`/`.bold`, always `.monospacedDigit()`; Focus timer uses `@ScaledMetric` |
| Word display | Flashcard term 1.6 rem / 700; WotD term 1.4 / 700 / −0.02 em; Codex term 1.35 / 700 | Review, WotD, Codex | `.title.bold()` / `.title2.bold()` |
| Tab label | 0.65 rem / 500 | Bottom nav | System |

Weights in use: 700 (123 declarations), 600 (69), 800 (19), 650 (14), 500 (13), 400 (6). Map 800 → `.heavy`, 700 → `.bold`, 600–650 → `.semibold`, 500 → `.medium`.

---

## 12. Spacing & layout

| Token | PWA value | iOS |
|---|---|---|
| Spacing scale | Gaps in use, by frequency: 0.75 rem (62), 0.5 (60), 0.4 (42), 1 (30), 1.25 (20), 0.35, 0.85, 0.6, 0.875, 0.3, 0.25, 0.1–0.2 | `Spacing.xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32` (4 pt grid; round 6/7 pt web values to 8) |
| Screen padding | 1.5 rem top, 1 rem sides | System margins (16 pt on iPhone) via default `List`/`ScrollView` content margins |
| Section gap | 1.25 rem (Home sections, Book Detail) | `Spacing.xl` (20) |
| Card padding | 1.25–1.5 rem (hero, progress panel 24; most cards 20); dense 0.85–1 rem | `Spacing.xl` (20); hero `xxl` (24); dense `md`–`lg` |
| Empty state padding | 3 rem × 2 rem | `ContentUnavailableView` defaults |
| Content max width | 680 px (Home, Library, other pages) | iPhone full-bleed; cap readable width on iPad later (`.containerRelativeFrame`) |
| Bottom clearance | `6rem + safe-area-bottom` for the floating nav | Not needed (system tab bar insets) |
| Touch targets | Nav items `min-height/width 44px`; stepper 41.6 px; pause 35–48 px | ≥ 44 pt everywhere |
| Dialog widths | 92 vw, max 420–480 px; confirm dialog 90 % | System sheets and alerts |
| Bottom nav | 64 px tall, 12 px from the edges, radius 18 | System tab bar |

---

## 13. Contrast audit (WCAG 2.x, normal text needs 4.5:1)

| Pair | Ratio | Verdict / iOS action |
|---|---|---|
| Text .90 on dark base | 15.93 | Pass |
| Muted .55 on dark base / on `#1C1C2E` | 6.27 / 5.92 | Pass |
| indigo-300 on dark base / on a .18 accent fill | 9.88 / 8.35 | Pass |
| White on indigo-400 `#818CF8` (dark primary button) | **2.98** | Fail → `accentStrong` `#4F46E5` (6.29) |
| White on indigo-500 `#6366F1` | 4.47 | Borderline → `accentStrong` |
| Text .90 on light base | 13.58 | Pass |
| Muted .55 on light base / on white | **4.09 / 4.20** | Fail → ≥ .62 opacity (5.16) or `.secondary` |
| `#4338CA` on light base / on a .12 accent fill | 7.18 / 6.23 | Pass — chosen light `accentText` |
| indigo-300 / indigo-400 on light base (web light mode where no override exists) | **1.81 / 2.71** | Fail → adaptive `accentText` |
| `#4F46E5` on light base | 5.72 | Pass |
| amber-400 / red-400 on light base | **1.52 / 2.51** | Fail → amber-700 (4.56), red-700 (5.88) |
| emerald-600 on white (light byline) | **3.77** | Fail → emerald-700 (5.48) |
| Focus dim timer on black | 4.30 | Acceptable for a 2.6 rem numeral (large text ≥ 3:1) |
| "tap to wake" white .16 on black | 1.44 | Decorative; give the dim layer an accessibility label instead |

---

## 14. Changes since the previous version (2026-06-20, inventories updated 2026-07-11)

| Area | Previous | Now |
|---|---|---|
| Platform floor & glass | iOS 18.0 minimum; `if #available(iOS 26.0, *)` `.appGlass()` helper with `.ultraThinMaterial` / `.regularMaterial` / `.thinMaterial` fallbacks | **iOS 26 only (D-04).** Native Liquid Glass directly; no fallback, no helper. Glass for the navigation/control layer; content on tokened surfaces (§5) |
| Background | "MeshGradient available at the iOS 18 floor" | Same gradient values; `MeshGradient` optional on iOS 26 (§2) |
| Accent | "primary-500 `#6366F1`" as the accent everywhere | Brand tint stays `#6366F1`, but the rendered interactive fill is **indigo-400 in dark** (Lara `primary.color`); prominent buttons need `accentStrong` for contrast (§1) |
| Light accent text | primary-600 `#4F46E5` | Components use both 600 and 700; choose **`#4338CA`** (§1) |
| Appearance | "Dark is the default; light swaps three colours" | Web: dark default + manual toggle, no system mode (PLT-40). iOS: System / Light / Dark, System default (PLT-Q06) (§2) |
| Semantic colours | Missing | Success, warning, danger, caution, open thread, with light-mode AA variants (§4) |
| Focus mode | Missing | Full palette (§6) |
| Overlays & toasts | Missing | Opaque overlays `#1C1C2E` / `#FFFFFF`, dialog masks, glass toast and Insight banner specs (§5, §7) |
| Component palettes | Progress fill, genre chip, cover placeholder only | Section accents, badges, Insight/Codex badges, chart palette, journey/passport/recap gradients, scrims (§7) |
| Typography | Page title 1.75 rem / 700 / −0.03 em; section label 0.75 rem (from `main.css` classes) | Those classes are unused; real titles are 1.6 rem / 800, section labels 0.85 rem / 700 / .65 (§11) |
| Radii | Card 20 · subtle 16 · cover 6 · pill 999 | Measured mix: 20 (glass default), 12 (`--p-border-radius-xl` resolves to 12, not 16), 16, 14, 8 (`lg`); covers 4–12 by size. iOS tokens unify to card 20 / inner 16 / tile 14 / control 12 (§9) |
| Motion | 0.15–0.22 s, 1.6 s shimmer | Plus flip, pop, ring fill, swipe, session/Insight/Focus pulses, dim timings (§8) |
| Icons, contrast | Not covered | PrimeIcons → SF Symbols map (§10); contrast audit (§13) |
| Deliverable | Framed as a Spec Kit foundation spec, including `GlassEffect.swift` | Phase 0B `DesignSystem/Tokens/`, built in a Claude Code ultracode session, without any glass helper (D-02, D-04) (§15) |

---

## 15. Phase 0B deliverable

`DesignSystem/Tokens/` in `bookhero-ios`:

| File | Contents |
|---|---|
| `ColorTokens.swift` + asset catalog | Indigo and violet ramps; `accent`, `accentStrong`, `accentText`, `accentFill(…)`, `accentStroke`; text roles; semantic roles; surfaces (`surfaceCard`, `surfaceSubtle`, `surfaceTrack`, `surfaceElevated`, `focusBackground`); chart palette — each with light, dark and high-contrast variants |
| `Gradients.swift` | Progress fill, cover placeholder, New-Insight chip, journey, passport, recap placeholder, scrims |
| `PageBackground.swift` | The two-glow background view |
| `Typography.swift` | Text-style roles of §11 as `Font` extensions (Dynamic Type only) |
| `Spacing.swift`, `Radius.swift` | §12 and §9 scales, cover size presets |
| `Motion.swift` | §8 animations, each with a Reduce Motion variant |
| `Iconography.swift` | §10 map as typed symbol names |

Every token file ships a `#Preview`; the gallery renders light, dark, Reduce Transparency, Increase Contrast and the largest accessibility text size, with a snapshot baseline. A lint rule forbids colour, font-size, spacing and radius literals outside `DesignSystem` (plan acceptance 0B-4). There is **no** `GlassEffect.swift` / `.appGlass()` helper.

[PLT]: ../business-rules/08-platform-auth-account.md
[constitution]: ios-constitution.md
[brief]: ios-design-brief.md
