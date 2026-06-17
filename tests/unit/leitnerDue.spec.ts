import { describe, it, expect } from 'vitest'
import { useLeitner } from '@/composables/useLeitner'
import type { LexiconEntry } from '@/types'

const entry = (over: Partial<LexiconEntry>): LexiconEntry => ({
  id: 'x',
  userId: 'u',
  bookId: 'b',
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

describe('useLeitner.getDueWord', () => {
  const { getDueWord } = useLeitner()

  it('picks the lowest-box due word', () => {
    const pick = getDueWord([
      entry({ id: 'a', leitnerBox: 3, nextReviewAt: '2000-01-01' }),
      entry({ id: 'b', leitnerBox: 1, nextReviewAt: '2000-01-02' }),
    ])
    expect(pick?.id).toBe('b')
  })

  it('excludes mastered words', () => {
    expect(getDueWord([entry({ id: 'a', mastered: true })])).toBeNull()
  })

  it('returns null when nothing is due', () => {
    expect(getDueWord([entry({ nextReviewAt: '2999-01-01' })])).toBeNull()
  })
})
