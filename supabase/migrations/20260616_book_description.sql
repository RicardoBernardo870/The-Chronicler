-- =============================================================================
-- File   : 20260616_book_description.sql
-- Feature: 030 - Book Search & Add
-- Purpose: Persist an API-sourced book description on the books record and
--          surface it from the library RPC.
--
-- Notes (Supabase Postgres best practices):
--   * `description` is nullable with no default → metadata-only ADD COLUMN
--     (no table rewrite, negligible lock).
--   * No index is added — description is never filtered or ordered server-side.
--   * Existing owner RLS on public.books governs the new column; no policy change.
-- =============================================================================

alter table public.books
  add column if not exists description text;

-- Re-create get_library_with_progress to also return the description.
-- Signature, stability, security definer, and the auth.uid() ownership filter
-- are unchanged from 20260502_rpc_performance_improvements.sql; only the
-- 'description' key is added to the returned object.
create or replace function public.get_library_with_progress(p_user_id uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id',             b.id,
        'title',          b.title,
        'author',         b.author,
        'coverUrl',       b.cover_url,
        'totalPages',     b.total_pages,
        'genre',          b.genre,
        'isbn',           b.isbn,
        'description',    b.description,
        'currentPage',    coalesce(rp.current_page, 0),
        'percentage',
          case
            when b.total_pages > 0
            then least(100, round((coalesce(rp.current_page, 0)::numeric / b.total_pages) * 100, 2))
            else 0
          end,
        'status',
          case
            when coalesce(rp.current_page, 0) = 0 then 'unread'
            when rp.current_page >= b.total_pages and b.total_pages > 0 then 'finished'
            else 'reading'
          end,
        'lastReadAt',     rp.updated_at,
        'sessionStartAt', rp.session_start_at,
        'progressId',     rp.id
      )
      order by coalesce(rp.updated_at, b.created_at) desc
    ),
    '[]'::json
  )
  from public.books b
  left join public.reading_progress rp
    on rp.book_id = b.id
   and rp.user_id = p_user_id
  where b.user_id = p_user_id
$$;

grant execute on function public.get_library_with_progress(uuid) to authenticated;
