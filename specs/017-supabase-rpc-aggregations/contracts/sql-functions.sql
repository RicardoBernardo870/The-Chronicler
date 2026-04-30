-- ============================================================
-- BookHero — RPC Aggregate Functions
-- Feature: 017-supabase-rpc-aggregations
-- Run in Supabase SQL editor (or as a migration)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. get_library_with_progress
--    Returns all books for a user joined with their latest
--    reading progress. Single call replaces separate books +
--    progress fetches and the client-side join.
--    Includes sessionStartAt so progressStore can track
--    active sessions without a second network call.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_library_with_progress(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id',             b.id,
        'title',          b.title,
        'author',         b.author,
        'coverUrl',       b.cover_url,
        'totalPages',     b.total_pages,
        'currentPage',    COALESCE(rp.current_page, 0),
        'percentage',
          CASE
            WHEN b.total_pages > 0
            THEN LEAST(100, ROUND((COALESCE(rp.current_page, 0)::numeric / b.total_pages) * 100, 2))
            ELSE 0
          END,
        'status',
          CASE
            WHEN COALESCE(rp.current_page, 0) = 0           THEN 'unread'
            WHEN rp.current_page >= b.total_pages
              AND b.total_pages > 0                          THEN 'finished'
            ELSE                                                  'reading'
          END,
        'lastReadAt',     rp.updated_at,
        'sessionStartAt', rp.session_start_at,
        'progressId',     rp.id
      )
      ORDER BY COALESCE(rp.updated_at, b.created_at) DESC
    ),
    '[]'::json
  )
  FROM books b
  LEFT JOIN reading_progress rp
    ON rp.book_id = b.id
   AND rp.user_id = p_user_id
  WHERE b.user_id = p_user_id
$$;


-- ────────────────────────────────────────────────────────────
-- 2. get_reading_stats
--    Aggregated lifetime reading statistics for one user.
--    Replaces useReadingProfile composable JS aggregation.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_reading_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
  -- Compute per-row page deltas using LAG partitioned by book.
  -- This prevents cross-book contamination when rows from
  -- different books are adjacent in the ordered history.
  deltas AS (
    SELECT
      book_id,
      recorded_at,
      session_start_at,
      GREATEST(
        0,
        page - LAG(page, 1, 0) OVER (PARTITION BY book_id ORDER BY recorded_at)
      ) AS page_delta,
      EXTRACT(EPOCH FROM (recorded_at - session_start_at)) AS dur_sec
    FROM progress_history
    WHERE user_id = p_user_id
  ),

  -- Valid sessions: have session_start_at, ≥60 s, ≥1 page
  valid_sessions AS (
    SELECT page_delta, dur_sec
    FROM deltas
    WHERE session_start_at IS NOT NULL
      AND dur_sec >= 60
      AND page_delta >= 1
  ),

  -- Reading day buckets (UTC date strings) for streak math
  reading_days AS (
    SELECT DISTINCT DATE(recorded_at) AS day
    FROM progress_history
    WHERE user_id = p_user_id
  ),

  -- Current streak: count consecutive days ending today or yesterday
  streak_base AS (
    SELECT
      day,
      day - LAG(day) OVER (ORDER BY day) - 1 AS gap_before
    FROM reading_days
  ),

  -- Mark where streaks break and number each streak group
  streak_groups AS (
    SELECT
      day,
      SUM(CASE WHEN gap_before > 0 OR gap_before IS NULL THEN 1 ELSE 0 END)
        OVER (ORDER BY day) AS grp
    FROM streak_base
  ),

  streak_lengths AS (
    SELECT grp, COUNT(*) AS len, MAX(day) AS last_day
    FROM streak_groups
    GROUP BY grp
  )

  -- Completed books: current_page >= total_pages
  completed_books AS (
    SELECT b.total_pages
    FROM books b
    JOIN reading_progress rp
      ON rp.book_id = b.id AND rp.user_id = p_user_id
    WHERE b.user_id = p_user_id
      AND b.total_pages > 0
      AND rp.current_page >= b.total_pages
  )

  SELECT json_build_object(
    'pagesThisWeek',
      COALESCE((
        SELECT SUM(page_delta) FROM deltas
        WHERE recorded_at >= NOW() - INTERVAL '7 days'
      ), 0),

    'pagesThisMonth',
      COALESCE((
        SELECT SUM(page_delta) FROM deltas
        WHERE recorded_at >= NOW() - INTERVAL '30 days'
      ), 0),

    'totalPagesRead',
      COALESCE((SELECT SUM(total_pages) FROM completed_books), 0),

    'totalReadingHours',
      COALESCE((
        SELECT ROUND(SUM(dur_sec) / 3600.0)
        FROM valid_sessions
      ), 0),

    'sessionsThisMonth',
      COALESCE((
        SELECT COUNT(*) FROM progress_history
        WHERE user_id = p_user_id
          AND recorded_at >= NOW() - INTERVAL '30 days'
      ), 0),

    'currentStreakDays',
      COALESCE((
        SELECT len FROM streak_lengths
        WHERE last_day >= CURRENT_DATE - 1
        ORDER BY last_day DESC
        LIMIT 1
      ), 0),

    'longestStreakDays',
      COALESCE((SELECT MAX(len) FROM streak_lengths), 0),

    'allTimeVelocityPph',
      COALESCE((
        SELECT ROUND(SUM(page_delta) / (SUM(dur_sec) / 3600.0))
        FROM valid_sessions
        HAVING SUM(dur_sec) > 0 AND SUM(page_delta) > 0
      ), 0)
  )
$$;


-- ────────────────────────────────────────────────────────────
-- 3. get_last_session
--    Most recent progress_history row with pre-computed
--    delta, duration, velocity, and finish prediction.
--    Replaces useLastSession composable entirely.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_last_session(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
  -- All history rows with per-book LAG delta
  all_deltas AS (
    SELECT
      ph.id,
      ph.book_id,
      ph.page,
      ph.recorded_at,
      ph.session_start_at,
      ph.session_note,
      GREATEST(
        0,
        ph.page - LAG(ph.page, 1, 0) OVER (PARTITION BY ph.book_id ORDER BY ph.recorded_at)
      ) AS page_delta,
      LAG(ph.page, 1, 0) OVER (PARTITION BY ph.book_id ORDER BY ph.recorded_at) AS prior_page,
      EXTRACT(EPOCH FROM (ph.recorded_at - ph.session_start_at)) AS dur_sec
    FROM progress_history ph
    WHERE ph.user_id = p_user_id
  ),

  -- The single most recent row across all books
  last_row AS (
    SELECT * FROM all_deltas
    ORDER BY recorded_at DESC
    LIMIT 1
  ),

  -- Valid sessions for rolling 3-session velocity (global, all books)
  valid_sessions AS (
    SELECT page_delta, dur_sec
    FROM all_deltas
    WHERE session_start_at IS NOT NULL
      AND dur_sec >= 60
      AND page_delta >= 1
    ORDER BY recorded_at DESC
    LIMIT 3
  ),

  rolling_velocity AS (
    SELECT
      CASE
        WHEN COUNT(*) > 0 AND SUM(dur_sec) > 0
        THEN SUM(page_delta) / (SUM(dur_sec) / 3600.0)
        ELSE NULL
      END AS velocity
    FROM valid_sessions
  )

  SELECT
    CASE
      WHEN (SELECT id FROM last_row) IS NULL THEN NULL
      ELSE json_build_object(
        'bookId',          lr.book_id,
        'bookTitle',       COALESCE(b.title, 'Unknown Book'),
        'endedAt',         lr.recorded_at,
        'startedAt',       lr.session_start_at,
        'pagesDelta',      lr.page_delta,
        'startPage',       lr.prior_page,
        'endPage',         lr.page,
        'durationSeconds',
          CASE WHEN lr.session_start_at IS NOT NULL THEN ROUND(lr.dur_sec) ELSE NULL END,
        'velocityPph',
          CASE
            WHEN lr.session_start_at IS NOT NULL AND lr.dur_sec >= 60 AND lr.page_delta >= 1
            THEN ROUND(lr.page_delta / (lr.dur_sec / 3600.0))
            ELSE NULL
          END,
        'completionDelta',
          CASE
            WHEN b.total_pages > 0
            THEN ROUND((lr.page_delta::numeric / b.total_pages) * 1000) / 10
            ELSE NULL
          END,
        'finishPredictionSessions',
          CASE
            WHEN b.total_pages > 0
              AND lr.page_delta >= 1
              AND (b.total_pages - lr.page) > 0
              AND rv.velocity IS NOT NULL
              AND rv.velocity > 0
            THEN CEIL(
              (b.total_pages - lr.page)::numeric
              / GREATEST(1, rv.velocity * (COALESCE(lr.dur_sec, 0) / 3600.0))
            )
            WHEN b.total_pages > 0 AND lr.page >= b.total_pages THEN 0
            ELSE NULL
          END,
        'sessionNote',     lr.session_note
      )
    END
  FROM last_row lr
  JOIN books b ON b.id = lr.book_id
  CROSS JOIN rolling_velocity rv
$$;


-- ────────────────────────────────────────────────────────────
-- 4. get_library_breakdown
--    Genre distribution, author count, status counts, and
--    average completion for the Library Breakdown card.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_library_breakdown(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
  books_with_status AS (
    SELECT
      b.id,
      b.author,
      NULLIF(TRIM(b.genre), '') AS genre,
      b.total_pages,
      COALESCE(rp.current_page, 0) AS current_page,
      CASE
        WHEN COALESCE(rp.current_page, 0) = 0           THEN 'unread'
        WHEN rp.current_page >= b.total_pages
          AND b.total_pages > 0                          THEN 'finished'
        ELSE                                                  'reading'
      END AS status,
      CASE
        WHEN b.total_pages > 0
        THEN LEAST(100, ROUND((COALESCE(rp.current_page, 0)::numeric / b.total_pages) * 100, 1))
        ELSE 0
      END AS completion_pct
    FROM books b
    LEFT JOIN reading_progress rp
      ON rp.book_id = b.id AND rp.user_id = p_user_id
    WHERE b.user_id = p_user_id
  ),

  total_count AS (SELECT COUNT(*) AS n FROM books_with_status),

  genre_counts AS (
    SELECT
      COALESCE(genre, 'Uncategorized') AS genre,
      COUNT(*) AS cnt
    FROM books_with_status
    GROUP BY COALESCE(genre, 'Uncategorized')
  )

  SELECT json_build_object(
    'genreDistribution',
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'genre',      gc.genre,
            'count',      gc.cnt,
            'percentage', ROUND(gc.cnt::numeric / NULLIF(tc.n, 0) * 100, 1)
          )
          ORDER BY gc.cnt DESC
        )
        FROM genre_counts gc, total_count tc
      ), '[]'::json),

    'authorsCount',
      (SELECT COUNT(DISTINCT LOWER(TRIM(author))) FROM books_with_status WHERE author IS NOT NULL),

    'booksFinished',
      (SELECT COUNT(*) FROM books_with_status WHERE status = 'finished'),

    'booksInProgress',
      (SELECT COUNT(*) FROM books_with_status WHERE status = 'reading'),

    'booksUnstarted',
      (SELECT COUNT(*) FROM books_with_status WHERE status = 'unread'),

    'avgCompletionPct',
      COALESCE((
        SELECT ROUND(AVG(completion_pct), 1)
        FROM books_with_status
        WHERE status != 'unread'
      ), 0)
  )
$$;
