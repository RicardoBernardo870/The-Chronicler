-- Pause/resume for reading sessions. Pausing stamps session_paused_at;
-- resuming shifts session_start_at forward by the paused span and clears it,
-- so every duration computation (recorded_at - session_start_at) stays
-- correct with no RPC changes.
alter table public.reading_progress
  add column if not exists session_paused_at timestamptz null;
