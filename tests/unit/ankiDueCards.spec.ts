import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLexiconStore } from '@/stores/lexicon'
import { useAnkiSession } from '@/composables/useAnkiSession'
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

describe('useAnkiSession.dueCards', () => {
  it('draws from the shared today-set: excludes mastered/not-due, ordered highest-box first', () => {
    const store = useLexiconStore()
    store.entriesByBook = {
      b1: [
        entry({ id: 'low', leitnerBox: 1, nextReviewAt: '2000-01-01' }),
        entry({ id: 'high', leitnerBox: 5, nextReviewAt: '2000-01-01' }),
        entry({ id: 'mastered', leitnerBox: 4, nextReviewAt: '2000-01-01', mastered: true }),
        entry({ id: 'future', leitnerBox: 2, nextReviewAt: '2999-01-01' }),
      ],
    }
    const { dueCards } = useAnkiSession()
    expect(dueCards.value.map(c => c.id)).toEqual(['high', 'low'])
  })
})
