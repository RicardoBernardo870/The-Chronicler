# Contract: `books` schema additions

Additive migration. Both columns `NOT NULL` with defaults so existing rows need no backfill.

```sql
alter table public.books
  add column if not exists source text not null default 'manual',
  add column if not exists page_count_estimated boolean not null default false;

-- Optional guard: constrain known sources (kept permissive for forward-compat).
-- Imported = source <> 'manual'. Values used by this feature: 'manual','goodreads','storygraph'.
```

## Semantics

- `source`
  - `'manual'` — added via scan / manual / search (existing flows). Default; unchanged behavior.
  - `'goodreads'` / `'storygraph'` — created by an import. **Excluded** from `get_reading_quest_summary`
    and from `get_reading_stats.totalPagesRead`. **Included** everywhere lifetime/composition is shown.
- `page_count_estimated`
  - `true` — `total_pages` is a flagged placeholder (FR-007); UI shows a "fix page count" affordance.
  - Set back to `false` when enrichment finds a real count or the reader edits the page count.

## Write paths that set these

- Import bulk insert: `source = <detected>`, `page_count_estimated = (csvPages == null)`.
- Existing `addBook` / `addBookWithInitialStatus`: leave defaults (`'manual'`, `false`).
- `updateBook`: clears `page_count_estimated` when `totalPages` is set to a real value.

## RLS

Unchanged — columns live on `books`, covered by existing per-user policies.
