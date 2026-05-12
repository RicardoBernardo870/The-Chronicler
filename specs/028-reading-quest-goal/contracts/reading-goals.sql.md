# Contract: Reading Goals Persistence

## Purpose

Persist one yearly book goal per user and allow Profile UI to create or edit the current year's target.

## Table Contract

`reading_goals`

| Column | Contract |
|--------|----------|
| `id` | Stable generated id |
| `user_id` | Authenticated owner id |
| `year` | Calendar year for the goal |
| `target_books` | Positive integer target |
| `created_at` | Creation timestamp |
| `updated_at` | Last update timestamp |

## Constraints

- Unique `(user_id, year)`.
- `target_books >= 1`.
- Goal rows are user-owned and must not be visible across users.

## Access Contract

### Read current-year goal

Input:

```text
user id from current session
year
```

Output:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "year": 2026,
  "targetBooks": 24,
  "createdAt": "iso-timestamp",
  "updatedAt": "iso-timestamp"
}
```

If no goal exists, returns no row/null.

### Create or edit goal

Input:

```json
{
  "year": 2026,
  "targetBooks": 24
}
```

Behavior:

- Uses atomic upsert on `(user_id, year)`.
- Updates `target_books` and `updated_at` for existing row.
- Rejects invalid targets below 1.

## RLS Contract

- Authenticated users can select, insert, update, and delete only rows where `user_id` is their own id.
- Policies should use the optimized Supabase pattern `(select auth.uid()) = user_id`.
- `user_id` must be indexed.
