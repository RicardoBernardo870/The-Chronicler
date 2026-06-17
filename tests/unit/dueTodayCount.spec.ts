import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLexiconStore } from '@/stores/lexicon'
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
  createdAt: '',
  source: 'manual',
  ...over,
})

beforeEach(() => setActivePinia(createPinia()))

describe('lexicon store dueTodayCount', () => {
  it('counts only non-mastered entries due today', () => {
    const store = useLexiconStore()
    store.entriesByBook = {
      b1: [
        entry({ id: 'due', nextReviewAt: '2000-01-01' }),
        entry({ id: 'mastered', nextReviewAt: '2000-01-01', mastered: true }),
        entry({ id: 'future', nextReviewAt: '2999-01-01' }),
      ],
    }
    expect(store.dueTodayCount).toBe(1)
  })
})
