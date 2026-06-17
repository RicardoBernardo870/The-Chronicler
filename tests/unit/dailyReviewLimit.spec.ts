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

describe('daily review tally', () => {
  it('counts words reviewed today and computes the remaining allotment', () => {
    const store = useLexiconStore()
    const now = new Date().toISOString()
    store.entriesByBook = {
      b1: [
        entry({ id: 'a', lastReviewedAt: now }),
        entry({ id: 'b', lastReviewedAt: now }),
        entry({ id: 'c', lastReviewedAt: null }),
        entry({ id: 'd', lastReviewedAt: '2000-01-01T00:00:00.000Z' }), // reviewed long ago
      ],
    }
    expect(store.reviewedTodayCount).toBe(2)
    expect(store.dailyRemaining).toBe(DAILY_REVIEW_LIMIT - 2)
  })

  it('floors dailyRemaining at zero when the limit is exceeded', () => {
    const store = useLexiconStore()
    const now = new Date().toISOString()
    store.entriesByBook = {
      b1: Array.from({ length: 25 }, (_, i) => entry({ id: `r${i}`, lastReviewedAt: now })),
    }
    expect(store.reviewedTodayCount).toBe(25)
    expect(store.dailyRemaining).toBe(0)
  })
})
