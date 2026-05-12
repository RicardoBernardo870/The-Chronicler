# Data Model: Reading Quest Goal

## Entity: ReadingGoal

User-authored yearly book goal.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | uuid | yes | Stable goal id |
| `user_id` | uuid | yes | Owner |
| `year` | integer | yes | Calendar year, e.g. 2026 |
| `target_books` | integer | yes | Must be at least 1 |
| `created_at` | timestamp | yes | Creation time |
| `updated_at` | timestamp | yes | Last edit time |

### Validation Rules

- One goal per `(user_id, year)`.
- `target_books >= 1`.
- `year` must be a reasonable calendar year; implementation should accept current year and future-proof historical rows.
- Users may only access their own goal rows.

### State Transitions

```text
No goal -> Goal set -> Goal edited
                  \-> New calendar year -> No active goal for new year
```

## Entity: ReadingQuestSummary

Derived current-year quest state returned to the Profile page.

| Field | Type | Notes |
|-------|------|-------|
| `year` | integer | Active calendar year |
| `goal` | ReadingGoal or null | Null when no current-year goal exists |
| `completed_books` | integer | Books completed in the active year |
| `target_books` | integer or null | Goal target when set |
| `progress_percent` | number | Capped at 100 for visual progress |
| `required_books_per_month` | number or null | Pace required from year start or remaining months |
| `current_books_per_month` | number or null | Current year-to-date completion pace |
| `projected_books` | number or null | Projected total by year end |
| `status` | string | `no_goal`, `no_projection`, `ahead`, `on_track`, `behind`, `comeback`, `complete` |
| `status_label` | string | Friendly display label |

### Status Rules

- `no_goal`: no current-year goal exists.
- `complete`: completed books are greater than or equal to target.
- `no_projection`: goal exists but pace history is insufficient.
- `ahead`: projection clearly exceeds target.
- `on_track`: projection approximately meets target.
- `behind`: projection is below target but recoverable.
- `comeback`: projection is materially below target, framed gently.

## Entity: ReaderXpSummary

Derived level state returned with the quest summary.

| Field | Type | Notes |
|-------|------|-------|
| `total_xp` | integer | Sum of all v1 XP sources |
| `level` | integer | Starts at 1 |
| `level_title` | string | Literary title for current level |
| `current_level_xp` | integer | XP earned since current level threshold |
| `next_level_xp` | integer | XP needed to move from current to next level |
| `xp_to_next_level` | integer | Remaining XP |
| `next_level_title` | string or null | Null at max named level if no next title |
| `progress_percent` | number | 0-100 progress within current level |

### XP Source Rules

| Source | XP |
|--------|----|
| Pages read | 1 per page |
| Completed books | 25 each |
| Reading sessions | 10 each |
| Page captures | 15 each |
| Recaps | 20 each |
| Lore cards | 15 each |

### Level Titles

| Level Band | Title |
|------------|-------|
| 1 | Page Turner |
| 2 | Chapter Seeker |
| 3 | Margin Walker |
| 4 | Lore Keeper |
| 5 | Archive Runner |
| 6 | Chapter Sage |
| 7+ | Library Legend |

## Entity: QualifyingReadingActivity

Existing persisted activity used to derive quest and XP.

| Activity | Source |
|----------|--------|
| Pages read | Reading progress joined to books |
| Completed books | Reading progress completion state plus best completion timestamp |
| Sessions | Progress history rows representing saved progress sessions |
| Page captures | Saved page captures |
| Recaps | Saved recaps |
| Lore cards | Saved lore cards |

## Relationships

- ReadingGoal belongs to one user.
- ReadingQuestSummary belongs to one user/year and may include one ReadingGoal.
- ReaderXpSummary belongs to one user and is derived from QualifyingReadingActivity.

## Indexing and RLS Notes

- `reading_goals` requires a unique index or constraint on `(user_id, year)`.
- `reading_goals.user_id` must be indexed for RLS and owner-scoped reads.
- Aggregate RPC implementation should verify indexes on user/date filters used for progress history, recaps, captures, and lore cards.
- RLS policies should use `(select auth.uid()) = user_id` for Supabase performance.
