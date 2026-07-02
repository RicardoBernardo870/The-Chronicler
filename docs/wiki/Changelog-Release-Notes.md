# Changelog Release Notes

Last updated: 2026-07-02

This repository does not currently include a dedicated changelog file. Use this page as the starter convention for release documentation.

## Releases

## 2026-07-02 - Unreleased (profile redesign)

### Added

- **Identity-first Profile page:** avatar wrapped in the yearly-goal progress ring with a reader-level badge, compact Reading DNA signature strip (full analysis in a bottom sheet), a fitted row of DNA recommendation covers (tap → add-book flow), stat pills, and a **Recap memories** carousel of generated recap images (one near-full-width image per snap; signed URLs from the private `recap-images` bucket).
- **Trophy Room** (`/profile/stats`): yearly quest as a large progress ring with pace metrics, XP/level strip, **reading calendar** (month grid showing the cover of the book read each day, with a tappable day-detail list), lifetime stats grid, and library breakdown.
- **Profile customization** (`/profile/edit`): username (live availability check), display name, bio, avatar upload (client-side downscale to ≤512 px JPEG → `community-avatars`), public-profile toggle, and per-surface privacy (defaults to nobody). A community profile row is created only on first save — sign-up never creates one. First client surface for the community profile RPCs.
- **Completed books** on the detail page now show a "View Recap History" link next to the image carousel.

### Changed

- The old stacked profile cards (`ReadingQuestCard`, `ReadingDnaCard`) were retired; their content moved to `QuestGoalHero` (Trophy Room) and `DnaSignatureStrip`/`DnaRecommendationsScroller`.
- DNA recommendation covers resolve sequentially (Google Books primary, Open Library fallback) to avoid Google 503 rate-limiting; unresolved covers stay tappable via the add-book search flow.
- Recap History back navigation pops real history instead of hard-routing to the book detail page.

### Technical

- New RPC `get_reading_calendar(p_user_id, p_month_start, p_timezone)` — timezone-aware per-day book activity; migration `20260702_get_reading_calendar.sql` (applied to prod and mirrored locally).
- New composables: `useCommunityIdentity`, `useDnaRecommendations`, `useRecapGallery`, `useReadingCalendar`. New routes: `profile-stats`, `profile-edit`.

## 2026-06-20 - Version 3.7.0

### Added

- **Library Import (034):** import a Goodreads or StoryGraph CSV export from the Add Book screen or the empty-library state. Auto-detects the export format, maps shelf status (read → completed; everything else → "Want to read"), de-duplicates against the existing library, and bulk-creates books **quietly** (no recaps/lore/quest XP/passports). Missing covers/genres/pages are enriched in the background (ISBN-prioritized); books with no page count import with a correctable placeholder. Imported "read" books count toward lifetime library composition but are excluded from current-period stats (yearly goal, streaks, monthly activity).

### Changed

- Library cards show an "Imported" badge and a "Set page count" affordance for placeholder page counts. The Want-to-read (queue) shelf has a richer empty state pointing to import/search.

### Fixed

- **ISBN search in the Add Book search bar** now returns results. A bare ISBN query uses the Google Books `isbn:` operator and skips `langRestrict`, which previously filtered out editions whose language didn't match the browser (so an ISBN search could return nothing while the Scan-ISBN lookup succeeded).
- Latent `vue-tsc` typing error in `useRecapImage.ts` (`pollTimer`) surfaced by the type-layer change.

### Technical

- New dependency `papaparse` (lazy-loaded with the import dialog — both are separate bundle chunks, off the critical path).
- New columns `books.source` + `books.page_count_estimated`; `get_reading_quest_summary`, `get_reading_stats`, and `get_library_with_progress` updated (authored from live function bodies — only the documented lines changed).
- 4 new unit-test suites for the CSV parsers, format detection, and dedupe helpers.

### Migration Notes

- Apply `supabase/migrations/20260619_library_import.sql` (additive columns + three `CREATE OR REPLACE` RPCs). Backward-compatible: existing rows default to `source = 'manual'`, `page_count_estimated = false`.
- Run `pnpm install` to pick up `papaparse` + `@types/papaparse`. **Note: this project uses pnpm, not npm.**

## Recommended Format

Use date-based sections and group changes by user impact.

```markdown
## YYYY-MM-DD - Version X.Y.Z

### Added

- New features.

### Changed

- Behavior changes and UX improvements.

### Fixed

- Bug fixes.

### Technical

- Refactors, migrations, dependency changes, and test updates.

### Migration Notes

- Database, environment, or deployment steps required for this release.
```

## Starter Entry

```markdown
## 2026-05-17 - Unreleased

### Added

- Book completion prompt that directs readers to the Book Passport journey.
- Book Passport stats RPC support.

### Fixed

- Starting a session for a newly selected book now works even when no previous progress row exists.

### Technical

- Added unit tests for completion prompt behavior, active book completion handling, and session start behavior.
- Updated progress session handling to create an initial progress row when needed.

### Migration Notes

- Ensure `reading_progress.session_start_at` exists.
- Ensure `get_book_passport_stats` RPC migration is applied.
```

## Release Checklist

- Version updated if applicable.
- Database migrations applied.
- Edge Functions deployed.
- Environment variables and secrets verified.
- `pnpm test` passes.
- `pnpm build` passes.
- Wiki pages updated for changed behavior.

