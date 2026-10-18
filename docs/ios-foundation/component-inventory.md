# Component Inventory — PWA components → SwiftUI views

Last updated: 2026-10-18

**Source:** web `master` @ `8d8701c` (PWA v3.9.1): every `.vue` file under `src/components/**` and `src/pages/*`, its importers, and `git log` since the first extraction (2026-06-20).

The PWA is already decomposed by feature. That decomposition is the SwiftUI view checklist: translate it, don't re-invent it, and swap web patterns for native ones where the table says so. Screens, states and copy are in the [screen inventory][screens]; token values are in [design tokens][tokens]; behaviour is in the [business-rules catalog][README].

## Counts

| Folder | Files | Live | Dead (not imported anywhere) |
|---|---|---|---|
| `src/components/**` | 79 | **75** | `HelloWorld.vue` (Vite scaffold), `capture/CaptureVerifyView.vue` (replaced by `CaptureReviewViewport.vue` on 2026-05-09, CAP-D18), `recap/CompletedRecapImageCarousel.vue` + `recap/CompletedRecapImageSlide.vue` (the slide is imported only by the dead carousel) |
| `src/pages/*` (product) | 17 | **16** routed screens (404 included) | `LexiconPage.vue` (not routed, LEX-D29) |
| Shell | `src/App.vue`, `src/layouts/DefaultLayout.vue` | 2 | — |

Dead files are never ported.

## Legend

| Mark | Meaning |
|---|---|
| **DS** | Becomes (or is built from) a shared primitive in `DesignSystem/Components/`. Everything else lives in `Features/<Feature>/Views/`. |
| **New** | Added after 2026-06-20, with its add date. **New (06-20)** = added on 2026-06-20 with the CSV import (spec 034). |
| **Changed** | Existed on 2026-06-20 and changed materially since (count of commits since 2026-06-21). |
| **Dead** / **Removed** | In the tree but unused / deleted or renamed since 2026-06-20. |
| **Phase** | Build phase in the [iOS implementation plan][plan]: 0B, 1, 2, 3. |
| System | Use the SwiftUI/UIKit system control; no custom component. |

Liquid Glass (D-04): system bars, tab bar, toolbars, sheets, menus and alerts get it for free. Custom glass (`.glassEffect`, `GlassEffectContainer`, `.buttonStyle(.glass / .glassProminent)`) is for the **navigation and control layer** only. Text-dense content sits on tokened, legible surfaces. No `Material` stand-ins, no re-created rgba/blur recipes, no availability helper, no glass on glass ([constitution §7][constitution], [tokens §5][tokens]).

---

## 1. DesignSystem primitives (Phase 0B)

Build these first; every feature view composes them. Names follow the constitution (domain names, never `Wrapper`/`Helper`).

| Primitive | Replaces (PWA) | SwiftUI construction | Glass? | Rules / tokens |
|---|---|---|---|---|
| `PageBackground` | `html` gradient in `main.css` | `ZStack` of two `RadialGradient`s over the base colour, `.ignoresSafeArea()`; light and dark sets | No | [tokens §2][tokens] |
| `ContentCard` (+ `.subtle` style) | `.glass-surface` (47 files), `.glass-subtle` (12 files) | `RoundedRectangle(cornerRadius: Radius.card, style: .continuous)` filled with `surfaceCard` / `surfaceSubtle` + hairline stroke; Increase Contrast → stronger stroke | **No** — content layer | [tokens §5][tokens] |
| `BookCover` | Covers in about 20 components (cards, rows, hero, detail, shelves, calendar, Focus, DNF, search, recommendations, Book Lengths, Last Session) | Async image from the single Phase 0B image pipeline; size presets (`thumb` 24×34, `row` 44×62, `wide` 52×75, `list` 64×92, `hero` 96×142, `detail` 128×188, `grid`/`shelf` 2:3 fill, `focus` ≤ 150 wide); placeholder = initials of the first two title words on the indigo→violet gradient, or a book glyph; **a broken URL shows the placeholder** (fixes LIB-D31); label "Cover of {title}"; optional tap-to-preview | No | [LIB-99][LIB], [tokens §7, §9][tokens] |
| `ProgressTrack` | `.glass-track` + indigo→violet fill (`BookCard`, `BookGridCard`, `ReadingWideCard`); PrimeVue `ProgressBar` (hero, panel, In Progress, DNA threshold, level strip, import) | Capsule track + capsule fill, or a custom `ProgressViewStyle`; `accessibilityValue("N percent")` | No | [tokens §7][tokens] |
| `ProgressRing` | `ProfileIdentityHeader` ring (r 33, stroke 5), `QuestGoalHero` ring (stroke 9) | `Circle().trim(from: 0, to: p)` with round caps, rotated −90°; fill animates 0.6–0.7 s, none under Reduce Motion | No | [PRO-37][PRO] |
| `Chip` | Genre chip, "Imported", count badges, "New Lore", lore type badges, Lexicon "Dictionary"/"Quote", "✓ Mastered", quest status `Tag`, watchlist chips, recap range pill, section badges | `Capsule` with tinted fill (accent .12–.22) + optional icon; variants: `.genre`, `.imported`, `.count`, `.insightType(kind)`, `.entryType`, `.mastered`, `.status(severity)`, `.watchlist`, `.range`; tappable chips are buttons ("New Lore" → Book Detail) | Only tappable control chips may use `.glass` | [tokens §1, §4][tokens] |
| `SectionHeader` | Uppercase dashboard/profile/stat headings; Library section headers (accent bar + label + count + chevron) | `HStack` of optional accent bar, `.textCase(.uppercase)` label, count `Chip`, optional disclosure chevron | No | [tokens §7][tokens] |
| `EmptyStateView` / `EmptyStateCard` | `shared/EmptyState.vue`, Home onboarding cards, DNF empty, Recap History empty, Codex and Insights empties, Lifetime/Breakdown empties | Full-screen: `ContentUnavailableView` (label, description, actions). In-card: icon tile + eyebrow + title + body + actions | No | [screens §6][screens] |
| `LoadingPlaceholder` | PrimeVue `Skeleton` (all screens), recap shimmer; `.glass-shimmer` is defined but unused | `.redacted(reason: .placeholder)` + a shimmer modifier (1.6 s sweep), static under Reduce Motion | No | [tokens §8][tokens] |
| `InlineMessage` | Session/save error lines, PrimeVue `Message` (auth, search, import, Codex errors) | `Label` with severity tint (info, success, warning, danger, caution) | No | [tokens §4][tokens] |
| `StatTile` | `profile/StatTile.vue`, Records tiles, stat pills, Passport tiles, Review summary stats | `VStack(icon, value, label)`; value `.monospacedDigit()`; on `ContentCard(.subtle)` | No | [PRO-41, PRO-42][PRO] |
| `CoverShelf` | `UpNextSection`, `DnaRecommendationsScroller`, `BookRecommendationsScroller` | Horizontal `ScrollView` + `LazyHStack` + `.scrollTargetBehavior(.viewAligned)` of `BookCover` + title (+ author) | No | — |
| `SnapCarousel` | `BookRecapCarousel`, `RecapImagesCarousel` | Paged horizontal scroll (one card per snap) with a bottom gradient caption | No | [REC-56, REC-57][REC] |
| `ReaderAvatar` | Identity header avatar, Home greeting avatar, Profile Edit avatar | Circle image with initials fallback; a broken URL falls back to initials | No | [PRO-90][PRO] |
| `FlipCard` | `LexiconCard`, `SwipeableFlashcard` | `rotation3DEffect` flip (0.45–0.5 s), height animates to the visible face; VoiceOver action "Show definition"; crossfade under Reduce Motion | No | [LEX-60, LEX-80][LEX] |
| `SessionTimer` | `SessionStartButton` timer card, Focus timer, mini player, Live Activity | `Text(timerInterval:pauseTime:)` (no per-second state) with `.monospacedDigit()`; format `M:SS` / `H:MM:SS`; label "Session 12 minutes, paused" | Inside the system accessory only | [SES-19][SES] |
| `PageStepper` | `PageSaveSheet` input row | −/+ 44 pt buttons bounded `0…total` + numeric field + "of {total} pages"; `.sensoryFeedback` on step | No | [SES-24…SES-26][SES] |
| `ToastBanner` (+ environment `ToastCenter`) | `shared/GlassToast.vue`, `lore/LoreGenerationBanner.vue`, PrimeVue `Toast`, the load-failure notice | Top overlay capsule; variants `success` (5 s), `warning` (6 s), `loading` (until replaced), `generating` (Insight jobs); tap to dismiss; VoiceOver announcement | **Yes** — `.glassEffect(.regular, in: .capsule)` (floating control layer) | [PLT-35, PLT-37][PLT], [tokens §7][tokens] |
| Button styles | PrimeVue `Button` presets (white-on-indigo primary, outlined, text, link, danger) and the soft accent buttons (Get Recap, Focus link, chips) | Primary → `.glassProminent` tinted `accentStrong` (contrast, tokens §1); secondary → `.glass`; tertiary → `.borderless`; soft accent → bordered with accent fill .18; destructive → `role: .destructive` | Yes for control buttons | [tokens §1][tokens] |

---

## 2. Feature mapping

### 2.1 App shell

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `App.vue` | — | Auth init splash, global `ConfirmDialog`, bottom `Toast`, Insight banner, glass toast, offline-queue flush on SW message | `ChroniclerApp` + root overlay host | `ToastCenter`; drain the queue on `scenePhase == .active` + `NWPathMonitor` | 0B |
| `layouts/DefaultLayout.vue` | — | Router outlet + bottom nav when signed in | `MainTabView` | System `TabView` | 0B |
| `shared/AppBottomNav.vue` | Changed (2) | Home · Library · Codex · Profile + "More" sheet (Add Book, Light/Dark mode, Sign out) | — | **System** floating Liquid Glass tab bar; "More" → Home / Library `+` and **Settings** (new) | 0B |
| `shared/LoadingSpinner.vue` | — | Full-page "Loading..." during auth init | — | Launch screen; `ProgressView` where needed | 0B |
| `shared/GlassToast.vue` | **New** 2026-07-14 | Top pill: success / loading / warning | — | DS `ToastBanner` | 0B |
| `shared/EmptyState.vue` | — | Icon + title + description + action slot | — | DS `EmptyStateView` | 0B |
| `pages/NotFoundPage.vue` | — | 404 | — | Not ported (unmatched link → Home) | — |
| `HelloWorld.vue` | Dead | Vite scaffold | — | Not ported | — |

### 2.2 Auth

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/AuthPage.vue` | — | Sign in / Sign up tabs, magic link, error banner | `AuthView` | **Add** `SignInWithAppleButton`, "Forgot password?", inbox state, Hide-My-Email guidance (D-11); `InlineMessage` for errors | 1 |

### 2.3 Home (dashboard)

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/DashboardPage.vue` | Changed (4) | Mount sequence, onboarding state switch, recap / completion / cancel orchestration | `HomeView` | Screen owns state; sections are views | 1 |
| `dashboard/DashboardGreeting.vue` | **New** 2026-07-02 | Time-of-day greeting + avatar, or "Set up your reader profile" CTA | `HomeGreetingHeader` | DS `ReaderAvatar` | 1 |
| `dashboard/HeroBookCard.vue` | Changed (7) | Active book: progress, forecast / Insight nudge, pencil, session controls, End Session, Get Recap / lock label, Focus entry, inline capture prompt, note, "New Lore" chip, offline tag | `HeroBookCard` — split into `HeroHeader`, `HeroForecastLine`, `SessionControls`, `CapturePromptCard` (the web file is 882 lines; constitution: ≤ ~150 per view) | DS `BookCover(.hero)`, `ProgressTrack`, `Chip`, `SessionTimer` | 1 (AI parts 2) |
| `dashboard/InProgressSection.vue` | — | Other in-progress books; tap = make hero; "New Lore" chip | `InProgressList` | DS `BookCover(.row)`, `ProgressTrack`, `Chip` | 1 |
| `dashboard/UpNextSection.vue` | Changed (1) | Up Next cover shelf; tap = make hero | `UpNextShelf` | DS `CoverShelf` | 1 |
| `dashboard/CompletedSection.vue` | Changed (1) | One row "Completed {n}" + 3 covers → Library | `CompletedRow` | `NavigationLink` row | 1 |
| `dashboard/DashboardEmptyState.vue` | — | `empty` and `oneQueued` onboarding cards (incl. "Import library") | `HomeOnboardingCard(.empty / .oneQueued)` | DS `EmptyStateCard` | 1 |
| `dashboard/CompletedOnlyState.vue` | — | `completedOnly` onboarding card | `HomeOnboardingCard(.completedOnly)` | DS `EmptyStateCard` | 1 |
| `dashboard/LastSessionCard.vue` | — | Picks the timed or untimed variant | `LastSessionCard` | — | 1 |
| `dashboard/LastTimedSessionCard.vue` | — | Time, velocity, this sitting, finish prediction | `LastSessionCard` | DS `StatTile`-style metrics | 1 |
| `dashboard/LastUpdateCard.vue` | — | Untimed variant ("Last Update") | — | **Not ported** in v1: D-08 makes the Last Session card timed-only; whether an untimed "Last Update" variant returns is OP-04.8 | — |
| `dashboard/WordOfTheDay.vue` | — | WotD (4 variants) and the Vocabulary Review prompt | `WordOfTheDayCard`, `VocabularyReviewPromptCard` | `ContentCard`; BC-10 RPCs | 2 |

### 2.4 Reading session

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `session/SessionStartButton.vue` | Changed (4) | Start ⇄ timer card (pause · stop · live count); pre-start gate order Memory Check → "Previously" → start; inline errors. Its `iconOnly` variant is dead (CAP-D18) | `SessionControls` + `SessionStartGate` (coordinator) | DS `SessionTimer`, `InlineMessage`; mini player in `.tabViewBottomAccessory` | 1 (gates 2) |
| `session/PageSaveSheet.vue` | **New** 2026-07-11 | "Where did you stop?" / "Update your page": stepper, number input, validation hints, "Cancel session — no progress saved" | `PageSaveSheet` | `.sheet` fixed-height detent + number pad; DS `PageStepper` | 1 |
| `session/FocusModeOverlay.vue` | **New** 2026-07-15 | Full-screen timer, wake lock, auto-dim after 30 s, goal chips 15/30/45/60 with chime + vibration + overtime | `FocusModeView` (+ `FocusGoalChips`, `FocusDimLayer`) | `.fullScreenCover`; `isIdleTimerDisabled`; window-scene screen brightness; `AVAudioPlayer` + `.sensoryFeedback`; local notification when backgrounded (Phase 3) | 1 |
| `session/SessionResumeDialog.vue` | **New** 2026-07-13 | "Previously" bullets + tension; "Begin reading"; dismiss aborts | `SessionResumeSheet` | `.sheet` (medium) | 2 |
| `session/MemoryCheckDialog.vue` | **New** 2026-07-15 | Quiz intro → loading → questions → summary; empty / error; session and on-demand modes | `MemoryCheckSheet` | `.sheet` (large); step enum | 2 |
| `session/SessionCaptureField.vue` | Changed (7) | Capture prompt: camera / upload / note / skip; OCR state machine; auto-save ≥ 0.90; toasts | `CapturePromptCard` + `CaptureCoordinator` | Inline card → covers; `PhotosPicker`; Vision OCR first, `ocr-page` fallback (D-15) | 2 |
| `session/SessionNoteField.vue` | — | "Where did you leave off?" note (≤ 160) | `SessionNoteEditor` | `TextField(axis: .vertical)` + counter | 1 |

### 2.5 Capture

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `capture/CaptureCameraView.vue` | — | Full-screen camera, "Snap" / "Cancel" | `PageCameraView` | `VNDocumentCameraViewController` (edge detection, perspective) or an AVFoundation still | 2 |
| `capture/CaptureReviewViewport.vue` | — | Full-screen review: image, low-confidence warning (< 0.70), text editor with 10 000 counter, "Use Capture", "Retake" / "Re-upload" | `CaptureReviewView` | `.fullScreenCover`; `TextEditor`; thresholds recalibrated for Vision (CAP-Q07) | 2 |
| `capture/CaptureVerifyView.vue` | Dead | Old review UI | — | Not ported | — |

### 2.6 Library

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/LibraryPage.vue` | Changed (2) | Header actions, view mode, search, edit / delete / reorder handlers | `LibraryView` | Toolbar: DNF, view menu, `+` | 1 |
| `library/LibraryListView.vue` | Changed (2) | Now Reading + sticky Queue / Completed pill tabs; reorder mode; empty copy | `LibraryListMode` | `List` sections + segmented `Picker`; `EditMode` | 1 |
| `library/LibraryGridView.vue` | Changed (1) | Collapsible Now Reading / The Queue / Completed; reorder toggle | `LibraryGridMode` | `LazyVGrid` + collapsible `SectionHeader` | 1 |
| `library/LibrarySearchBar.vue` | **New** 2026-07-02 | Sticky accent-insensitive search with clear | — | **System** `.searchable` (no autocorrect, no autocapitalisation) | 1 |
| `library/LibrarySearchResults.vue` | **New** 2026-07-02 | Results grouped Now Reading / Queue / Completed / Did Not Finish | `LibrarySearchResultsList` | `List` sections | 1 |
| `library/QueueReorderList.vue` | **New** 2026-07-02 | Drag-handle reorder (vuedraggable) | — | **System** `List` + `.onMove` + VoiceOver move actions | 1 |
| `library/SwipeableBookCard.vue` | — | Custom touch swipe → Edit / Delete | — | **System** `.swipeActions` + `.contextMenu` on `BookRow` (not touch-only, LIB-102) | 1 |
| `library/ReadingWideCard.vue` | — | Wide "Now Reading" card in grid mode | `NowReadingCard` | DS `BookCover(.wide)`, `ProgressTrack` | 1 |
| `books/BookCard.vue` | — | List row: cover/initials, genre, "Imported", progress, page, "Set page count", days left, "New Lore" | `BookRow` | DS `BookCover(.list)`, `Chip`, `ProgressTrack` | 1 |
| `books/BookGridCard.vue` | — | Grid cell with frosted title scrim + progress | `BookGridCell` | DS `BookCover(.grid)`, `ProgressTrack` | 1 |
| `pages/DnfListPage.vue` | **New** 2026-07-17 | Shelved books sorted by `dnf_at`, Resume | `DnfListView` + `DnfRow` | `List`; trailing "Resume" + swipe | 1 |

### 2.7 Add book & import

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/AddBookPage.vue` | — | Hub (Scan / Manual / Import / Search) → scan → form | `AddBookView` | `.sheet` (large) with its own `NavigationStack` | 1 |
| `books/BookSearchSection.vue` | — | Search field, loading, error + Retry, empty, results, "Load more" | `BookSearchSection` | `book-search` proxy (BC-15) | 1 |
| `books/BookSearchResultCard.vue` | — | Result row (cover 44×64, title, author, year, chevron) | `BookSearchResultRow` | DS `BookCover(.row)` | 1 |
| `books/IsbnScanner.vue` | — | Quagga2 barcode scanner + reticle + success flash + error | `IsbnScannerView` | VisionKit `DataScannerViewController` (EAN-13 with the 978/979 prefix only; the PWA also accepts EAN-8, LIB-D25); `AVCaptureMetadataOutput` fallback | 1 |
| `books/BookForm.vue` | — | Manual add / metadata-only edit form | `BookFormView` (modes `.add`, `.metadata`) | `Form` | 1 |
| `pages/BookSearchDetailPage.vue` | — | View-first editable detail, duplicate notice, status, recommendations | `SearchDetailView` | Push inside the AddBook sheet | 1 |
| `books/SearchBookHero.vue` | — | Cover (preview), genre, title, author, pages · ISBN | `SearchDetailHero` | DS `BookCover(.detail)` | 1 |
| `books/BookDescription.vue` | — | "About this book" + Read more / Read less | — | DS `ExpandableText` (shared with Book Detail) | 1 |
| `books/LibraryStatusSelector.vue` | — | Want to read / Reading now / Finished | — | **System** segmented `Picker` | 1 |
| `books/BookRecommendationsScroller.vue` | — | "More {subject} books" / "You might also like" posters | — | DS `CoverShelf` | 1 |
| `books/BookEditDialog.vue` | — | Edit Book dialog (shows ignored status controls, LIB-61) | `BookEditSheet` | `.sheet` + `BookFormView(.metadata)` | 1 |
| `import/LibraryImportDialog.vue` | **New (06-20)** | CSV import: idle → parsing → importing → enriching → done / error | `LibraryImportSheet` | `.fileImporter([.commaSeparatedText])`; `.interactiveDismissDisabled` while busy; `import_library` (BC-15) | 1 |
| `import/ImportSummaryPanel.vue` | **New (06-20)** | Imported / already in library / skipped counts, page-count note, skipped rows | `ImportSummaryView` | DS `Chip(.status)`, `DisclosureGroup` | 1 |

### 2.8 Book Detail

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/BookDetailPage.vue` | Changed (5) | Hub orchestration: progress, recap, DNF, Memory Check, capture, Codex add, passport | `BookDetailView` | Toolbar menu Edit / Delete (new on iOS) | 1 (AI parts 2) |
| `book/BookDetailHeader.vue` | Changed (1) | Centered cover, meta, clamped description | `BookDetailHeader` | DS `BookCover(.detail)`, `ExpandableText`; zoom-transition target | 1 |
| `book/BookProgressPanel.vue` | Changed (8) | Progress, pencil, session controls, Focus, journey button, chips, DNF link / shelved state | `ReadingProgressPanel` | `SessionControls`, DS `Chip`, `ProgressTrack` | 1 (chips 2) |
| `book/BookRecapCarousel.vue` | **New** 2026-07-03 | Illustrated recaps of this book (signed URLs) or empty line | `BookRecapMemories` | DS `SnapCarousel` | 2 |

### 2.9 Recaps

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `recap/RecapDialog.vue` | **New** 2026-07-13 | Fresh-recap modal: shimmer while generating, then the persisted row (story layout); error + Try Again; "View history" / "Done" | `RecapSheet` | `.sheet` (large); staged progress from `generate-recap` v2 (BC-07) | 2 |
| `pages/RecapHistoryPage.vue` | Changed (1) | Header, loading, error + Retry | `RecapHistoryView` | Push | 2 |
| `recap/RecapHistory.vue` | Changed (1) | Empty state + list | `RecapHistoryView` | `LazyVStack` of `RecapStoryCard` | 2 |
| `recap/RecapCard.vue` | Changed (2) | Story card: range · %, date, image, byline, prose, watchlist chips, open thread | `RecapStoryCard` — **one view for the sheet and the history** (the web duplicates the layout in `RecapDialog`) | DS `Chip(.watchlist, .range)` | 2 |
| `recap/RecapImagePanel.vue` | — | Illustration states: skeleton, image, failed placeholder, none (legacy) | `RecapIllustration` | Capped polling / Realtime; terminal state required (REC-49) | 2 |
| `recap/CompletedRecapImageCarousel.vue`, `CompletedRecapImageSlide.vue` | Dead | — | — | Not ported | — |

### 2.10 Insights (code name "lore")

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `lore/LoreChronoscopeCard.vue` | — | Book Detail Insights card (collapsible, cycle). Its compact, non-collapsible variant (tap → `/lexicon?bookId=…&tab=lore`) is never mounted: Book Detail always passes `collapsible` | `InsightsCard` (add an explicit "See all Insights" link to the Codex) | `DisclosureGroup`; DS `Chip(.insightType)` | 2 |
| `lore/LoreCardList.vue` | — | Codex Insights tab: loading, empty, collapsible rows | `InsightsList` | `List` + `DisclosureGroup` | 2 |
| `lore/LoreCardDetail.vue` | — | Body, "Mentions:" chips, unlock footer | `InsightDetail` | DS `Chip` | 2 |
| `lore/LoreGenerationBanner.vue` | — | Global "Chronicler is weaving new lore" capsule | — | DS `ToastBanner(.generating)` driven by `get_my_jobs` (BC-08) | 2 |

### 2.11 Codex & review

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/GreatLibraryPage.vue` | Changed (1) | Codex: header counts, Lexicon / Insights tabs, search, book / type filters, sort, infinite scroll | `CodexView` | Segmented `Picker`; `.searchable`; filter `Menu`; load more on last-row `onAppear` | 2 |
| `lexicon/LexiconCard.vue` | — | Flip card (badge, mastered, page, term, book; back: definition, context). Labels quotes "Lore" (LEX-D27) | `LexiconCardView` | DS `FlipCard`, `Chip(.entryType)` — label quotes "Quote" | 2 |
| `lexicon/AddWordDialog.vue` | Changed (1) | Add Word / Add Quote; book picker; dictionary lookup + phonetic | `AddToCodexSheet` | `.sheet` + `Form`; Wiktionary attribution (LEX-103) | 2 |
| `pages/AnkiReviewPage.vue` | Changed (1) | Deck, undo, progress, empty, summary, "Review more" | `ReviewDeckView` | `.fullScreenCover`; BC-10 RPCs | 2 |
| `anki/SwipeableFlashcard.vue` | Changed (1) | Flip + swipe card, en-US pronunciation, Knew it / Didn't know | `FlashcardView` | DS `FlipCard` + `DragGesture`; `AVSpeechSynthesizer` (en-US); custom accessibility actions | 2 |
| `pages/LexiconPage.vue` | Dead | Old lexicon page | — | Not ported | — |

### 2.12 Book Passport

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/BookPassportPage.vue` | — | Journey header, stat tiles, AI summary (streamed), Share Journey | `PassportView` | DS `StatTile`; `ShareLink`; frozen stats + `summary_status` (BC-05) | 2 |

### 2.13 Profile

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/ProfilePage.vue` | Changed (2) | Identity-first layout; loads everything before first paint | `ProfileView` | Toolbar gear → Settings; DNA never blocks the first paint (BC-05) | 1 (shell + Settings entry) / 2 |
| `profile/ProfileIdentityHeader.vue` | **New** 2026-07-02 | Avatar in the yearly-goal ring, "Lv N", name, level title, goal caption; tap → edit | `ProfileIdentityHeader` | DS `ReaderAvatar`, `ProgressRing`, `Chip` | 2 |
| `profile/DnaSignatureStrip.vue` | **New** 2026-07-02 | DNA strip states + bottom-sheet analysis | `ReadingDnaStrip` + `ReadingDnaSheet` | `.sheet` (medium) | 2 |
| `profile/MoodSignature.vue` | — | Tone + emoji row | `MoodSignatureView` | — | 2 |
| `profile/DnaRecommendationsScroller.vue` | **New** 2026-07-02 | "Your DNA suggests" covers → search detail | — | DS `CoverShelf` | 2 |
| `profile/ProfileStatsNav.vue` | **New** 2026-07-02 | Stat pills + "Trophy room" / "Stats" entry cards | `ProfileStatsNav` | DS `StatTile`; `NavigationLink` cards | 2 |
| `profile/RecapImagesCarousel.vue` | **New** 2026-07-02 | "Recap memories" gallery (12, signed URLs) | `RecapMemoriesGallery` | DS `SnapCarousel` | 2 |
| `pages/ProfileEditPage.vue` | **New** 2026-07-02 | Create / edit profile: avatar, username availability, display name, bio, public toggle, privacy rows | `ProfileEditView` — **username, display name, avatar only (D-13)** | `.sheet` + `Form`; `PhotosPicker`; BC-11.8 partial write; no bio / public / privacy UI | 2 |

### 2.14 Trophy Room

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/TrophyRoomPage.vue` | **New** 2026-07-15 | Quest hero, level strip, achievements; runs the achievement sync | `TrophyRoomView` | `sync_achievements()` (BC-09) | 2 |
| `profile/QuestGoalHero.vue` | **New** 2026-07-02 | Quest ring, status tag, pace row, no-goal CTA | `QuestRingCard` | DS `ProgressRing`, `Chip(.status)` | 2 |
| `profile/ReadingGoalDialog.vue` | — | Set / edit yearly goal (1–999) | `YearlyGoalSheet` | `.sheet` (small) + `Stepper` / number field | 2 |
| `profile/ReaderLevelStrip.vue` | — | Level, XP, title, progress, XP to next | `ReaderLevelStrip` | DS `ProgressTrack` | 2 |
| `profile/AchievementsGrid.vue` | **New** 2026-07-15 | 17 badges, earned / locked, earned date | `AchievementsGrid` + `AchievementBadge` | `LazyVGrid`; server catalog (BC-09); celebrate newly earned; icons per [tokens §10][tokens] | 2 |

### 2.15 Reading Stats

| PWA | Status | Responsibility | iOS view | Native pattern / DS | Phase |
|---|---|---|---|---|---|
| `pages/ReadingStatsPage.vue` | **Renamed** 2026-07-15 (was `ProfileStatsPage.vue`, added 2026-07-02) | Orchestrates the six analytics cards | `ReadingStatsView` | Push from Profile | 2 |
| `profile/MonthlyReadingChart.vue` | **New** 2026-07-11 | "Your year": 12 bars, year navigation, month selection | `MonthlyReadingChart` | Swift Charts `BarMark` + `chartXSelection`; audio graph | 2 |
| `profile/ReadingCalendarCard.vue` | **New** 2026-07-02 | Month grid with day covers; day-detail list | `ReadingCalendarCard` | `LazyVGrid` (7 columns); DS `BookCover(.thumb)` | 2 |
| `profile/LifetimeStatsGrid.vue` | — | Seven lifetime tiles or empty message | `LifetimeStatsGrid` | DS `StatTile` | 2 |
| `profile/StatTile.vue` | — | Icon + value + label tile | — | DS `StatTile` | 0B |
| `profile/RecordsCard.vue` | **New** 2026-07-15 | Best day, longest session, fastest finish, longest streak | `PersonalRecordsCard` | DS `StatTile` | 2 |
| `profile/BookLengthCard.vue` | **New** 2026-07-11 | Average finished length + longest / shortest | `BookLengthsCard` | DS `BookCover(.row)` | 2 |
| `profile/LibraryBreakdownCard.vue` | Changed (1) | Genre bar + legend, authors, finished / reading / unstarted | `LibraryBreakdownCard` | Swift Charts stacked `BarMark` (or a custom bar) with the genre palette | 2 |

### 2.16 New on iOS (no PWA component)

| iOS view | Purpose | Native pattern | Phase |
|---|---|---|---|
| `SettingsView` | Appearance (System / Light / Dark), Link Apple ID, Sign out, Delete account, AI consent status (Phase 2), legal links, acknowledgements, version | `Form` sections; push from Profile | 1 |
| `DeleteAccountView` + `ReauthenticateSheet` | D-10 flow: what is deleted → re-auth (password / Apple / OTP) → `delete-account` → wipe | Push + system auth sheet + destructive `.confirmationDialog` | 1 |
| `ForgotPasswordSheet`, `SetNewPasswordView`, `CheckInboxView` | D-11 password reset and email-link states | Sheet / cover opened by a universal link | 1 |
| `AIConsentSheet` | One-time AI-processing consent (PLT-Q03) | `.sheet` | 2 |
| `SessionMiniPlayer` | Running-session accessory on every tab | `.tabViewBottomAccessory` | 1 |
| `SessionLiveActivity`, widgets (`CurrentlyReadingWidget`, `WordOfTheDayWidget`, `QuestRingWidget`) | Lock Screen / Dynamic Island / Home Screen surfaces | ActivityKit, WidgetKit, App Intents | 3 |

---

## 3. Removed, renamed and dead since 2026-06-20

| PWA file | Change | Commit | Replacement |
|---|---|---|---|
| `recap/RecapStream.vue` | Deleted 2026-07-13 | `a3e0e3a` | `recap/RecapDialog.vue` (shimmer, then the persisted row; no streamed text is rendered, REC-55) |
| `profile/ReadingQuestCard.vue` | Deleted 2026-07-02 | `8aea053` | `profile/QuestGoalHero.vue` (now in the Trophy Room) |
| `profile/ReadingDnaCard.vue` | Deleted 2026-07-02 | `464f17d` | `profile/DnaSignatureStrip.vue` (strip + sheet) and `profile/DnaRecommendationsScroller.vue` (cover row) |
| `profile/BookSuggestionItem.vue` | Deleted 2026-07-02 | `464f17d` | `profile/DnaRecommendationsScroller.vue` |
| `pages/ProfileStatsPage.vue` | Renamed 2026-07-15 | `3ab17d7` | `pages/ReadingStatsPage.vue` (analytics); goals split into the new `pages/TrophyRoomPage.vue` |
| `capture/CaptureVerifyView.vue` | Dead since 2026-05-09 (still in the tree) | `1059bb9` | `capture/CaptureReviewViewport.vue` |
| `recap/CompletedRecapImageCarousel.vue`, `CompletedRecapImageSlide.vue` | Dead (never imported) | — | `book/BookRecapCarousel.vue`, `profile/RecapImagesCarousel.vue` |
| `session/SessionStartButton.vue` `iconOnly` variant | Dead branch | — | Full variant only |
| `pages/LexiconPage.vue`, `HelloWorld.vue` | Dead | — | — |

Added since 2026-06-20 (22 components + 4 pages): `DashboardGreeting`, `LibrarySearchBar`, `LibrarySearchResults`, `QueueReorderList`, `ProfileIdentityHeader`, `DnaSignatureStrip`, `DnaRecommendationsScroller`, `ProfileStatsNav`, `QuestGoalHero`, `ReadingCalendarCard`, `RecapImagesCarousel` (2026-07-02); `BookRecapCarousel` (07-03); `PageSaveSheet`, `MonthlyReadingChart`, `BookLengthCard` (07-11); `SessionResumeDialog`, `RecapDialog` (07-13); `GlassToast` (07-14); `MemoryCheckDialog`, `FocusModeOverlay`, `AchievementsGrid`, `RecordsCard` (07-15); pages `ProfileEditPage` (07-02), `ReadingStatsPage` (renamed 07-15), `TrophyRoomPage` (07-15), `DnfListPage` (07-17). The import components (`LibraryImportDialog`, `ImportSummaryPanel`) landed on 2026-06-20 itself.

---

## 4. Native swaps cheat-sheet

| Web pattern | Native replacement |
|---|---|
| Floating custom bottom nav + "More" sheet | System `TabView` (floating Liquid Glass) + `.tabViewBottomAccessory`; `+` toolbar item; Settings screen |
| PrimeVue `Dialog` / bottom-positioned dialog | `.sheet` with detents — system Liquid Glass, **no custom chrome** |
| PrimeVue `ConfirmDialog` | `.alert` (question) / `.confirmationDialog` (destructive) |
| PrimeVue `Toast` + glass toast + generation banner | One `ToastBanner` overlay |
| Custom touch swipe card | `.swipeActions` + `.contextMenu` |
| vuedraggable reorder | `List` + `.onMove` in `EditMode` + accessibility move actions |
| PrimeVue `Skeleton` | `.redacted(reason: .placeholder)` + shimmer |
| PrimeVue `TabMenu` / `SelectButton` | `Picker(.segmented)` |
| PrimeVue `Select` with filter | `Menu` or a searchable picker sheet |
| PrimeVue `Panel` / collapsible cards | `DisclosureGroup` |
| PrimeVue `InputNumber` | `TextField` with `.numberPad` + `Stepper` |
| `<input type=file accept=image/*>` | `PhotosPicker` / `.fileImporter([.image])` |
| PrimeVue `FileUpload` (CSV) | `.fileImporter([.commaSeparatedText])` with a security-scoped URL |
| `getUserMedia` camera | `VNDocumentCameraViewController` or `AVCaptureSession` still |
| Quagga2 barcode | `DataScannerViewController` |
| Screen Wake Lock / simulated dim | `isIdleTimerDisabled` / window-scene screen brightness |
| Web Audio chime + `navigator.vibrate` | `AVAudioPlayer` / `AudioServices` + `.sensoryFeedback` |
| `speechSynthesis` | `AVSpeechSynthesizer` (en-US voice) |
| Web Share / clipboard | `ShareLink` |
| PrimeVue `Image` preview | Full-screen image viewer |
| IntersectionObserver infinite scroll | `onAppear` of the last row |
| `localStorage` preferences | `@AppStorage` (per device) |
| IndexedDB offline queue | SwiftData `SyncOperation` (user-scoped), replayed through `save_progress` (D-08) |
| Hover states | Press states, long-press context menus |
| **No progress slider** | The page sheet (stepper + number pad) is the parity pattern; a `Slider` would be a new design decision |

[README]: ../business-rules/README.md
[LIB]: ../business-rules/01-library.md
[SES]: ../business-rules/02-reading-sessions.md
[REC]: ../business-rules/03-recaps.md
[LEX]: ../business-rules/05-codex-lexicon.md
[PRO]: ../business-rules/07-profile-stats-goals.md
[PLT]: ../business-rules/08-platform-auth-account.md
[plan]: ../ios-implementation-plan.md
[constitution]: ios-constitution.md
[screens]: screen-inventory.md
[tokens]: design-tokens.md
