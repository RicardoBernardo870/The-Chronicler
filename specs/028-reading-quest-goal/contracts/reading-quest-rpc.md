# Contract: Reading Quest Summary RPC

## Function

`get_reading_quest_summary(p_user_id uuid, p_year int)`

## Purpose

Return all Profile data needed by the Reading Quest card and reader level area in one server-side aggregate call.

## Inputs

| Name | Type | Rules |
|------|------|-------|
| `p_user_id` | uuid | Must match the authenticated user context |
| `p_year` | integer | Calendar year to summarize |

## Output Shape

The function returns one JSON object or one row with the following logical shape:

```json
{
  "year": 2026,
  "goal": {
    "id": "uuid",
    "targetBooks": 24,
    "createdAt": "iso-timestamp",
    "updatedAt": "iso-timestamp"
  },
  "quest": {
    "completedBooks": 7,
    "targetBooks": 24,
    "progressPercent": 29.2,
    "requiredBooksPerMonth": 2.0,
    "currentBooksPerMonth": 1.4,
    "projectedBooks": 17,
    "status": "behind",
    "statusLabel": "A little behind",
    "hasProjection": true
  },
  "level": {
    "totalXp": 2480,
    "level": 4,
    "levelTitle": "Lore Keeper",
    "currentLevelXp": 480,
    "nextLevelXp": 750,
    "xpToNextLevel": 270,
    "nextLevelTitle": "Archive Runner",
    "progressPercent": 64
  },
  "sources": {
    "pagesRead": 1860,
    "completedBooks": 7,
    "sessions": 18,
    "captures": 12,
    "recaps": 9,
    "loreCards": 6
  }
}
```

When no goal exists, `goal` is null and quest fields that require a target are null/zero as appropriate:

```json
{
  "year": 2026,
  "goal": null,
  "quest": {
    "completedBooks": 7,
    "targetBooks": null,
    "progressPercent": 0,
    "requiredBooksPerMonth": null,
    "currentBooksPerMonth": 1.4,
    "projectedBooks": 17,
    "status": "no_goal",
    "statusLabel": "Set your reading quest",
    "hasProjection": true
  },
  "level": { "...": "same level contract" },
  "sources": { "...": "same source counts" }
}
```

## Business Rules

- Completed book count uses books completed in `p_year`.
- Progress percent is capped at 100 for display.
- Projected books can exceed the target.
- If completion or pace data is insufficient, `hasProjection` is false and projection fields may be null.
- Status labels must be limited to friendly, non-punitive language.
- XP is derived from current persisted activity and must be deterministic.

## Performance Contract

- One call must return all quest and level data.
- The implementation must avoid one query per book or one query per activity item.
- Query filters should use indexed `user_id`, date/year, and join columns.
- The function should be stable for read-only aggregation except where implementation constraints require otherwise.
