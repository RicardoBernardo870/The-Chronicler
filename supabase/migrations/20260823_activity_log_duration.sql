-- Activity logs — session duration.
-- Adds duration_seconds so we can tell how long the app stayed open per
-- app_open row. The tracked account patches its own row's duration as the
-- session runs (heartbeat + on hide/unload); read/delete stay admin-only.
-- This relaxes the original append-only rule with a narrow UPDATE policy:
-- tracked accounts may only touch their own rows.
-- IDs here must stay in sync with src/composables/useActivityLog.ts.

alter table public.activity_logs
  add column if not exists duration_seconds integer;

-- Tracked accounts may update their own rows (duration_seconds in practice).
create policy "tracked users update own activity"
  on public.activity_logs for update
  using (
    auth.uid() = user_id
    and user_id in ('f817241e-f331-421c-b1a8-8147da346e9d'::uuid)
  )
  with check (
    auth.uid() = user_id
    and user_id in ('f817241e-f331-421c-b1a8-8147da346e9d'::uuid)
  );
