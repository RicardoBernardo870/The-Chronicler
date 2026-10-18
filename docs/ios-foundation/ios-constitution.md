<!--
DROP-IN CLAUDE.md FOR THE NATIVE iOS REPOSITORY.

Copy this file to bookhero-ios/CLAUDE.md (repository root), then fill in the two placeholders:
"Docs root" in section 0 and "Commands" in section 14.
Do NOT create .specify/. There is no Spec Kit (D-02).

Canonical source: docs/ios-foundation/ios-constitution.md in the web repository (BookHero).
Amend it there first, bump the version, then copy it again. Rules are never edited in the iOS repo.
Markdown links in this file resolve inside the web repo. In the iOS repo, open the same
paths under the Docs root.

Lineage
  1.0.0  2026-06-20  Spec Kit constitution, adapted from The Chronicler PWA constitution v1.1.0.
  2.0.0  2026-10-18  MAJOR. Changes:
                     - Spec Kit governance replaced by Claude Code / ultracode (D-02).
                     - iOS 26+ and native Liquid Glass only (D-04).
                     - Thin client: rules come from the server and the catalog (D-06).
                     - Multi-client parity (D-05). Time-zone and counting rules (D-07, D-08).
                     - Account deletion, Sign in with Apple and AI consent (D-10, D-11, Guideline 5.1.2(i)).
                     - On-device OCR as the only on-device ML exception (D-15).
                     - Tests named by rule ID.
  2.0.1  2026-10-18  PATCH. Docs-root options led by the bookhero/ submodule (phase prompts §3.2);
                     read-retry policy aligned with PLT-Q10; iOS-repo docs list completed.
-->

# The Chronicler for iOS — CLAUDE.md

Version 2.0.1 · Last updated: 2026-10-18 · Canonical source: `docs/ios-foundation/ios-constitution.md` in the web repo

You are building **The Chronicler** for iPhone. The internal code name is **BookHero**; it is used for the repo `bookhero-ios`, the Supabase project and code identifiers (D-03). The app is a native SwiftUI client on the **same Supabase backend** as the live web PWA, and Android follows later (D-05).

This file sets the principles and the way of working. It does **not** contain the business rules. Those live in the numbered catalog: read them, cite them, and never reinvent them.

## 0. Read first

**Docs root:** `<fill in at scaffold time: bookhero/docs (submodule, recommended) | ../BookHero/docs | docs>`. The options are listed in the web repo's `docs/ios-foundation/README.md`, step 3. **Web-repo commit:** see `SOURCE_COMMIT` (or the submodule pointer).

| Need | Read (relative to the docs root) |
|---|---|
| Behaviour: rules, limits, copy, edge cases | [business-rules/README.md](../business-rules/README.md) (index, legend, glossary, owner decisions D-01 … D-17), then the domain file |
| What the backend does today | [backend-contract.md](../backend-contract.md). Start with §15, Notes for native clients. |
| What the backend will do before and during the iOS build | [backend-consolidation-plan.md](../backend-consolidation-plan.md) (Phase 0A, BC-01 … BC-15) |
| Scope, acceptance criteria and exit gate of the current phase | [ios-implementation-plan.md](../ios-implementation-plan.md) §7 |
| What this session builds | The phase kickoff brief in [ios-phase-prompts.md](../ios-phase-prompts.md) |
| Look and feel | [ios-design-brief.md](ios-design-brief.md), then [design-tokens.md](design-tokens.md), [component-inventory.md](component-inventory.md) and [screen-inventory.md](screen-inventory.md). Each lists what changed since its previous version ([README.md](README.md)). |

**Rule-ID prefixes → catalog file:**

| Prefix | File |
|---|---|
| LIB | `01-library.md` |
| SES | `02-reading-sessions.md` |
| REC | `03-recaps.md` |
| CAP | `04-capture-resume-quiz.md` |
| LEX | `05-codex-lexicon.md` |
| INS | `06-insights.md` |
| PRO | `07-profile-stats-goals.md` |
| PLT | `08-platform-auth-account.md` |
| BE | `09-database-invariants.md` |
| COM | `10-community-circles.md` |
| XD | `11-cross-domain.md` |
| CL | `12-client-logic-register.md` |

`<PREFIX>-Dnn` is a known defect. `<PREFIX>-Qnn` is an open decision.

**Precedence:**

1. Owner decisions.
2. The catalog (behaviour), and the contract and BC plan (backend).
3. The implementation plan (scope).
4. This file (how).
5. The design brief, then the tokens, then the inventories.

If two sources conflict and this order does not settle it, **stop and ask**.

---

## 1. Memory continuity & spoiler safety (NON-NEGOTIABLE)

The app has one job: get a reader oriented and back into their book after a break. It remembers what they read (page captures, recaps, Insights, words, quotes) and brings it back when they return (Memory Check, "Previously", recaps). Every feature is judged by whether it serves that job.

- **MUST:** no AI output shown to the reader refers to content beyond their current position.
  - **Corpus recaps** use only the reader's own captured page text inside the recap window.
  - **Inferred recaps** (no captures in range) are built on the server from book metadata with Google Search grounding, so they can contain spoilers. The inferred-recap warning **must** come before generation ([REC-17](../business-rules/03-recaps.md#rec-17--the-inferred-recap-warning-uses-a-different-window)). From BC-07 on, the warning and the mode come from **one server decision**; the client never picks the mode.
  - **Insights** are generated by the server from a recap, then from captures, then from spoiler-guarded book metadata (D-12, BC-08). A card built from metadata is labelled as such.
  - **"Previously"** resumes and **Memory Check** quizzes come only from the reader's captures (CAP-48 … CAP-78).
- **MUST:** recap generation is always an explicit action by the reader ([REC-01](../business-rules/03-recaps.md#rec-01--generation-is-always-explicit)). Only server-owned jobs (Insights, passport summary, Reading DNA) run without a tap.
- **MUST:** the Lock Screen, widgets, notifications and Live Activities never show page text, recap text, notes or quotes. Whether the Word of the Day may appear there is LEX-Q17.
- A recap has three parts: `memory_jogger` (prose), `concept_watchlist` ("Keep an eye on" chips) and `thematic_bridge` (the open-thread quote) ([REC-70](../business-rules/03-recaps.md#rec-70--recap-modal-states--copy)).

*Why:* the product is worthless if a recap spoils the plot or misjudges where the reader is.

## 2. Physical-to-digital bridge

- **Absolute page numbers** are the unit. Percentage = `current_page / total_pages × 100`, rounded to 2 decimals, capped at 100, and derived when used. It is never stored (XD-02).
- **The capture page is the reader's current page** at capture time, never an OCR result ([CAP-28](../business-rules/04-capture-resume-quiz.md#cap-28--page-number-comes-from-progress-never-from-ocr)). One capture per page (CAP-30). **Page images are transient**: they are never written to disk, Storage or logs ([CAP-90](../business-rules/04-capture-resume-quiz.md#cap-90--page-images-are-transient)).
- **Add paths**, all first-class:
  - ISBN scan (VisionKit `DataScannerViewController`, EAN-13);
  - search through the `book-search` proxy (BC-15);
  - manual entry, always available;
  - CSV import from Goodreads or StoryGraph through `import_library` (LIB-66 … LIB-86).
- Ebook readers capture by uploading a screenshot (LIB-97).
- Every third-party lookup (search, ISBN, dictionary, AI) **must** fail gracefully. A lookup failure never blocks progress tracking.

## 3. AI through edge functions only

- **MUST NOT:**
  - generate AI content on the device;
  - ship prompts;
  - hold provider keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) or the service-role key.
- AI runs only in the Supabase edge functions: `generate-recap`, `generate-lore` (Insights), `ocr-page`, `extract-vocabulary`, `generate-page-resume`, `generate-book-quiz`, `generate-reading-dna`. The **deployed** versions are canonical (D-09).
- **The one on-device exception (D-15):** Apple Vision text recognition for page capture, falling back to `ocr-page` on low confidence.
  - The PWA's 0.90 auto-save and 0.70 warning thresholds are calibrated to Gemini's self-reported confidence. **Never copy them.** Vision thresholds come from the CAP-Q07 calibration.
  - No other on-device ML (including Apple's on-device foundation models) is allowed without a new owner decision.
  - System capture features are not AI generation: barcode scanning and document-camera edge detection.
- **MUST:** the third-party AI consent sheet comes before the **first** AI call, and the server enforces it (PLT-Q03, Guideline 5.1.2(i), BC-11).
- **MUST NOT** auto-retry costly, non-idempotent AI calls (`generate-recap`, `generate-lore`). Once a recap is paid for, the server finishes and saves it, even if the sheet closes or the app goes to the background (BC-07).
- **MUST:** map AI and server errors to friendly copy. Never show a raw server string (REC-D19).
- Quotas and entitlements are checked on the server (BC-12). The client never gates on its own.

## 4. Thin client: rules come from the server and the catalog (NON-NEGOTIABLE)

- **The server owns:**
  - progress writes and session timing (BC-04);
  - completion and its effects (BC-05);
  - recap eligibility and persistence (BC-07);
  - Insight milestones and generation (BC-08);
  - achievements (BC-09);
  - review scheduling (BC-10);
  - XP, levels, quest, streaks and stats, in the reader's time zone (BC-06);
  - passport stats and Reading DNA eligibility (BC-05).

  The client **must not** compute or persist any of these. It calls the RPC or edge function, renders the result (progress-state object, `completion`, `effects`) and replaces its local state with the server's response.
- The client **never writes directly** to server-owned tables: `reading_progress`, `progress_history`, `recaps`, `lore_cards`, `book_passports`, `reading_dna`, `achievements`. The PWA still does during the transition; iOS never does.
- **Client-side rules are allowed only where the catalog says so.** These are the rows of [12 · Client-logic register](../business-rules/12-client-logic-register.md) whose target home is `client (all clients)` or `client (per platform)`. Examples:
  - page-sheet validation (SES-24 … SES-27);
  - hero inference (SES-59 … SES-62);
  - onboarding states (SES-55);
  - Memory Check gating (CAP-61 … CAP-64);
  - formatting (PLT-67 … PLT-69).

  Each one lives as a pure, unit-tested function in `ChroniclerCore/Policies` and **cites its ID** in a doc comment (`/// Rule: SES-24`).
- **A behaviour with no rule ID → stop.** Either the rule goes into the catalog first (web repo), or it is recorded as an **iOS design choice** in this repo's `docs/ios-design-choices.md`: what, why, related rule IDs. Never silently.
- **Implement the rule, not the PWA's bug.** Known defects (`<PREFIX>-Dnn`) are never reproduced. Examples: an offline queue replayed as the next user (XD-43), a velocity cache that drops other books (LIB-108), unbounded image polling (REC-48).
- **No stopgaps for a missing server package.** The phase gates guarantee the packages exist. If a kickoff brief explicitly allows an interim client rule, implement exactly the interim rule the catalog describes and mark it `// Interim until BC-xx`.

## 5. Data integrity & sync

- **Supabase is the source of truth.** SwiftData holds a per-user cache and the sync queue, in an App Group container. User data is never lost to an app kill, a token refresh, a lost connection or a device switch.
- **Progress and session writes go only through the BC-04 RPCs:** `start_session`, `pause_session`, `resume_session`, `cancel_session`, `save_progress`, `set_session_note`, `mark_dnf`, `resume_dnf`, `set_initial_status`. They use the **server clock**. The device clock is used only as `p_client_occurred_at` of an offline replay (D-08).
- **Offline queue:**
  - Each save gets an **idempotency key** (a UUID created once per user action and reused on every retry) and its **original occurred-at time**.
  - The queue is FIFO and **scoped by user id**.
  - It drains on foreground, when `NWPathMonitor` reports a usable path, and opportunistically in the background.
  - Permanent errors (`book_not_found`, `23503`, `42501`) are dropped with a visible notice. Transient errors back off.
  - A stale replay (`"stale": true`) never rewinds the page.
  - The "pending sync" indicator is computed from the queue's real contents.
  - Offline is detected from failed requests, not from reachability alone.
- **Online-only in v1:** session start, pause, resume and cancel (SES-Q03); library mutations; AI; capture save; search; import.
- **Counting (D-08):** any forward page change counts for pages, streaks and charts, including offline replays at their original time. Session XP, session-count badges and the Last Session card need a real timed session. The server computes all of it; the client displays it.
- **Time zone (D-07):**
  - Call `set_my_time_zone(TimeZone.current.identifier)` at launch and whenever the system time zone changes.
  - Pass `p_timezone` to every stats RPC.
  - Decode `YYYY-MM-DD` fields as floating calendar dates, never as UTC midnights ([PLT-68](../business-rules/08-platform-auth-account.md#plt-68--absolute-dates-and-date-only-parsing)).
- **Identity:**
  - One signed-in account per device.
  - A user change (sign-out, account deletion, another account) **wipes everything local** and cancels in-flight tasks (XD-41 … XD-46). That means the SwiftData store, the queue, image caches, App Group caches, widget timelines, Live Activities and per-user defaults.
  - Never pass another user's id. New RPCs take no `p_user_id`; on legacy RPCs it must equal the caller.
- **Transport:**
  - `statement_timeout` is 8 s for `authenticated`, so request timeouts are ≥ 10 s for PostgREST and RPC calls and ≥ 120 s for recap generation.
  - Business errors arrive as HTTP 400 `{code:"P0001", message:"<code>"}`. Switch on `message` and never retry them.
  - Retry idempotent reads on network errors, 503 or 520 with 1 / 2 / 4 s backoff (PLT-Q10), and once on `57014`.
  - Never auto-retry a write that has no idempotency key.
  - On a 401, refresh the session and retry once (PLT-33, PLT-Q10).
- **Freshness:** SWR semantics per key, with the TTLs and invalidation map of PLT-24 … PLT-31. Refresh stale on-screen data on `scenePhase == .active`. "Invalidate" means: show the cached data and refresh in the background.

## 6. Native iOS first

- **SwiftUI throughout.** UIKit only through representables where no SwiftUI API exists (`VNDocumentCameraViewController`, `DataScannerViewController`). No web views and no cross-platform UI frameworks.
- **iOS 26.0 minimum, iPhone, portrait in v1** (D-04). No `if #available` branches for older systems.
- **The HIG wins** over the PWA's look, unless a catalog rule marks the behaviour as a product rule (for example the page-sheet validation and copy).
- **System components first:**
  - `TabView` with the floating tab bar and `.tabViewBottomAccessory`;
  - `NavigationStack` with typed routes;
  - `List`, `.searchable`;
  - `.swipeActions` plus context menus (never gesture-only);
  - `.sheet` with detents, `.confirmationDialog`, `.alert`, `Menu`;
  - `ShareLink`, `PhotosPicker`, `.fileImporter`, Swift Charts.
- **Core actions within two taps** of a tab root: start or end a session, save a page, get a recap.
- **Performance budgets** (plan §8.8):
  - cold launch → library from cache < 1.5 s;
  - warm launch < 0.5 s;
  - cached Book Detail < 200 ms;
  - online page save < 1 s p95.

## 7. Design-system-first with native Liquid Glass (NON-NEGOTIABLE)

- **Phase 0B builds `DesignSystem`**: tokens, components and a preview gallery. Every screen composes it. Screens never invent colours, type sizes, spacing, radii or one-off controls; a lint rule forbids those literals outside `DesignSystem`.
- **Liquid Glass is the glass (D-04).**
  - System bars, sheets, menus and alerts get it for free.
  - Custom glass uses `.glassEffect(_:in:)`, with `GlassEffectContainer` around groups and `.glassEffectID(_:in:)` for morphs.
  - Glass buttons use `.buttonStyle(.glass)` or `.buttonStyle(.glassProminent)`.
- **Forbidden:** `Material` as a stand-in for glass, re-creating the PWA's rgba/blur recipe, an `.appGlass()`-style availability helper, and glass on glass.
- **Glass belongs to the navigation and control layer.** Text-dense content (recap prose, definitions, lists, forms) sits on legible tokened surfaces ([design brief §3](ios-design-brief.md#3-visual-language-native-liquid-glass-on-ios-26)).
- **Reduce Transparency and Increase Contrast are respected.** Every custom glass surface is checked in the gallery with each setting on.
- **One brand tint:** indigo `#6366F1`. Artwork is dark-first; light mode is first-class. Appearance follows the system with a manual override, unless PLT-Q06 decides otherwise.
- Every reusable view ships a `#Preview`. The gallery renders light, dark, Reduce Transparency, Increase Contrast and the largest accessibility text size, with a snapshot baseline.
- Views over about 150 lines are split up. Screens own state and layout; `Features/<X>/Views` and `DesignSystem/Components` do the presentation.
- Names are PascalCase domain names (`HeroBookCard`, `BookCover`, `QuestRing`), never `Box`, `Wrapper` or `Helper`.
- A new shared component is added only when nothing in the design system fits. The reason goes in its doc comment.
- Look-and-feel changes go to the design brief first, then the tokens, then the code.

## 8. Accessibility is part of the spec

- **Dynamic Type everywhere**, with no fixed point sizes. The Focus-mode timer uses `@ScaledMetric` and `.monospacedDigit()`.
- **VoiceOver:**
  - every control has a label; covers read "Cover of {title}";
  - the session timer reads like "Session 12 minutes, paused", with no per-second announcements;
  - a locked button includes the reason ("Locked, 12 more pages");
  - flashcards and queue reordering have custom actions;
  - banner states are announced.
- Every gesture has a button equivalent. Hit targets are ≥ 44 pt.
- **Reduce Motion** turns off shimmer sweeps, zoom transitions, ring fills and dim fades. **Reduce Transparency** and **Increase Contrast** are honoured.
- Colour is never the only signal. Custom text meets WCAG AA contrast. Charts have audio graphs.
- A screen is not done until it works at the largest accessibility text size and with VoiceOver.

## 9. Privacy & App Store compliance (NON-NEGOTIABLE)

- **Account deletion (D-10, Guideline 5.1.1(v)).** Settings → Delete account:
  1. A confirmation that lists what is deleted.
  2. Re-authentication within 5 minutes: password, a fresh Apple credential or an OTP.
  3. The `delete-account` edge function deletes immediately and for good: Storage purge, Apple token revocation, `auth.admin.deleteUser`, foreign-key cascades.
  4. A full local wipe, then the sign-in screen.

  The web gets the same flow.
- **Auth (D-11):**
  - Sign in with Apple, plus email and password.
  - Password reset.
  - Magic links and reset links arrive as universal links (PKCE).
  - Existing email users can link an Apple ID from Settings.
  - Point Hide-My-Email users to "Already have an account? Sign in with email" first, so they don't create an empty duplicate account.
- **Third-party AI consent (Guideline 5.1.2(i)).** A one-time sheet before the first AI feature names Google (Gemini, including Google Search grounding) and OpenAI. Consent is recorded server-side (`record_ai_consent`). Declining keeps every non-AI feature working.
- **Profile v1 (D-13):** username, display name and avatar **only**. No bio, privacy settings, public toggle, follows, discovery or circles. New profiles are not public. Profile updates are partial and never reset fields set on the web.
- **Monetisation (D-14) is undecided.** No paywall, no tiers and no client-side gating. Show only the server's entitlement state.
- **Secrets:**
  - Only the publishable key and the project URL ship, as xcconfig `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The names are in git; the values are injected.
  - No Google Books key (BC-15).
  - supabase-swift keeps the session in the Keychain. Extensions share it through a Keychain access group.
- **Logging:** `OSLog` with privacy redaction. Never log titles, words, quotes, notes, page text, recap text or tokens. No analytics or crash SDK unless PLT-Q15 decides on one; the default is MetricKit plus the Xcode Organizer.
- **Store requirements:**
  - privacy manifest (`PrivacyInfo.xcprivacy`, `NSPrivacyTracking = false`, only the required-reason APIs actually used);
  - App Privacy labels per plan §8.2;
  - `NSCameraUsageDescription`;
  - notification permission asked in context.
- Wiktionary (CC BY-SA) attribution in the Codex (LEX-103). Privacy policy and terms linked from sign-in and Settings.
- Captures and recap images stay private and are never shared publicly.

## 10. Multi-client parity (NON-NEGOTIABLE, D-05)

- **One backend, many clients. Never fork backend behaviour for iOS.** No iOS-only RPCs, edge-function modes, columns, flags or response shapes. Every backend change:
  - is client-agnostic and backward compatible (expand → migrate → contract);
  - lands as a migration in the **web repo** (BC-03);
  - updates the contract and the catalog in the same change;
  - is adopted by the PWA too.
- **This repo never changes the backend.** No DDL or DML, no edge-function deploys, no dashboard SQL, no `supabase` CLI against production. Backend work is a web-repo task.
- **Same account, same numbers.** For the same time zone, iOS and the PWA show identical stats, XP, quest, Last Session and forecast.
- iOS and the PWA run side by side on one account. Refresh sessions, pause state and per-book caches on foreground.
- Rules are stated client-agnostically, so Android can implement the same catalog.

## 11. Technical stack

| Layer | Choice |
|---|---|
| OS, toolchain | iOS 26.0+, iPhone; Xcode 26; Swift 6 language mode with complete strict concurrency |
| UI and state | SwiftUI; Observation (`@Observable`); no `ObservableObject` or Combine pipelines. Feature models are `@MainActor`; repositories and the sync engine are actors. |
| Local data | SwiftData (per-user cache + `SyncOperation` queue) in an App Group container |
| Backend | `supabase-swift`: Auth, PostgREST, `.rpc`, Functions, Storage. `URLSession.bytes(for:)` reads the streamed `generate-recap` response. |
| Design | Liquid Glass (`.glassEffect`, `GlassEffectContainer`, glass button styles, floating tab bar, `.tabViewBottomAccessory`); Swift Charts |
| Capture and OCR | `VNDocumentCameraViewController` or an AVFoundation still; `PhotosPicker` / `.fileImporter`; Apple Vision text recognition with `ocr-page` fallback (D-15) |
| ISBN | VisionKit `DataScannerViewController` (EAN-13), with `AVCaptureMetadataOutput` as fallback |
| Speech | `AVSpeechSynthesizer`, pinned to `en-US` (LEX-69) |
| System surfaces | ActivityKit (Live Activity / Dynamic Island), WidgetKit, App Intents, UserNotifications (local), BackgroundTasks (opportunistic drain) — Phase 3 |
| Auth UI | AuthenticationServices (Sign in with Apple), Associated Domains (universal links) |
| Later | StoreKit 2 (only after D-14), APNs (only after `device_tokens`, BC-14) |
| Dependencies | `supabase-swift`; one image pipeline (chosen in Phase 0B); `swift-snapshot-testing` (tests only). **Anything else needs a written reason added here.** |

## 12. Project layout

```text
bookhero-ios/
├── CLAUDE.md                 # this file
├── bookhero/                 # read-only docs submodule of the web repo (if that option was chosen)
├── docs/                     # ios-design-choices.md, phases/<phase>/ ledgers and design notes, generated rule-coverage.md
│                             # (+ vendored web docs and SOURCE_COMMIT, if that option was chosen)
├── Config/                   # .xcconfig per environment; names only in git
├── App/                      # @main, scenes, router, deep links, app delegate
├── Packages/
│   ├── ChroniclerCore/       # domain models, Policies (pure, rule-ID tested), formatters; no UI, no I/O
│   ├── BackendKit/           # supabase-swift client, DTOs, typed RPC/edge wrappers, errors, retry, stream reader
│   ├── Persistence/          # SwiftData models, per-user store, App Group access, wipe hook
│   └── DesignSystem/         # tokens, glass usage, components, preview gallery
├── Features/                 # Auth, Settings, Home, Library, AddBook, Import, BookDetail, Session, Focus,
│                             # Capture, Recaps, Insights, Codex, Review, Passport, Profile, TrophyRoom, ReadingStats
├── Intents/  Extensions/     # App Intents; widgets + Live Activity UI (Phase 3)
└── Tests/                    # ChroniclerCoreTests, BackendContractTests, SnapshotTests, UITests
```

Layer rules: views never call the network or hold business rules; feature models never compute server-owned results; repositories never leak data across users; BackendKit never holds a service-role or provider key.

## 13. Testing conventions

- **Tests are named by rule ID**, using Swift Testing:

  ```swift
  @Test("SES-24 · page outside 0…total is blocked")
  ```

  A test may cite several IDs. A regression test for a PWA defect cites the rule and the defect (`"… (regression SES-Dnn)"`).
- **Every client-side rule** (a register row) has unit tests in `ChroniclerCoreTests`. Port the PWA's fixtures where they exist: recap lock, milestones, master recap, Leitner, page save.
- **Every server call** has a contract test in `BackendContractTests`, run against a **staging** backend seeded with fixture accounts, never production. A contract test covers:
  - request encoding;
  - decoding: 0–6 fractional seconds, absent keys, nullable numbers;
  - typed `P0001` errors;
  - 401 refresh;
  - time zones.
- **Sync tests:** replay, idempotency, stale replay, user switch, deleted book, clock skew.
- **Snapshot tests:** design system and key screens in light and dark, at accessibility sizes, with Reduce Transparency and with Increase Contrast.
- **UI tests (XCUITest):**
  - sign in;
  - add a book;
  - start → end a session → save the page;
  - offline save and replay;
  - delete the account.
- Never weaken, skip or delete a test to get green. Fix the code, or raise the rule with the owner.

## 14. Working with Claude Code (ultracode)

- **Tooling (D-02):** Claude Code with Opus 5.5 in **ultracode** mode. **No Spec Kit:** no `.specify/`, no Spec Kit commands, no spec folders, no generated spec, plan or task files.
- **Session scope:** one phase kickoff brief from `ios-phase-prompts.md` (Phase 0B, then 1 … 6). Phase 0A runs in the web repo, not here.
- **Working loop:**
  1. Read the brief, then the catalog files it names, the contract sections and the plan's phase section.
  2. List the rule IDs and acceptance criteria you will satisfy, and flag every open decision (`<PREFIX>-Qnn`) in scope.
  3. Build in vertical slices: backend call → repository → model → view → tests.
  4. Write tests named by rule ID, plus contract tests.
  5. Build, lint and run every test.
  6. Update docs in the same change set (§15).
  7. The work is done only when the phase's acceptance criteria are green and its exit gate is met.
- **Stop and ask the owner when:**
  - a rule is missing, ambiguous or contradicts another;
  - an open decision in scope has no answer (follow its recommendation only if the brief says so);
  - the work needs a backend change;
  - a step would touch secrets, delete data, sign or submit to App Store Connect, or run against the production project;
  - a new dependency would be added.
- **Git:** one branch per slice; small commits; never commit secrets or xcconfig values; never force-push `main`.

**Commands** (fill in at scaffold time):

```sh
xcodebuild -scheme <AppScheme> -destination 'platform=iOS Simulator,name=<iPhone simulator>' build
xcodebuild -scheme <AppScheme> -destination 'platform=iOS Simulator,name=<iPhone simulator>' test
swift test --package-path Packages/ChroniclerCore
swiftlint --strict
swift format lint --recursive .
```

## 15. Keeping docs in sync

- **The canonical docs live in the web repo:**
  - the catalog;
  - the contract;
  - the BC plan;
  - the implementation plan;
  - the phase briefs;
  - `docs/ios-foundation/`.

  This repo holds only this `CLAUDE.md` (a copy), `docs/ios-design-choices.md`, the per-phase scope ledgers and design notes in `docs/phases/`, the generated `docs/rule-coverage.md`, the docs pointer (submodule, `SOURCE_COMMIT` or snapshot) and code-level documentation.
- When a change alters behaviour, the same change set updates, in the web repo:
  - the catalog entry (rule text, and "server-enforced" vs "client");
  - the contract;
  - the plan's status table.
- When a BC package lands or the catalog changes, refresh the docs pointer and re-read the affected rules.
- When the canonical constitution changes, copy it here again and keep the filled-in placeholders.
- Look-and-feel changes go to the design brief first, then the tokens, then the code.

## 16. Governance

- This file is the root `CLAUDE.md` of `bookhero-ios`. Owner decisions and the catalog override it on behaviour.
- **To amend it**, change `docs/ios-foundation/ios-constitution.md` in the web repo with a written rationale, then:
  1. Bump the version: MAJOR removes or redefines a principle, MINOR adds or expands one, PATCH clarifies.
  2. Update "Last updated".
  3. Copy the file here again.
  4. Check the design brief and inventories for knock-on changes.
- Principles 1, 4, 7, 9 and 10 change only through an owner decision recorded in the decisions log.
