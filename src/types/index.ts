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
  pageSnapshot: number | null
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
  page_snapshot: number | null
  memory_jogger: string
  concept_watchlist: string
  thematic_bridge: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Mappers (DB row → domain type)
// ─────────────────────────────────────────────────────────────

export const mapBook = (row: BookRow): Book => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  author: row.author,
  isbn: row.isbn,
  coverUrl: row.cover_url,
  totalPages: row.total_pages,
  genre: row.genre,
  createdAt: row.created_at,
})

export const mapReadingProgress = (row: ReadingProgressRow, totalPages: number): ReadingProgress => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  currentPage: row.current_page,
  percentage: totalPages > 0 ? Math.round((row.current_page / totalPages) * 10000) / 100 : 0,
  updatedAt: row.updated_at,
})

export const mapRecap = (row: RecapRow): Recap => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  progressSnapshot: row.progress_snapshot,
  pageSnapshot: row.page_snapshot ?? null,
  memoryJogger: row.memory_jogger,
  conceptWatchlist: row.concept_watchlist,
  thematicBridge: row.thematic_bridge,
  createdAt: row.created_at,
})

// ─────────────────────────────────────────────────────────────
// Lexicon (T008)
// ─────────────────────────────────────────────────────────────

export type LexiconEntryType = 'dictionary' | 'lore'

export interface LexiconEntry {
  id: string
  userId: string
  bookId: string
  term: string
  definition: string
  entryType: LexiconEntryType
  contextSentence: string | null
  pageFound: number | null
  leitnerBox: number
  nextReviewAt: string
  createdAt: string
}

export interface LexiconEntryRow {
  id: string
  user_id: string
  book_id: string
  term: string
  definition: string
  entry_type: LexiconEntryType
  context_sentence: string | null
  page_found: number | null
  leitner_box: number
  next_review_at: string
  created_at: string
}

export const mapLexiconEntry = (row: LexiconEntryRow): LexiconEntry => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  term: row.term,
  definition: row.definition,
  entryType: row.entry_type,
  contextSentence: row.context_sentence,
  pageFound: row.page_found,
  leitnerBox: row.leitner_box,
  nextReviewAt: row.next_review_at,
  createdAt: row.created_at,
})

// ─────────────────────────────────────────────────────────────
// Progress History, Up Next Order, Recap Fragment, Book Passport (T009)
// ─────────────────────────────────────────────────────────────

export interface ProgressHistory {
  id: string
  bookId: string
  userId: string
  page: number
  recordedAt: string
}

export interface ProgressHistoryRow {
  id: string
  book_id: string
  user_id: string
  page: number
  recorded_at: string
}

export const mapProgressHistory = (row: ProgressHistoryRow): ProgressHistory => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  page: row.page,
  recordedAt: row.recorded_at,
})

export interface UpNextOrder {
  id: string
  userId: string
  bookId: string
  sortPosition: number
  updatedAt: string
}

export interface UpNextOrderRow {
  id: string
  user_id: string
  book_id: string
  sort_position: number
  updated_at: string
}

export const mapUpNextOrder = (row: UpNextOrderRow): UpNextOrder => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  sortPosition: row.sort_position,
  updatedAt: row.updated_at,
})

export interface RecapFragment {
  id: string
  bookId: string
  userId: string
  pageAtExtraction: number
  percentageAtExtraction: number
  extractedJson: Record<string, unknown>
  createdAt: string
}

export interface RecapFragmentRow {
  id: string
  book_id: string
  user_id: string
  page_at_extraction: number
  percentage_at_extraction: number
  extracted_json: Record<string, unknown>
  created_at: string
}

export const mapRecapFragment = (row: RecapFragmentRow): RecapFragment => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  pageAtExtraction: row.page_at_extraction,
  percentageAtExtraction: Number(row.percentage_at_extraction),
  extractedJson: row.extracted_json,
  createdAt: row.created_at,
})

export interface BookPassport {
  id: string
  bookId: string
  userId: string
  totalDays: number | null
  peakDay: string | null
  peakDayPages: number | null
  vocabularyCount: number
  aiSummary: string | null
  generatedAt: string
}

export interface BookPassportRow {
  id: string
  book_id: string
  user_id: string
  total_days: number | null
  peak_day: string | null
  peak_day_pages: number | null
  vocabulary_count: number
  ai_summary: string | null
  generated_at: string
}

export const mapBookPassport = (row: BookPassportRow): BookPassport => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  totalDays: row.total_days,
  peakDay: row.peak_day,
  peakDayPages: row.peak_day_pages,
  vocabularyCount: row.vocabulary_count,
  aiSummary: row.ai_summary,
  generatedAt: row.generated_at,
})
