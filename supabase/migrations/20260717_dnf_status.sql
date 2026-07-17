-- DNF (Did Not Finish) status
-- Additive: a reader can shelve a book they stopped reading. dnf_at non-null =
-- shelved; resuming clears it, restoring the previous percentage-derived status.
-- History (progress_history) is untouched — pages read before shelving still
-- count wherever history counts today.

alter table public.reading_progress
  add column if not exists dnf_at timestamptz;

-- ── get_library_with_progress: dnf overrides the derived status ────────────────
-- Changes vs 034 body: new 'dnfAt' key; status case checks rp.dnf_at first.
CREATE OR REPLACE FUNCTION public.get_library_with_progress(p_user_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'source',             coalesce(b.source, 'manual'),
        'pageCountEstimated', coalesce(b.page_count_estimated, false),
        'currentPage',    coalesce(rp.current_page, 0),
        'percentage',
          case
            when b.total_pages > 0
            then least(100, round((coalesce(rp.current_page, 0)::numeric / b.total_pages) * 100, 2))
            else 0
          end,
        'status',
          case
            when rp.dnf_at is not null then 'dnf'
            when coalesce(rp.current_page, 0) = 0 then 'unread'
            when rp.current_page >= b.total_pages and b.total_pages > 0 then 'finished'
            else 'reading'
          end,
        'lastReadAt',     rp.updated_at,
        'sessionStartAt', rp.session_start_at,
        'dnfAt',          rp.dnf_at,
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
$function$;
