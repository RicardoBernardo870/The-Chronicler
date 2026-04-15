/**
 * The Chronicler — Pinia Store & Service Interfaces
 *
 * This file documents the TypeScript contracts for the app's internal data layer.
 * It is a design artifact — not compiled directly. Implementation mirrors these shapes.
 */

// ─────────────────────────────────────────────────────────
// Core Domain Types
// ─────────────────────────────────────────────────────────

export interface Book {
  id: string
  userId: string
  title: string
  author: string
  isbn: string | null
  coverUrl: string | null
  totalPages: number
  genre: string | null
  createdAt: string // ISO 8601
}

export interface ReadingProgress {
  id: string
  bookId: string
  userId: string
  currentPage: number
  percentage: number // computed: (currentPage / book.totalPages) * 100, rounded to 2dp
  updatedAt: string  // ISO 8601
}

export interface Recap {
  id: string
  bookId: string
  userId: string
  progressSnapshot: number // percentage at time of generation
  memoryJogger: string
  conceptWatchlist: string
  thematicBridge: string
  createdAt: string // ISO 8601
}

export interface BookMetadata {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  genre: string | null
}

// ─────────────────────────────────────────────────────────
// Auth Store  (useAuthStore)
// ─────────────────────────────────────────────────────────

export interface AuthState {
  user: { id: string; email: string } | null
  loading: boolean
}

export interface AuthActions {
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  sendMagicLink(email: string): Promise<void>
  initialize(): Promise<void> // call on app mount; restores session
}

// ─────────────────────────────────────────────────────────
// Books Store  (useBooksStore)
// ─────────────────────────────────────────────────────────

export interface BooksState {
  books: Book[]
  loading: boolean
  error: string | null
}

export interface BooksActions {
  fetchLibrary(): Promise<void>
  addBook(input: Omit<Book, 'id' | 'userId' | 'createdAt'>): Promise<Book>
  updateBook(id: string, changes: Partial<Pick<Book, 'title' | 'author' | 'totalPages' | 'genre' | 'coverUrl'>>): Promise<void>
  removeBook(id: string): Promise<void>
}

export interface BooksGetters {
  bookById(id: string): Book | undefined
}

// ─────────────────────────────────────────────────────────
// Progress Store  (useProgressStore)
// ─────────────────────────────────────────────────────────

export interface ProgressState {
  progress: Record<string, ReadingProgress> // keyed by bookId
  pendingSync: boolean // true when offline queue has unsynced items
}

export interface ProgressActions {
  fetchProgress(): Promise<void>
  updateProgress(bookId: string, currentPage: number): Promise<void>
  // updateProgress writes to IndexedDB queue first,
  // optimistically updates local state,
  // then syncs to Supabase when online.
  flushOfflineQueue(): Promise<void> // called by service worker on sync
}

export interface ProgressGetters {
  progressForBook(bookId: string): ReadingProgress | undefined
  percentageForBook(bookId: string): number // 0–100
}

// ─────────────────────────────────────────────────────────
// Recaps Store  (useRecapsStore)
// ─────────────────────────────────────────────────────────

export type RecapGenerationStatus = 'idle' | 'streaming' | 'complete' | 'error'

export interface RecapsState {
  recapsByBook: Record<string, Recap[]> // keyed by bookId, sorted by createdAt DESC
  generationStatus: RecapGenerationStatus
  streamingContent: Partial<Pick<Recap, 'memoryJogger' | 'conceptWatchlist' | 'thematicBridge'>>
  error: string | null
}

export interface RecapsActions {
  fetchRecapsForBook(bookId: string): Promise<void>
  generateRecap(bookId: string): Promise<void>
  // generateRecap:
  //   1. Sets generationStatus = 'streaming'
  //   2. Calls Edge Function → Claude API stream
  //   3. Progressively updates streamingContent as tokens arrive
  //   4. On stream complete: validates all fields, persists to Supabase
  //   5. Sets generationStatus = 'complete' | 'error'
}

export interface RecapsGetters {
  latestRecapForBook(bookId: string): Recap | undefined
  recapHistoryForBook(bookId: string): Recap[]
}

// ─────────────────────────────────────────────────────────
// ISBN Service  (useIsbnService composable)
// ─────────────────────────────────────────────────────────

export interface IsbnService {
  lookup(isbn: string): Promise<BookMetadata | null>
  // Returns null if both Open Library and Google Books return no result.
  // Never throws — wraps network errors and returns null.
}

// ─────────────────────────────────────────────────────────
// Scanner Composable  (useScanner)
// ─────────────────────────────────────────────────────────

export interface ScannerComposable {
  isScanning: boolean
  startScanning(videoElement: HTMLVideoElement): void
  stopScanning(): void
  onDetected: (callback: (isbn: string) => void) => void
}
