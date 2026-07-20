-- Activity logs — private usage telemetry.
-- Tracked accounts write their own rows from the client; only the admin
-- account can read (or clear) them. RLS is the real access gate — the
-- client-side checks in the app only decide what the UI shows and sends.
-- IDs here must stay in sync with src/composables/useActivityLog.ts.

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null default 'app_open',
  path text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx
  on public.activity_logs (created_at desc);

alter table public.activity_logs enable row level security;

-- Tracked accounts may insert rows about themselves only.
create policy "tracked users insert own activity"
  on public.activity_logs for insert
  with check (
    auth.uid() = user_id
    and user_id in ('f817241e-f331-421c-b1a8-8147da346e9d'::uuid)
  );

-- Only the admin account can read the log.
create policy "admin reads activity"
  on public.activity_logs for select
  using (auth.uid() = '7e1ff11d-6600-4a4d-8d28-8b64daf95a09'::uuid);

-- Only the admin account can clear the log.
create policy "admin deletes activity"
  on public.activity_logs for delete
  using (auth.uid() = '7e1ff11d-6600-4a4d-8d28-8b64daf95a09'::uuid);

-- No update policy on purpose — the log is append-only.
