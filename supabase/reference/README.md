# Live schema reference

`live-baseline-2026-10-19.sql` is the **current read-only snapshot of the live Supabase database** (project `zlndhygpqacygceivuvk`), captured on 2026-10-19 from the Postgres catalogs after the BC-01 security migration (`supabase/migrations/20261018120000_bc01_security_hardening.sql`) was applied. It holds every `public` function, trigger, RLS policy, constraint, index and enum, the `private` schema helpers added by BC-01, the storage buckets and their policies, plus a reference listing of table columns, the platform inventory, runtime settings, function ACLs and default privileges. The activity-log feature is excluded.

`live-baseline-2026-10-18.sql` is the **pre-BC-01 baseline**, kept unchanged for comparison.

Why it exists: `supabase/migrations/` has drifted from production. Most live functions, including the whole community / reading-circles layer, have no local migration, and replaying the folder would regress `get_reading_stats`. Until the drift is fixed (work package **BC-03** in [`docs/backend-consolidation-plan.md`](../../docs/backend-consolidation-plan.md)), the newest dated file here is the closest thing to a source of truth that lives in the repo.

Rules:

- **Not a migration.** Objects are grouped by category, not ordered by dependency. The folder is deliberately outside `supabase/migrations/` and `supabase/schemas/`, so the Supabase CLI never applies or diffs it.
- **Regenerate it whenever the live backend changes.** Re-run the catalog queries, save a new dated file, and update [`docs/backend-contract.md`](../../docs/backend-contract.md).
- The human-readable contract is `docs/backend-contract.md`; the business rules built on top of it are in [`docs/business-rules/`](../../docs/business-rules/README.md).
