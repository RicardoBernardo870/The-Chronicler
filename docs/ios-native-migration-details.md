# BookHero Native iOS Migration Details

**Status:** Future implementation plan  
**Created:** 2026-05-02  
**Base document:** `docs/ios-implementation-plan.md`  
**Current app:** Vue 3 + TypeScript + Vite PWA backed by Supabase  
**Target app:** Native SwiftUI iOS app, iOS 17+, App Store distribution

This document expands the existing iOS implementation plan with migration-specific detail. It is intended as a future handoff document for the engineer or agent who starts the native iOS project. Do not treat this as current implementation work in the PWA repo.

> ### ⚠️ Reconciliation note (2026-06-18)
>
> The **authoritative backend inventory is now [`docs/backend-contract.md`](./backend-contract.md)** (generated from a live introspection of the Supabase project). The §3 "Backend Surface To Reuse" list below is **incomplete** — defer to the contract. Highlights: prod has **25 tables / 60+ functions / 5 edge functions**; the **Community + Reading Circles backend already exists** (so it's client-only work, not new schema); `lexicon_entries` now has `mastered` + `last_reviewed_at` and `books` has `description`; additional tables include `anki_review_sessions`, `reading_goals`, `reading_quest_events`, `user_settings`. The §7 Phase 0 "document all RPC/Edge Function shapes" and "audit Edge Function auth" tasks are now largely satisfied by the contract (note: `generate-recap`, `generate-lore`, `ocr-page` run with `verify_jwt: false` and self-validate; `extract-vocabulary` and `generate-reading-dna` use platform JWT). Subscriptions/entitlements remain unbuilt.

## 1. Migration Goal

Build a native iOS app that reaches feature parity with the current BookHero PWA while reusing the existing Supabase backend as the source of truth.

The PWA should remain live during the migration. The iOS app should be built incrementally, with every phase producing a usable TestFlight or App Store-ready build.

Primary goals:

- Preserve the existing user data model.
- Avoid backend rewrites in the first three phases.
- Keep all new backend work additive and compatible with the PWA.
- Ship a small native MVP first, then add AI parity and native polish.
- Make iOS feel first-party: SwiftUI navigation, native gestures, haptics, widgets, Live Activities, and system sharing.

Non-goals for the first native release:

- Do not migrate the PWA to another framework.
- Do not replace Supabase.
- Do not introduce community, subscriptions, iPad, Watch, Mac, or Vision Pro before the core iPhone app is stable.
- Do not move AI generation logic into the iOS client.

## 2. Current App Inventory

The current app is a Vue 3 PWA using:

- Vue 3, TypeScript, Vite
- Pinia stores
- Vue Router
- Supabase JS
- PrimeVue / PrimeUI styling
- Workbox / Vite PWA
- IndexedDB offline queue for progress updates
- Supabase Edge Functions for AI and OCR-related workflows

Important current routes:

- `/` dashboard
- `/library`
- `/books/add`
- `/books/:id`
- `/books/:id/recaps`
- `/lexicon`
- `/books/:id/passport`
- `/profile`
- `/login`

Important current stores and composables:

- `src/stores/auth.ts`
- `src/stores/books.ts`
- `src/stores/progress.ts`
- `src/stores/upNext.ts`
- `src/stores/recaps.ts`
- `src/stores/lexicon.ts`
- `src/stores/loreCards.ts`
- `src/stores/captures.ts`
- `src/stores/bookPassport.ts`
- `src/stores/readingDna.ts`
- `src/composables/useCache.ts`
- `src/composables/useOfflineSync.ts`
- `src/composables/useReadingSession.ts`
- `src/composables/useCapture.ts`
- `src/composables/useReadingVelocity.ts`

The native iOS project should not port Vue code directly. Instead, use these files as behavioral references.

## 3. Backend Surface To Reuse

The current Supabase backend already contains the core data and AI surface needed by iOS.

Tables currently in use:

- `books`
- `reading_progress`
- `recaps`
- `up_next_order`
- `progress_history`
- `lexicon_entries`
- `book_passports`
- `lore_cards`
- `page_captures`
- `reading_dna`
- `vocabulary_extractions`

RPC functions currently in use:

- `get_library_with_progress`
- `get_reading_stats`
- `get_last_session`
- `get_library_breakdown`
- `get_reading_velocity`

Edge Functions currently in use:

- `generate-recap`
- `generate-lore`
- `ocr-page`
- `extract-vocabulary`
- `generate-reading-dna`

Backend rules:

- Reuse these tables, RPCs, and functions for iOS.
- Preserve existing RLS policies.
- Do not rename columns or change response shapes for existing PWA flows.
- Any schema changes for iOS must be additive.
- Add backend compatibility wrappers only if the Supabase Swift SDK cannot comfortably consume an existing PWA contract.

Important security note:

- Before public iOS launch, audit all Edge Function auth settings and in-function authorization checks. Some deployed functions may use `verify_jwt: false`; if this remains necessary, the function body must validate authorization explicitly.

## 4. Native Architecture

Recommended stack:

- Swift 5.10 or newer
- SwiftUI
- SwiftData
- Supabase Swift SDK
- URLSession for custom Edge Function streaming or multipart flows if needed
- StoreKit 2 later for subscriptions
- WidgetKit later for widgets
- ActivityKit later for Live Activities
- VisionKit / AVFoundation for ISBN scanning and OCR/capture flows
- Sentry or equivalent crash reporting

Recommended app structure:

```text
BookHero-iOS/
  App/
    BookHeroApp.swift
    RootView.swift
    AppDelegate.swift
  Core/
    Network/
    Cache/
    Sync/
    Auth/
    Models/
    DesignSystem/
  Features/
    Dashboard/
    Library/
    AddBook/
    BookDetail/
    Recaps/
    Lexicon/
    Lore/
    Capture/
    Profile/
    Passport/
    Settings/
  Widgets/
  LiveActivity/
  Tests/
```

Repository mapping:

| Current PWA store | Native iOS repository |
| --- | --- |
| `auth` | `AuthRepository` |
| `books` | `BooksRepository` |
| `progress` | `ProgressRepository` |
| `upNext` | `UpNextRepository` |
| `recaps` | `RecapsRepository` |
| `lexicon` | `LexiconRepository` |
| `loreCards` | `LoreRepository` |
| `captures` | `CapturesRepository` |
| `bookPassport` | `PassportRepository` |
| `readingDna` | `ProfileRepository` |

State and data flow:

- SwiftUI views read repository state.
- Repositories own fetching, mutation, caching, and optimistic updates.
- SwiftData stores local cache records and pending sync operations.
- Supabase remains the remote source of truth.
- Edge Functions are called only from repositories or service classes, never directly from views.

## 5. Data Model Guidance

Mirror current TypeScript domain models as Swift structs and SwiftData models.

Core domain models:

- `Book`
- `ReadingProgress`
- `LibraryBookEntry`
- `Recap`
- `LexiconEntry`
- `LoreCard`
- `BookPassport`
- `ReadingDna`
- `PageCapture`
- `VocabularyExtraction`
- `ProgressHistory`
- `UpNextOrder`

Use snake_case DTOs at the network boundary and camelCase domain models in Swift code.

Example convention:

```swift
struct BookRow: Decodable {
    let id: UUID
    let user_id: UUID
    let title: String
    let author: String
    let isbn: String?
    let cover_url: String?
    let total_pages: Int
    let genre: String?
    let created_at: Date
}

struct Book: Identifiable, Equatable {
    let id: UUID
    let userId: UUID
    var title: String
    var author: String
    var isbn: String?
    var coverUrl: URL?
    var totalPages: Int
    var genre: String?
    var createdAt: Date
}
```

Do not rely on generated Swift types alone unless they are ergonomic and stable. Keep explicit mapping functions so PWA database naming does not leak through the app.

## 6. Offline And Cache Strategy

The PWA currently has:

- SWR cache keys with TTLs
- stale-while-revalidate behavior
- background revalidation on visibility changes
- IndexedDB queue for offline progress updates

The iOS equivalent should use:

- SwiftData for local cache.
- Repository-level freshness timestamps.
- A `SyncOperation` SwiftData model for offline mutations.
- `NWPathMonitor` to detect connectivity changes.
- `BGAppRefreshTask` for best-effort background drain.

Minimum offline queue operation for MVP:

```text
type: progress_update
payload:
  bookId
  currentPage
  updatedAt
retries
createdAt
lastError
```

MVP offline behavior:

- If online, save progress optimistically and then write to Supabase.
- If Supabase write fails, roll back the local optimistic state unless the failure is clearly connectivity-related.
- If offline, update local state, enqueue the mutation, and show a subtle pending state.
- On reconnect, drain queued progress mutations FIFO.
- After a successful drain, refresh library/progress aggregates.

Do not queue AI generation in MVP. AI flows can require network until a later phase.

## 7. Phase Plan

### Phase 0: Pre-Kickoff

Purpose: prepare the backend contracts and app-store decisions before opening Xcode.

Tasks:

- Confirm final native app name: BookHero or The Chronicler.
- Confirm bundle identifier.
- Confirm Supabase project and environment naming.
- Generate a staging Supabase project or branch for iOS testing.
- Document all current RPC request and response shapes.
- Document all Edge Function request and response shapes.
- Audit Edge Function auth.
- Decide whether the iOS project lives inside this repo or a separate repository.
- Decide crash reporting and analytics provider.

Exit criteria:

- iOS engineer can create a new Xcode project without needing product or backend clarification.

### Phase 1: Native MVP

Purpose: build the smallest native reading tracker.

Included:

- App shell and tab/navigation structure.
- Auth gate.
- Email auth.
- Sign in with Apple.
- Library screen.
- Add/edit/delete book.
- ISBN scan/autofill.
- Book detail.
- Progress slider.
- Start/end reading session.
- Session note save.
- Queue ordering.
- Offline progress queue.
- Basic Settings with sign out.

Excluded:

- Recaps.
- Lexicon.
- Lore.
- Reading DNA.
- Book Passport.
- Capture/OCR corpus features.
- Widgets.
- Live Activities.
- Subscriptions.
- Community.

Primary Supabase calls:

- `books.select`
- `books.insert`
- `books.update`
- `books.delete`
- `reading_progress.upsert`
- `progress_history.insert`
- `progress_history.update`
- `up_next_order` read/write
- `get_library_with_progress`
- `get_last_session`
- `get_reading_stats`
- `get_library_breakdown`
- `get_reading_velocity`

Phase 1 success criteria:

- User can sign in.
- User can add at least five books.
- User can update progress and reopen the app with state intact.
- User can go offline, save progress, reconnect, and see the server catch up.
- User can sign out and sign back in with server data restored.
- Internal TestFlight build is installable.

### Phase 2: AI Feature Parity

Purpose: bring the core PWA intelligence features to iOS.

Included:

- AI recaps.
- Recap history.
- Lexicon browse/search.
- Manual lexicon entry.
- Leitner review flow.
- Lore card unlocks.
- Lore Chronoscope.
- Reading DNA profile.
- Book Passport.
- Page capture flow.
- Vocabulary extraction from captures.

Primary Supabase calls:

- `recaps`
- `lexicon_entries`
- `lore_cards`
- `book_passports`
- `reading_dna`
- `page_captures`
- `vocabulary_extractions`
- `generate-recap`
- `generate-lore`
- `generate-reading-dna`
- `extract-vocabulary`
- `ocr-page` if server OCR remains part of the flow

Phase 2 success criteria:

- Recap generation works for the same books and progress states as the PWA.
- Recaps persist and reload.
- Lexicon entries can be added, reviewed, and filtered.
- Lore unlocks at milestone transitions.
- Book Passport generates on completion.
- Reading DNA generation follows the existing PWA threshold behavior.
- Capture flow allows user correction before saving text.

### Phase 3: Native Launch Polish

Purpose: make the iOS app feel meaningfully better than the PWA.

Included:

- Home Screen widget for current reading.
- Lock Screen widget.
- Live Activity for an active reading session.
- Haptics for important interactions.
- Native share sheets.
- Local reading reminders.
- App icon and launch screen.
- Accessibility pass.
- App Privacy manifest.
- App Store screenshots and metadata.

Phase 3 success criteria:

- Public App Store candidate build is ready.
- App launch performance is acceptable on a current low-end supported device.
- VoiceOver and Dynamic Type support critical flows.
- Widgets and Live Activity work after backgrounding.
- Crash reporting is verified in a production-style build.

### Phase 4: Subscriptions

Purpose: add monetization after the core app is stable.

Included:

- StoreKit 2 product loading.
- Purchase flow.
- Restore purchases.
- Manage subscription deep link.
- Server-side receipt validation.
- Entitlement persistence.
- Paywalls and feature gates.

New backend additions:

- `subscriptions` table.
- `verify-apple-receipt` Edge Function.
- Optional entitlement RPC.

Phase 4 success criteria:

- StoreKit sandbox purchases work.
- Receipt validation writes entitlement data to Supabase.
- Feature gates are enforced server-side.
- Offline entitlement behavior is conservative and does not grant unlimited access based only on client state.

### Phase 5: Community And Expansion

Purpose: future growth only after the native app proves retention.

Potential features:

- Public profiles.
- Follows.
- Activity feed.
- Reading circles.
- Spoiler-safe reactions.
- Book clubs.
- Push notifications.
- Share Extension.
- iPad layout.
- Watch companion.
- Mac Catalyst.

Backend additions must remain additive and separately planned.

## 8. Screen Mapping

| PWA route | iOS screen |
| --- | --- |
| `/login` | `AuthView` |
| `/` | `DashboardView` |
| `/library` | `LibraryView` |
| `/books/add` | `AddBookView` |
| `/books/:id` | `BookDetailView` |
| `/books/:id/recaps` | `RecapHistoryView` |
| `/lexicon` | `LexiconView` or `GreatLibraryView` |
| `/books/:id/passport` | `BookPassportView` |
| `/profile` | `ProfileView` |

Navigation guidance:

- Use a native `TabView` for the main app shell.
- Suggested tabs: Dashboard, Library, Lexicon, Profile.
- Add Book can be a sheet or navigation destination from Library.
- Book Detail should be pushed from Dashboard, Library, and search results.
- Recap History and Book Passport should be child destinations of Book Detail.

## 9. Auth Requirements

Required:

- Supabase Auth session persistence.
- Sign in with Apple.
- Email/password or magic-link fallback.
- Keychain storage for tokens if the SDK does not handle secure persistence sufficiently.
- Sign out clears local SwiftData cache and pending queue for that user.

Important App Store requirement:

- If the iOS app offers third-party/social login, Sign in with Apple must be available. Even if the PWA currently relies on email auth, the native app should include Apple auth from Phase 1.

## 10. AI And Edge Function Guidance

AI generation must remain server-side.

The iOS app should:

- Send the same identifiers and user intent as the PWA.
- Display streaming or staged loading states.
- Persist only server-approved generated outputs.
- Avoid storing model prompts or provider keys locally.
- Handle Edge Function failures with retry affordances.

For recap streaming:

- Prefer native streaming if the current Edge Function supports it.
- If streaming is awkward through the Supabase Swift SDK, call the Edge Function with `URLSession` directly using the Supabase access token.

For OCR/capture:

- Prefer on-device OCR with VisionKit/Vision where quality is good enough.
- Keep the existing `ocr-page` flow available as fallback if needed.
- Always allow user review/edit before saving capture text.

## 11. Design System Guidance

The iOS app should translate the PWA visual identity into native components, not recreate web CSS.

Use:

- SwiftUI `Material` backgrounds.
- SF Symbols.
- Native lists, sheets, menus, context menus, and swipe actions.
- Haptics for save, milestone, session completion, and generation completion.
- Dynamic Type.
- High-contrast fallbacks.
- Reduce Motion and Reduce Transparency fallbacks.

Do not:

- Build a webview wrapper.
- Use custom controls where native controls are clearer.
- Copy the PWA layout one-to-one when iOS has a better pattern.

## 12. Testing Strategy

Unit tests:

- Repository fetch success/failure.
- DTO-to-domain mapping.
- Cache freshness decisions.
- Offline queue ordering.
- Optimistic update rollback.
- Progress percentage calculations.
- Milestone detection.

Integration tests:

- Auth session restore.
- Library RPC response decoding.
- Progress upsert.
- Progress history insert.
- Recap generation.
- Lexicon insert/update.
- Lore unlock.
- Reading DNA generation.

UI tests:

- First launch auth gate.
- Sign in.
- Add book.
- Edit book.
- Delete book.
- Scan ISBN path with mocked scanner output.
- Save progress online.
- Save progress offline and reconnect.
- Generate recap.
- Add lexicon entry.
- Sign out.

Manual TestFlight checks:

- Airplane mode.
- Slow network.
- App termination during active session.
- App relaunch after token refresh.
- Dynamic Type large sizes.
- VoiceOver.
- Reduce Motion.
- Widget refresh.
- Live Activity updates.
- StoreKit sandbox after Phase 4.

## 13. Release Strategy

Recommended release sequence:

1. Internal TestFlight after Phase 1.
2. External TestFlight after Phase 2.
3. Public App Store v1.0 after Phase 3.
4. v1.1 or later for subscriptions.
5. v2.0 or later for community.

The PWA should remain the stable production client until:

- iOS has passed Phase 3.
- Data sync and auth behavior are stable.
- There are no unresolved schema compatibility concerns.

## 14. Risks And Mitigations

Risk: backend contracts drift while the iOS app is being built.  
Mitigation: document RPC and Edge Function contracts before Phase 1 and add contract tests.

Risk: offline queue conflicts with server state.  
Mitigation: start with progress-only offline sync and FIFO draining. Expand later only after observing real usage.

Risk: Edge Function auth is too permissive for native public launch.  
Mitigation: audit all functions, require JWT where possible, and enforce user ownership in function code.

Risk: SwiftData cache diverges from Supabase.  
Mitigation: treat Supabase as source of truth, use explicit freshness timestamps, and refresh after every mutation queue drain.

Risk: AI streaming behaves differently on iOS.  
Mitigation: isolate Edge Function calls behind service classes so transport can change without touching views.

Risk: scope expands before the MVP ships.  
Mitigation: keep Phase 1 limited to auth, library, book detail, progress, queue, and offline progress sync.

## 15. Pre-Kickoff Checklist

Before any native implementation begins:

- [ ] Decide final app name and bundle identifier.
- [ ] Decide repository location for the Xcode project.
- [ ] Create Apple Developer app record if App Store distribution is confirmed.
- [ ] Confirm iOS minimum version.
- [ ] Confirm Supabase staging strategy.
- [ ] Document all RPC response shapes.
- [ ] Document all Edge Function request/response shapes.
- [ ] Audit RLS policies for all reused tables.
- [ ] Audit Edge Function JWT and user authorization behavior.
- [ ] Decide analytics and crash reporting provider.
- [ ] Decide whether subscriptions are definitely post-v1.0.
- [ ] Prepare app icon source assets.
- [ ] Prepare privacy policy and support URLs.

## 16. Handoff Notes For Future Agents

When starting future implementation, use this prompt shape:

```text
We are implementing Phase [N] from docs/ios-native-migration-details.md.
Use docs/ios-implementation-plan.md as the base roadmap.
The current PWA is Vue/Pinia/Supabase and remains live.
Reuse existing Supabase tables, RPCs, and Edge Functions unless the task explicitly says otherwise.
Do not make breaking backend changes.
Implement the native app with SwiftUI, SwiftData, Supabase Swift SDK, and iOS 17+.
```

Recommended first implementation task:

```text
Create the BookHero-iOS Xcode project, app shell, Supabase client setup, auth gate, SwiftData container, and empty main tabs for Dashboard, Library, Lexicon, and Profile. No AI features yet.
```

## 17. Spec Files Per Phase

Speckit-ready specifications exist for each phase. Use these as the entry point for `/speckit-plan` and `/speckit-tasks` when starting implementation:

| Phase | Spec | Maps to section |
|---|---|---|
| 1 — Native MVP | `specs/100-ios-mvp/spec.md` | Section 7 Phase 1 |
| 2 — AI Parity | `specs/101-ios-ai-parity/spec.md` | Section 7 Phase 2 |
| 3 — Native Polish | `specs/102-ios-native-polish/spec.md` | Section 7 Phase 3 |
| 4 — Subscriptions | `specs/103-ios-subscriptions/spec.md` | Section 7 Phase 4 |
| 5 — Community | `specs/104-ios-community/spec.md` | Section 7 Phase 5 (expanded) |
| 6 — Platform Expansion | `specs/105-ios-platform-expansion/spec.md` | (new — iPad/Watch/Mac/Vision) |
| Cross-cutting | `specs/106-notifications-system/spec.md` | Section 7 Phase 5 cross-cutting |

Each spec contains user stories with priorities (P1/P2/P3), acceptance scenarios, edge cases, functional requirements, key entities, and measurable success criteria. They are designed to feed directly into `/speckit-plan`.

## 18. Gaps Filled Outside This Document

The following details are NOT in this migration doc but are documented elsewhere:

- **Notification architecture** — see `specs/106-notifications-system/spec.md`
- **Community sub-feature breakdown** — see `specs/104-ios-community/spec.md` and `docs/wiki/Planned-Community.md`
- **Subscription tier matrix** — see `specs/103-ios-subscriptions/spec.md`
- **Recap quality improvements** (formats, continuity, audio) — folded into Phase 2 spec as P3 stories
- **Lexicon quality improvements** (memory hooks, share extension) — folded into Phase 2 (server-side) and Phase 6 (iOS-native Share Extension)
- **Existing PWA architecture** — see `docs/wiki/Architecture-*.md`

