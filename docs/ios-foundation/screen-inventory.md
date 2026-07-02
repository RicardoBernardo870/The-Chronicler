# Screen Inventory — routes → iOS screens

From the PWA router (`src/router/index.ts`). Every screen lists its key **states** — design all of them,
not just the happy path (empty/loading/error are where AI-generated screens usually fall short).

| PWA route (name) | Page component | iOS screen | Nav placement | Key states |
|------------------|----------------|-----------|---------------|------------|
| `/login` (`login`) | `AuthPage` | `AuthView` | pre-auth root | idle · submitting · auth error · **Sign in with Apple** |
| `/` (`dashboard`) | `DashboardPage` | `DashboardView` | **Tab 1** | loading skeleton · empty (no books) · single-queued · completed-only · standard (hero + sections) |
| `/library` (`library`) | `LibraryPage` | `LibraryView` | **Tab 2** | loading · empty · Now-Reading/Queue/Completed populated · queue-empty (import/search CTA) |
| `/books/add` (`add-book`) | `AddBookPage` | `AddBookView` | push/sheet from Library + Dashboard empty | hub (Scan/Manual/Search/Import) · scanning · manual form · search results · **import sheet** (idle/parsing/importing/enriching/done/error) |
| `/books/add/details/:source/:key` (`add-book-details`) | `BookSearchDetailPage` | `BookSearchDetailView` | push from search | loading · view (editable) · recommendations · duplicate notice |
| `/books/:id` (`book-detail`) | `BookDetailPage` | `BookDetailView` | push from Dashboard/Library/Search | loading · reading (slider) · queued ("Start reading") · finished · lore chronoscope · capture prompt |
| `/books/:id/recaps` (`recap-history`) | `RecapHistoryPage` | `RecapHistoryView` | push from Book Detail | empty (no recaps) · streaming · list · error/retry |
| `/lexicon` (`lexicon`) | `GreatLibraryPage` | `LexiconView` | **Tab 3** | loading · empty · search results (server-paginated) · filters · Word-of-the-Day |
| `/anki-review` (`anki-review`) | `AnkiReviewPage` | `ReviewView` | push from Lexicon / WotD | no-cards-due · reviewing (swipe) · daily-limit reached ("review more") · session complete |
| `/books/:id/passport` (`book-passport`) | `BookPassportPage` | `BookPassportView` | push from completion prompt / Book Detail | generating · journey + stats + AI summary · error |
| `/profile` (`profile`) | `ProfilePage` | `ProfileView` | **Tab 4** | loading · identity header (avatar + goal ring + level badge; email-initials fallback when no community profile row) · DNA signature strip (or below-threshold / generating / error) · DNA recommendation covers row · stat pills · Trophy Room entry · recap-memories carousel (or empty CTA) |
| `/profile/stats` (`profile-stats`) | `ProfileStatsPage` | `TrophyRoomView` | push from Profile (identity ring caption, stat pills, trophy row) | loading · quest ring hero (or no-goal CTA) · level/XP strip · reading calendar (month nav · day covers · day-detail list) · lifetime stats · library breakdown |
| `/profile/edit` (`profile-edit`) | `ProfileEditPage` | `ProfileEditView` | push from Profile identity header | **first-run create** (no `community_profiles` row exists until first save — placeholder state, not an error) · edit · username availability (checking/available/taken) · avatar pick + local preview · privacy selects · saving · save error |
| `*` (`not-found`) | `NotFoundPage` | — | — | native nav has no 404 |

## Navigation model

- Root: auth gate → `TabView` with 4 tabs: **Dashboard · Library · Lexicon · Profile**.
- `AddBookView` is a sheet/destination from Library and the Dashboard empty state.
- `BookDetailView` is pushed from Dashboard hero, Library rows, and search results — it's the hub for
  Recaps and Book Passport (child destinations).
- Completion prompt (book hits 100%) → confirmation → `BookPassportView`.
- `ProfileView` pushes two children: `TrophyRoomView` (analytics: quest ring, calendar, stats) and
  `ProfileEditView` (identity/privacy customization). `RecapHistoryView` is also reachable from the
  profile's recap-memories carousel — back navigation must return to wherever the reader came from
  (history pop, not a hardcoded parent).

## Cross-screen states to get right (design once, reuse)

- **Empty states** — every list/tab has one; reuse DS `EmptyState`. Onboarding copy must be actionable
  (constitution: "never a blank screen").
- **Loading** — glass skeleton / shimmer (DS `ShimmerView`), not a bare spinner where content has shape.
- **Offline** — progress saves queue locally + subtle pending indicator; import/search/AI require network
  and show a clear "needs connection" state.
- **AI generating** — streaming (recaps) or determinate/indeterminate progress (DNA, passport, import enrichment).
- **Imported-book affordances (034)** — "Imported" badge (from `source`) and "Set page count" hint
  (from `pageCountEstimated`) appear on cards across Library/Dashboard.
