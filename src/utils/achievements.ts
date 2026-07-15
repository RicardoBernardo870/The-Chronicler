import type { ReaderXpSources, ReadingRecords } from '@/types'

/**
 * Achievement catalog. Definitions and unlock conditions live here; the
 * `achievements` table only persists WHEN a key was first earned, so a
 * trophy never regresses (deleting a book doesn't un-earn "First victory").
 *
 * Conditions draw exclusively from data the Trophy Room already loads:
 * quest XP sources (get_reading_quest_summary), lifetime stats
 * (get_reading_stats), and personal records (get_reading_records) — no
 * extra queries per achievement.
 */

export interface AchievementContext {
  sources: ReaderXpSources | null
  longestStreakDays: number
  records: ReadingRecords | null
}

export interface AchievementDef {
  key: string
  title: string
  description: string
  icon: string
  isEarned: (ctx: AchievementContext) => boolean
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Books ──────────────────────────────────────────────────────────
  {
    key: 'first_book',
    title: 'First victory',
    description: 'Finish your first book',
    icon: 'pi-flag',
    isEarned: (ctx) => (ctx.sources?.completedBooks ?? 0) >= 1,
  },
  {
    key: 'books_5',
    title: 'Shelf conqueror',
    description: 'Finish 5 books',
    icon: 'pi-book',
    isEarned: (ctx) => (ctx.sources?.completedBooks ?? 0) >= 5,
  },
  {
    key: 'books_10',
    title: 'Two-digit shelf',
    description: 'Finish 10 books',
    icon: 'pi-crown',
    isEarned: (ctx) => (ctx.sources?.completedBooks ?? 0) >= 10,
  },
  // ── Pages ──────────────────────────────────────────────────────────
  {
    key: 'pages_1k',
    title: 'Thousand-pager',
    description: 'Read 1,000 pages',
    icon: 'pi-file',
    isEarned: (ctx) => (ctx.sources?.pagesRead ?? 0) >= 1_000,
  },
  {
    key: 'pages_10k',
    title: 'Ten-thousand club',
    description: 'Read 10,000 pages',
    icon: 'pi-database',
    isEarned: (ctx) => (ctx.sources?.pagesRead ?? 0) >= 10_000,
  },
  // ── Sessions ───────────────────────────────────────────────────────
  {
    key: 'sessions_50',
    title: 'Regular',
    description: 'Log 50 reading sessions',
    icon: 'pi-calendar',
    isEarned: (ctx) => (ctx.sources?.readingSessions ?? 0) >= 50,
  },
  {
    key: 'sessions_100',
    title: 'Devoted',
    description: 'Log 100 reading sessions',
    icon: 'pi-calendar-plus',
    isEarned: (ctx) => (ctx.sources?.readingSessions ?? 0) >= 100,
  },
  // ── Chronicler tools ───────────────────────────────────────────────
  {
    key: 'capture_first',
    title: 'Chronicler',
    description: 'Save your first page capture',
    icon: 'pi-camera',
    isEarned: (ctx) => (ctx.sources?.pageCaptures ?? 0) >= 1,
  },
  {
    key: 'captures_50',
    title: 'Archivist',
    description: 'Save 50 page captures',
    icon: 'pi-images',
    isEarned: (ctx) => (ctx.sources?.pageCaptures ?? 0) >= 50,
  },
  {
    key: 'recap_first',
    title: 'Storyteller',
    description: 'Generate your first recap',
    icon: 'pi-sparkles',
    isEarned: (ctx) => (ctx.sources?.recapsGenerated ?? 0) >= 1,
  },
  {
    key: 'insight_first',
    title: 'Lorekeeper',
    description: 'Unlock your first Insight',
    icon: 'pi-eye',
    isEarned: (ctx) => (ctx.sources?.loreCardsUnlocked ?? 0) >= 1,
  },
  // ── Streaks ────────────────────────────────────────────────────────
  {
    key: 'streak_7',
    title: 'Week of pages',
    description: 'Read 7 days in a row',
    icon: 'pi-bolt',
    isEarned: (ctx) => ctx.longestStreakDays >= 7,
  },
  {
    key: 'streak_30',
    title: 'Habit forged',
    description: 'Read 30 days in a row',
    icon: 'pi-verified',
    isEarned: (ctx) => ctx.longestStreakDays >= 30,
  },
  // ── Records ────────────────────────────────────────────────────────
  {
    key: 'century_day',
    title: 'Century day',
    description: 'Read 100+ pages in one day',
    icon: 'pi-gauge',
    isEarned: (ctx) => (ctx.records?.bestDay?.pages ?? 0) >= 100,
  },
  {
    key: 'deep_dive',
    title: 'Deep dive',
    description: 'A single 2-hour reading session',
    icon: 'pi-clock',
    isEarned: (ctx) => (ctx.records?.longestSession?.minutes ?? 0) >= 120,
  },
  {
    key: 'devoured',
    title: 'Devoured',
    description: 'Finish a book within 3 days',
    icon: 'pi-forward',
    isEarned: (ctx) => (ctx.records?.fastestFinish?.days ?? Infinity) <= 3,
  },
  {
    key: 'night_owl',
    title: 'Night owl',
    description: 'End a session in the small hours',
    icon: 'pi-moon',
    isEarned: (ctx) => ctx.records?.nightOwl === true,
  },
]
