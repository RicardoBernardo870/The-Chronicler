# Component Inventory — PWA → SwiftUI

The PWA's `src/components/` is already decomposed by feature (~60 components). That decomposition is
your SwiftUI view checklist — the hard part (what exists, what each does) is decided. Translate, don't
re-invent. Native pattern swaps are called out (dialogs → `.sheet`, swipe cards → `.swipeActions`, etc.).

> **Legend** — **DS** = promote to `DesignSystem/Components/` (shared primitive). Everything else lives
> under `Features/<Feature>/Views/`.

## DesignSystem primitives (build in `specs/001-ios-foundation`)

These are the reused atoms. Extract them first; every screen composes them. **Glass is not on this
list** — surfaces use the native glass effect directly (`.glassEffect` iOS 26+ / `Material` below),
never a custom reconstruction of the PWA's emulated glass (see `design-tokens.md §3`).

| Primitive | Derived from | SwiftUI |
|-----------|--------------|---------|
| BookCover | `BookCard`, `HeroBookCard`, grid/list cards | `AsyncImage` (Kingfisher) + initials-on-gradient placeholder, radius 6, 2:3 |
| `Chip` / `Badge` | `BookCard` genre + "Imported" chip, status pills | `Capsule` accent-tinted |
| `ProgressTrackView` | `BookCard`, `BookProgressPanel` | capsule track + indigo→violet fill |
| `SectionHeader` | dashboard/library section labels | uppercase caption + count badge |
| `EmptyState` | `shared/EmptyState.vue` | icon + title + body + CTA; used by every list |
| `PrimaryButton` / `.heroButton()` | white-on-indigo button preset (`preset.ts`) | `.borderedProminent` tinted accent, white label |
| `LoadingSpinner` / `ShimmerView` | `shared/LoadingSpinner.vue`, `glass-shimmer` | `ProgressView` + redacted shimmer |
| `StatTile` | `profile/StatTile.vue` | labeled metric tile (reused across Profile) |

## Auth
| PWA | Responsibility | SwiftUI target |
|-----|----------------|----------------|
| `pages/AuthPage.vue` | Sign in / sign up | `AuthView` — **add Sign in with Apple** (App Store requirement) |

## Library  (`Features/Library/`)
| PWA component | Responsibility | SwiftUI |
|---------------|----------------|---------|
| `library/LibraryListView.vue` | 3-section list: Now Reading / Queue / Completed (tabbed) | `LibraryView` — native `List` w/ sections; Queue/Completed as a `Picker`/segmented control |
| `library/LibraryGridView.vue` | Grid layout variant | `LazyVGrid` variant (view toggle) |
| `library/SwipeableBookCard.vue` | Card w/ swipe edit/delete | row + **`.swipeActions`** (drop the custom swipe code) |
| `library/ReadingWideCard.vue` | Wide "now reading" hero card | `NowReadingCard` |
| `books/BookCard.vue` | Standard list card (cover, genre/Imported chip, progress, page-fix hint) | `BookCardRow` (composes DS `BookCover`/`Chip`/`ProgressTrackView`) |
| `books/BookGridCard.vue` | Grid cell | `BookGridCell` |

## Dashboard  (`Features/Dashboard/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `dashboard/HeroBookCard.vue` | Active book + inline progress save + recap CTA | `HeroBookCard` (the dashboard centerpiece) |
| `dashboard/InProgressSection.vue` | In-progress carousel | horizontal `ScrollView` section |
| `dashboard/UpNextSection.vue` | Reorderable up-next strip | `.onMove` list section |
| `dashboard/CompletedSection.vue` / `CompletedOnlyState.vue` | Completed preview / completed-only first-run | sections + first-run state |
| `dashboard/DashboardEmptyState.vue` | Empty / single-queued onboarding (now incl. **Import** action) | `DashboardEmptyState` |
| `dashboard/LastSessionCard.vue` / `LastTimedSessionCard.vue` / `LastUpdateCard.vue` | "Last session" variants | `LastSessionCard` (variant enum) |
| `dashboard/WordOfTheDay.vue` | Daily lexicon card (Leitner advance) | `WordOfTheDayCard` |

## Add Book & Import  (`Features/AddBook/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/AddBookPage.vue` | Scan / Manual / Search / **Import** hub | `AddBookView` |
| `books/IsbnScanner.vue` | Barcode scan | **VisionKit `DataScannerViewController`** wrapper |
| `books/BookForm.vue` | Manual entry / edit form | `BookFormView` |
| `books/BookSearchSection.vue` / `BookSearchResultCard.vue` / `SearchBookHero.vue` | Search UI (ISBN-aware) | `BookSearchView` (mirror the `isbn:` operator + no-langRestrict fix) |
| `pages/BookSearchDetailPage.vue` / `books/BookDescription.vue` / `BookRecommendationsScroller.vue` | View-first editable detail + recs | `BookSearchDetailView` |
| `books/LibraryStatusSelector.vue` | Reading / Queue / Completed picker | segmented `Picker` |
| `books/BookEditDialog.vue` | Edit sheet | **`.sheet`** |
| `import/LibraryImportDialog.vue` | CSV import dialog (file → progress → summary) | `LibraryImportSheet` — **`.fileImporter`** + `ProgressView` |
| `import/ImportSummaryPanel.vue` | imported/skipped/failed counts | `ImportSummaryView` |

## Book Detail & Progress  (`Features/BookDetail/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/BookDetailPage.vue` | Detail screen | `BookDetailView` |
| `book/BookDetailHeader.vue` | Cover + title + meta header | `BookDetailHeader` (matched-geometry target from library) |
| `book/BookProgressPanel.vue` | Progress slider + save | `ProgressPanel` (native `Slider` + sensory feedback every 10 pp) |

## Reading Session & Capture  (`Features/Capture/`, session sheets)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `session/SessionStartButton.vue` | Start session | button + Live Activity start (Phase 3) |
| `session/SessionNoteField.vue` | Session note | inline field |
| `session/SessionCaptureField.vue` | Capture prompt (camera **or upload** — 033) | offer camera + **`PhotosPicker`/files** |
| `capture/CaptureCameraView.vue` | Camera viewport | AVFoundation wrapper |
| `capture/CaptureReviewViewport.vue` / `CaptureVerifyView.vue` | Review OCR text, retake/close | `CaptureReviewView` (VisionKit on-device OCR, `ocr-page` fallback) |

## Recaps  (`Features/Recaps/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/RecapHistoryPage.vue` / `recap/RecapHistory.vue` | Recap history | `RecapHistoryView` |
| `recap/RecapStream.vue` | Streaming recap text | `AsyncStream` token rendering |
| `recap/RecapCard.vue` | Recap memory card | `RecapCard` |
| `recap/RecapImagePanel.vue` / `CompletedRecapImageCarousel.vue` / `CompletedRecapImageSlide.vue` | Recap imagery | carousel (`TabView .page`) |

## Lexicon & Review  (`Features/Lexicon/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/GreatLibraryPage.vue` / `LexiconPage.vue` | Lexicon browse/search (server-paginated) | `LexiconView` (searchable `List`) |
| `lexicon/LexiconCard.vue` | Term card (flip) | `LexiconCard` |
| `lexicon/AddWordDialog.vue` | Add term | **`.sheet`** |
| `pages/AnkiReviewPage.vue` / `anki/SwipeableFlashcard.vue` | Leitner review (swipe know/don't) | `ReviewView` + drag-to-rate card |

## Lore  (`Features/Lore/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `lore/LoreChronoscopeCard.vue` | Collapsible lore on detail | `LoreChronoscopeView` |
| `lore/LoreCardList.vue` / `LoreCardDetail.vue` | Lore browse/detail | list + detail |
| `lore/LoreGenerationBanner.vue` | Generating state | inline banner |

## Profile & Quest  (`Features/Profile/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/ProfilePage.vue` | Identity-first profile screen | `ProfileView` |
| `pages/ProfileStatsPage.vue` | Trophy Room (analytics, one tap deep) | `TrophyRoomView` |
| `pages/ProfileEditPage.vue` | Profile customization (creates the community row on first save) | `ProfileEditView` (`.sheet` or push) |
| `profile/ProfileIdentityHeader.vue` | Avatar in yearly-goal ring + level badge + name | header w/ `Circle` ring (`trim(from:to:)`) |
| `profile/DnaSignatureStrip.vue` / `MoodSignature.vue` | Compact DNA strip; full analysis in bottom sheet | strip + `.sheet` |
| `profile/DnaRecommendationsScroller.vue` | DNA suggestion covers, one fitted row → add flow | `HStack` of tappable covers |
| `profile/ProfileStatsNav.vue` | Stat pills + Trophy Room entry | pill grid + `NavigationLink` row |
| `profile/RecapImagesCarousel.vue` | Recap memories carousel (signed URLs, 1 image/snap) | `TabView(.page)` or snapping `ScrollView` |
| `profile/QuestGoalHero.vue` / `ReadingGoalDialog.vue` | Yearly quest ring + pace row, goal editing (excludes imported) | ring hero + goal `.sheet` |
| `profile/ReaderLevelStrip.vue` | XP / level progress | level strip |
| `profile/ReadingCalendarCard.vue` | Month grid of per-day book covers (`get_reading_calendar`) | custom calendar grid (day-detail disclosure) |
| `profile/LifetimeStatsGrid.vue` / `StatTile.vue` | Lifetime stats grid | `LazyVGrid` of DS `StatTile` |
| `profile/LibraryBreakdownCard.vue` | Genre/author breakdown | `LibraryBreakdownCard` (incl. imported books) |

> `ReadingQuestCard.vue`, `ReadingDnaCard.vue`, and `BookSuggestionItem.vue` were retired in the 2026-07 profile redesign — the quest card became `QuestGoalHero` (Trophy Room) and the DNA card split into `DnaSignatureStrip` (bottom-sheet analysis) + `DnaRecommendationsScroller` (cover row).

## Book Passport  (`Features/Passport/`)
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `pages/BookPassportPage.vue` | Completed-book journey + AI summary | `BookPassportView` |

## App shell
| PWA | Responsibility | SwiftUI |
|-----|----------------|---------|
| `shared/AppBottomNav.vue` | Bottom nav | **`TabView`** (Dashboard / Library / Lexicon / Profile) |
| `pages/NotFoundPage.vue` | 404 | n/a (native nav has no 404) |
| `components/HelloWorld.vue` | Vite scaffolding | ignore |

## Native swaps cheat-sheet
- Custom swipe card → `.swipeActions`
- Dialog/modal → `.sheet` (`.glassElevated` chrome)
- Bottom nav → `TabView`
- Reorderable list → `List` + `.onMove`
- Toast → transient overlay / `.sensoryFeedback`
- Progress slider → native `Slider` + `.sensoryFeedback(.increase, trigger:)` every 10 pages
- Confirm dialog → `.confirmationDialog` / `.alert`
