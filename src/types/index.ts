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
  sessionStartAt: string | null  // 013 — non-null = active session in progress
}

export type RecapMode = 'corpus' | 'inferred'

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
}

export interface BookMetadata {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
}

export type InitialBookStatus = 'queued' | 'currentlyReading' | 'completed'

export interface AddBookInput extends Omit<Book, 'id' | 'userId' | 'createdAt'> {
  initialStatus: InitialBookStatus
  currentPage: number | null
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
  created_at: string
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

// ---------------------------------------------------------------------------
// Community Reader Profiles (020)
// ---------------------------------------------------------------------------

export type ProfileVisibility = 'everyone' | 'followers' | 'nobody'

export interface CommunityProfileIdentity {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isPublic?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CommunityProfilePrivacy {
  progress: ProfileVisibility
  currentlyReading: ProfileVisibility
  lexicon: ProfileVisibility
  readerDna: ProfileVisibility
}

export interface MyCommunityProfile {
  profile: CommunityProfileIdentity & {
    isPublic: boolean
    createdAt: string
    updatedAt: string
  }
  privacy: CommunityProfilePrivacy
}

export interface CommunityProfileInput {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isPublic: boolean
  privacy: CommunityProfilePrivacy
}

export interface UsernameAvailability {
  available: boolean
  normalizedUsername: string
}

export interface PublicProfileStats {
  booksRead: number
  totalPagesRead: number
  currentStreakDays: number
  longestStreakDays: number
}

export interface PublicCurrentlyReading {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  currentPage: number
  totalPages: number
  percentage: number
}

export interface PublicLexiconHighlight {
  term: string
  bookTitle: string | null
  masteredAt: string
}

export interface PublicReaderDna {
  personality: string
  moodTone: string
  moodEmojis: string[]
}

export interface PublicCommunityProfile {
  profile: Omit<CommunityProfileIdentity, 'isPublic' | 'createdAt' | 'updatedAt'>
  stats?: PublicProfileStats
  currentlyReading?: PublicCurrentlyReading
  lexiconHighlights?: PublicLexiconHighlight[]
  readerDna?: PublicReaderDna
}

// ---------------------------------------------------------------------------
// Community Follow Graph And Blocking (022)
// ---------------------------------------------------------------------------

export type CommunityInteractionReason = 'allowed' | 'self' | 'blocked' | 'profile_unavailable'

export interface CommunityRelationshipState {
  targetUserId: string
  isFollowing: boolean
  followsViewer: boolean
  isBlockedByViewer: boolean
  hasBlockedViewer: boolean
  followersCount: number
  followingCount: number
  canInteract: boolean
  reason: CommunityInteractionReason
  changed?: boolean
}

export interface CommunityReaderSearchResult {
  userId: string
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isFollowing: boolean
  followsViewer: boolean
  followersCount: number
  followingCount: number
}

export interface CommunityFollowListItem {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  followedAt: string
  isFollowing: boolean
}

export interface CommunityBlockedUser {
  userId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  blockedAt: string
}

export interface CommunityCursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface CommunityBlockResult {
  targetUserId: string
  isBlockedByViewer: boolean
  removedFollowsCount?: number
  changed: boolean
  reason?: CommunityInteractionReason
}

export interface CommunityInteractionResult {
  targetUserId: string
  allowed: boolean
  reason: CommunityInteractionReason
}

// ---------------------------------------------------------------------------
// Also Reading Card (023)
// ---------------------------------------------------------------------------

export type AlsoReadingMatchType = 'same_book' | 'same_isbn'
export type AlsoReadingRelativeStatus = 'ahead' | 'behind' | 'same_area' | null

export interface AlsoReadingItem {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  matchType: AlsoReadingMatchType
  matchedBookId: string
  matchedIsbn: string | null
  currentPage: number | null
  totalPages: number | null
  percentage: number | null
  relativeStatus: AlsoReadingRelativeStatus
  updatedAt: string
}

export interface AlsoReadingPage {
  items: AlsoReadingItem[]
  nextCursor: string | null
  totalVisible: number
}

// ---------------------------------------------------------------------------
// Reading Circles (024)
// ---------------------------------------------------------------------------

export type CircleMemberRole = 'owner' | 'member'
export type CircleInvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'

export interface ReadingCircleBookSummary {
  bookId: string
  title: string
  author: string
  coverUrl: string | null
  normalizedIsbn?: string | null
}

export interface ReadingCircleSummary {
  circleId: string
  name: string
  book: ReadingCircleBookSummary
  memberCount: number
  pendingInviteCount: number
  latestReactionAt: string | null
}

export interface ReadingCircleListCircleItem {
  type: 'circle'
  circle: ReadingCircleSummary
  viewerRole: CircleMemberRole
}

export interface ReadingCircleListInvitationItem {
  type: 'invitation'
  invitationId: string
  circle: ReadingCircleSummary
  invitedBy: {
    userId: string
    username: string
    displayName: string | null
    avatarUrl: string | null
  }
}

export type ReadingCircleListItem = ReadingCircleListCircleItem | ReadingCircleListInvitationItem

export interface ReadingCircleListPage {
  items: ReadingCircleListItem[]
  nextCursor: string | null
}

export interface ReadingCircleMember {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: CircleMemberRole
  joinedAt: string
}

export interface ReadingCirclePendingInvitation {
  invitationId: string
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  status: CircleInvitationStatus
  createdAt: string
}

export interface ReadingCircleViewerProgress {
  role: CircleMemberRole
  currentPage: number | null
  totalPages: number | null
  normalizedLocation: number | null
}

export interface ReadingCircleDetail {
  circleId: string
  name: string
  book: ReadingCircleBookSummary
  viewer: ReadingCircleViewerProgress
  members: ReadingCircleMember[]
  pendingInvitations: ReadingCirclePendingInvitation[]
  createdAt: string
}

export interface ReadingCircleCreateResult {
  circleId: string
  created: boolean
  invitedUserIds: string[]
  skippedUserIds: string[]
}

export interface ReadingCircleInvitationResponse {
  circleId: string
  invitationId: string
  status: CircleInvitationStatus
  member: {
    userId: string
    role: CircleMemberRole
    joinedAt: string
  } | null
}

export interface ReadingCircleInviteResult {
  circleId: string
  invitedUserIds: string[]
  skippedUserIds: string[]
}

export interface CircleReactionAuthor {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export interface CircleReaction {
  reactionId: string
  circleId: string
  author: CircleReactionAuthor
  content: string
  sourcePage: number
  sourceTotalPages: number
  normalizedLocation: number
  viewerEquivalentPage: number | null
  createdAt: string
}

export interface CircleReactionPage {
  items: CircleReaction[]
  nextCursor: string | null
  viewerProgressMissing?: boolean
}

export interface CircleReactionCreateResult {
  reactionId: string
  circleId: string
  normalizedLocation: number
  createdAt: string
}

export interface ReadingCircleLeaveResult {
  circleId: string
  left: boolean
  newOwnerId: string | null
}

export interface ReadingCircleRemoveMemberResult {
  circleId: string
  userId: string
  removed: boolean
  revokedInvitation: boolean
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
})

// ─────────────────────────────────────────────────────────────
// Lexicon (T008)
// ─────────────────────────────────────────────────────────────

export type LexiconEntryType = 'dictionary' | 'lore'
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
})
