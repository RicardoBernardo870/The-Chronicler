import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLexiconStore, DAILY_REVIEW_LIMIT } from '@/stores/lexicon'
import type { LexiconEntry } from '@/types'

vi.mock('@/services/supabase', () => ({ supabase: { from: vi.fn() } }))

const entry = (over: Partial<LexiconEntry>): LexiconEntry => ({
  id: 'x',
  userId: 'u',
  bookId: 'b1',
  term: 't',
  definition: 'd',
  entryType: 'dictionary',
  contextSentence: null,
  pageFound: null,
  leitnerBox: 1,
  nextReviewAt: '2000-01-01',
  mastered: false,
  lastReviewedAt: null,
  createdAt: '',
  source: 'manual',
  ...over,
})

beforeEach(() => setActivePinia(createPinia()))

describe('eligibleReviewWords', () => {
  it('excludes mastered + reviewed-today + not-due, sorted lowest-box then most-overdue', () => {
    const store = useLexiconStore()
    const now = new Date().toISOString()
    store.entriesByBook = {
      b1: [
        entry({ id: 'box3', leitnerBox: 3, nextReviewAt: '2000-01-01' }),
        entry({ id: 'box1newer', leitnerBox: 1, nextReviewAt: '2000-01-02' }),
        entry({ id: 'box1older', leitnerBox: 1, nextReviewAt: '2000-01-01' }),
        entry({ id: 'mastered', leitnerBox: 1, nextReviewAt: '2000-01-01', mastered: true }),
        entry({ id: 'reviewedToday', leitnerBox: 1, nextReviewAt: '2000-01-01', lastReviewedAt: now }),
        entry({ id: 'future', leitnerBox: 1, nextReviewAt: '2999-01-01' }),
      ],
    }
    expect(store.eligibleReviewWords.map(e => e.id)).toEqual(['box1older', 'box1newer', 'box3'])
  })
})

describe('todaysReviewSet / activeReviewWords cap', () => {
  it('caps at the daily limit and lifts the cap on enableReviewMore', () => {
    const store = useLexiconStore()
    store.entriesByBook = {
      b1: Array.from({ length: 25 }, (_, i) =>
        entry({ id: `w${i}`, leitnerBox: 1, nextReviewAt: '2000-01-01' }),
      ),
    }
    expect(store.todaysReviewSet.length).toBe(DAILY_REVIEW_LIMIT)
    expect(store.activeReviewWords.length).toBe(DAILY_REVIEW_LIMIT)
    expect(store.extraAvailable).toBe(true)

    store.enableReviewMore()
    expect(store.activeReviewWords.length).toBe(25)
  })
})
