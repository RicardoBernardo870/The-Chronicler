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
  description: string | null
  createdAt: string
  source: string                 // 034 — 'manual' | 'goodreads' | 'storygraph'; imported = source !== 'manual'
  pageCountEstimated: boolean     // 034 — true = flagged placeholder page count the reader can fix
}

export interface ReadingProgress {
  id: string
  bookId: string
  userId: string
  currentPage: number
  percentage: number // computed: (currentPage / book.totalPages) * 100
  updatedAt: string
  sessionStartAt: string | null  // 013 — non-null = active session in progress
}

export type RecapMode = 'corpus' | 'inferred'

export type RecapImageStatus =
  | 'pending'
  | 'succeeded'
  | 'failed_safety'
  | 'failed_transient'
  | 'skipped'

export interface Recap {
  id: string
  bookId: string
  userId: string
  progressSnapshot: number
  pageSnapshot: number | null
  memoryJogger: string
  conceptWatchlist: string
  thematicBridge: string
  mode: RecapMode               // 015 — which generation path produced this row
  createdAt: string
  imagePath: string | null
  imageStatus: RecapImageStatus
  imageGeneratedAt: string | null
}

export interface BookMetadata {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
  description: string | null
}

export type InitialBookStatus = 'queued' | 'currentlyReading' | 'completed'

export interface AddBookInput extends Omit<Book, 'id' | 'userId' | 'createdAt' | 'source' | 'pageCountEstimated'> {
  initialStatus: InitialBookStatus
  currentPage: number | null
}

// ─────────────────────────────────────────────────────────────
// Library Import (034) — Goodreads & StoryGraph CSV
// ─────────────────────────────────────────────────────────────

export type ImportSource = 'goodreads' | 'storygraph'

export type ImportPhase = 'idle' | 'parsing' | 'importing' | 'enriching' | 'done' | 'error'

/** A single usable CSV row mapped to BookHero shape (transient — never persisted as-is). */
export interface ImportRow {
  title: string
  author: string
  isbn: string | null
  totalPages: number | null            // null → placeholder + page_count_estimated on insert
  initialStatus: 'completed' | 'queued'
  source: ImportSource
  dedupeKey: string                    // ISBN digits if present, else `lower(title) lower(author)`
}

export interface ImportFailure {
  row: number
  title: string | null
  reason: string
}

/** Result of an import run, shown to the reader. */
export interface ImportSummary {
  imported: number
  skippedDuplicate: number
  failed: ImportFailure[]
  total: number
  estimatedPageCounts: number          // imported books left with a placeholder page count
}

export type DashboardFirstRunStateKind =
  | 'empty'
  | 'oneQueued'
  | 'oneInProgress'
  | 'completedOnly'
  | 'standard'

export interface DashboardFirstRunState {
  kind: DashboardFirstRunStateKind
  hasBooks: boolean
  activeBookCount: number
  queuedBookCount: number
  completedBookCount: number
  singleQueuedBook: Book | null
  recentCompletedBooks: Book[]
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
  description: string | null
  created_at: string
  source?: string | null                  // 034
  page_count_estimated?: boolean | null    // 034
}

// ─────────────────────────────────────────────────────────────
// RPC Aggregate Response Types (017-supabase-rpc-aggregations)
// ─────────────────────────────────────────────────────────────

export type BookStatus = 'unread' | 'reading' | 'finished'

/** Returned as an array by get_library_with_progress RPC. */
export interface LibraryBookEntry {
  id: string             // book id
  title: string
  author: string
  coverUrl: string | null
  totalPages: number
  currentPage: number
  percentage: number     // 0–100
  status: BookStatus
  lastReadAt: string | null      // ISO timestamp; null if never started
  sessionStartAt: string | null  // non-null = active session in progress
  progressId: string | null      // reading_progress.id; null if no progress row
  genre: string | null           // 019 — pulled from books.genre via RPC
  isbn: string | null            // 019 — pulled from books.isbn via RPC (needed for edit pre-fill)
  description: string | null     // 030 — pulled from books.description via RPC
  source: string                 // 034 — provenance; imported = source !== 'manual'
  pageCountEstimated: boolean     // 034 — flagged placeholder page count
}

/** Returned by get_reading_stats RPC. All numeric fields default to 0. */
export interface ReadingStats {
  pagesThisWeek: number
  pagesThisMonth: number
  totalPagesRead: number
  totalReadingHours: number
  sessionsThisMonth: number
  currentStreakDays: number
  longestStreakDays: number
  allTimeVelocityPph: number
}

/** Returned by get_last_session RPC. null when user has no history. */
export interface LastSessionSummary {
  bookId: string
  bookTitle: string
  endedAt: string
  startedAt: string | null
  pagesDelta: number
  startPage: number
  endPage: number
  durationSeconds: number | null
  velocityPph: number | null
  completionDelta: number | null
  finishPredictionSessions: number | null
  sessionNote: string | null
}

export interface GenreDistributionItem {
  genre: string
  count: number
  percentage: number
}

/** Returned by get_library_breakdown RPC. */
export interface LibraryBreakdown {
  genreDistribution: GenreDistributionItem[]
  authorsCount: number
  booksFinished: number
  booksInProgress: number
  booksUnstarted: number
  avgCompletionPct: number
}

export type ReadingQuestStatus =
  | 'no_goal'
  | 'no_projection'
  | 'ahead'
  | 'on_track'
  | 'behind'
  | 'comeback'
  | 'complete'

export interface ReadingGoal {
  id: string
  userId: string
  year: number
  targetBooks: number
  createdAt: string
  updatedAt: string
}

export interface ReadingQuestSummary {
  year: number
  targetBooks: number | null
  completedBooks: number
  progressPercent: number
  requiredBooksPerMonth: number | null
  currentBooksPerMonth: number | null
  projectedBooks: number | null
  hasProjection: boolean
  status: ReadingQuestStatus
  statusLabel: string
}

export interface ReaderXpSources {
  pagesRead: number
  completedBooks: number
  readingSessions: number
  pageCaptures: number
  recapsGenerated: number
  loreCardsUnlocked: number
}

export interface ReaderXpSummary {
  level: number
  title: string
  totalXp: number
  currentLevelXp: number
  nextLevelXp: number
  xpToNextLevel: number
  progressPercent: number
}

export interface ReadingQuestResponse {
  goal: ReadingGoal | null
  quest: ReadingQuestSummary
  level: ReaderXpSummary
  sources: ReaderXpSources
}

export interface ReadingProgressRow {
  id: string
  book_id: string
  user_id: string
  current_page: number
  updated_at: string
  session_start_at: string | null  // 013
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
  mode: RecapMode               // 015
  created_at: string
  image_path: string | null
  image_status: RecapImageStatus | null
  image_generated_at: string | null
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
  description: row.description ?? null,
  createdAt: row.created_at,
  source: row.source ?? 'manual',                        // 034
  pageCountEstimated: row.page_count_estimated ?? false,  // 034
})

// ─────────────────────────────────────────────────────────────
// Book Search & Add (030) — transient types (never persisted)
// ─────────────────────────────────────────────────────────────

// Google Books is the primary search/detail source for this flow; Open Library
// fills any gaps. (`openlibrary` is retained for forward-compat on route params.)
export type BookSearchSource = 'googlebooks' | 'openlibrary'

export interface BookSearchResult {
  source: BookSearchSource
  key: string            // Google Books volume id — details route :key
  title: string
  author: string | null
  coverUrl: string | null
  firstPublishYear: number | null
  isbn: string | null
}

/** Aggregated, editable pre-fill for BookForm (Google Books primary ⊕ Open Library gap-fill). */
export interface BookDetailDraft {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
  description: string | null
  isbn: string | null
  // Transient, recommendation-only: specific→general subjects (e.g. "Space Opera",
  // "Science Fiction") gathered from Google Books categories + Open Library subjects.
  // Not persisted on the saved book.
  subjects?: string[]
}

export type Recommendation = BookSearchResult

/** Raw Google Books volume (subset of fields we use). */
export interface GoogleVolume {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
  }
}

type GoogleVolumeInfo = NonNullable<GoogleVolume['volumeInfo']>

export const googleVolumeCover = (info: GoogleVolumeInfo): string | null => {
  const raw = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
  return raw ? raw.replace('http:', 'https:') : null
}

export const googleVolumeIsbn = (info: GoogleVolumeInfo): string | null => {
  const ids = info.industryIdentifiers ?? []
  return (
    ids.find((i) => i.type === 'ISBN_13')?.identifier ??
    ids.find((i) => i.type === 'ISBN_10')?.identifier ??
    null
  )
}

export const googleVolumeYear = (info: GoogleVolumeInfo): number | null => {
  const year = Number(info.publishedDate?.slice(0, 4))
  return Number.isFinite(year) && year > 0 ? year : null
}

export const mapGoogleVolume = (volume: GoogleVolume): BookSearchResult => {
  const info = volume.volumeInfo ?? {}
  return {
    source: 'googlebooks',
    key: volume.id,
    title: info.title ?? 'Untitled',
    author: info.authors?.[0] ?? null,
    coverUrl: googleVolumeCover(info),
    firstPublishYear: googleVolumeYear(info),
    isbn: googleVolumeIsbn(info),
  }
}

export const mapReadingProgress = (row: ReadingProgressRow, totalPages: number): ReadingProgress => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  currentPage: row.current_page,
  percentage: totalPages > 0 ? Math.round((row.current_page / totalPages) * 10000) / 100 : 0,
  updatedAt: row.updated_at,
  sessionStartAt: row.session_start_at ?? null,  // 013
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
  mode: row.mode ?? 'inferred',  // 015 — DEFAULT 'inferred' on historical rows
  createdAt: row.created_at,
  imagePath: row.image_path ?? null,
  imageStatus: row.image_status ?? 'skipped',
  imageGeneratedAt: row.image_generated_at ?? null,
})

// ─────────────────────────────────────────────────────────────
// Lexicon (T008)
// ─────────────────────────────────────────────────────────────

export type LexiconEntryType = 'dictionary' | 'quote'
// 016 — distinguishes user-added vs auto-extracted lexicon entries
export type LexiconEntrySource = 'manual' | 'auto'

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
  mastered: boolean             // 031 — terminal "learned" flag; excluded from review
  lastReviewedAt: string | null // 032 — when last reviewed (per-day tally)
  createdAt: string
  source: LexiconEntrySource    // 016
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
  mastered: boolean             // 031
  last_reviewed_at: string | null // 032
  created_at: string
  source: LexiconEntrySource    // 016
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
  mastered: row.mastered ?? false,
  lastReviewedAt: row.last_reviewed_at ?? null,
  createdAt: row.created_at,
  source: row.source ?? 'manual',
})

// ─────────────────────────────────────────────────────────────
// Great Library search (018-great-library)
// ─────────────────────────────────────────────────────────────

/** A lexicon entry enriched with the source book's title (from join). */
export interface LexiconSearchResult extends LexiconEntry {
  bookTitle: string   // 'Unknown Book' when the book row is orphaned/deleted
}

/** One option in the Great Library book-filter dropdown. */
export interface BookFilterOption {
  bookId: string
  bookTitle: string
}

/** Maps a raw Supabase lexicon_entries row (with books join) to LexiconSearchResult. */
export const mapSearchResult = (
  row: LexiconEntryRow & { books: { title: string } | null },
): LexiconSearchResult => ({
  ...mapLexiconEntry(row),
  bookTitle: (row.books as { title: string } | null)?.title ?? 'Unknown Book',
})

// ─────────────────────────────────────────────────────────────
// Reading DNA + Vocabulary Extraction (016)
// ─────────────────────────────────────────────────────────────

export interface BookSuggestion {
  title: string
  author: string
  reason: string
}

export interface MoodSignature {
  tone: string
  emojis: string[]
}

export interface ReadingDna {
  userId: string
  personality: string
  moodSignature: MoodSignature
  suggestions: BookSuggestion[]
  booksFinishedAtGeneration: number
  generatedAt: string
}

export interface ReadingDnaRow {
  user_id: string
  personality: string
  mood_tone: string
  mood_emojis: string[]
  suggestions: BookSuggestion[]
  books_finished_at_generation: number
  generated_at: string
}

export const mapReadingDna = (row: ReadingDnaRow): ReadingDna => ({
  userId: row.user_id,
  personality: row.personality,
  moodSignature: { tone: row.mood_tone, emojis: row.mood_emojis },
  suggestions: row.suggestions,
  booksFinishedAtGeneration: row.books_finished_at_generation,
  generatedAt: row.generated_at,
})

export type VocabularyExtractionStatus = 'pending' | 'succeeded' | 'failed' | 'skipped'

export interface VocabularyExtraction {
  id: string
  captureId: string
  bookId: string
  page: number
  wordsAdded: number
  status: VocabularyExtractionStatus
  createdAt: string
}

// ─────────────────────────────────────────────────────────────
// Progress History, Up Next Order, Recap Fragment, Book Passport (T009)
// ─────────────────────────────────────────────────────────────

export interface ProgressHistory {
  id: string
  bookId: string
  userId: string
  page: number
  recordedAt: string
  sessionStartAt: string | null  // 013 — null for legacy rows
  sessionNote: string | null     // 013 — optional end-of-session reminder
}

export interface ProgressHistoryRow {
  id: string
  book_id: string
  user_id: string
  page: number
  recorded_at: string
  session_start_at: string | null  // 013
  session_note: string | null      // 013
}

export const mapProgressHistory = (row: ProgressHistoryRow): ProgressHistory => ({
  id: row.id,
  bookId: row.book_id,
  userId: row.user_id,
  page: row.page,
  recordedAt: row.recorded_at,
  sessionStartAt: row.session_start_at ?? null,
  sessionNote: row.session_note ?? null,
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

// ─────────────────────────────────────────────────────────────
// Lore Chronoscope (007)
// ─────────────────────────────────────────────────────────────

export type LoreType = 'History' | 'Culture' | 'Geography' | 'Technology' | 'Lore'

export interface LoreCardRow {
  id: string
  user_id: string
  book_id: string
  title: string
  content: string
  type: LoreType
  linked_entities: string[]
  unlocked_at_page: number
  unlocked_at_milestone: number
  seen: boolean
  created_at: string
}

export interface LoreCard {
  id: string
  userId: string
  bookId: string
  title: string
  content: string
  type: LoreType
  linkedEntities: string[]
  unlockedAtPage: number
  unlockedAtMilestone: number
  seen: boolean
  createdAt: string
}

export const mapLoreCard = (row: LoreCardRow): LoreCard => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  title: row.title,
  content: row.content,
  type: row.type,
  linkedEntities: row.linked_entities ?? [],
  unlockedAtPage: row.unlocked_at_page,
  unlockedAtMilestone: row.unlocked_at_milestone,
  seen: row.seen,
  createdAt: row.created_at,
})

// ─────────────────────────────────────────────────────────────
// Page Captures (015) — corpus-grounded delta recaps
// ─────────────────────────────────────────────────────────────

export type PageCaptureSource = 'ocr' | 'manual' | 'import'

// Session resume — one-page warm-up shown in a dialog before the session
// timer starts. Grounded ONLY in the capture's own text (never inferred);
// stored on the capture row so it is purged with the OCR text on completion.
export interface SessionResume {
  bullets: string[]     // up to 3, one sentence each
  tension: string       // single sentence, present tense
}

export interface PageCapture {
  id: string
  userId: string
  bookId: string
  page: number          // sourced from reading_progress.current_page; NEVER OCR-detected
  text: string          // 1-10000 chars (post user-edit)
  wordCount: number
  confidence: number    // 0.0-1.0, self-rated by Gemini multimodal
  capturedAt: string
  source: PageCaptureSource
  resume: SessionResume | null
}

export interface PageCaptureRow {
  id: string
  user_id: string
  book_id: string
  page: number
  text: string
  word_count: number
  confidence: number
  captured_at: string
  source: PageCaptureSource
  resume: SessionResume | null
}

export const mapPageCapture = (row: PageCaptureRow): PageCapture => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  page: row.page,
  text: row.text,
  wordCount: row.word_count,
  confidence: Number(row.confidence),
  capturedAt: row.captured_at,
  source: row.source,
  resume: row.resume ?? null,
})

// ─────────────────────────────────────────────────────────────
// Memory Check (035) — pre-session recall quiz
// ─────────────────────────────────────────────────────────────

// One multiple-choice question grounded in the reader's own captures.
export interface QuizQuestion {
  question: string
  options: string[]        // exactly 3
  correctIndex: number     // 0-2
  sourcePage: number | null
}

// One row per (user, book) — regenerated (upserted) once the reader moves
// past pageSnapshot. Purged on book completion together with the captures.
export interface BookQuiz {
  id: string
  userId: string
  bookId: string
  pageSnapshot: number
  questions: QuizQuestion[]
  score: number | null       // correct answers on the most recent take
  answeredAt: string | null
  generatedAt: string
}

export interface BookQuizRow {
  id: string
  user_id: string
  book_id: string
  page_snapshot: number
  questions: QuizQuestion[]
  score: number | null
  answered_at: string | null
  generated_at: string
}

export const mapBookQuiz = (row: BookQuizRow): BookQuiz => ({
  id: row.id,
  userId: row.user_id,
  bookId: row.book_id,
  pageSnapshot: row.page_snapshot,
  questions: row.questions ?? [],
  score: row.score,
  answeredAt: row.answered_at,
  generatedAt: row.generated_at,
})

// ── Community profile (customization page) ────────────────────────────────────

export type ProfileVisibility = 'everyone' | 'followers' | 'nobody'

export interface CommunityPrivacy {
  progress: ProfileVisibility
  currentlyReading: ProfileVisibility
  lexicon: ProfileVisibility
  readerDna: ProfileVisibility
}

export interface CommunityProfile {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

/** `get_my_community_profile` / `upsert_my_community_profile` payload — null until the reader customizes their profile. */
export interface MyCommunityProfile {
  profile: CommunityProfile
  privacy: CommunityPrivacy
}

// ── Reading calendar (get_reading_calendar RPC) ───────────────────────────────

export interface ReadingCalendarBook {
  bookId: string
  title: string
  coverUrl: string | null
  furthestPage: number
}

export interface ReadingCalendarDay {
  date: string // YYYY-MM-DD in the caller's timezone
  books: ReadingCalendarBook[]
}
