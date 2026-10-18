# The Chronicler for iOS — Design Brief

Last updated: 2026-10-18

**Purpose.** This brief sets the design direction for the native iPhone app (iOS 26+, D-04). It records the *intent* behind the PWA so the iOS build has a north star, and it explicitly licenses departures from the PWA.

- It is referenced by the iOS `CLAUDE.md` ([ios-constitution.md](ios-constitution.md), §7).
- Changes to look and feel land **here first**, then in the tokens, then in code.
- Behaviour, copy and limits come from the [business-rules catalog](../business-rules/README.md). Phase scope comes from the [implementation plan](../ios-implementation-plan.md).

> **The PWA is the reference, not the target.** Keep its soul: calm, frosted, indigo, reading-first. Rebuild the body in iOS 26 idioms. When the PWA and the HIG disagree, the HIG wins, unless a catalog rule marks the behaviour as a product rule (for example the page-sheet validation, [SES-24](../business-rules/02-reading-sessions.md#ses-24--page-validation-in-the-sheet)).

---

## 1. Product soul (non-negotiable — keep)

- **One job: memory continuity.** Get a reader oriented and back into their book with minimal friction. The app remembers what they read (captures, recaps, Insights, words, quotes) and brings it back when they return (Memory Check, "Previously", recaps). Every screen is judged by whether it serves this.
- **Calm and legible in low light.** People read at night, so the artwork is dark-first, text contrast is high and spacing is generous. Light mode is first-class, not an afterthought.
- **Frosted depth over an indigo night sky.** The page background is a deep indigo radial glow. On iOS the frosted layer is real Liquid Glass on the controls, not glass-effect cards (§3).
- **One brand colour.** Indigo `#6366F1`, used sparingly and with purpose.
- **Two taps to the core action.** Start or end a session, save a page and get a recap are each reachable within two taps from a tab root.
- **Quiet gamification.** XP, the quest ring and badges are present but never nag. No social feeds in v1 (D-13).
- **Memories feel like a journal.** Recaps are story cards ("From your captures · N days later", the page range, an open-thread quote). A finished book gets a Reading Journey.

## 2. Naming & voice

### 2.1 Product name

The product and App Store name is **The Chronicler** (D-03, [PLT-87](../business-rules/08-platform-auth-account.md#plt-87--user-facing-product-name)). It appears in:

- the display name and the App Store listing;
- the sign-in screen ("The Chronicler — Your AI reading companion");
- email templates;
- the AI persona ("You are The Chronicler…").

"BookHero" is never user-facing. It stays in the repo name `bookhero-ios`, in identifiers and in storage keys. A trademark search clears the name before submission ([plan §8.9](../ios-implementation-plan.md#89-release-checklist)).

### 2.2 User-facing vocabulary

| Term | Meaning | Note |
|---|---|---|
| **Home · Library · Codex · Profile** | The four tabs, in this order | "Codex" is the user-facing name of the vocabulary area. `/lexicon`, `GreatLibraryPage` and "Great Library" are internal. The Codex's own tabs are **Lexicon** and **Insights**. |
| **Recap** | The three-part memory jogger for the stretch since the last recap | Section "Recap memories"; history "View Recap History (n)" |
| **Insight(s)** | A milestone card unlocked every 10 % (10–90) | See §2.3: the PWA still says "Lore" in places |
| **"Previously"** | The pre-session resume of the last captured page | Dialog title "Previously", with "page N" |
| **Memory check** | The pre-session quiz built from captures | Chip and dialog title "Memory check" |
| **Focus mode** | Full-screen session companion | Button "Focus mode" |
| **Reading Journey** | The finished-book page (internally the passport) | The PWA mixes "Reading Journey" (page title, button "View Reading Journey", "Share Journey") with "Book Passport" (the completion prompt says "Open your Book Passport"). **Recommendation (new, not yet in the catalog):** say "Reading Journey" everywhere user-facing. |
| **Didn't finish / Shelve** | DNF | "Didn't finish it? Shelve this book", "Start reading again", DNF list "Nothing shelved" |
| **Trophy room · Stats** | Profile's two child screens | Entry cards "Trophy room — Quest goal and level" and "Stats — Charts, calendar, records" |
| **Word of the Day · Vocabulary Review** | Dashboard word card · Anki-style review | — |

### 2.3 "Insights" vs "Lore" — what the PWA shows today

The 2026-07 rename to "Insights" is incomplete. Internal names (`lore_cards`, `generate-lore`, `LoreCard*`) are unchanged by design.

| Surface (PWA, `master` @ `8d8701c`) | Copy today |
|---|---|
| Codex tab | **"Insights"** (`GreatLibraryPage.vue:50`) |
| Hero nudge | **"N pages to your next Insight"** (`HeroBookCard.vue:220`) |
| Achievement | "Lorekeeper — Unlock your first **Insight**" (`utils/achievements.ts:105-106`) |
| Unseen chip on hero, In Progress and library cards | **"New Lore"** (aria "New lore unlocked — tap to view") |
| Global generation banner | **"Chronicler is weaving new lore"** (`LoreGenerationBanner.vue:25`) |
| Codex Insights empty state | "Keep reading to unlock your first **lore card**." / "**Lore cards** unlock at every 10% reading milestone." (`LoreCardList.vue:70-72`) |
| Book Detail card | Type badge + "Unlocked at N%" + title, with no "Insights" heading. Internal name "Lore Chronoscope" (aria in compact mode: "Lore Chronoscope — tap to open Great Library"). |
| Card *type* badge | One of History · Culture · Geography · Technology · **Lore** (INS-Q11) |
| Codex **quote** badge | **"Lore"**: a defect, it should say "Quote" ([LEX-D27](../business-rules/05-codex-lexicon.md#known-defects)) |
| Quest level 3 | "Lore Keeper" (vs. the achievement "Lorekeeper") |

**Recommendation (INS-Q05, open):**

- Use **"Insight(s)" in every user-facing string**: chip "New Insight", banner "The Chronicler is uncovering a new Insight", empty state "Keep reading to unlock your first Insight".
- Rename the quote badge to **"Quote"** on every client. This is a defect fix, not a decision.
- Keep "Lore" only as a card *type* and as flavour names (level title, achievement). Align their spelling.
- Ship the same term on web and iOS in the same release.

Until INS-Q05 is answered, every string goes through the String Catalog, so the rename is a copy change, not a code change. The plan's phase tables still say "New Lore" chip because they follow today's PWA.

### 2.4 Voice

- Calm, warm, second person, short. No exclamation-mark enthusiasm, except at completion.
- Errors say what happened and what to do next. Never show raw server strings: today the PWA shows "AI output invalid" and "Unauthorized" verbatim ([REC-D19](../business-rules/03-recaps.md#known-defects)), and Supabase auth errors verbatim (PLT-04).
- Exact copy comes from the catalog. Changing copy on one client is a catalog change, so both clients stay aligned.

## 3. Visual language: native Liquid Glass on iOS 26

### 3.1 What carries over from the PWA

These are values only. The exact numbers are in [design-tokens.md](design-tokens.md) and §6.

- **Indigo accent ramp.** Primary `#6366F1`, full 50–950 ramp.
- **Page background.** Two radial glows over a base colour, edge to edge. Dark: `#1a1040` at 20 %/20 % and `#0d1a3a` at 80 %/80 % over `#0a0a14`. Light: `#e8e0f8` / `#dce8f8` over `#f0f4ff`.
- **Text.** 0.90 primary and 0.55 muted opacity, or `.primary` / `.secondary`.
- **Shapes.** Continuous corners: 20 (card), 16 (inner), 6 (cover), capsule (pills and tracks).
- **Type.** System font with Dynamic Type everywhere. The PWA already uses the system font stack.
- **Progress fill.** Indigo-400 → violet-400 gradient on a faint capsule track.

### 3.2 Two layers, not "everything is glass"

The PWA puts a CSS blur behind almost every card because a browser has no real material system. iOS 26 does: Liquid Glass is the **functional layer for controls and navigation that floats above content**. Carrying the PWA look literally would stack glass on content, and on glass, everywhere. That is the main "rethink" of this brief.

| Layer | iOS 26 treatment | Examples |
|---|---|---|
| **Background** | `PageBackground`: the radial glows, static, ignoring safe areas | Every tab root and pushed screen |
| **Content** | **Tokened surfaces, not glass**: solid or near-solid card fills per scheme, standard `List` / grouped backgrounds, separators. Text-dense surfaces are opaque. | Book cards, hero card body, recap story, Insight detail, definitions, stats cards, forms, review text |
| **Controls & navigation** | **Liquid Glass**. Free from the system: tab bar, toolbars, sheets at partial detents, menus, alerts, search field. Custom: `.glassEffect` on floating controls. | Tab bar; session mini timer in `.tabViewBottomAccessory`; Focus-mode controls; floating chips ("New Insight"); the top status banner; primary action buttons (`.buttonStyle(.glassProminent)`) |

This departs from the PWA on purpose. The owner reviews it on a device in the Phase 0B gallery. If a specific content surface must be glass (for example the dashboard hero floating over the background), record it as an iOS design choice with its reason.

### 3.3 Glass rules

| # | Rule |
|---|---|
| G-1 | **No fallback** (D-04). Use `.glassEffect(_:in:)`, `GlassEffectContainer` and the glass button styles directly. Forbidden: `if #available` branches, `Material` as a glass stand-in, re-creating the PWA's rgba/blur recipe, and any `.appGlass()`-style wrapper. |
| G-2 | Glass lives in the control layer. Content uses tokened surfaces (§3.2). |
| G-3 | Group neighbouring custom glass in **one** `GlassEffectContainer(spacing:)`, so the shapes blend and morph correctly. Morph related controls with `.glassEffectID(_:in:)`, for example Start → timer controls, or Pause ↔ Resume. |
| G-4 | **Never put glass on glass**: no glass chip on a glass card inside a glass sheet. |
| G-5 | `.regular` glass by default. Use `.clear` only over rich imagery (Focus-mode cover backdrop, Reading Journey hero), with a dimming layer underneath for legibility. |
| G-6 | Tint sparingly. Only the single primary action of a surface carries the accent (`.glassProminent` or `.tint(.accent)`): "End Session", "Get Recap", "Begin reading", "Save". Everything else stays untinted. |
| G-7 | Tappable custom glass uses `.interactive()` and has a hit target of at least 44 pt. |
| G-8 | Text-dense surfaces are opaque. Let system sheets do what they do: glass at partial height, opaque at full height. Menus and alerts are system components with no custom chrome. The PWA already forces dialogs and menus opaque (`#1C1C2E` / `#FFFFFF`); keep that intent. |
| G-9 | Under bars, use the system scroll-edge effect instead of custom fade gradients. |
| G-10 | **Accessibility.** With Reduce Transparency, system glass frosts or solidifies on its own. Every custom content surface switches to its opaque variant too. With Increase Contrast, custom surfaces gain a visible border. Never depend on translucency for meaning. Don't hard-code opacities that defeat the reader's system glass appearance preference (Clear / Tinted, iOS 26.1+). Every custom glass and content surface is checked in the gallery with each setting on. |

### 3.4 Motion & haptics

- **Navigation:** a zoom transition from a cover to Book Detail (`.matchedTransitionSource` + `.navigationTransition(.zoom(sourceID:in:))`), plus glass morphs (G-3).
- **Timing:** standard transitions of about 0.2 s ease-in-out. The PWA's 1.6 s shimmer becomes `.redacted(reason: .placeholder)` with a shimmer.
- **Haptics** (`.sensoryFeedback`): page saved, invalid page blocked, session started and ended, completion, recap ready, badge earned, Focus goal reached.
- **Reduce Motion** turns off shimmer sweeps, zoom transitions, ring fills and dim fades.

## 4. System appearance

**Today (PWA).** Two themes. Dark is the default, with a manual "Light mode / Dark mode" toggle in the More sheet, persisted per device under `bookhero_theme`. There is no "System" option ([PLT-40](../business-rules/08-platform-auth-account.md#plt-40--two-themes-dark-by-default-no-system-mode)). Only the browser chrome colour follows the OS (PLT-42).

**The theme default is an open decision: PLT-Q06.**

**Recommendation** (catalog, plan and this brief agree):

- **Follow the system appearance by default**, with a manual override **System / Light / Dark** in Settings.
- Keep any explicit choice the reader has already stored.
- Add "System" to the web too, so both clients offer the same three choices.

| Aspect | iOS implementation |
|---|---|
| Default | `.preferredColorScheme(nil)` (System) |
| Override | `@AppStorage("bookhero_theme")` = `system \| light \| dark`. Per device, not synced, not user-scoped, like PLT-40. |
| Colours | Asset-catalog colours with Any / Dark appearances and High Contrast variants. `PageBackground` per scheme. |
| Artwork | Designed and reviewed dark-first (night reading). Light must pass the same gallery checks (contrast, Reduce Transparency, Increase Contrast). |
| Focus mode | Follows the app appearance, as the PWA does (it has a light variant). Its dim layer is black in both. |

Whatever the owner decides, Phase 0B implements it ([plan Phase 0B](../ios-implementation-plan.md#phase-0b--design-system--app-shell)).

## 5. Keep vs. rethink — today's surfaces

Each row lists the PWA as of `master` @ `8d8701c`, what must survive, and what changes on iOS 26. Rule IDs point into the catalog; they define behaviour and copy.

### 5.1 Shell

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Floating glass bottom nav **Home · Library · Codex · Profile** + **More** sheet (Add Book, Light/Dark mode, Sign out). Library is highlighted for every `/library*` and `/books*` route. | Four tabs, same labels and order | `TabView` with the system floating tab bar and `.tabBarMinimizeBehavior(.onScrollDown)`. The More sheet dissolves: **Add Book** becomes a `+` toolbar action (sheet) on Home and Library. Theme, sign out, link Apple ID, delete account, legal links, AI-consent status and version move to **Settings**, pushed from Profile's toolbar. `.tabViewBottomAccessory` hosts the running-session mini timer. Each tab owns a `NavigationStack` that keeps its scroll position (the web always scrolls to top, PLT-20). | PLT-18 … PLT-23 |
| Sign-in screen "The Chronicler — Your AI reading companion": Sign in / Sign up tabs, magic link | Brand header, three modes, submit labels | System `SignInWithAppleButton` with equal prominence (D-11). "Forgot password?" → reset via universal link. Magic link: resend and "use another email" (the web dead-ends, PLT-08). Friendly error mapping instead of raw Supabase text (PLT-04). AutoFill content types. Hide-My-Email guidance. | PLT-01 … PLT-08, PLT-82 |
| *(none — the PWA has only the More sheet)* | — | **Settings** screen: Theme · Sign out (scope per PLT-Q01) · Link Apple ID · Delete account (D-10) · Privacy policy & Terms · AI-consent status · Version | PLT-Q01, PLT-Q04, PLT-Q06 |

### 5.2 Home

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Greeting by local hour ("Up late" / "Good morning" / "Good afternoon" / "Good evening"); avatar, or the "Set up your reader profile" call to action | Copy and hour buckets | Header row; the avatar opens Profile | SES-57, PRO-92 |
| **Hero book card**: cover, progress, forecast ("N pages left · finish by ~date"), Insight nudge (≤ 15 pages), "New Lore" chip, session controls, Get Recap / lock label, Focus mode button, inline capture prompt, last session note, offline badge | One hero; one primary action at a time (Start / End Session / Get Recap); forecast and nudge rules; tapping an Up Next cover makes that book the hero | Hero body is a content surface (§3.2) with the cover as the zoom source. The primary action is `.glassProminent`. The offline badge becomes the global **pending-sync indicator**, driven by the real queue. **The capture prompt becomes the next step of the same page-save sheet** (the sheet swaps from "Where did you stop?" to "Capture this page"), so there is no second modal. This is a recommendation; record it as an iOS design choice. | SES-53 … SES-74, CAP-01 … CAP-06b |
| In Progress list, Up Next cover shelf, Completed row (3 covers + "+N"); onboarding states `empty` / `oneInProgress` / `oneQueued` / `completedOnly` / `standard`, with the Import action | States, order and copy | Horizontal shelves with view-aligned scrolling; context menu "Open"; empty states via the design system's `EmptyState` | SES-54 … SES-56, SES-59 … SES-65 |
| Word of the Day card + "Vocabulary Review" prompt (≥ 3 days since the last session and ≥ 5 words) | State precedence, advance, Codex link | Card now, widget in Phase 3. All review writes go through BC-10. The word is never a quote. | LEX-44 … LEX-57 |
| Last Session card (timed and untimed variants) | Timed-session card | Shows real timed sessions only (D-08). The untimed variant per OP-04.8. | SES-72, SES-73 |

### 5.3 Reading session

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Start ⇄ timer card (pause, stop → "Cancel this session? No progress will be saved.", End Session). Elapsed `M:SS`, then `H:MM:SS`. | Server-confirmed start; timer derived from timestamps; cancel confirmation copy | Mini timer in `.tabViewBottomAccessory` while a session runs, adapting to the `.inline` placement when the tab bar minimizes; tap → Focus mode or the book. Live Activity (§7). Cancel via `.confirmationDialog` with a destructive role. Haptics on start and end. | SES-08 … SES-22 |
| **Page save sheet**: "Where did you stop?" / "Update your page", −/+ stepper, numeric input, unchanged-page block with "Cancel session instead" | **Product rule.** Validation, bounds and copy exactly as specified. | `.sheet` at `.medium` detent, number pad, stepper with selection haptics, success haptic on save. Server errors (`page_out_of_range`, `page_unchanged`, `no_pages_read`) map to the same copy. **No slider**: the old "progress slider" mapping was never a PWA feature. The capture step continues in the same sheet (§5.2). | SES-24 … SES-36 |
| **Focus mode**: full-screen cover, big timer, pause / End Session; Screen Wake Lock; auto-dim after 30 s (black 0.94 overlay, timer at 60 % lavender, "tap to wake"); goal chips 15 / 30 / 45 / 60 min counted from the current elapsed time; "Time's up" with chime and vibration; overtime `+M:SS` | All of it, including "opening or closing Focus mode never changes the session" and "the session keeps running after the goal" | `.fullScreenCover`. `isIdleTimerDisabled = true` while visible, restored on disappear and when the app backgrounds. Dim overlay in Phase 1; real brightness dimming (always restored) per SES-Q13. At the goal: success haptic, chime (respects the silent switch), "Time's up", End Session pulses. Locked or backgrounded: a local notification at the goal time (Phase 3). The Live Activity shows the goal countdown. Timer in a rounded, monospaced-digit style scaled with `@ScaledMetric`. Controls are glass in one `GlassEffectContainer` over the cover-tinted backdrop (G-5). | SES-79 … SES-83 |
| **Pre-session gates.** **Memory check** (after ≥ 48 h away): "It's been N days since page P…", up to 3 questions × 3 options with "From your capture · page N", summary "Perfect recall" / "Solid recall" / "It happens — memory fades", "Feeling hazy? Read the full recap". **"Previously"**: up to 3 bullets + a tension line, "Begin reading". | Order Memory Check → "Previously" → start; the timer starts only on confirm; any dismissal aborts with no write; all copy | `.sheet` with detents instead of centred dialogs; swipe-down = abort, like the PWA's dismiss. Large answer buttons with success / error haptics. The hint "Your timer starts once you begin." A slow resume backfill shows progress plus "Skip to reading" instead of blocking Start (CAP-55a is a defect). The on-demand "Memory check" chip stays on Book Detail. | SES-14, SES-15, CAP-48 … CAP-78 |
| **Capture prompt & review**: camera or upload, "Add note instead", skip; auto-save at high confidence ("Page captured"); otherwise a review with edit / retake / re-upload and a low-confidence banner | Flow and copy; capture page = current page; one capture per page | Document camera (`VNDocumentCameraViewController`) or a guided still; `PhotosPicker` / Files. On-device Vision first, `ocr-page` fallback (D-15), thresholds recalibrated (CAP-Q07). **No prompt when `captureAllowed` is false** (the completing save). The toast becomes the top banner (§5.8). | CAP-01 … CAP-35, CAP-90 |
| Completion prompt "Finished: {title} — Your reading journey is ready…" (View Journey / Continue); the hero rotates away | The moment and the copy | Calm celebration: success haptic, cover in the alert or sheet. "View Journey" once passports ship (Phase 2). | SES-39 … SES-43 |

### 5.4 Memory: recaps, Insights, Reading Journey

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| **Recap modal** (`RecapDialog`). Header "Recap". Generating: spinner, "Generating your recap…", shimmer. Complete, image first: image → range chip + byline ("From your captures · N days later") → memory jogger → "Keep an eye on" chips → open-thread quote → "View history (n)" / "Done". Error + "Try Again". Before it: the **"Inferred recap"** warning ("…may be less accurate or contain spoilers. Continue?"). The button shows the lock label ("N more pages" / "Recap in N hours", "Recap open"). | Story layout and order; the inferred-recap warning and its copy; lock labels | `.sheet` at large detent with an opaque story surface; glass only on the sheet's own chrome. **Staged progress** (accepted → extracting → composing → saved) from `generate-recap` v2 instead of a silent shimmer; inferred recaps take tens of seconds (BC-07, REC-Q11). **Never render raw stream text** ([REC-55](../business-rules/03-recaps.md#rec-55--the-modal-shows-the-persisted-row-never-the-stream)). Closing or backgrounding never loses a paid recap: "It will appear in your history." Image states: pending skeleton "Illustrating this stretch…"; failed → calm gradient placeholder; skipped → no slot. Image polling is capped (REC-48, BC-13). Success haptic when ready. Lock state comes from `get_recap_eligibility` and is re-queried when `unlockAt` passes. | REC-01 … REC-19, REC-36 … REC-57, [REC-70](../business-rules/03-recaps.md#rec-70--recap-modal-states--copy) |
| Recap History (story cards, journal framing), Book Detail recap carousel, Profile "Recap memories" gallery | Journal framing, ordering, range labels | Paging carousels; images cached by recap id (never by signed URL); recap images stay private (no share action) | REC-50 … REC-57, REC-69 |
| **Insights**: collapsible Book Detail card (type badge, "Unlocked at N%", title, cycle); Codex Insights tab with book filter; "New Lore" chip until Book Detail opens; global banner "Chronicler is weaving new lore"; hero nudge | 10 % milestone cadence (10–90), seen semantics, nudge rule | Naming per §2.3. The banner is a non-blocking top pill driven by `effects.insightMilestonesQueued` and bounded `get_my_jobs` polling. Arrival feedback: "New Insight unlocked" banner + a Codex tab badge with the unseen count (INS-Q07 recommendation). Cards built from metadata carry "Based on book info" (D-12). Type badges use colour **and** text. | INS-37 … INS-53, INS-60 |
| **Reading Journey** (passport): journey, stats, AI summary, "Share Journey" (Web Share / clipboard) | Layout; share text | `ShareLink` (text, plus an optional card rendered with `ImageRenderer`). A failed summary still shows the stats, never a dead end. Shown exactly when a passport row exists (SES-Q06 / LIB-Q09 recommendation). | SES-44 … SES-52 |

### 5.5 Library & books

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Library: Now Reading / Queue / Completed. List view with sticky Queue/Completed tabs; grid view with sticky collapsible sections; both persisted per device. Accent-insensitive grouped search, including the DNF group. Queue reorder mode. Swipe edit/delete. | Sections, grouping, per-device persistence, the DNF search group | `List` with sections and a segmented `Picker`; `LazyVGrid` for the grid; `.searchable`; edit-mode `.onMove` with VoiceOver move actions. `.swipeActions` **plus** a context menu **plus** Book Detail toolbar actions: never touch-only (LIB-Q06). | LIB-44 … LIB-65, LIB-101 … LIB-104 |
| **DNF.** "Didn't finish it? Shelve this book" → "Shelve this book as Did Not Finish? Your progress and words are kept, but sessions, recaps and insights are paused until you resume." (Shelve it / Keep reading). The shelved state offers "Start reading again". A Library header icon (only when ≥ 1 book is shelved) opens the DNF list: "stopped at p. X · Y% · shelved {relative}", Resume. | Copy, exclusions, list sorted by `dnf_at` | `.confirmationDialog`; toolbar item shown only when ≥ 1 book is shelved; empty state "Nothing shelved". With a running session, offer "Save page & shelve" / "Discard session & shelve" (XD-Q03 recommendation). | LIB-90 … LIB-95, SES-75, XD-25 … XD-32 |
| Add Book hub: Scan ISBN, Add Manually, search, **"Import from Goodreads or StoryGraph"**. Search detail (editable, recommendations, duplicate notice). Initial status Want to read / Reading at page N / Finished. | Hub contents, copy, the quiet initial status | A sheet from `+`; full-screen `DataScannerViewController` with guidance; search through the proxy (BC-15); status as a segmented `Picker`; "Reading at page N" clamped to `[1, total − 1]` | LIB-13 … LIB-43, LIB-103 … LIB-107 |
| CSV import dialog (file → parsing → importing → enriching → summary) | Phases, summary counts, DNF-shelf mapping | `.fileImporter` for comma-separated text; phased progress; summary screen. The server (`import_library`) dedupes and maps statuses. | LIB-66 … LIB-86, XD-33 … XD-40 |
| **Book Detail**: centred cover hero + clamped description ("Read more"); progress panel; chips (+ Codex, Words N, Memory check); Insights card; Recap memories (Get Recap, "View Recap History (n)"); "View Reading Journey" | Hub structure and order | Zoom-transition target. Toolbar menu: Edit, Delete, Shelve. A shelved state replaces the session and AI sections. Get Recap stays visible during a session here; only the hero hides it ([REC-02](../business-rules/03-recaps.md#rec-02--where-the-get-recap-button-exists), REC-Q07). | LIB-40 … LIB-42, SES-42, SES-66, LEX-102 |

### 5.6 Codex

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Title "Codex"; header stats (words · mastered); **Lexicon / Insights** tabs; search; type chips All / Dictionary / Quotes; sort Newest ↔ A–Z; "Add to Codex" (Word / Quote); deep links `?bookId`, `?tab=lore` | Structure, filters, server-side paging | Segmented `Picker` for the tabs; `.searchable`; `Menu` for type, book and sort; Add as a `.sheet`. Quote badge **"Quote"** (LEX-D27). Wiktionary (CC BY-SA) attribution ([LEX-103](../business-rules/05-codex-lexicon.md#lex-103--dictionary-content-is-cc-by-sa-and-shown-without-attribution)). | LEX-01 … LEX-23, LEX-70 … LEX-82 |
| Review (Anki-style): progress bar, flip card, swipe or buttons, one-level undo, `en-US` pronunciation, daily limit 20 + "Review more", summary with missed words | Rules and copy | Drag gesture with **always-visible** Knew it / Didn't know buttons; VoiceOver custom actions (Knew it / Didn't know / Pronounce); haptics; `AVSpeechSynthesizer` pinned to `en-US`; every write through BC-10 | LEX-24 … LEX-69 |

### 5.7 Profile, Trophy Room, Reading Stats

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| Profile: identity header (avatar inside the yearly-goal ring + level badge + name; email-initials fallback); DNA strip + full-analysis sheet; DNA recommendation covers; stat pills Books / Pages / Hours / Streak (≥ 10 000 → `12.3k`) → Reading Stats; two entry cards **Trophy room** and **Stats**; Recap memories | Identity-first composition, pill formatting, two entry cards | Settings in the toolbar. Profile edit = **username, display name, avatar only** (D-13), with `PhotosPicker` and crop. Display levels 1-based (PRO-Q04 recommendation: "Lv 0" reads as broken). | PRO-37 … PRO-41, PRO-63 … PRO-90 |
| **Trophy Room**: quest ring hero + goal dialog (1–999 books), XP / level strip, achievements wall (17 badges). **Reading Stats**: "Your year" monthly chart, reading calendar, lifetime stats, personal records, book lengths, library breakdown. | **Keep the split.** Trophy Room is motivation (goal, level, badges); Reading Stats is analysis (charts, calendar, records). | Swift Charts with audio graphs; calendar days with full-date labels; goal editing in a `.sheet`. Badges come from `sync_achievements`; **celebrate newly earned badges** with a haptic and a short animation that respects Reduce Motion (the PWA has none). All numbers are in the reader's time zone (BC-06). | PRO-01 … PRO-51, PRO-106 |

### 5.8 Feedback, loading & empty states

| PWA surface today | Keep | Rethink for iOS 26 | Rules |
|---|---|---|---|
| **Glass toast**: a top-centre pill, success / loading / warn, 5 s / until dismissed / 6 s. Plus PrimeVue bottom toasts, a global "Some things didn't load" notice (one per 30 s) and ConfirmDialog. | Variants, durations, de-duplication | One **top banner** component: a glass capsule with three variants, a haptic and a VoiceOver announcement. It never covers the Insight banner; today they share one slot (PLT-37). Page-level failures appear inline with "Retry". Cached data shows an "as of" hint. Confirmations use `.confirmationDialog` / `.alert`. | PLT-35 … PLT-38 |
| Manual skeletons and shimmer | The shimmer identity | `.redacted(reason: .placeholder)` + shimmer, off with Reduce Motion | — |
| `EmptyState` (icon, title, description, action) on every list | Every list has one; empty states onboard, never blank | Design-system `EmptyState` | SES-56, LIB-109 |

## 6. Token additions for Phase 0B

These additions were read from the PWA sources on 2026-10-18 and are now folded into [design-tokens.md](design-tokens.md) (§1, §4–§7), which holds the final values, including the AA-compliant light variants. This table keeps the PWA source of each. On iOS they become asset-catalog colours (Any / Dark, plus High Contrast variants). They are references for hue and weight, never rgba recipes for re-creating glass.

| Token | Dark | Light | PWA source |
|---|---|---|---|
| Accent text | indigo-300 `#A5B4FC` | primary-700 `#4338CA` (decided in tokens §1: the higher-contrast choice for small text; older components use primary-600 `#4F46E5`) | `preset.ts`; `FocusModeOverlay.vue`, `RecapDialog.vue`, `RecapCard.vue` |
| Success | green-400 `#4ADE80` / emerald-400 `#34D399` | green-700 `#15803D` (tokens §4; the web keeps the dark value) | `HeroBookCard.vue`, `WordOfTheDay.vue`, `MemoryCheckDialog.vue` |
| Warning | amber-400 `#FBBF24` | amber-700 `#B45309` (tokens §4) | `BookCard.vue`, `LexiconCard.vue` |
| Danger | red-400 `#F87171` | red-700 `#B91C1C` (tokens §4) | `BookProgressPanel.vue`, `BookForm.vue`, `RecapDialog.vue` |
| Caution (low-confidence OCR) | orange-400 `#FB923C` | orange-700 `#C2410C` (tokens §4) | `CaptureReviewViewport.vue`, `CaptureVerifyView.vue` |
| Open-thread quote | emerald-300 `#6EE7B7` | emerald-700 `#047857` (tokens §4; the web's emerald-600 `#059669` fails AA) | `RecapDialog.vue`, `RecapCard.vue` |
| Progress fill | indigo-400 → violet-400 `#A78BFA` (90°) | same | `BookCard.vue`, `BookGridCard.vue`, `ReadingWideCard.vue` |
| Journey gradient | `#34D399` → `#A78BFA` (135°) | same | `BookProgressPanel.vue` |
| Queue accent | violet-400 `#A78BFA` | violet-600 `#7C3AED` (text) | `LibraryGridView.vue`, `LibrarySearchResults.vue` |
| Opaque overlay surface (menus, dialogs) | `#1C1C2E` | `#FFFFFF` | `main.css` |
| Genre palette (breakdown) | `#6366F1`, `#A78BFA`, `#818CF8`, `#C4B5FD`, `#4F46E5` | same | `LibraryBreakdownCard.vue` |
| Insight type badges (fill 0.18) | History indigo-400 · Culture amber-400 · Geography emerald-400 · Technology cyan-400 · Lore violet-400 | same | `LoreChronoscopeCard.vue` |
| Focus-mode backdrop | indigo glow 0.16 (radial 120 % × 90 % at top centre) over `rgba(11,13,22,0.93)` | glow 0.12 over `rgba(246,247,251,0.93)` | `FocusModeOverlay.vue` |
| Focus timer | indigo-300, 3.4 rem / weight 800, tabular figures | `#4338CA` | `FocusModeOverlay.vue` |
| Focus dim layer | black 0.94; dimmed timer `rgba(178,183,250,0.6)` | same | `FocusModeOverlay.vue` |
| Focus goal chip | dashed border indigo 0.4 → active: solid 0.7 + fill 0.2 | same hue | `FocusModeOverlay.vue` |
| Status banner (glass toast) | Top centre below the safe area, capsule | same | `GlassToast.vue` |

## 7. Dynamic Island & Live Activity for reading sessions

**Phase:** the Live Activity ships in **Phase 3 / App Store v1.0**. The SES-Q19 recommendation is "ship it in v1.0". Its in-app twin, the `.tabViewBottomAccessory` mini timer, ships in **Phase 1**. Both read the same session state: the BC-04 progress-state object.

### 7.1 Lifecycle

| Event | Live Activity |
|---|---|
| `start_session` confirmed (after the gates, SES-15) | `Activity.request(...)` with the attributes and content state below. Push type `nil` until push exists (BC-14). |
| Pause / resume confirmed, from the app or the Lock Screen (`LiveActivityIntent` calling `pause_session` / `resume_session` with the shared Keychain session) | `update` with the new `sessionStartAt` / `sessionPausedAt`. The server shifts the start on resume (SES-18). |
| Session ended by `save_progress` | `end` with a final "Saved · p. {page}" state and a short dismissal delay |
| `cancel_session`, `mark_dnf`, completion, sign-out, account deletion | `end`, dismissal `.immediate` |
| A foreground refresh shows the session ended elsewhere (for example on the PWA) | `end`, dismissal `.immediate` |
| A foreground refresh shows a running session with no local activity (started on the PWA) | Start one, so the timer is on the Lock Screen after the reader leaves the app. A session cannot start remotely without push-to-start (later, BC-14). |
| Long session | `staleDate` = start + 8 h (the system limit). Stale view: "Still reading? Open The Chronicler to end this session." This follows the stale-session rule (OP-04.7 / SES-Q16). |
| Live Activities disabled in Settings (`areActivitiesEnabled == false`) | Use only the in-app accessory. Don't nag. |

### 7.2 Data

- **`ActivityAttributes`:** `bookId`, `title`, `author`, `totalPages`. No image data travels in the payload. The widget extension reads a small cover thumbnail written beforehand to the App Group container.
- **`ContentState`:**
  - `sessionStartAt`: server time, already shifted by pauses;
  - `sessionPausedAt?`;
  - `currentPage`;
  - `goalEndsAt?`: the device-local Focus goal, recomputed on pause and resume because the goal freezes while paused (SES-82).
- **Timer:** `Text(timerInterval: sessionStartAt...Date.distantFuture, pauseTime: sessionPausedAt, countsDown: false)` with monospaced digits. The system ticks it, so there are **no per-second updates**: the app updates only on pause, resume and end. The goal countdown, when set, uses `countsDown: true` up to `goalEndsAt`.

### 7.3 Presentations

| Presentation | Content |
|---|---|
| Lock Screen / banner | Cover thumbnail · title · author (one line) · large elapsed timer · "p. 142 of 380" · "Reading…" or "Paused" · buttons **Pause / Resume** (intent) and **End** (deep link to the page sheet; a page is never saved from the Lock Screen because it has to be entered) · goal countdown when set |
| Dynamic Island, compact | Leading: book glyph or cover thumbnail in an indigo-tinted capsule. Trailing: elapsed timer (monospaced, indigo-300). |
| Dynamic Island, minimal | Book glyph |
| Dynamic Island, expanded | Leading: cover. Trailing: elapsed timer. Centre: title and "p. 142/380". Bottom: Pause / Resume and End, plus the goal countdown when set. |
| Paused | Frozen timer, "Paused" label, **Resume** as the prominent button |

- **Look:** system Live Activity background with a subtle indigo `activityBackgroundTint` and the accent as the system-action foreground. No custom glass. Legible on both Lock Screen appearances.
- **Privacy:** shows only title, author, cover, page numbers and elapsed time. Never notes, page text or recap text (constitution §1).
- **Accessibility:** VoiceOver reads "Reading {title}, 12 minutes, page 142 of 380" (or "…, paused") and supports Dynamic Type within the system's limits.
- **More than one session:** design for one. If concurrent sessions stay allowed (OP-04.6, versus the SES-Q02 recommendation of one active session per user), show an activity only for the most recently started session. The accessory lists the others.

## 8. Where iOS should pull ahead of the PWA

- **Live Activity, Dynamic Island and the tab-bar session accessory** (§7).
- **Widgets** (Phase 3): Currently Reading (cover, page X of Y, forecast), Lock Screen inline "p. 142/380", Word of the Day (content per LEX-Q17), quest ring. Widgets read the App Group cache only.
- **App Intents / Siri / Shortcuts**: "Start reading {book}", "Log page {n} for {book}", "Add book by ISBN", "Review today's words". They return the same errors and copy as the app.
- **Home Screen quick actions**: "Current read", "Add book" (parity with the PWA's manifest shortcuts).
- **Focus mode for real**: idle-timer control, optional real dimming, and a goal notification even when the phone is locked.
- **On-device OCR**: faster and private (D-15).
- **Haptics and zoom transitions** throughout (§3.4).
- **Local notifications**: review reminders ("N words due"; the word itself only if LEX-Q17 allows), Focus-goal end. Permission is asked in context.
- **Later:** Spotlight (optional in Phase 3, otherwise Phase 6); in Phase 6 a Share Extension (select text in Books, Kindle or Safari → add to the Codex), Apple Watch, iPad layouts.

## 9. Design principles (apply to every screen)

1. **Reading-first and calm.** Legible at night; nothing competes with the book.
2. **Every state designed:** empty, loading, error, offline / pending sync, generating, locked, shelved, signed out. Empty states onboard; nothing is ever blank.
3. **Reach.** The primary action is within thumb reach, and core actions are at most two taps from a tab root.
4. **Glass for controls, clarity for content** (§3.2).
5. **Motion with intent.** Short, eased and meaningful, and always gated on Reduce Motion.
6. **Compose, don't reinvent.** Build from the design system; a new shared component needs a recorded reason.
7. **Accessibility is the spec, not a pass:** Dynamic Type, VoiceOver, Reduce Transparency, Increase Contrast, ≥ 44 pt targets, a button for every gesture.
8. **Same rule, same copy on every client.** Copy differences are catalog changes or recorded iOS design choices.
9. **Never a raw error, never a dead end.** Every failure says what to do next.
10. **Privacy on glanceable surfaces.** The Lock Screen, widgets, notifications and the Live Activity show no page text, recap text, notes or quotes.

## 10. Non-goals for v1

- Not a pixel-port of the PWA. Visual parity is **not** a success metric; *feel* parity is.
- No web views and no cross-platform UI frameworks.
- No custom glass engine and no pre-iOS-26 support (D-04).
- No community or social surfaces (D-13); no paywall (D-14); no iPad-specific layouts (iPhone first).
- No on-device AI generation; on-device Vision OCR is the only on-device ML (D-15).
- No sharing of recap images or captures (they stay private).
- No new brand exploration mid-build. If the brand evolves, update this brief first, then the tokens.

## 11. Open decisions that affect the design

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| PLT-Q06 | Theme default | System appearance + Light / Dark / System override, on both clients | Phase 0B |
| INS-Q05 | "Insights" or "Lore" in user copy | "Insight(s)" everywhere; quote badge "Quote" (LEX-D27) | Phase 2 copy (String Catalog from 0B) |
| — (new) | "Reading Journey" vs "Book Passport" | "Reading Journey" in all user copy; add the decision to the catalog | Phase 2 |
| SES-Q19 | Live Activity and widgets in v1 | Live Activity in v1.0; widgets may follow | Phase 3 |
| SES-Q02 / OP-04.6 | Concurrent sessions across books | One active session per user (simplifies the Live Activity) | Phases 1, 3 |
| SES-Q13 | Focus mode: real dimming, goal persistence, notification at the goal | Overlay dim in Phase 1; real dim with guaranteed restore; notification in Phase 3 | Phases 1, 3 |
| CAP-Q07 | Vision OCR calibration (auto-save / review / fallback) | Calibrate on real page photos; until then review every on-device result below the provisional threshold | Phase 2 exit |
| SES-Q11 / CAP-Q02 | Capture prompt after the completing save | Suppress it (`captureAllowed`) | Phase 1 |
| SES-Q10 | Where the session note is entered | In the end-session sheet | Phase 1 |
| XD-Q03 | Shelving while a session runs | "Save page & shelve" / "Discard session & shelve" | Phase 1 |
| LIB-Q06 | Where Edit / Delete live | Swipe + context menu + Book Detail toolbar on every device | Phase 1 |
| SES-Q01 | Explicit hero across relaunches | Open | Phase 1 |
| PRO-Q04 | Level display 0- or 1-based | Display `level + 1` on web and iOS together | Phase 2 |
| INS-Q07 | Insight arrival feedback | Brief banner + Codex tab badge | Phase 2 |
| REC-Q11 | `generate-recap` v2 wire format | Staged progress events + the final persisted row | Phase 2 |
| LEX-Q17 | Word and definition on the Lock Screen and in widgets | Hide the word unless the reader opts in | Phase 3 |
| PLT-Q08 | Localisation | English content, String Catalog from day one, locale-aware dates | Phase 0B |
| — (plan) | iPad in v1 | iPhone-only target; iPad layouts in Phase 6 | Phase 3 |

## 12. How this brief stays honest

- Direction changes land **here first**. They then propagate to the tokens and to `DesignSystem`.
- **Phase 0B gate:** the owner reviews the component gallery on a device in light, dark, Reduce Transparency, Increase Contrast and the largest accessibility text size ([plan Phase 0B](../ios-implementation-plan.md#phase-0b--design-system--app-shell), 0B-2).
- **Every later phase:** the new screens are reviewed as screenshots against this brief before the exit gate. `#Preview` galleries and snapshot tests are the "did we hold the line?" check.
- A deliberate departure from this brief is recorded as an iOS design choice in the iOS repo, with its reason, and folded back into this brief when it proves out.
