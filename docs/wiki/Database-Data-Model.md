# Database Data Model

Last updated: 2026-05-17

BookHero uses Supabase PostgreSQL with row-level security. The frontend reads and writes through `supabase-js`; aggregate views are exposed through Postgres RPC functions.

## Core Tables

| Table | Purpose |
| --- | --- |
| `books` | User-owned book metadata. |
| `reading_progress` | Current page, update timestamp, and active session start. |
| `progress_history` | Historical page saves, session start, and session notes. |
| `recaps` | AI recap text, snapshots, generation mode, and image status/path. |
| `book_passports` | Completed-book journey summary and stats. |
| `lexicon_entries` | Vocabulary and lore terms collected per book. |
| `up_next_order` | User-defined ordering for current/up-next books. |
| `lore_cards` | Generated lore cards unlocked at reading milestones. |
| `page_captures` | Reviewed OCR text snippets by book/page. |
| `reading_dna` | Generated reader identity profile. |
| `vocabulary_extractions` | Ledger for capture-based vocabulary extraction. |
| `reading_goals` | Yearly reading goal settings. |
| `reading_quest_events` | Quest event ledger for page captures and XP accounting. |
| `anki_review_sessions` | Review session stats referenced by the app. Creation migration is not currently visible in the inspected migrations. |

## Relationship Overview

```mermaid
erDiagram
  users ||--o{ books : owns
  users ||--o{ reading_progress : owns
  users ||--o{ progress_history : owns
  users ||--o{ recaps : owns
  users ||--o{ book_passports : owns
  users ||--o{ lexicon_entries : owns
  users ||--o{ lore_cards : owns
  users ||--o{ page_captures : owns
  users ||--o{ reading_goals : owns

  books ||--o{ reading_progress : has
  books ||--o{ progress_history : records
  books ||--o{ recaps : has
  books ||--o{ book_passports : has
  books ||--o{ lexicon_entries : contains
  books ||--o{ lore_cards : unlocks
  books ||--o{ page_captures : captures
```

`users` refers to Supabase Auth users.

## Important Columns

| Table | Important columns |
| --- | --- |
| `books` | `id`, `user_id`, `title`, `author`, `isbn`, `cover_url`, `total_pages`, `genre`, `created_at` |
| `reading_progress` | `book_id`, `user_id`, `current_page`, `updated_at`, `session_start_at` |
| `progress_history` | `book_id`, `user_id`, `page`, `recorded_at`, `session_start_at`, `session_note` |
| `recaps` | `book_id`, `user_id`, `progress_snapshot`, `page_snapshot`, `memory_jogger`, `concept_watchlist`, `thematic_bridge`, `mode`, `image_path`, `image_status`, `image_generated_at` |
| `book_passports` | `book_id`, `user_id`, `total_days`, `peak_day`, `peak_day_pages`, `vocabulary_count`, `ai_summary`, `generated_at` |
| `page_captures` | `user_id`, `book_id`, `page`, `text`, `word_count`, `confidence`, `captured_at`, `source` |
| `lore_cards` | `user_id`, `book_id`, `title`, `content`, `type`, `linked_entities`, `unlocked_at_page`, `unlocked_at_milestone`, `seen` |
| `reading_goals` | `user_id`, `year`, `target_books`, `created_at`, `updated_at` |

## Migrations

Migrations live in `supabase/migrations`.

Notable migrations:

| Migration | Adds or changes |
| --- | --- |
| `20260417_lore_cards.sql` | `lore_cards` table, indexes, RLS policies. |
| `20260424_session_stats.sql` | Session columns on progress/history. |
| `20260426_corpus_recaps.sql` | `page_captures`, recap mode, capture RLS. |
| `20260428_reader_profile.sql` | `reading_dna`, `vocabulary_extractions`, lexicon source. |
| `20260501_reading_velocity.sql` | Reading velocity RPC. |
| `20260502_rpc_performance_improvements.sql` | Library/profile/session/breakdown/velocity RPCs and indexes. |
| `20260503_recap_image_columns.sql` | Recap image columns and storage policies. |
| `20260512_reading_quest_goal.sql` | `reading_goals`, quest summary RPC, XP sources. |
| `20260513_page_capture_completion_cleanup.sql` | Quest events, capture cleanup trigger, updated quest RPC. |
| `20260517_book_passport_stats_rpc.sql` | Book Passport stats RPC and supporting indexes. |

## Row-Level Security

Newer migrations enable RLS and owner policies on feature tables such as `lore_cards`, `page_captures`, `reading_dna`, `vocabulary_extractions`, `reading_goals`, and `reading_quest_events`.

RLS for original base tables is expected from the existing schema, but the complete authoritative base-table policy set is not currently documented in the latest migration files.

## Schema Management Notes

- The current app expects Supabase tables and RPCs to exist before frontend workflows are exercised.
- Some base schema definitions live in older `specs/` contracts rather than current migration files.
- Seed data is not currently documented in the codebase.

