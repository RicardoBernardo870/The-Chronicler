# BookHero iOS — Implementation Plan

> A staged roadmap from empty Xcode project to full-featured native iOS app, designed for incremental release and AI-assisted coding.

**Last updated:** 2026-07-04
**Target platforms:** iOS 18+ (iPhone), iPadOS 18+ optional later — real Liquid Glass on iOS 26+ via availability branching
**Distribution:** App Store

---

> ### ⚠️ Reconciliation note (2026-06-18)
>
> A live introspection of the Supabase project produced **[`docs/backend-contract.md`](./backend-contract.md)**, which is now the **authoritative backend inventory**. The table/RPC/Edge-Function lists in this roadmap (esp. §5 "Backend Reuse Strategy") are **incomplete** — defer to the contract. Key corrections:
> - The backend is much larger than this plan assumes: **25 tables, 60+ functions, 5 edge functions** live in prod.
> - **The Community AND Reading Circles backend is ALREADY BUILT and deployed** (`community_profiles`, `follows`, `blocks`, `reading_circles`, `circle_*`, plus ~40 community/circle RPCs and the `community-avatars` bucket). Phase 5 (§11) is therefore **client-only work**, not "new tables to add" — most of the schema it lists already exists (under different names: `community_profiles` not `user_profiles`, etc.).
> - Newer columns not reflected here: `books.description`, `books.source` + `books.page_count_estimated` (034 library import), `lexicon_entries.mastered` + `last_reviewed_at`. Additional live tables: `anki_review_sessions`, `reading_goals`, `reading_quest_events`, `user_settings`.
> - **Library Import (034) shipped on the PWA** (Goodreads/StoryGraph CSV). Backend impact the iOS client must honor: imported books carry `source <> 'manual'` and are **excluded from current-period stat RPCs** (`get_reading_quest_summary`, `get_reading_stats.totalPagesRead`) while **included** in lifetime composition (`get_library_breakdown`, Reading DNA). `get_library_with_progress` now returns `source` + `pageCountEstimated` per book. See §7 for iOS import-parity notes.
> - **Ebook capture (033) shipped:** the capture flow accepts an uploaded image, not just camera — Phase 3 should offer a `PhotosPicker`/Files import alongside the VisionKit scanner.
> - **Subscriptions still do not exist** server-side (no `entitlements`/`subscriptions` table yet) — that part of Phase 4 is accurate.
> - **iOS v1 scope steer:** Library/reading + AI memory + capture/vocab + goals + **library import**. **Defer Community + Circles** despite the backend being ready — they're a large client surface.
> - Local `supabase/migrations` has drifted from prod; a one-time baseline squash from the live schema is recommended before native work begins.
> - The Spec Kit `specs/100-…` / companion `docs/wiki/Planned-*.md` references below were aspirational and may not exist on disk.

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
| Min iOS | 18.0 | Same device reach as 17 (iPhone XS/XR+); `MeshGradient` available at floor; real Liquid Glass (`.glassEffect`) on iOS 26+ with `Material` fallback via `.appGlass()` |
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

- **All tables** — `books` (incl. `description`, `source`, `page_count_estimated`), `reading_progress`, `progress_history`, `lexicon_entries`, `lore_cards`, `recaps`, `book_passports`, `reading_dna`, `vocabulary_extractions`, `page_captures`, `up_next_order` *(plus `reading_goals`, `reading_quest_events`, `anki_review_sessions`, `user_settings` — see contract)*
- **All RPC functions** — `get_library_with_progress` (returns `source` + `pageCountEstimated`), `get_reading_stats`, `get_last_session`, `get_library_breakdown`, `get_reading_velocity`, `get_reading_quest_summary` *(the period-stat RPCs already exclude imported books — the iOS client gets correct numbers for free)*
- **All Edge Functions** — `generate-recap`, `generate-lore`, `generate-reading-dna`, `extract-vocabulary`, `ocr-page`
- **No backend work for library import** — it's pure client logic (CSV parse + bulk insert + best-effort enrichment) writing to existing tables; the iOS client re-implements `useLibraryImport.ts`/`booksStore.importBooks` natively.
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
- **Library import (034)** — Goodreads/StoryGraph CSV via `.fileImporter` / document picker. Strong activation win for a brand-new iOS user with an empty library. Parse CSV natively (no `papaparse` equivalent needed — Swift `String` splitting with RFC-4180 quoting, or a tiny CSV helper), map status, dedupe (ISBN-first), bulk-insert quietly, enrich in a background `Task`. Honor `source = 'goodreads'|'storygraph'` + `page_count_estimated` on insert.
- Library page (Now Reading + sticky Queue/Completed tabs; grid variant with sticky collapsible sections)
- Library search (accent-insensitive title/author filter, grouped results)
- Drag-to-reorder Queue (native `List.onMove`, reorder mode on both views)
- Swipe-left actions (Edit / Delete) — native `.swipeActions`
- Book detail page — centered-cover hero + clamped description (Google Books backfill); session-first progress: Start Session ⇄ live timer (pause/resume, `session_paused_at`) ⇄ End Session → page sheet ("Where did you stop?"); pencil page-edit outside sessions
- "Page X of Y" + percentage
- Save progress via the page sheet (optimistic + offline queue; unchanged-page inline block with cancel-session escape)
- Sign out

### Architecture deliverables

- `SupabaseClient` setup
- `AuthRepository` with Sign in with Apple
- `BooksRepository` + `ProgressRepository` + `UpNextRepository`
- SWR cache primitive ported
- SwiftData models: `Book` (incl. `source`, `pageCountEstimated`), `Progress`, `SyncOperation`
- Offline sync queue with `BGAppRefreshTask` drain
- Glassmorphism design tokens (Colors, Materials, Typography)
- `LibraryImportService` (CSV parse + dedupe + chunked bulk insert + background enrichment) and an import sheet with progress + summary

### Import parity notes (034)

- **ISBN-prioritized enrichment** — mirror the PWA: look up by ISBN first (Google Books → Open Library), fall back to title+author search only when no ISBN. Also mirror the **ISBN-aware search fix** in any search bar (use Google Books `isbn:` operator and drop language restriction for ISBN-shaped queries).
- **Quiet insert** — completed ("read") rows write `reading_progress.current_page = total_pages` directly; do **not** route them through the normal progress-save path (no history rows, no recap/lore/quest side effects).
- **Stats are correct for free** — because imported books carry `source <> 'manual'` and the server RPCs already exclude them, the iOS Profile/Quest screens need no special-casing; just badge imported books in the UI using the `source` field.

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
- **Codex** (renamed from Great Library) — header stats, Lexicon/Insights tabs, type chips (All/Dictionary/Quotes), Newest↔A–Z sort; Word/Quote add sheet (quotes = keepsakes, excluded from review); Leitner flashcard review with progress bar, undo-last-answer, missed-words summary, en-US pronunciation (AVSpeechSynthesizer)
- **Insight Cards** (user-facing rename of lore) — auto-unlock at 10% milestones (10–90)
- **Lore Chronoscope** — collapsible card on book detail
- **Reading DNA / Profile page** — calls `generate-reading-dna` once threshold met. The PWA profile was redesigned (2026-07) to an **identity-first layout** — mirror it, don't copy the old stacked-cards version: identity header (avatar in yearly-goal ring + level badge), compact DNA signature strip with the full analysis in a `.sheet`, DNA recommendation covers row (tap → add flow), stat pills, recap-memories carousel (signed URLs from `recap-images`), and a pushed **Trophy Room** (`TrophyRoomView`): quest progress ring, XP strip, **reading calendar** (`get_reading_calendar` RPC — timezone-aware day buckets with book covers per day), lifetime stats, library breakdown. See `ios-foundation/screen-inventory.md` + `component-inventory.md` for the state/component map.
  - **Community-RPC dependency (pre-Phase-5):** the identity header reads `get_my_community_profile` (already live) with a graceful email-initials fallback when no profile row exists — safe to ship before Phase 5. The **profile customization screen** (`ProfileEditView`: username/avatar/bio/privacy — the only place a `community_profiles` row is created; sign-up never creates one) has no social-graph dependencies, so it can ship with this phase or slide to Phase 5a; decide when scoping.
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
- DNA profile generates after 2 finished books (FINISHED_THRESHOLD = 2 in the PWA)

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
- `MeshGradient` on detail page (available at the iOS 18 floor); real Liquid Glass on iOS 26+ via `.appGlass()`

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

### PWA-validated rollout order (2026-07)

The PWA will pioneer the social surfaces in this order — iOS should follow the same sequencing (a feed is people × content; discovery and invites must precede it):

1. **Discovery (zero BE):** reader search + public profiles + follow + "also reading" on book detail — all existing RPCs.
2. **Circles UI + external invite links** (small BE: invite-token table + redemption surviving signup) — the growth loop.
3. **Following feed** (new `activity_feed`): mostly automatic events (finished, milestone, opt-in shared recap image / Insight). Sharing an image needs explicit consent + a public asset copy + progress-bracket spoiler labeling (blur-until-tap for readers earlier in the book). Report/hide UX ships with the feed, not after.
4. **Circles → clubs:** multi-book history, reading schedule, page-gated discussion threads (extends the reaction gating — the differentiator vs Fable), group pace, AI group recaps.

#### 5a — Profiles & Follow Graph

> The PWA already ships **profile customization** (`/profile/edit`) against the live RPCs — `get_my_community_profile`, `upsert_my_community_profile`, `is_username_available` — and the `community-avatars` bucket (path must be `{userId}/…` per RLS; PWA downscales avatars to ≤512 px JPEG client-side before upload). iOS 5a should match that page's contract and UX (first-run create state, live username availability, privacy defaults to `nobody`) rather than redesign it. If `ProfileEditView` already shipped with Phase 2 (see §8), 5a only adds the social surfaces.

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
| 0 — Design Foundation | `specs/001-ios-foundation/` | Design system: color tokens + PageBackground + typography/spacing/radii + reusable components + gallery (build FIRST; see `docs/ios-foundation/` and `docs/ios-phase-prompts.md` Phase 0) |
| 1 — MVP | `specs/100-ios-mvp/` | Native auth + library + progress + queue + offline |
| 2 — AI Parity | `specs/101-ios-ai-parity/` | Recaps, Lexicon, Lore, DNA, Passport, Captures |
| 3 — Native Polish | `specs/102-ios-native-polish/` | Widgets, Live Activity, haptics, App Store v1.0 |
| 4 — Subscriptions | `specs/103-ios-subscriptions/` | StoreKit 2, three-tier paywall, server validation |
| 5 — Community | `specs/104-ios-community/` | Profiles, follows, feed, circles, book clubs |
| 6 — Platform Expansion | `specs/105-ios-platform-expansion/` | iPad, Watch, Mac Catalyst, Vision Pro |
| Cross-cutting | `specs/106-notifications-system/` | APNS + local + scheduled notifications |

Each spec is independently testable and shippable per the Speckit user-story prioritization model.

## Companion Documents

- **`docs/ios-foundation/`** — the **design foundation** extracted from the PWA: `design-tokens.md`,
  `component-inventory.md`, `screen-inventory.md`, `ios-design-brief.md`, and a drop-in
  `ios-constitution.md`. Copy these into the new iOS repo and build the design system
  (`specs/001-ios-foundation`) FIRST, before any screen feature.
- `docs/ios-native-migration-details.md` — backend reuse rules, repository mapping, contract preservation
- `docs/backend-contract.md` — authoritative backend inventory (live-introspected)
- `docs/wiki/` — full project wiki (existing features + planned features + conventions)
- `.specify/memory/constitution.md` — non-negotiable engineering principles (PWA; iOS uses `docs/ios-foundation/ios-constitution.md`)
