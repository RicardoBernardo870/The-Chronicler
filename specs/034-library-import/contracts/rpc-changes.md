# Contract: RPC changes

All three are authored as `CREATE OR REPLACE` from the **live** definitions captured during planning,
changing only the lines below. This avoids reverting any remote-only fixes (the discipline that caught a
near-regression in the recent `get_reading_stats` work). Keep `SECURITY DEFINER`, `SET search_path`, the
`authorized` / auth.uid() guards, and all other CTEs byte-for-byte.

## 1. `get_reading_quest_summary(p_user_id uuid, p_year integer)` — EXCLUDE imported

In the `progress_rows` CTE only, add the source filter:

```sql
    progress_rows as (
      select
        b.id,
        greatest(b.total_pages, 0) as total_pages,
        least(greatest(coalesce(rp.current_page, 0), 0), greatest(b.total_pages, 0)) as current_page,
        rp.updated_at
      from public.books b
      left join public.reading_progress rp
        on rp.book_id = b.id
       and rp.user_id = b.user_id
      where b.user_id = p_user_id
        and coalesce(b.source, 'manual') = 'manual'   -- 034: imports never count toward quest/XP
    ),
```

**Effect**: imported books drop out of `completed_books_year` (yearly goal), `completed_books_all`, and
`pages_read` ⇒ no XP and no goal inflation (FR-005, FR-014, SC-007). `reading_sessions`/captures/recaps/
lore counts already exclude imports (imports create none).

## 2. `get_reading_stats(p_user_id uuid)` — EXCLUDE imported from lifetime pages

In the `current_progress` CTE only, add the source filter:

```sql
  current_progress as (
    select
      least(greatest(rp.current_page, 0), b.total_pages) as pages_read
    from public.reading_progress rp
    join authorized a on a.user_id = rp.user_id
    join public.books b
      on b.id = rp.book_id
     and b.user_id = rp.user_id
    where b.total_pages > 0
      and rp.current_page > 0
      and coalesce(b.source, 'manual') = 'manual'   -- 034: imported books don't inflate totalPagesRead
  )
```

**Do NOT touch** `deltas`, `valid_sessions`, `reading_days`, `streak_*` — they read `progress_history`,
which imports never write. `pagesThisWeek/Month`, `sessionsThisMonth`, streaks, hours, velocity are
already correct.

## 3. `get_library_with_progress(p_user_id uuid)` — EXTEND (do not filter)

Add `source` and `pageCountEstimated` to the per-row JSON object so the client can badge imported books
and surface the page-fix prompt. Keep all existing books in the result (imports included).

```sql
    -- inside the per-book json_build_object(...)
    'source', coalesce(b.source, 'manual'),
    'pageCountEstimated', coalesce(b.page_count_estimated, false),
```

## Unchanged (must keep counting imports)

- `get_library_breakdown` — genre distribution, `booksFinished`, authors, avg completion: **no change**.
- `get_last_session` — reads `progress_history`: **no change** (imports write none).

## Verification queries (run after apply)

```sql
-- Quest yearly goal ignores an imported completed book:
--   import 1 read book → get_reading_quest_summary(...).quest.completedBooks unchanged.
-- Library composition still counts it:
--   get_library_breakdown(...).booksFinished increases by 1.
```
