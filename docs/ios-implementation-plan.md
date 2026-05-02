# BookHero iOS — Implementation Plan

> A staged roadmap from empty Xcode project to full-featured native iOS app, designed for incremental release and AI-assisted coding.

**Last updated:** 2026-05-02
**Target platforms:** iOS 17+ (iPhone), iPadOS 17+ optional later
**Distribution:** App Store

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Backend Reuse Strategy](#5-backend-reuse-strategy)
6. [Phased Roadmap](#6-phased-roadmap)
7. [MVP — Phase 1](#7-mvp--phase-1)
8. [Phase 2 — Core AI Features](#8-phase-2--core-ai-features)
9. [Phase 3 — Native Polish](#9-phase-3--native-polish)
10. [Phase 4 — Subscriptions](#10-phase-4--subscriptions)
11. [Phase 5 — Community](#11-phase-5--community)
12. [Phase 6 — Advanced & Platform Expansion](#12-phase-6--advanced--platform-expansion)
13. [Cross-Cutting Concerns](#13-cross-cutting-concerns)
14. [Release Strategy](#14-release-strategy)

---

## 1. Vision & Principles

BookHero iOS is a **native rebuild** of the existing PWA, sharing 100% of the Supabase backend (database, RPC functions, AI Edge Functions) but rebuilding the client layer to feel indistinguishable from a first-party Apple app.

### Core Principles

- **Native > Cross-platform** — SwiftUI throughout. No React Native, no Flutter.
- **Backend stays untouched** — all server logic is already production-ready.
- **Apple HIG compliance** — every interaction follows iOS Human Interface Guidelines.
- **Liquid Glass design language** — `.ultraThinMaterial` everywhere, matches existing PWA glassmorphism.
- **Offline-first** — SwiftData local persistence + sync layer. App works without network.
- **Privacy-first** — feature-gating done server-side; sensitive data stays local where possible.
- **Incrementally shippable** — every phase is a working, App Store-submittable build.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | Swift 5.10+ | Strict concurrency enabled |
| UI | SwiftUI (100%) | UIKit only via `UIViewRepresentable` for VisionKit/StoreKit views |
| Min iOS | 17.0 | Enables `@Observable`, SwiftData, `MeshGradient` (18) feature-flagged |
| State | `@Observable` macro | Replaces `ObservableObject` boilerplate |
| Persistence | SwiftData | Local cache + offline queue |
| Networking | Supabase Swift SDK + URLSession | Same endpoints as PWA |
| AI | Existing Supabase Edge Functions (Gemini 2.5 Flash) | Zero rewrite |
| Auth | Supabase Auth + Sign in with Apple | Must support Apple per App Store rules |
| Subscriptions | StoreKit 2 | Native, async/await |
| Analytics | TelemetryDeck or PostHog | Privacy-respecting |
| Crash reporting | Sentry | Already used in PWA, share project |
| OCR | VisionKit `DataScannerViewController` | On-device |
| Camera | AVFoundation | Wrapped in SwiftUI |
| Notifications | UserNotifications + APNS | Via Supabase Edge Function |
| Background | BGAppRefreshTask | Offline queue drain, sync |
| Widgets | WidgetKit | Home + Lock Screen |
| Live Activities | ActivityKit | Reading session timer |

### Dependencies (SPM)

- `supabase-swift` — Supabase client
- `Sentry` — crash reporting
- `Kingfisher` — image caching for book covers
- `swift-collections` — `OrderedSet` for queue ordering

Avoid heavy dependencies. Native first.

---

## 3. Architecture Overview

### High-Level

```
┌─────────────────────────────────────────────────────────┐
│                     SwiftUI Views                       │
│  (LibraryView, BookDetailView, DashboardView, ...)      │
└───────────────────────┬─────────────────────────────────┘
                        │ @Environment(\.repository)
┌───────────────────────▼─────────────────────────────────┐
│              Repositories (@Observable actors)          │
│  BooksRepository · ProgressRepository · UpNextRepo ...  │
│  - SWR-style cache primitive                            │
│  - Optimistic updates + rollback                        │
└───────────────────────┬─────────────────────────────────┘
                        │
       ┌────────────────┴─────────────────┐
       │                                  │
┌──────▼──────────┐              ┌────────▼─────────┐
│   SwiftData     │              │ Supabase Client  │
│   (local cache) │              │  (network)       │
│  - Book         │              │  - Auth          │
│  - Progress     │              │  - Database      │
│  - Lexicon      │              │  - RPC           │
│  - SyncQueue    │              │  - Functions     │
└─────────────────┘              │  - Realtime      │
                                 │  - Storage       │
                                 └──────────────────┘
```

### Patterns

- **Repository pattern** — one repo per Pinia store from PWA, modeled as `@Observable` Swift class
- **Actor isolation** for write paths to prevent race conditions
- **SWR cache** — reuse the TTL/staleness/invalidation pattern from `useCache.ts`
- **Optimistic updates** — UI updates first, repository syncs to Supabase, rollback on failure
- **Offline queue** — SwiftData-backed `SyncOperation` model, drained on connectivity restore

### Repository Mapping

| PWA Pinia Store | iOS Repository |
|---|---|
| `useBooksStore` | `BooksRepository` |
| `useProgressStore` | `ProgressRepository` |
| `useUpNextStore` | `UpNextRepository` |
| `useAuthStore` | `AuthRepository` |
| `useLoreCardsStore` | `LoreRepository` |
| `useRecapsStore` | `RecapsRepository` |
| `useLexiconStore` | `LexiconRepository` |
| `useReadingDnaStore` | `ProfileRepository` |
| `useCapturesStore` | `CapturesRepository` |
| `useBookPassportStore` | `PassportRepository` |

---

## 4. Project Structure

```
BookHero-iOS/
├── App/
│   ├── BookHeroApp.swift            // @main, environment setup
│   ├── AppDelegate.swift            // APNS, background tasks
│   └── RootView.swift               // auth-gated TabView
│
├── Core/
│   ├── Network/
│   │   ├── SupabaseClient+Setup.swift
│   │   └── APIError.swift
│   ├── Cache/
│   │   ├── SWRCache.swift           // port of useCache.ts
│   │   └── CacheKey.swift
│   ├── Sync/
│   │   ├── SyncQueue.swift
│   │   └── SyncOperation.swift      // @Model
│   ├── Auth/
│   │   └── AuthRepository.swift
│   └── Extensions/
│       ├── Date+Format.swift        // mirrors src/utils/date.ts
│       └── View+Modifiers.swift     // .glassCard(), .pageBackground()
│
├── Features/
│   ├── Library/
│   │   ├── Views/
│   │   │   ├── LibraryView.swift
│   │   │   ├── LibrarySectionView.swift
│   │   │   ├── BookCardRow.swift
│   │   │   └── BookGridCell.swift
│   │   ├── BooksRepository.swift
│   │   └── Models/
│   │       ├── Book.swift           // @Model SwiftData
│   │       └── LibraryEntry.swift
│   │
│   ├── BookDetail/
│   │   ├── Views/
│   │   │   ├── BookDetailView.swift
│   │   │   ├── BookDetailHeader.swift
│   │   │   └── ProgressPanel.swift
│   │   └── ProgressRepository.swift
│   │
│   ├── Dashboard/
│   ├── Recaps/
│   ├── Lexicon/
│   ├── Lore/
│   ├── Profile/
│   ├── Capture/                     // OCR + corpus recaps
│   ├── Subscription/
│   └── Community/                   // later phase
│
├── Widgets/
│   └── BookHeroWidgets/
│       ├── CurrentlyReadingWidget.swift
│       ├── LockScreenWidget.swift
│       └── DailyWordWidget.swift
│
├── LiveActivity/
│   └── ReadingSessionActivity.swift
│
├── Extensions/
│   ├── ShareExtension/              // Share to Lexicon
│   └── ActionExtension/             // Quick add book
│
├── Resources/
│   ├── Assets.xcassets
│   ├── Localizable.xcstrings
│   └── Info.plist
│
└── Tests/
    ├── UnitTests/
    └── UITests/
```

---

## 5. Backend Reuse Strategy

**Zero backend rewrite.** Every Supabase resource is consumed as-is.

### Reused Resources

- **All tables** — `books`, `reading_progress`, `progress_history`, `lexicon_entries`, `lore_cards`, `recaps`, `book_passports`, `reading_dna`, `vocabulary_extractions`, `page_captures`, `up_next_order`
- **All RPC functions** — `get_library_with_progress`, `get_reading_stats`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity`
- **All Edge Functions** — `generate-recap`, `generate-lore`, `generate-reading-dna`, `extract-vocabulary`, `ocr-page`
- **All RLS policies** — already enforce per-user isolation
- **Auth schema** — Supabase Auth supports Sign in with Apple natively

### What's New on Backend (incremental, additive)

| Phase | Addition | Purpose |
|---|---|---|
| 4 | `subscriptions` table + `verify-apple-receipt` Edge Function | StoreKit receipt validation |
| 5 | `user_profiles`, `follows`, `activity_feed`, `reading_circles`, `circle_reactions`, `book_clubs` tables | Community |
| 5 | `notify-on-progress` Edge Function | Fan-out feed events to APNS |
| 6 | `device_tokens` table | APNS push targeting |

All additive — never breaks existing PWA.

---

## 6. Phased Roadmap

| Phase | Name | Duration | App Store? | Goal |
|---|---|---|---|---|
| 1 | MVP — Read & Track | 4–6 weeks | TestFlight | Library, progress, basic detail page |
| 2 | Core AI Features | 3–4 weeks | TestFlight | Recaps, Lexicon, Lore |
| 3 | Native Polish | 3–4 weeks | **Public launch v1.0** | Widgets, Live Activity, OCR, haptics |
| 4 | Subscriptions | 2–3 weeks | v1.1 | StoreKit 2, paywall, tiers |
| 5 | Community | 6–8 weeks | v2.0 | Profiles, follows, circles, book clubs |
| 6 | Advanced | Ongoing | v2.x | iPad, Mac Catalyst, Vision Pro, audio recaps |

Each phase ends with a buildable, App Store-submittable artifact. Internal TestFlight builds throughout.

---

## 7. MVP — Phase 1

> **Goal:** A user can sign up, add books, track reading progress, and see their library. Nothing else. Ship to TestFlight.

### Features

- Sign in with Apple (mandatory) + email/password fallback
- Manual book entry (title, author, total pages, cover URL)
- ISBN scan → autofill (VisionKit barcode scanner)
- Library page (3 sections: Currently Reading / The Queue / Archives)
- Drag-to-reorder Queue (native `List.onMove`)
- Swipe-left actions (Edit / Delete) — native `.swipeActions`
- Book detail page with progress slider
- "Page X of Y" + percentage
- Save progress (optimistic + offline queue)
- Sign out

### Architecture deliverables

- `SupabaseClient` setup
- `AuthRepository` with Sign in with Apple
- `BooksRepository` + `ProgressRepository` + `UpNextRepository`
- SWR cache primitive ported
- SwiftData models: `Book`, `Progress`, `SyncOperation`
- Offline sync queue with `BGAppRefreshTask` drain
- Glassmorphism design tokens (Colors, Materials, Typography)

### Out of scope for MVP

- AI features (recaps, lore, lexicon) — Phase 2
- Widgets, Live Activities — Phase 3
- Subscriptions — Phase 4 (everything free during MVP)

### Success criteria

- Add 5 books, track progress, close app, reopen → state intact
- Toggle airplane mode mid-save → save persists locally → drains on reconnect
- Sign out → sign back in → library restored from server
- Submit to TestFlight, internal testers can install

---

## 8. Phase 2 — Core AI Features

> **Goal:** Bring the AI features from PWA to parity. All free during this phase.

### Features

- **AI Recaps** — `generate-recap` Edge Function call, streaming response via `AsyncStream`
- **Recap history** per book
- **Lexicon** — manual entry, browse by book, flashcard review (Leitner)
- **Lore Cards** — auto-unlock at milestones (50%, 75%, 100%)
- **Lore Chronoscope** — collapsible card on book detail
- **Reading DNA / Profile page** — calls `generate-reading-dna` once threshold met
- **Book Passport** — auto-generated on book completion
- **Dashboard page** — "Last session" card, "Up Next" inline, "Currently Reading" hero

### New Repositories

- `RecapsRepository`
- `LexiconRepository`
- `LoreRepository`
- `ProfileRepository`
- `PassportRepository`

### UI work

- Streaming recap text (token-by-token)
- Flashcard swipe gesture (drag to know/don't know)
- Lexicon search + filter
- DNA visualization (radar chart or stylized tags)

### Success criteria

- Generate 10 recaps, all stream successfully
- Add 30 lexicon entries, complete a Leitner review session
- Hit 50% on a book, lore card auto-unlocks within 3s
- DNA profile generates after 3 finished books

---

## 9. Phase 3 — Native Polish

> **Goal:** This is where iOS pulls ahead of the PWA. Public App Store launch v1.0.

### Features

- **Home Screen Widget — Currently Reading** (small, medium)
- **Lock Screen Widget — Page X of Y** (inline)
- **Live Activity — Reading Session** (Dynamic Island + Lock Screen)
- **VisionKit OCR** — corpus recap captures (replaces Gemini multimodal OCR for capture step)
- **Haptic feedback** throughout (page save, session end, milestone)
- **Matched geometry transitions** — book cover flies from library → detail
- **Sensory feedback** on slider — pulse every 10 pages
- **SF Symbols 6 animations** — `.bounce` on save, `.pulse` on streaming
- **Pull-to-refresh** with custom animation
- **Context menus** on long-press of book cards
- **Share sheets** — share book, share recap as image
- **Local notifications** — daily reminder, streak warnings

### Technical work

- `WidgetKit` extension target
- `ActivityKit` Live Activity attributes + content state
- `App Groups` for shared SwiftData container (app + widgets)
- `VisionKit` `DataScannerViewController` wrapper
- Haptic engine (`UIImpactFeedbackGenerator`, `UINotificationFeedbackGenerator`)
- `MeshGradient` (iOS 18+) on detail page, with iOS 17 fallback

### Success criteria

- Widget renders within 2s of pin
- Live Activity persists across app close, updates every minute
- OCR captures readable text from a paper book photo
- App feels indistinguishable from a first-party Apple app
- **Submit v1.0 to App Store**

---

## 10. Phase 4 — Subscriptions

> **Goal:** Monetization. Three-tier model (Free / Scholar / Chronicler).

### Features

- StoreKit 2 product fetch + purchase flow
- 3 products in App Store Connect:
  - `com.bookhero.scholar.monthly` ($4.99)
  - `com.bookhero.scholar.yearly` ($34.99)
  - `com.bookhero.chronicler.monthly` ($9.99)
  - `com.bookhero.chronicler.yearly` ($69.99)
- 7-day free trial on yearly plans
- Family Sharing enabled (Scholar tier)
- Contextual paywalls (triggered when hitting feature wall)
- Settings → Manage Subscription deep link
- Restore Purchases button
- Server-side receipt verification via new Edge Function `verify-apple-receipt`
- `subscriptions` table with `tier`, `expires_at`, `original_transaction_id`

### Feature gates (server-checked)

| Feature | Free limit | Scholar | Chronicler |
|---|---|---|---|
| Books | 5 | ∞ | ∞ |
| Recaps/month | 3 | 30 | ∞ |
| Lexicon entries | 20 | ∞ | ∞ |
| Reading DNA | ❌ | ✅ | ✅ |
| Widgets | ❌ | ✅ | ✅ |
| Corpus recaps (OCR) | ❌ | ❌ | ✅ |
| Audio recaps | ❌ | ❌ | ✅ |
| Vocabulary auto-extract | ❌ | ✅ | ✅ |

### UI work

- Paywall view (hero, comparison, CTA)
- "Upgrade" badge on locked features
- Subscription status in Settings
- Trial countdown indicator

### Success criteria

- All 4 products purchasable in Sandbox
- Receipt validation persists entitlement to Supabase
- Feature gates respected even after offline → online
- Paywall conversion tracked in analytics

---

## 11. Phase 5 — Community

> **Goal:** Social layer. v2.0 release. Highest retention impact.

### Features (in build order)

#### 5a — Profiles & Follow Graph

- Public user profile (username, bio, avatar, DNA tags, currently reading)
- Privacy controls (progress visible to: everyone/followers/nobody)
- Follow / unfollow
- Followers / following lists
- Username uniqueness + profanity filter (Edge Function)

**New tables:** `user_profiles`, `follows`, `blocks`

#### 5b — Activity Feed

- Server-side fan-out via Postgres trigger → `activity_feed` table
- Feed events: book started, book finished, lore unlocked, word added, DNA evolved
- Pull-to-refresh + Realtime subscription for live updates
- No likes/comments initially (signal density)

**New table:** `activity_feed`
**New trigger:** `notify_feed_on_completion`

#### 5c — "Also Reading" + Reading Circles

- Detect when followers share a book → surface card on Book Detail
- Reading Circle = lightweight group (≤10 people, 1 book)
- Spoiler-safe page-gated reactions (you only see reactions ≤ your current page)
- Reaction = 280 char note pinned to a page
- Realtime updates via Supabase channel subscription

**New tables:** `reading_circles`, `circle_members`, `circle_reactions`
**RLS:** reaction visibility filtered by current user's progress

#### 5d — Public Book Pages

- Aggregate community stats per ISBN (RPC: `get_book_community_stats`)
- "X readers · avg completion: 3.4 weeks · top words: ..."
- List of active circles for that book
- Discoverability hub before starting a book

#### 5e — Book Clubs

- Scheduled reading (Week 1: chapters 1–8, etc.)
- AI-generated weekly discussion prompts
- Async threaded discussion
- Pace tracking + nudges
- Public/private clubs
- Hosting = Chronicler tier feature

**New tables:** `book_clubs`, `club_schedules`, `club_discussions`

### Push Notifications

- "Marco left a reaction at your current page in The Idiot"
- "Sofia started reading Crime and Punishment"
- "Your book club's Week 2 discussion is open"
- All routed through APNS via `notify-on-event` Edge Function

### Success criteria

- 100 beta users in 5 reading circles
- Spoiler-safe reactions verified (no information leakage at any page)
- Feed updates in <2s after follower action
- Book club completion rate >50% (members finish on schedule)

---

## 12. Phase 6 — Advanced & Platform Expansion

> **Goal:** Best-in-class polish. Platform expansion.

### Audio Recaps (Chronicler)

- `AVSpeechSynthesizer` with high-quality voice
- Background audio playback
- Now Playing controls (Lock Screen, AirPods)
- Playback speed control

### Share Extension — Inline Lexicon Lookup

- Select text in Apple Books / Kindle / Safari
- Share → BookHero → definition + "Add to Lexicon for [current book]"
- Returns user to source app instantly
- **The single most valuable Lexicon improvement**

### iPad Optimization

- Multi-column `NavigationSplitView`
- Library + detail side-by-side
- Drag-and-drop between sections (Queue management)
- Stage Manager support

### Mac Catalyst

- Same codebase, optimized for cursor + keyboard
- Menu bar commands
- Window resizing

### Vision Pro (visionOS)

- Spatial reading session — book detail floats in space
- Recap as immersive text panel
- Long-tail bet, low priority

### Apple Watch Companion

- Currently reading complication
- Quick "log session" tap
- Lexicon flashcard review on wrist
- Daily Word complication

### Smart Recommendations

- Use Reading DNA + community data
- Surface on Dashboard: "Readers like you are loving X"
- Powered by new RPC `get_recommendations(user_id)`

### Recap Improvements (cross-cutting)

- Multiple formats (Summary / Chapter Map / Character Focus / Quote Gallery / Cliff Notes / Study Mode)
- Continuity-aware (each recap aware of previous via `context_digest`)
- Spoiler shield (prompt enforced)
- Recap cards (swipeable: summary → moments → characters → quote)
- Audio recap (above)
- Auto-suggest after every 50 pages

### Lexicon Improvements (cross-cutting)

- Memory hooks (Gemini-generated mnemonics per word)
- Contextual flashcard review (show original sentence)
- Spaced repetition + Lock Screen Daily Word
- Vocabulary profile clustering ("your lexicon skews Gothic")
- Rare word badges
- Word of the Day push notification (interactive — review from notification)

---

## 13. Cross-Cutting Concerns

### Security

- **Supabase JWT** stored in iOS Keychain via `KeychainAccess` wrapper
- **No API keys in app bundle** — Supabase anon key is public-safe by design
- **Receipt validation server-side** — never trust client-reported entitlements
- **RLS policies** enforce all per-user data isolation
- **Sign in with Apple** mandatory (App Store requirement)
- **Privacy manifest** (`PrivacyInfo.xcprivacy`) declaring data collection

### Performance budgets

- App launch → library visible: <1.5s (cold), <500ms (warm)
- Book detail open: <200ms
- Recap streaming first token: <2s
- Widget refresh: <100ms

### Accessibility (must-have, not nice-to-have)

- Dynamic Type — all text scales
- VoiceOver labels on every interactive element
- Reduce Motion — gates `matchedGeometryEffect` and `MeshGradient`
- Reduce Transparency — falls back from `.ultraThinMaterial` to solid colors
- Sufficient color contrast (WCAG AA min)

### Localization

- English at launch
- Use `String Catalog` (`.xcstrings`) from day 1 — even single-language
- Prepare for: ES, PT-BR, FR, DE, JA (post v1.0)

### Testing strategy

- Unit tests on repositories (mock Supabase client)
- Snapshot tests on key views (`swift-snapshot-testing`)
- UI tests on critical flows (sign in, add book, save progress)
- StoreKit configuration file for purchase flow tests
- Manual TestFlight for visual/haptic verification

### CI/CD

- Xcode Cloud or GitHub Actions
- Automated TestFlight deploys on `main` push
- Lint via SwiftLint
- Format via swift-format

### Analytics events (privacy-respecting)

- `app_launched`, `book_added`, `progress_saved`, `recap_generated`,
  `lexicon_entry_added`, `paywall_shown`, `purchase_initiated`,
  `purchase_completed`, `circle_joined`, `feed_event_viewed`
- Never log book titles, lexicon words, recap content, or PII

---

## 14. Release Strategy

### TestFlight cadence

- Internal: every push to `main`
- External (100 testers): every Friday during active phase
- Public TestFlight: 2 weeks before App Store submission

### App Store milestones

| Version | Phase | Hero feature for screenshots |
|---|---|---|
| 1.0 | After Phase 3 | Live Activity + Widgets + matched geometry |
| 1.1 | After Phase 4 | Subscription tiers comparison |
| 2.0 | After Phase 5 | Reading Circles spoiler-safe reactions |
| 2.1+ | Phase 6 | Audio recaps / iPad / Watch |

### Pre-launch checklist (before v1.0)

- [ ] App Privacy declarations complete
- [ ] App Store screenshots (6.7", 6.5", 5.5", iPad)
- [ ] App Preview video (Live Activity hero)
- [ ] Privacy policy URL live
- [ ] Terms of service URL live
- [ ] Support email + URL
- [ ] Marketing site landing page
- [ ] Sign in with Apple verified
- [ ] All RLS policies audited
- [ ] Sentry crash reporting verified in production build
- [ ] StoreKit Sandbox tested on 5+ Apple IDs
- [ ] TestFlight 50+ external testers, no critical bugs in 7 days

### Post-launch

- Monitor Sentry crash-free rate (target: >99.5%)
- Monitor StoreKit conversion funnel
- ASO iteration on keywords + screenshots
- Respond to App Store reviews within 48h
- Monthly TestFlight beta with new features behind feature flags

---

## Quick Reference for AI-Assisted Coding

When using this plan with an AI assistant, prompt structure:

> "We are in **Phase X** of the BookHero iOS plan. The current task is **[feature/component]**.
> Refer to section **[N]** of the plan. The repository pattern is described in section 3.
> Use SwiftUI, `@Observable`, SwiftData, and Supabase Swift SDK.
> Backend: same Supabase project as PWA — call existing RPC `[name]` / Edge Function `[name]`."

### Suggested Prompts per Phase

- **Phase 1 kickoff:** "Set up `BookHeroApp.swift` with Supabase client environment injection, RootView with auth gate, and SwiftData container for `Book`, `Progress`, `SyncOperation` models."
- **Phase 1 library:** "Build `LibraryView.swift` per section 7. Three sections via `List`, native `.onMove` reorder, `.swipeActions` for edit/delete. Data from `BooksRepository.libraryEntries`."
- **Phase 2 recap:** "Implement `RecapsRepository.streamRecap(bookId:)` using `AsyncStream`. Call existing Edge Function `generate-recap`. Render in `RecapStreamView` token-by-token."
- **Phase 3 widget:** "Create WidgetKit extension target `BookHeroWidgets`. Implement `CurrentlyReadingWidget` (small + medium). Read from shared App Group SwiftData container."
- **Phase 4 paywall:** "Build `PaywallView` triggered by `.sheet(isPresented:)` when feature wall hit. Use StoreKit 2 `Product.products(for:)` and `purchase()` async APIs."
- **Phase 5 circles:** "Implement Reading Circle reaction visibility filter. RLS policy + client-side `circle_reactions.page <= current_progress.page` enforcement. Realtime channel subscription for live reactions."

---

**End of plan.** Ship Phase 1 first. Everything else builds on a working foundation.

---

## Spec Files (Speckit-ready)

Each phase has a corresponding `spec.md` in `specs/`. To begin implementation, point Speckit at the relevant directory:

```
/speckit-plan       (when at the spec dir)
/speckit-tasks
/speckit-implement
```

| Phase | Spec directory | Primary deliverable |
|---|---|---|
| 1 — MVP | `specs/100-ios-mvp/` | Native auth + library + progress + queue + offline |
| 2 — AI Parity | `specs/101-ios-ai-parity/` | Recaps, Lexicon, Lore, DNA, Passport, Captures |
| 3 — Native Polish | `specs/102-ios-native-polish/` | Widgets, Live Activity, haptics, App Store v1.0 |
| 4 — Subscriptions | `specs/103-ios-subscriptions/` | StoreKit 2, three-tier paywall, server validation |
| 5 — Community | `specs/104-ios-community/` | Profiles, follows, feed, circles, book clubs |
| 6 — Platform Expansion | `specs/105-ios-platform-expansion/` | iPad, Watch, Mac Catalyst, Vision Pro |
| Cross-cutting | `specs/106-notifications-system/` | APNS + local + scheduled notifications |

Each spec is independently testable and shippable per the Speckit user-story prioritization model.

## Companion Documents

- `docs/ios-native-migration-details.md` — backend reuse rules, repository mapping, contract preservation
- `docs/wiki/` — full project wiki (existing features + planned features + conventions)
- `.specify/memory/constitution.md` — non-negotiable engineering principles
