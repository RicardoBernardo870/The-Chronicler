-- Page capture completion cleanup
-- Removes OCR capture text once a book is complete while preserving durable
-- quest XP and vocabulary extraction ledgers.

-- ---------------------------------------------------------------------------
-- 1. Durable quest events
-- ---------------------------------------------------------------------------

create table if not exists public.reading_quest_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid null references public.books(id) on delete set null,
  event_type text not null check (event_type in ('page_capture')),
  page integer null check (page is null or page >= 0),
  source_id uuid null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.reading_quest_events is
  'Durable reading quest activity events. Page capture XP is recorded here so page_captures text can be deleted after book completion without reducing lifetime XP.';

create unique index if not exists reading_quest_events_page_capture_unique_idx
on public.reading_quest_events (user_id, book_id, page)
where event_type = 'page_capture' and book_id is not null and page is not null;

create index if not exists reading_quest_events_user_type_occurred_idx
on public.reading_quest_events (user_id, event_type, occurred_at desc);

alter table public.reading_quest_events enable row level security;

drop policy if exists "Reading quest events are viewable by owner" on public.reading_quest_events;
create policy "Reading quest events are viewable by owner"
on public.reading_quest_events for select
to authenticated
using ((select auth.uid()) = user_id);

-- Existing captures have already earned quest XP. Backfill without deleting or
-- mutating captures.
insert into public.reading_quest_events (
  user_id,
  book_id,
  event_type,
  page,
  source_id,
  occurred_at
)
select
  pc.user_id,
  pc.book_id,
  'page_capture',
  pc.page,
  pc.id,
  pc.captured_at
from public.page_captures pc
on conflict (user_id, book_id, page)
where event_type = 'page_capture' and book_id is not null and page is not null
do nothing;

-- ---------------------------------------------------------------------------
-- 2. Preserve vocabulary extraction ledgers when captures are pruned
-- ---------------------------------------------------------------------------

alter table public.vocabulary_extractions
  alter column capture_id drop not null;

do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.vocabulary_extractions'::regclass
    and contype = 'f'
    and conkey = array[
      (
        select attnum
        from pg_attribute
        where attrelid = 'public.vocabulary_extractions'::regclass
          and attname = 'capture_id'
      )
    ];

  if fk_name is not null then
    execute format('alter table public.vocabulary_extractions drop constraint %I', fk_name);
  end if;
end $$;

alter table public.vocabulary_extractions
  add constraint vocabulary_extractions_capture_id_fkey
  foreign key (capture_id)
  references public.page_captures(id)
  on delete set null;

comment on column public.vocabulary_extractions.capture_id is
  'Nullable because page_captures OCR text is deleted after book completion. The extraction ledger row is preserved.';

-- ---------------------------------------------------------------------------
-- 3. Capture activity and completion cleanup helpers
-- ---------------------------------------------------------------------------

create or replace function public.record_page_capture_quest_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total_pages integer;
  current_page integer;
begin
  insert into public.reading_quest_events (
    user_id,
    book_id,
    event_type,
    page,
    source_id,
    occurred_at
  )
  values (
    new.user_id,
    new.book_id,
    'page_capture',
    new.page,
    new.id,
    new.captured_at
  )
  on conflict (user_id, book_id, page)
  where event_type = 'page_capture' and book_id is not null and page is not null
  do update set
    source_id = coalesce(reading_quest_events.source_id, excluded.source_id),
    occurred_at = least(reading_quest_events.occurred_at, excluded.occurred_at);

  select b.total_pages, rp.current_page
    into total_pages, current_page
  from public.books b
  join public.reading_progress rp
    on rp.book_id = b.id
   and rp.user_id = b.user_id
  where b.id = new.book_id
    and b.user_id = new.user_id;

  if coalesce(total_pages, 0) > 0 and coalesce(current_page, 0) >= total_pages then
    delete from public.page_captures
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$$;

drop trigger if exists page_capture_retention_after_save on public.page_captures;
drop trigger if exists page_capture_quest_event_after_save on public.page_captures;
create trigger page_capture_quest_event_after_save
after insert or update on public.page_captures
for each row execute function public.record_page_capture_quest_event();

create or replace function public.delete_page_captures_on_book_completion()
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
    delete from public.page_captures
    where user_id = new.user_id
      and book_id = new.book_id;
  end if;

  return new;
end;
$$;

drop trigger if exists page_captures_delete_on_completion on public.reading_progress;
create trigger page_captures_delete_on_completion
after insert or update of current_page on public.reading_progress
for each row execute function public.delete_page_captures_on_book_completion();

-- ---------------------------------------------------------------------------
-- 4. Reading Quest RPC reads durable capture events, not retained OCR rows
-- ---------------------------------------------------------------------------

create or replace function public.get_reading_quest_summary(
  p_user_id uuid,
  p_year integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id <> (select auth.uid()) then
    raise exception 'Not allowed';
  end if;

  return (
    with params as (
      select
        make_timestamptz(p_year, 1, 1, 0, 0, 0, 'UTC') as year_start,
        make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'UTC') as next_year
    ),
    months as (
      select case
        when now() < year_start then 1::numeric
        else greatest(
          1::numeric,
          least(
            12::numeric,
            (extract(epoch from (least(now(), next_year) - year_start)) / 2629800.0)::numeric
          )
        )
      end as elapsed
      from params
    ),
    goal_row as (
      select *
      from public.reading_goals
      where user_id = p_user_id
        and year = p_year
      limit 1
    ),
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
    ),
    base_counts as (
      select
        coalesce(sum(current_page), 0)::integer as pages_read,
        count(*) filter (where total_pages > 0 and current_page >= total_pages)::integer as completed_books_all,
        count(*) filter (
          where total_pages > 0
            and current_page >= total_pages
            and updated_at >= (select year_start from params)
            and updated_at < (select next_year from params)
        )::integer as completed_books_year
      from progress_rows
    ),
    activity_counts as (
      select
        (select count(*)::integer from public.progress_history where user_id = p_user_id) as reading_sessions,
        (
          select count(*)::integer
          from public.reading_quest_events
          where user_id = p_user_id
            and event_type = 'page_capture'
        ) as page_captures,
        (select count(*)::integer from public.recaps where user_id = p_user_id) as recaps_generated,
        (select count(*)::integer from public.lore_cards where user_id = p_user_id) as lore_cards_unlocked
    ),
    sources as (
      select
        bc.pages_read,
        bc.completed_books_all as completed_books,
        ac.reading_sessions,
        ac.page_captures,
        ac.recaps_generated,
        ac.lore_cards_unlocked
      from base_counts bc
      cross join activity_counts ac
    ),
    xp as (
      select
        pages_read
        + completed_books * 25
        + reading_sessions * 10
        + page_captures * 5
        + recaps_generated * 20
        + lore_cards_unlocked * 15 as total_xp
      from sources
    ),
    level_calc as (
      select
        total_xp,
        case
          when total_xp < 1500 then 0
          when total_xp < 4000 then 1
          when total_xp < 8000 then 2
          when total_xp < 14000 then 3
          when total_xp < 22000 then 4
          when total_xp < 34000 then 5
          else 6
        end as level,
        case
          when total_xp < 1500 then 'Page Turner'
          when total_xp < 4000 then 'Chapter Seeker'
          when total_xp < 8000 then 'Margin Walker'
          when total_xp < 14000 then 'Lore Keeper'
          when total_xp < 22000 then 'Archive Runner'
          when total_xp < 34000 then 'Chapter Sage'
          else 'Library Legend'
        end as title,
        case
          when total_xp < 1500 then 0
          when total_xp < 4000 then 1500
          when total_xp < 8000 then 4000
          when total_xp < 14000 then 8000
          when total_xp < 22000 then 14000
          when total_xp < 34000 then 22000
          else 34000
        end as current_floor,
        case
          when total_xp < 1500 then 1500
          when total_xp < 4000 then 4000
          when total_xp < 8000 then 8000
          when total_xp < 14000 then 14000
          when total_xp < 22000 then 22000
          when total_xp < 34000 then 34000
          else null
        end as next_threshold
      from xp
    ),
    quest_base as (
      select
        p_year as year,
        gr.target_books,
        bc.completed_books_year,
        m.elapsed as months_elapsed,
        case when gr.target_books is null then null else round(gr.target_books::numeric / 12, 1) end as required_books_per_month,
        case when bc.completed_books_year > 0 then round(bc.completed_books_year::numeric / m.elapsed, 1) else null end as current_books_per_month,
        case when bc.completed_books_year > 0 then round((bc.completed_books_year::numeric / m.elapsed) * 12, 1) else null end as projected_books
      from params
      cross join months m
      cross join base_counts bc
      left join goal_row gr on true
    ),
    quest as (
      select
        *,
        projected_books is not null as has_projection,
        case
          when target_books is null then 0
          else least(100, round((completed_books_year::numeric / target_books::numeric) * 100, 1))
        end as progress_percent,
        case
          when target_books is null then 'no_goal'
          when completed_books_year >= target_books then 'complete'
          when projected_books is null then 'no_projection'
          when projected_books >= target_books * 1.1 then 'ahead'
          when projected_books >= target_books then 'on_track'
          when projected_books >= target_books * 0.75 then 'behind'
          else 'comeback'
        end as status
      from quest_base
    ),
    status_labels as (
      select
        status,
        case status
          when 'no_goal' then 'Set your reading quest'
          when 'no_projection' then 'Pace warming up'
          when 'ahead' then 'Ahead of pace'
          when 'on_track' then 'On track'
          when 'behind' then 'A little behind'
          when 'comeback' then 'Comeback arc available'
          when 'complete' then 'Quest complete'
          else 'On track'
        end as status_label
      from quest
    )
    select jsonb_build_object(
      'goal', (
        select case when gr.id is null then null else jsonb_build_object(
          'id', gr.id,
          'userId', gr.user_id,
          'year', gr.year,
          'targetBooks', gr.target_books,
          'createdAt', gr.created_at,
          'updatedAt', gr.updated_at
        ) end
        from goal_row gr
      ),
      'quest', (
        select jsonb_build_object(
          'year', q.year,
          'targetBooks', q.target_books,
          'completedBooks', q.completed_books_year,
          'progressPercent', q.progress_percent,
          'requiredBooksPerMonth', q.required_books_per_month,
          'currentBooksPerMonth', q.current_books_per_month,
          'projectedBooks', q.projected_books,
          'hasProjection', q.has_projection,
          'status', q.status,
          'statusLabel', sl.status_label
        )
        from quest q
        join status_labels sl on sl.status = q.status
      ),
      'level', (
        select jsonb_build_object(
          'level', level,
          'title', title,
          'totalXp', total_xp,
          'currentLevelXp', total_xp - current_floor,
          'nextLevelXp', coalesce(next_threshold - current_floor, 0),
          'xpToNextLevel', coalesce(greatest(next_threshold - total_xp, 0), 0),
          'progressPercent', case
            when next_threshold is null then 100
            else round(((total_xp - current_floor)::numeric / (next_threshold - current_floor)::numeric) * 100, 1)
          end
        )
        from level_calc
      ),
      'sources', (
        select jsonb_build_object(
          'pagesRead', pages_read,
          'completedBooks', completed_books,
          'readingSessions', reading_sessions,
          'pageCaptures', page_captures,
          'recapsGenerated', recaps_generated,
          'loreCardsUnlocked', lore_cards_unlocked
        )
        from sources
      )
    )
  );
end;
$$;

grant execute on function public.get_reading_quest_summary(uuid, integer) to authenticated;
