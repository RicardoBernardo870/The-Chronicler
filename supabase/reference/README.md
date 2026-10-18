# Live schema reference

`live-baseline-2026-10-18.sql` is a **read-only snapshot of the live Supabase database** (project `zlndhygpqacygceivuvk`), captured on 2026-10-18 from the Postgres catalogs. It holds every `public` function, trigger, RLS policy, constraint, index and enum, the storage buckets and their policies, plus a reference listing of table columns, the platform inventory, runtime settings and default privileges. The activity-log feature is excluded.

Why it exists: `supabase/migrations/` has drifted from production. 55 of the 69 live functions, including the whole community / reading-circles layer, have no local migration, and replaying the folder would regress `get_reading_stats`. Until the drift is fixed (work package **BC-03** in [`docs/backend-consolidation-plan.md`](../../docs/backend-consolidation-plan.md)), this file is the closest thing to a source of truth that lives in the repo.

Rules:

- **Not a migration.** Objects are grouped by category, not ordered by dependency. The folder is deliberately outside `supabase/migrations/` and `supabase/schemas/`, so the Supabase CLI never applies or diffs it.
- **Regenerate it whenever the live backend changes.** Re-run the catalog queries, save a new dated file, and update [`docs/backend-contract.md`](../../docs/backend-contract.md).
- The human-readable contract is `docs/backend-contract.md`; the business rules built on top of it are in [`docs/business-rules/`](../../docs/business-rules/README.md).
