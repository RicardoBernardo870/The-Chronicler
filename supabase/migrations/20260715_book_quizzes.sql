-- =====================================================================
-- Migration: 20260715_book_quizzes.sql
-- Feature : Memory Check (pre-session recall quiz)
-- Purpose : Store one AI-generated quiz per (user, book): up to 3
--           multiple-choice questions (3 options each) grounded ONLY in
--           the reader's own page captures (+ latest recap for name
--           continuity). The quiz is cached until the reader reads past
--           its page_snapshot, so generation is at most one AI call per
--           reading position. Purged on book completion, same as
--           page_captures (the material it was derived from).
-- =====================================================================

create table if not exists public.book_quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_snapshot integer not null check (page_snapshot >= 0),
  questions jsonb not null,
  score integer null check (score is null or (score >= 0 and score <= 3)),
  answered_at timestamptz null,
  generated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

comment on table public.book_quizzes is
  'Memory Check quizzes. One row per (user, book): questions is an array of { question, options (exactly 3), correctIndex (0-2), sourcePage }. Grounded only in the reader''s page captures — regenerated (upserted) once the reader moves past page_snapshot.';
comment on column public.book_quizzes.page_snapshot is
  'reading_progress.current_page at generation time. A quiz is reusable while page_snapshot >= current_page.';
comment on column public.book_quizzes.score is
  'Correct answers on the most recent take (0-3). Null until answered.';

create index if not exists book_quizzes_book_id_idx
  on public.book_quizzes (book_id);

alter table public.book_quizzes enable row level security;

drop policy if exists "Book quizzes are viewable by owner" on public.book_quizzes;
create policy "Book quizzes are viewable by owner"
on public.book_quizzes for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Book quizzes are insertable by owner" on public.book_quizzes;
create policy "Book quizzes are insertable by owner"
on public.book_quizzes for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Book quizzes are updatable by owner" on public.book_quizzes;
create policy "Book quizzes are updatable by owner"
on public.book_quizzes for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Book quizzes are deletable by owner" on public.book_quizzes;
create policy "Book quizzes are deletable by owner"
on public.book_quizzes for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Completion cleanup: quizzes are derived from page captures, which are
-- deleted when a book completes (20260513). Purge quizzes on the same
-- signal so no stale quiz outlives its source material.
-- ---------------------------------------------------------------------

create or replace function public.delete_book_quizzes_on_book_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_pages integer;
begin
  select b.total_pages into total_pages
  from public.books b
  where b.id = new.book_id
    and b.user_id = new.user_id;

  if coalesce(total_pages, 0) > 0 and new.current_page >= total_pages then
    delete from public.book_quizzes
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$$;

drop trigger if exists book_quizzes_delete_on_completion on public.reading_progress;
create trigger book_quizzes_delete_on_completion
after insert or update of current_page on public.reading_progress
for each row execute function public.delete_book_quizzes_on_book_completion();

-- =====================================================================
-- End of migration
-- =====================================================================
