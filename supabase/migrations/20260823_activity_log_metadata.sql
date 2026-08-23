-- Activity logs — metadata bag.
-- A catch-all jsonb column so events can carry structured detail (route name,
-- counts, scores, mode, book_title, …) without a migration per event type.
-- First use: route_view rows store { name } — the matched route name — so the
-- log reads "Viewed book-detail" instead of a raw UUID path.
-- Covered by the existing insert policy (tracked accounts insert own rows);
-- no policy change needed.

alter table public.activity_logs
  add column if not exists metadata jsonb;
