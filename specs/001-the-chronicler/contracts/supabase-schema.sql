-- ============================================================
-- The Chronicler — Supabase Database Schema
-- ============================================================
-- Apply via Supabase Dashboard > SQL Editor or supabase migrations

-- ------------------------------------------------------------
-- 1. BOOKS
-- ------------------------------------------------------------
create table if not exists books (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  title       text        not null check (char_length(title) between 1 and 500),
  author      text        not null check (char_length(author) between 1 and 200),
  isbn        text        check (isbn ~ '^\d{10}$|^\d{13}$'),
  cover_url   text,
  total_pages integer     not null check (total_pages >= 1),
  genre       text,
  created_at  timestamptz not null default now()
);

create index if not exists books_user_id_idx on books (user_id);

alter table books enable row level security;

create policy "Users can manage their own books"
  on books for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. READING PROGRESS
-- ------------------------------------------------------------
create table if not exists reading_progress (
  id           uuid        primary key default gen_random_uuid(),
  book_id      uuid        not null references books (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  current_page integer     not null default 0,
  updated_at   timestamptz not null default now(),
  unique (book_id, user_id)
);

-- current_page range is validated at the application layer.
-- A DB trigger keeps updated_at current:
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reading_progress_updated_at
  before update on reading_progress
  for each row execute function set_updated_at();

create index if not exists reading_progress_user_id_idx on reading_progress (user_id);

alter table reading_progress enable row level security;

create policy "Users can manage their own progress"
  on reading_progress for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. RECAPS
-- ------------------------------------------------------------
create table if not exists recaps (
  id                uuid           primary key default gen_random_uuid(),
  book_id           uuid           not null references books (id) on delete cascade,
  user_id           uuid           not null references auth.users (id) on delete cascade,
  progress_snapshot numeric(5, 2)  not null,
  memory_jogger     text           not null check (char_length(memory_jogger) > 0),
  concept_watchlist text           not null check (char_length(concept_watchlist) > 0),
  thematic_bridge   text           not null check (char_length(thematic_bridge) > 0),
  created_at        timestamptz    not null default now()
);

create index if not exists recaps_book_user_idx
  on recaps (book_id, user_id, created_at desc);

alter table recaps enable row level security;

create policy "Users can manage their own recaps"
  on recaps for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
