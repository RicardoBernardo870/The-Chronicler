// ─────────────────────────────────────────────────────────────
// Core domain types — The Chronicler
// ─────────────────────────────────────────────────────────────

export interface Book {
  id: string
  userId: string
  title: string
  author: string
  isbn: string | null
  coverUrl: string | null
  totalPages: number
  genre: string | null
  createdAt: string
}

export interface ReadingProgress {
  id: string
  bookId: string
  userId: string
  currentPage: number
  percentage: number // computed: (currentPage / book.totalPages) * 100
  updatedAt: string
}

export interface Recap {
  id: string
  bookId: string
  userId: string
  progressSnapshot: number
  memoryJogger: string
  conceptWatchlist: string
  thematicBridge: string
  createdAt: string
}

export interface BookMetadata {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
}

// ─────────────────────────────────────────────────────────────
// Recap generation
// ─────────────────────────────────────────────────────────────

export type RecapGenerationStatus = 'idle' | 'streaming' | 'complete' | 'error'

export interface StreamingRecap {
  memoryJogger: string
  conceptWatchlist: string
  thematicBridge: string
}

// ─────────────────────────────────────────────────────────────
// Offline queue
// ─────────────────────────────────────────────────────────────

export interface OfflineProgressMutation {
  id?: number
  type: 'progress_update'
  payload: {
    bookId: string
    currentPage: number
    updatedAt: string
  }
  retries: number
}

// ─────────────────────────────────────────────────────────────
// Supabase row shapes (snake_case, as returned from DB)
// ─────────────────────────────────────────────────────────────

export interface BookRow {
  id: string
  user_id: string
  title: string
  author: string
  isbn: string | null
  cover_url: string | null
  total_pages: number
  genre: string | null
  created_at: string
}

export interface ReadingProgressRow {
  id: string
  book_id: string
  user_id: string
  current_page: number
  updated_at: string
}

export interface RecapRow {
  id: string
  book_id: string
  user_id: string
  progress_snapshot: number
  memory_jogger: string
  concept_watchlist: string
  thematic_bridge: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Mappers (DB row → domain type)
// ─────────────────────────────────────────────────────────────

export function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    coverUrl: row.cover_url,
    totalPages: row.total_pages,
    genre: row.genre,
    createdAt: row.created_at,
  }
}

export function mapReadingProgress(row: ReadingProgressRow, totalPages: number): ReadingProgress {
  return {
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    currentPage: row.current_page,
    percentage: totalPages > 0 ? Math.round((row.current_page / totalPages) * 10000) / 100 : 0,
    updatedAt: row.updated_at,
  }
}

export function mapRecap(row: RecapRow): Recap {
  return {
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    progressSnapshot: row.progress_snapshot,
    memoryJogger: row.memory_jogger,
    conceptWatchlist: row.concept_watchlist,
    thematicBridge: row.thematic_bridge,
    createdAt: row.created_at,
  }
}
