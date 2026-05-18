# Changelog Release Notes

Last updated: 2026-05-17

This repository does not currently include a dedicated changelog file. Use this page as the starter convention for release documentation.

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

