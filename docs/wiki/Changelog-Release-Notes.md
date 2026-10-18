# Changelog & Release Notes

Last updated: 2026-10-18

Release history of **The Chronicler** (product name; internal code name **BookHero**, D-03). Entries are dated, newest first, and grouped by user impact. The app version lives in `package.json` (currently **3.9.1**). Entries after 3.9.1 are unreleased commits on `master`.

For current behaviour, see [Features](Features.md) (overview) and the [business-rules catalog](../business-rules/README.md) (authoritative).

## Releases

## 2026-10-18 — Documentation overhaul

No code, schema or edge-function changes. Every new document was verified against web `master` @ `8d8701c` and the live Supabase project on 2026-10-18.

### Added

- **Business-rules catalog**, [`docs/business-rules/`](../business-rules/README.md).
  - A README with the index, legend, glossary and decisions log.
  - Twelve domain files with stable rule IDs, plus a "Known defects" (`<PREFIX>-Dnn`) and an "Open decisions" (`<PREFIX>-Qnn`) section in each: 01 Library (LIB), 02 Reading sessions (SES), 03 Recaps (REC), 04 Capture, Resume & Quiz (CAP), 05 Codex & Lexicon (LEX), 06 Insights (INS), 07 Profile, Stats & Goals (PRO), 08 Platform, Auth & Account (PLT), 09 Database invariants (BE), 10 Community & Circles (COM), 11 Cross-domain (XD), 12 Client logic register (CL).
- **Backend consolidation plan**, [`docs/backend-consolidation-plan.md`](../backend-consolidation-plan.md). Phase 0 backend work before the iOS build, as work packages BC-01…BC-15 (listed below).
- **Live schema reference**, [`supabase/reference/live-baseline-2026-10-18.sql`](../../supabase/reference/live-baseline-2026-10-18.sql) with a [README](../../supabase/reference/README.md). A read-only DDL snapshot of the live database: functions, triggers, policies, constraints, indexes, enums and buckets. It is **not** a migration; `supabase/migrations/` has drifted from production.

### Changed

- **Backend contract rewritten**, [`docs/backend-contract.md`](../backend-contract.md). Sixteen sections:
  1. Connection, auth & runtime limits
  2. Domain map
  3. Tables
  4. Cascades & lifecycle effects
  5. Row-level security
  6. Enums
  7. Storage
  8. RPC catalogue
  9. Triggers & internal functions
  10. Edge functions
  11. External APIs (client-side)
  12. Security status
  13. Drift: migrations & deployed sources
  14. Advisors & performance
  15. Notes for native clients
  16. Planned changes

  It now covers `book_quizzes`, `achievements`, `generate-book-quiz` and `get_reading_records`, and corrects the claims that every RPC re-checks the caller and that the `verify_jwt:false` functions validate tokens.
- **iOS docs rewritten**: [`ios-implementation-plan.md`](../ios-implementation-plan.md), [`ios-native-migration-details.md`](../ios-native-migration-details.md), [`ios-phase-prompts.md`](../ios-phase-prompts.md) and [`ios-foundation/`](../ios-foundation/README.md).
  - The phase prompts become Claude Code ultracode kickoff briefs.
  - The iOS repo gets a `CLAUDE.md` derived from `ios-foundation/ios-constitution.md`.
  - Every Spec Kit step, and every reference to `specs/1xx-ios-*` or `docs/wiki/Planned-*.md`, is removed (those never existed).
- **Wiki.**
  - [Features](Features.md) is now an overview that links every area to its rules file. It adds the previously undocumented Memory Check, Focus mode, DNF, achievements, records and the Trophy Room / Reading Stats split, and fixes the stale statements (forecast line, Codex page size, recap lock and cooldown, OCR auto-save, Insights' dependency on recaps, offline semantics, import caveats, account and auth gaps).
  - [Home](Home.md) navigates to the new documents.
  - [FAQ](FAQ.md) is refreshed.
  - This changelog is backfilled from 2026-07-14.

### Owner decisions (2026-10-18)

| ID | Decision |
|---|---|
| D-01 | Docs layout: a numbered business-rules catalog in `docs/business-rules/` (README + per-domain files); `docs/wiki/Features.md` becomes an overview that links into it. |
| D-02 | No Spec Kit. The native app and future features are built with Claude Code using Opus 5.5 in ultracode mode; the iOS repo gets a `CLAUDE.md` instead of a `.specify` constitution. |
| D-03 | Product / App Store name is "The Chronicler"; "BookHero" stays the internal code name (repo, Supabase project, identifiers, `bookhero-ios`). |
| D-04 | iOS 26+ minimum, iPhone first. Native Liquid Glass (`.glassEffect` / `GlassEffectContainer`) is the only glass implementation, with no pre-iOS-26 fallback; Reduce Transparency and Increase Contrast are respected. |
| D-05 | The PWA stays live. The long-term goal is iOS + Android + web on one shared Supabase backend, so every backend change is client-agnostic and backward compatible. |
| D-06 | Core logic moves server-side before the iOS build: atomic save-progress RPC, recap eligibility in `generate-recap`, server-side achievements and Insight generation. Native clients stay thin. |
| D-07 | Every day / week / month / year boundary uses the reader's IANA time zone. Stats RPCs take a time-zone parameter, and the zone is stored server-side for jobs. |
| D-08 | Any forward page change counts for pages, streaks and charts, offline replays included at their original time. Session XP, session-count badges and the Last Session card need a real timed session. |
| D-09 | Edge-function drift: the deployed versions are canonical (`generate-lore` v18, accuracy-first, temperature 0.35; `generate-reading-dna` v8 with Google Search grounding). Repo sources are synced to them. |
| D-10 | Account deletion is an immediate hard delete through a new `delete-account` edge function (Storage purge, Apple token revocation, `auth.admin.deleteUser`, FK cascades), with confirm + re-auth, on web and iOS. |
| D-11 | Auth is Sign in with Apple + email/password, with password reset on both clients, magic and reset links through universal links, and Apple-ID linking for existing email users. |
| D-12 | Insights without a qualifying recap are generated from page captures, or from spoiler-guarded metadata. Skipped, offline-crossed or failed milestones are back-filled. |
| D-13 | The iOS v1 profile is username + display name + avatar only. Follow graph, discovery and circles are a much later Community phase, and that backend stays dormant. |
| D-14 | Subscriptions / paywall are undecided. Any tier table is a non-binding draft, and entitlement + AI-usage checks are designed without fixing tiers or prices. |
| D-15 | iOS OCR runs on-device with Apple Vision first, and falls back to `ocr-page` (Gemini) on low confidence. The 0.90 / 0.70 thresholds must be recalibrated for Vision. |
| D-16 | A read-only live-schema snapshot is committed at `supabase/reference/`. The repo will be private, so security findings are documented in full. |
| D-17 | The activity-log feature is out of scope for all documentation; existing mentions that describe it are removed. |

### Phase 0 work packages (fixed IDs)

| ID | Package | Status |
|---|---|---|
| BC-01 | Security hardening (RPC owner checks, revoke anon/PUBLIC EXECUTE, book-ownership RLS on child tables, dead/leaking helpers) | Required |
| BC-02 | Edge-function auth (verified JWTs for `generate-recap`, `generate-lore`, `ocr-page`; committed `supabase/config.toml`) | Required |
| BC-03 | Source of truth & drift (baseline migration, migration discipline, repo synced to deployed functions) | Decided |
| BC-04 | Atomic progress & session RPCs (`save_progress`, session RPCs, `completed_at`, DNF/resume RPCs) | Decided |
| BC-05 | Server-owned completion & lifecycle effects | Decided |
| BC-06 | Timezone standardisation (`p_timezone` on every stats RPC, stored reader zone) | Decided |
| BC-07 | Recap eligibility & persistence server-side | Decided |
| BC-08 | Insights orchestration server-side + fallback | Decided |
| BC-09 | Achievements server-side | Decided |
| BC-10 | Review (Leitner) RPC | Recommended |
| BC-11 | Account lifecycle & auth (delete-account, reset, Sign in with Apple, universal links, SMTP) | Decided |
| BC-12 | Entitlements & AI-usage foundation (tiers undecided) | Decided in principle |
| BC-13 | Storage hygiene & AI-job robustness | Recommended |
| BC-14 | Sync & realtime readiness | Recommended |
| BC-15 | Book data hygiene (ISBN normalisation, book-search proxy, import RPC) | Recommended |

## 2026-08-27 — Unreleased (load resilience)

### Fixed

- **Reader profile no longer blanks for the session after one failed fetch.** A failed `get_my_community_profile` call no longer counts as "fetched". The next mount retries, up to 3 attempts per user, so a single transient error no longer leaves an empty Dashboard greeting until reload (`useCommunityIdentity`).
- **Transient 401s on cold start.** Every PostgREST request (`/rest/v1/`, tables and RPCs) that returns 401 is retried once after 400 ms, which covers the cold-start token race (`src/services/retryingFetch.ts`, wired in `src/services/supabase.ts`).

### Added

- **"Some things didn't load" notice.** A warn glass toast, "Reopen the app or refresh the page to try again.", shown at most once per 30 s. It fires when a retried 401 still fails, or when the Dashboard library load fails (`src/composables/useLoadFailureNotice.ts`).

### Technical

- New unit-test suite `tests/unit/retryingFetch.spec.ts`.

## 2026-07-27 — Unreleased (recap lock fix, continuity warning removed)

### Fixed

- **Recap lock: the 72 h idle grant is now one-shot.** The grant also requires ≥ 6 h since the last recap. Before, generating a recap did not touch `reading_progress.updated_at`, so the button stayed unlocked until some unrelated progress write. Regression tests: `tests/unit/recapLockIdleUnlock.spec.ts`.

### Removed

- **The hero "continuity warning"** (`useReadingPulse`): a score of 100 − 15 per day since the last history row, which below 40 showed an amber pulse and "It's been a while — time for a Memory Jogger?". Its client-side streak went with it. The hero forecast line ("N pages left · finish by ~date", or "N pages to your next Insight") is unchanged.

## 2026-07-17 — Unreleased (DNF shelf, Focus-mode reading goals)

### Added

- **DNF — Did Not Finish.**
  - Book Detail "Didn't finish it? Shelve this book" (with a confirm) pauses every feature for the book until "Start reading again".
  - The Library header shows a DNF icon when at least one book is shelved, leading to the DNF list (`/library/dnf`) with per-row Resume.
  - Library search shows a "Did Not Finish" group.
  - CSV import maps `did-not-finish` / `did not finish` / `dnf` shelves to the DNF shelf.
- **Focus mode reading goals.**
  - Chips 15 / 30 / 45 / 60 min start a display-only countdown.
  - At zero: three double-dings (880 Hz), vibration where supported, "Time's up", a pulsing End Session, and overtime counted as `+M:SS`.
  - The session keeps running, and the goal is not persisted.
- **Legal & compliance review** document: [`docs/legal-compliance-review.md`](../legal-compliance-review.md).

### Technical

- Migration `20260717_dnf_status.sql`: `reading_progress.dnf_at timestamptz`. `get_library_with_progress` now returns `dnfAt` and a `'dnf'` status that takes precedence over the derived one.
- Service worker: TypeScript declarations for the Background Sync `sync` event. The `progress-sync` relay that asks open windows to flush the offline queue predates this change.

### Known limitations (documented 2026-10-18)

- Shelving re-sends the device's cached page and can roll back a page saved on another device (LIB-D23).
- Server stats ignore DNF (PRO-95).

## 2026-07-16 — Unreleased (offline boot, service-worker update)

### Changed

- **Service worker.** It now activates immediately (`skipWaiting` + `clients.claim`), and the page reloads **once** when the new worker takes control, with no prompt. A navigation route serves the precached app shell for in-app SPA navigation.
- **Offline-tolerant boot.** Session restore races `getSession()` against a 3 s timeout, then falls back to the persisted last-user snapshot (`localStorage['bookhero-auth-user']`), so the app opens offline with an expired token.

### Fixed

- The capture review overlay now mounts only when a review is actually needed.

## 2026-07-15 — Version 3.9.1 (Memory Check, Trophy Room / Reading Stats split, Focus mode, records & achievements)

### Added

- **Memory Check.** A pre-session recall quiz of 1–3 questions with exactly 3 options each, grounded only in the reader's page captures. Entry points:
  - at Start Session after ≥ 48 h away, as an intro "Quiz me" / "Skip to reading" with the AI call made only on opt-in;
  - on demand, from a "Memory check" chip on Book Detail.

  The quiz is cached per book while its page snapshot covers the reader's position. It is suppressed when a fresh recap covers the position or the covering quiz was already answered. There is no XP.
- **Focus mode.** A full-screen cover with a big timer and pause / End Session, available only during a session. It holds a Screen Wake Lock and auto-dims after 30 s without a touch.
- **Personal records** on Reading Stats: best day, longest session (12 h cap), fastest finish, night owl, and the all-time longest streak.
- **Achievements.** 17 badges on the Trophy Room wall, earned ones lit with a date and locked ones dimmed with a hint. The catalog lives client-side in `src/utils/achievements.ts`. Newly met keys are written to an insert-only ledger when the Trophy Room mounts.

### Changed

- **Profile detail split into two pages.** **Trophy Room** (`/profile/trophy-room`) holds the quest ring, the level / XP strip and achievements. **Reading Stats** (`/profile/stats`) holds the monthly chart, calendar, lifetime stats, records, book lengths and library breakdown. The Profile shows "Trophy room" and "Stats" entry cards. `ProfileStatsPage.vue` was renamed `ReadingStatsPage.vue`, and `TrophyRoomPage.vue` is new.
- The Focus-mode status line reads "Reading...".

### Technical

- New edge function `generate-book-quiz` (`verify_jwt: true`). It is stateless, shuffles the options server-side and soft-fails with `{quiz: null}`.
- Migration `20260715_book_quizzes.sql`: table `book_quizzes`, unique per (user, book), score 0–3, owner RLS, plus trigger `book_quizzes_delete_on_completion`.
- Migration `20260716_records_achievements.sql`: RPC `get_reading_records(p_user_id, p_timezone)` and table `achievements`, an insert-only ledger unique per (user, key).
- New composables `useBookQuiz`, `useReadingRecords`, `useAchievements`, `useWakeLock`.
- `package.json` version 3.9.1.

## 2026-07-14 — Unreleased (OCR auto-save, glass toast, DNA cover cache)

### Added

- **High-confidence OCR auto-save.** A capture with OCR confidence ≥ 0.90 and non-empty text saves without review, with a "Page captured" confirmation. Below 0.90 the reader reviews the text, and below 0.70 a low-confidence warning is added.
- **Glass toast.** A top-centre pill notification (success / loading / warn), mounted once in `App.vue`. The capture flow uses it for loading ("Reading the page…") and results (`useGlassToast`, `GlassToast.vue`).
- **DNA recommendation cover cache.** Resolved covers are stored in `localStorage['bookhero:dna-covers']`, keyed by the suggestion list, so a Profile reload makes no new Google / Open Library calls.

### Changed

- The capture panel collapses while OCR or an auto-save runs. Progress is shown through the glass toast instead of inline spinners.

## 2026-07-13 — Version 3.9.0 (Session Resume, arc recaps, recap modal)

### Added

- **Session Resume ("Previously" dialog).**
  - Tapping Start Session first shows a modal with a resume of the reader's **highest-page** capture: up to 3 one-sentence bullets and 1 tension line. The session timer starts only on "Begin reading"; dismissing aborts the start (`session_start_at` is written on confirm).
  - Strictly resume-or-nothing, and suppressed when the latest recap already covers the current position (`pageSnapshot >= currentPage`).
  - New edge function `generate-page-resume` (stateless, Gemini 2.5 Flash). Generation runs fire-and-forget after a capture is saved and is persisted on `page_captures.resume`, with an on-demand backfill for older captures. A failed or empty generation is retried at the next Start.
  - Resumes are purged with their captures when the book is completed.
- **Arc-shaped recaps.**
  - `memory_jogger` now reads as an arc: where you left off → what changed → the strongest moment. `thematic_bridge` names the open thread.
  - All fields stay label-free prose, so the image prompt refiner keeps working. `concept_watchlist` is capped at 5.
  - The journal framing "pages X–Y · N days later" is computed client-side from the previous recap row.
- **Recap modal redesign.**
  - Get Recap opens `RecapDialog`, which replaces the inline `RecapStream` and the Dashboard hero's inline panel (both deleted).
  - It shows a shimmer while generating, then an image-first story layout: illustration slot ("Illustrating this stretch…"), corpus / days byline, arc prose, watchlist chips, open-thread quote, and a footer with View history + Done.
  - History cards (`RecapCard`) use the same layout; the accordions are removed.
  - Dismissing the modal on the Dashboard still aborts an in-flight recap. On Book Detail it does not.

### Changed

- `SessionStartButton` now gates the session start behind the resume dialog on both Book Detail and the Dashboard hero.
- `generate-recap` repo sources were synced with deployed v84: the arc prompt, watchlist ≤ 5, passport 90–100 words, and the square-frame image refiner guidance.

### Technical

- A compile-time test flag `DISABLE_RECAP_LOCK` was added to `useRecapLock.ts`. It is `false` in production.
- `package.json` version 3.9.0.

### Migrations

- `20260713_session_page_resume.sql`: `page_captures.resume` (jsonb) + `resume_generated_at`. The migration comment mentions a `characters` array; the function writes only `bullets` + `tension`.

## 2026-07-04 — Versions 3.8.2 / 3.8.3 (Codex, sessions, book detail, Trophy Room charts, review polish)

Version 3.8.2 shipped on 2026-07-03 and 3.8.3 on 2026-07-11.

### Added

- **Codex** (the Great Library renamed).
  - Header stats, and Lexicon / Insights tabs.
  - **Quotes** as a lexicon type: the Add-to-Codex modal reshapes for the quote text and a note. Quotes are keepsakes, excluded from every review surface.
  - Newest ↔ A–Z sort, and All / Dictionary / Quotes chips.
- **Library findability.** A sticky, accent-insensitive search in both views with grouped results, sticky collapsible grid section headers, sticky list-view tabs, and a queue **reorder mode** in both views.
- **Session timer + pause/resume.** A live count on the session card (pause · stop · count) and a new `session_paused_at` column. Resume shifts `session_start_at`, so stats needed no changes.
- **End Session flow.**
  - An explicit End Session button opens the page sheet "Where did you stop?", with a −/+ stepper and a native numeric input. The recap button hides on the hero during sessions.
  - A pencil edit handles quiet page corrections.
  - The permanent CURRENT PAGE inputs were removed from the hero and the book panel.
- **Dashboard.** A greeting with avatar or setup call to action, the Up Next cover shelf, a one-row Completed link, and the hero forecast line ("N pages left · finish by ~date"), which becomes an Insight-milestone nudge within 15 pages.
- **Book detail redesign.** A centered-cover hero with a clamped description, backfilled from Google Books when it is missing. A Recap memories section (a book-scoped image carousel for reading and completed books, Get Recap in its header, and the history link). Codex / Words chips.
- **Trophy Room charts.** "Your year" monthly bars (`get_monthly_reading` RPC), a genre distribution bar and a Book Lengths card. These moved to Reading Stats on 2026-07-15.
- **Anki review.**
  - Undo of the last answer, which reverses mastery or reset.
  - A missed-words summary list and a progress bar.
  - An `en-US`-pinned pronunciation button.
  - A deep-link data fetch, an idempotent session save and content-sized flashcards.
- **PWA social rollout plan recorded**: discovery → circles + invite links → following feed → clubs. Superseded on 2026-10-18 by D-13 (community is a much later phase).

### Migrations

- `20260703_session_pause_resume.sql`.
- `20260703_get_monthly_reading.sql`.
- `lexicon_quote_entry_type` (applied through MCP): deleted the legacy lore rows; the CHECK is now `dictionary | quote`.

## 2026-07-02 — Unreleased (profile redesign)

### Added

- **Identity-first Profile page.**
  - The avatar sits inside the yearly-goal progress ring, with a reader-level badge.
  - A compact Reading DNA signature strip, with the full analysis in a bottom sheet.
  - A fitted row of DNA recommendation covers; a tap opens the add-book flow.
  - Stat pills.
  - A **Recap memories** carousel of generated recap images, one near-full-width image per snap, through signed URLs from the private `recap-images` bucket.
- **Trophy Room** (then at `/profile/stats`, split into two pages on 2026-07-15). A yearly quest as a large progress ring with pace metrics, an XP / level strip, the **reading calendar** (a month grid with the cover of each day's book and a tappable day-detail list), a lifetime stats grid and the library breakdown.
- **Profile customization** (`/profile/edit`).
  - Username with a live availability check, display name, bio, and avatar upload (downscaled client-side to ≤ 512 px JPEG and stored in `community-avatars`).
  - A public-profile toggle and per-surface privacy (default: nobody).
  - The community profile row is created only on the first save; sign-up never creates one. This is the first client surface for the community profile RPCs.
- **Completed books** on the detail page now show a "View Recap History" link next to the image carousel.

### Changed

- The old stacked profile cards (`ReadingQuestCard`, `ReadingDnaCard`) were retired. Their content moved to `QuestGoalHero` (Trophy Room) and to `DnaSignatureStrip` / `DnaRecommendationsScroller`.
- DNA recommendation covers resolve one at a time (Google Books primary, Open Library fallback) to avoid Google 503 rate limiting. Unresolved covers stay tappable through the add-book search flow.
- Recap History back navigation now pops real history instead of hard-routing to the book detail page.

### Technical

- New RPC `get_reading_calendar(p_user_id, p_month_start, p_timezone)`: time-zone-aware per-day book activity. Migration `20260702_get_reading_calendar.sql`, applied to production and mirrored locally.
- New composables `useCommunityIdentity`, `useDnaRecommendations`, `useRecapGallery`, `useReadingCalendar`. New routes `profile-stats` and `profile-edit`.

## 2026-06-20 — Version 3.7.0

### Added

- **Library Import (034).**
  - Import a Goodreads or StoryGraph CSV export from the Add Book screen or the empty-library state.
  - The export format is detected automatically. Shelf status is mapped: read → completed, everything else → "Want to read"; the DNF mapping followed on 2026-07-17.
  - Books are de-duplicated against the library loaded in memory and bulk-created **quietly**: no recaps, lore, quest XP or passports.
  - Missing covers, genres and pages are enriched in the background, ISBN first. Books with no page count import with a 100-page placeholder.
  - Imported "read" books count toward lifetime library composition but are excluded from the yearly goal and XP.
- **Ebook support (033, merged 2026-06-19).** "Upload image" beside "Take photo" in the capture prompt, for screenshots or no camera. The image is normalised client-side (long edge ≤ 2000 px, JPEG 0.85) and is never stored.

### Changed

- Library cards show an "Imported" badge and a "Set page count" label for placeholder page counts. The Want-to-read (queue) shelf has a richer empty state pointing to import and search.

### Fixed

- **ISBN search in the Add Book search bar** now returns results. A bare ISBN query uses the Google Books `isbn:` operator and skips `langRestrict`. Before, `langRestrict` filtered out editions whose language didn't match the browser, so an ISBN search could return nothing while the Scan-ISBN lookup succeeded.
- A latent `vue-tsc` typing error in `useRecapImage.ts` (`pollTimer`), surfaced by the type-layer change.

### Technical

- New dependency `papaparse`, lazy-loaded with the import dialog. Both are separate bundle chunks, off the critical path.
- New columns `books.source` and `books.page_count_estimated`. `get_reading_quest_summary`, `get_reading_stats` and `get_library_with_progress` were updated, authored from the live function bodies with only the documented lines changed.
- 4 new unit-test suites for the CSV parsers, format detection and dedupe helpers.

### Migration Notes

- Apply `supabase/migrations/20260619_library_import.sql`: additive columns plus three `CREATE OR REPLACE` RPCs. It is backward compatible: existing rows default to `source = 'manual'` and `page_count_estimated = false`.
- Run `pnpm install` to pick up `papaparse` and `@types/papaparse`. **This project uses pnpm, not npm.**

## 2026-05-17 — Unreleased (completion prompt, passport stats)

### Added

- A book completion prompt that directs readers to the Book Passport journey.
- Book Passport stats RPC (`get_book_passport_stats`).

### Fixed

- Starting a session for a newly selected book now works even when the book has no progress row yet.

### Technical

- Unit tests for the completion prompt, active-book completion handling and session start.
- Session handling creates an initial progress row when needed.

### Migration Notes

- Ensure `reading_progress.session_start_at` exists.
- Ensure the `get_book_passport_stats` RPC migration is applied.

## Recommended format

Use date-based sections and group changes by user impact.

```markdown
## YYYY-MM-DD — Version X.Y.Z (or "Unreleased (theme)")

### Added
- New features.

### Changed
- Behaviour changes and UX improvements.

### Fixed
- Bug fixes.

### Removed
- Removed features or UI.

### Technical
- Refactors, migrations, dependency changes, and test updates.

### Migration Notes
- Database, environment, or deployment steps required for this release.
```

## Release checklist

- Version updated in `package.json` if applicable.
- `pnpm test` passes, and `pnpm build` (`vue-tsc -b && vite build`) passes. There is no lint script and no CI.
- Database migrations applied. After any live backend change, regenerate the `supabase/reference/` snapshot and update [`backend-contract.md`](../backend-contract.md); `supabase/migrations/` is not a reliable replay source until BC-03.
- Edge functions deployed with the right settings. The repo has **no `supabase/config.toml`**, so `supabase functions deploy` defaults to `verify_jwt = true`.
  - `generate-recap`, `generate-lore` and `ocr-page` currently run with `verify_jwt = false` until BC-02.
  - Do **not** deploy `generate-lore` or `generate-reading-dna` from the repo until it is synced to the deployed v18 / v8 sources (D-09 · BC-03).
- Environment variables and secrets verified. Edge secrets: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [Features](Features.md) and the affected [business-rules](../business-rules/README.md) file updated for changed behaviour; this changelog updated.
