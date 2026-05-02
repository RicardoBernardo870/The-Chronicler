# iOS Phase Prompts — Ready for Speckit

> **How to use:** When you're ready to start a phase, copy the entire prompt block for that phase and paste it after `/speckit-specify` (or whichever Speckit command you want to start with).
>
> Each prompt is self-contained: it tells Speckit the goal, the scope, what's in/out, the success criteria, and which existing docs to reference. Speckit will then generate the proper spec.md, plan.md, and tasks.md.

**Companion docs (referenced by every prompt):**
- `docs/ios-implementation-plan.md` — high-level roadmap
- `docs/ios-native-migration-details.md` — backend reuse + handoff details
- `docs/wiki/Architecture-*.md` — current PWA architecture
- `docs/wiki/Feature-*.md` — current feature behavior

---

## Phase 1 — Native MVP

### `/speckit-specify` prompt

```
Build the native iOS MVP for BookHero per docs/ios-implementation-plan.md Phase 1
and docs/ios-native-migration-details.md Section 7 Phase 1.

Stack: Swift 5.10+, SwiftUI, SwiftData, Supabase Swift SDK, iOS 17+. Reuse the
existing Supabase backend without any schema or Edge Function changes.

Scope (in):
- Sign in with Apple + email/password fallback (Supabase Auth)
- Persistent session via Keychain
- Library screen with three sections: Currently Reading, The Queue, The Archives
- Section headers with counts; Archives collapsed by default
- Add book (manual entry + VisionKit ISBN scan)
- Edit / delete book (swipe-left actions on row)
- Book detail screen with progress slider
- Optimistic progress saves with rollback on failure
- Offline queue for progress updates (SwiftData-backed) with auto-drain on reconnect
- Start / end / cancel reading session
- Drag-to-reorder Queue with optimistic persistence (no flicker)
- Sign out clears local cache and pending queue

Scope (out — explicitly deferred):
- AI features (recaps, lore, lexicon auto-extract, DNA, passport, captures)
- Widgets, Live Activities, haptics
- Subscriptions and paywalls
- Community, push notifications
- iPad, Watch, Mac Catalyst, Vision Pro

Backend rules:
- No schema changes, no new RPCs, no new Edge Functions, no migrations
- All calls via existing tables (books, reading_progress, progress_history, up_next_order)
- All calls via existing RPCs (get_library_with_progress, get_last_session,
  get_reading_stats, get_library_breakdown, get_reading_velocity)

Success criteria:
- New user signs up + adds first book in under 90 seconds
- Progress saves reflect in UI in <50ms regardless of network
- Offline queue drains within 30s of reconnect in 99% of cases
- Library cold-load <1.5s with up to 100 books
- Reorder shows zero flicker on iPhone 12+
- TestFlight installable by internal testers without setup support
- Crash-free session rate ≥99.5% before promoting to Phase 2

Phase ends with internal TestFlight build, not an App Store submission.
```

---

## Phase 2 — AI Feature Parity

### `/speckit-specify` prompt

```
Bring iOS to AI feature parity with the PWA per docs/ios-implementation-plan.md Phase 2
and docs/ios-native-migration-details.md Section 7 Phase 2.

Prerequisite: Phase 1 (specs/100-ios-mvp/) shipped to TestFlight, all P1 stories met.

Scope (in):
- AI Recaps: invoke generate-recap Edge Function, render streaming response
- Recap History page per book
- Recap lock mechanics (page + time gates) matching PWA behavior
- Lexicon: manual entry, browse, filter by book, search
- Leitner spaced-repetition flashcard review
- Lore Cards: auto-unlock on milestone crossings (50/75/100), Chronoscope card
- Reading DNA: auto-generate after 3 finished books OR 90 days, manual regenerate
- Book Passport: auto-generate on book completion
- Page Captures (OCR): VisionKit on-device OCR; fall back to ocr-page Edge Function
  if VisionKit confidence is low; user can edit captured text before save
- Vocabulary auto-extraction fire-and-forget after capture save
- Dashboard page (Last Session card, In Progress carousel, Up Next strip)

Stack additions:
- VisionKit (DataScannerViewController for OCR)
- AsyncStream for recap streaming
- AVFoundation for camera capture flow

Backend rules:
- Reuse existing Edge Functions (generate-recap, generate-lore, generate-reading-dna,
  extract-vocabulary, ocr-page) without changes
- Reuse existing tables (recaps, recap_fragments, lexicon_entries, lore_cards,
  reading_dna, book_passports, page_captures, vocabulary_extractions)
- Image bytes for OCR are in-memory only — never persist to Storage

P3 stretch stories (include if time permits):
- Recap formats (Summary / Chapter Map / Character Focus / Cliff Notes / Study Mode)
- Recap continuity via context_digest from previous recap
- Memory hooks (Gemini-generated mnemonics) on lexicon entries

Success criteria:
- Recaps stream first token within 2s of "Get Recap" tap
- Recap lock state matches PWA on the same book/progress combination
- Capture flow allows user correction before save
- Lore cards unlock within 3s of milestone crossing
- DNA generates after 3 finished books, threshold matches PWA
- Auto-vocabulary appears in Lexicon within 10s of capture save (online)
```

---

## Phase 3 — Native Polish (App Store v1.0)

### `/speckit-specify` prompt

```
Native iOS polish to make the app feel first-party. Public App Store launch v1.0.
Reference: docs/ios-implementation-plan.md Phase 3, docs/ios-native-migration-details.md
Section 7 Phase 3.

Prerequisite: Phase 2 complete; all AI features at parity with PWA on TestFlight.

Scope (in):
- Home Screen Widget: Currently Reading (small + medium sizes)
- Lock Screen Widget: page progress (inline)
- Live Activity: active reading session timer (Dynamic Island + Lock Screen)
- App Group container so app + widgets share SwiftData
- Haptics: progress save (light), session end (medium), milestone unlock (success)
- Sensory feedback on slider every 10 pages
- Matched-geometry transitions: book cover from library card → detail header
- SF Symbols animations (.bounce on save, .pulse on streaming)
- Pull-to-refresh on Library and Dashboard
- Context menus on long-press of book cards
- Native share sheets (share book, share recap as image)
- Local notifications: daily reminder, streak warnings (no push yet)
- Accessibility pass: Dynamic Type, VoiceOver, Reduce Motion, Reduce Transparency
- Privacy manifest (PrivacyInfo.xcprivacy)
- App Store Connect setup: screenshots, App Preview video, metadata
- Sentry crash reporting verified in production build

Scope (out):
- Push notifications (deferred to specs/106-notifications-system/)
- Subscriptions (deferred to Phase 4)

New backend additions:
- None required; widgets read from existing tables via shared SwiftData cache

Success criteria:
- Home Screen widget renders within 2s of pin
- Live Activity persists across app close, updates every minute while active
- Crash-free session rate ≥99.7% on production build
- VoiceOver reads all primary flows (sign in, add book, save progress, recap, lexicon)
- Reduce Motion disables matched geometry without breaking navigation
- Public App Store v1.0 ships at the end of this phase

Pre-launch checklist (block release until complete):
- App Privacy declarations
- Privacy policy + Terms URLs live
- Support email + URL configured
- App Store screenshots (6.7", 6.5", 5.5", iPad placeholder)
- App Preview video featuring Live Activity
- 50+ external TestFlight testers, no critical bugs in 7 days
```

---

## Phase 4 — Subscriptions

### `/speckit-specify` prompt

```
Add three-tier subscriptions (Free / Scholar / Chronicler) via StoreKit 2.
Reference: docs/ios-implementation-plan.md Phase 4, docs/ios-native-migration-details.md
Section 7 Phase 4.

Prerequisite: Phase 3 complete; v1.0 in App Store with stable crash rate.

Scope (in):
- StoreKit 2 product fetch + purchase flow (async/await native)
- Four products in App Store Connect:
  - com.bookhero.scholar.monthly ($4.99)
  - com.bookhero.scholar.yearly ($34.99, 7-day free trial)
  - com.bookhero.chronicler.monthly ($9.99)
  - com.bookhero.chronicler.yearly ($69.99, 7-day free trial)
- Family Sharing enabled on Scholar tier
- Contextual paywalls (triggered when user hits feature wall)
- Settings → Manage Subscription deep link
- Restore Purchases button
- Server-side receipt validation via new verify-apple-receipt Edge Function
- Persistent entitlement in new subscriptions table
- Server-side feature gates enforced in Edge Functions and RPCs (not just client)
- Trial countdown indicator
- Conservative offline behavior — never grant unlocked features based only on client state

Feature gate matrix:
- Books in library: Free 5 / Scholar ∞ / Chronicler ∞
- Recaps per month: Free 3 / Scholar 30 / Chronicler ∞
- Lexicon entries: Free 20 / Scholar ∞ / Chronicler ∞
- Reading DNA: Free ❌ / Scholar ✅ / Chronicler ✅
- Widgets: Free ❌ / Scholar ✅ / Chronicler ✅
- Corpus recaps (OCR): Free ❌ / Scholar ❌ / Chronicler ✅
- Audio recaps: Free ❌ / Scholar ❌ / Chronicler ✅
- Vocabulary auto-extraction: Free ❌ / Scholar ✅ / Chronicler ✅
- Custom themes: Free ❌ / Scholar ❌ / Chronicler ✅

New backend additions (additive only — PWA must keep working):
- subscriptions table (user_id pk, tier, product_id, expires_at, original_transaction_id, is_in_trial)
- verify-apple-receipt Edge Function (uses StoreKit JWS verification or App Store Server API)
- Optional: get_user_entitlement RPC for client + Edge Function checks

Success criteria:
- All four products purchasable in StoreKit Sandbox
- Receipt verification persists entitlement to Supabase within 5s of purchase
- Feature gates respected even after offline → online cycles
- Restore Purchases recovers entitlement on a new device
- Paywall conversion tracked in analytics (TelemetryDeck or PostHog)
- App Store v1.1 ships at the end of this phase
```

---

## Phase 5 — Community

### `/speckit-specify` prompt

```
Add the community layer to BookHero. Reference: docs/ios-implementation-plan.md Phase 5,
docs/community-design-notes.md, and docs/wiki/Planned-Community.md (if present).

Prerequisite: Phase 4 complete; subscription model live.

This phase ships in five sub-releases. Each sub-release is independently testable
and shippable.

Sub-release 5a — Profiles & Follow Graph (P1):
- Public user profile (username, bio, avatar, DNA tags, currently reading)
- Username uniqueness + profanity filter (Edge Function)
- Privacy controls (progress / lexicon / currently reading visibility per follower scope)
- Follow / unfollow asymmetric graph (Twitter model, not friend model)
- Followers / following lists
- Block another user (hard mutual hide)
- New tables: user_profiles, follows, blocks

Sub-release 5b — Activity Feed (P1):
- Server-side fan-out via Postgres trigger to activity_feed table
- Event types: book_started, book_finished, lore_unlocked, word_added, dna_evolved
- Realtime subscription for live updates while feed is open
- No likes/comments initially (signal density first)
- New table: activity_feed
- New trigger: notify_feed_on_completion (et al)

Sub-release 5c — Reading Circles & Spoiler-Safe Reactions (P1):
- "Also reading" card on Book Detail when followers share a book
- Reading Circle = lightweight ≤10-person group for one book
- 280-char reactions pinned to a page
- Spoiler-safe RLS: a user only sees reactions where reaction.page <= their current_page
- Realtime updates within an active circle
- New tables: reading_circles, circle_members, circle_reactions

Sub-release 5d — Public Book Pages (P2):
- Aggregate community stats per ISBN
- New RPC: get_book_community_stats(isbn)
- Discoverability hub before starting a book

Sub-release 5e — Book Clubs (P2):
- Scheduled reading (week 1: chapters 1-8, etc.)
- AI-generated weekly discussion prompts
- Async threaded discussion bounded to current week
- Pace tracking + nudges
- Hosting reserved for Chronicler tier (ties to Phase 4)
- New tables: book_clubs, club_schedules, club_discussions

Cross-cutting requirements:
- Block enforcement in all RLS policies (a blocked user never appears in feeds, circles,
  or discoverability)
- Username creation flow gates first community feature use
- All community features paywall-gated per the matrix in specs/103-ios-subscriptions/

Success criteria:
- Spoiler-safe reactions verified — no information leakage at any page
- Feed updates appear in <2s after follower action
- Block hides the blocked user from every surface (feed, circles, profiles)
- Book club completion rate >50% (members finish on schedule) in private beta
- v2.0 ships at the end of this phase
```

---

## Phase 6 — Platform Expansion

### `/speckit-specify` prompt

```
Expand BookHero beyond iPhone. Reference: docs/ios-implementation-plan.md Phase 6.
This phase is open-ended — pick sub-releases as needed; each is independently shippable.

Prerequisite: Phase 5 (or at least Phase 3) complete; iPhone app is stable.

Sub-release 6a — Audio Recaps (Chronicler tier):
- AVSpeechSynthesizer with high-quality voice
- Background audio playback
- Now Playing controls (Lock Screen, AirPods, CarPlay)
- Playback speed control
- Tied to Chronicler tier per Phase 4 gate matrix

Sub-release 6b — Share Extension (in-line lexicon lookup):
- iOS Share Extension target
- Triggered from Apple Books, Kindle, Safari, any text-selection
- Definition + "Add to Lexicon for [current book]" with one tap
- Returns user to source app instantly
- Single most-impactful Lexicon improvement — solves the cross-app friction

Sub-release 6c — iPad Optimization:
- NavigationSplitView (sidebar + detail layout)
- Library + detail side-by-side
- Drag-and-drop between sections
- Stage Manager support
- Adaptive layouts using size classes

Sub-release 6d — Mac Catalyst:
- Same codebase, optimized for cursor + keyboard
- Menu bar commands
- Window resizing with multi-window support

Sub-release 6e — Apple Watch companion:
- Currently Reading complication
- Quick "log session" tap
- Lexicon flashcard review on wrist
- Daily Word complication

Sub-release 6f — Vision Pro (visionOS):
- Spatial reading session — book detail floats in space
- Recap as immersive text panel
- Lower priority; only if there's a strategic reason

Sub-release 6g — Smart Recommendations:
- Use Reading DNA + community data
- Surface on Dashboard: "Readers like you are loving X"
- Powered by new RPC get_recommendations(user_id)

Sub-release 6h — Recap Quality Improvements (cross-platform):
- Multiple formats (Summary / Chapter Map / Character Focus / Quote Gallery / Cliff Notes / Study Mode)
- Continuity-aware recaps via context_digest
- Spoiler shield prompt enforcement
- Recap as swipeable cards (summary → moments → characters → quote)
- Auto-suggest after every 50 pages

Sub-release 6i — Lexicon Quality Improvements (cross-platform):
- Memory hooks (Gemini mnemonics)
- Contextual flashcard review (show original sentence)
- Spaced repetition + Lock Screen Daily Word
- Vocabulary profile clustering ("your lexicon skews Gothic")
- Rare word badges
- Interactive Word of the Day push notification

Success criteria per sub-release:
- 6a: Audio plays from Lock Screen with full controls
- 6b: Share Extension installable, definition shows in <2s, returns user to source app
- 6c: iPad layout passes App Store iPad-class review
- 6e: Watch app installs from iPhone pairing, complications visible on watch face
```

---

## Cross-Cutting — Notifications System

### `/speckit-specify` prompt

```
Build a unified notifications system spanning local notifications, scheduled reminders,
and APNS push. Reference: docs/ios-implementation-plan.md (notifications references in
Phase 3 + Phase 5), docs/ios-native-migration-details.md.

Can be tackled at multiple points:
- Local + scheduled notifications: any time after Phase 1
- Push notifications: requires Phase 5 community foundation for compelling content

Scope (in):
- Notification preferences screen (Settings):
  - Daily reading reminder (time picker)
  - Streak warnings (you haven't read in N days)
  - Community events (new follower, circle reaction at your page, club discussion open)
  - Word of the Day
  - Per-category opt-in/opt-out
- Local notifications:
  - Daily reminder fires at user-configured time
  - Streak warning fires after N days of inactivity (configurable; default 3)
- Interactive Word of the Day:
  - Daily push at user-configured time
  - Notification body contains word + definition
  - "I know this" / "Still learning" actions update Leitner box from notification
- Push notifications via APNS:
  - "Marco left a reaction at your current page in The Idiot"
  - "Sofia started reading Crime and Punishment" (followers only)
  - "Your book club's Week 2 discussion is open"
  - "Lore Card unlocked" with book cover thumbnail
- Rich notifications with book cover image attachments
- Server-side delivery via new notify-on-event Edge Function → APNS

New backend additions (additive only):
- device_tokens table (user_id, token, platform, last_seen)
- notification_preferences table (user_id pk, daily_reminder bool, reminder_time time,
  streak_warnings bool, community_events bool, word_of_day bool, word_of_day_time time)
- notify-on-event Edge Function (consumes activity_feed events, fans out to APNS)
- Postgres trigger or scheduled function to fire daily/streak checks

iOS side:
- UserNotifications framework
- Request authorization on first contextual moment (NOT app launch)
- Register for remote notifications, send token to device_tokens table
- Handle notification taps with deep links to relevant screens
- Notification Service Extension for rich content (cover image attachment)
- Notification Content Extension for custom Word of the Day UI

Privacy & compliance:
- Never include sensitive content (lexicon words, recap content) in notification body
  if user's device shows previews on Lock Screen — use generic copy and link to in-app
- Respect Focus modes
- Provide clear unsubscribe path in Settings + standard iOS notification settings deep link

Success criteria:
- Authorization request appears at a contextual moment, not on cold launch
- Daily reminder fires within 1 minute of configured time when permission granted
- Push notifications deliver within 30s of trigger event in 95% of cases
- Tap on notification deep links to the correct screen
- Disabling a category in Settings stops that category within 1 minute
- Streak warning never fires more than once per day
```

---

## How to Adapt These Prompts

Each prompt is ready to paste behind `/speckit-specify`. If you want a different starting
point in the Speckit pipeline, the prompt body still works — Speckit reads the description
and produces the appropriate artifact:

| Speckit command | What it does |
|---|---|
| `/speckit-specify` | Generates `specs/NNN-name/spec.md` from the prompt |
| `/speckit-clarify` | Asks clarifying questions, updates the spec |
| `/speckit-plan` | Generates `plan.md`, `data-model.md`, `contracts/`, `research.md` |
| `/speckit-tasks` | Generates `tasks.md` with prioritized stories and dependencies |
| `/speckit-implement` | Walks the tasks in order, implementing each |

Recommended flow per phase:
```
/speckit-specify  <paste prompt>
/speckit-clarify
/speckit-plan
/speckit-tasks
/speckit-implement
```

## Tips When Starting a Phase

- **Start in a fresh Speckit branch.** Each phase is large; don't mix with PWA feature work.
- **Update the prompt before pasting.** If decisions changed since 2026-05-02 (pricing, feature priorities, tier composition), edit the prompt first.
- **Reference the wiki for current behavior.** Anything that says "matches PWA behavior" should be cross-checked against `docs/wiki/Feature-*.md` to make sure the PWA hasn't drifted.
- **Skip stretch P3 stories on first pass.** Each prompt has optional P3 stories — defer them unless time permits.
- **Run `/speckit-clarify` always.** Even if you're confident, the clarification pass surfaces ambiguities that would otherwise leak into implementation.

## When to Re-read the Plan vs. the Prompt

- **`docs/ios-implementation-plan.md`** is for understanding *what and why*. Read it when context-switching back to iOS work.
- **`docs/ios-native-migration-details.md`** is for understanding *backend reuse rules and migration constraints*. Read it before any backend-touching change.
- **This file (`ios-phase-prompts.md`)** is for *kicking off implementation*. Copy the prompt, paste, run.
