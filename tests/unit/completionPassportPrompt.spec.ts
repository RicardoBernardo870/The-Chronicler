import { describe, expect, it } from 'vitest'
import {
  createCompletionPromptTarget,
  crossedCompletionThreshold,
} from '@/utils/completionPrompt'

describe('completion passport prompt eligibility', () => {
  it('qualifies only when progress crosses from below complete to complete', () => {
    expect(crossedCompletionThreshold(99.9, 100)).toBe(true)
    expect(crossedCompletionThreshold(25, 100.1)).toBe(true)
    expect(crossedCompletionThreshold(0, 99.9)).toBe(false)
    expect(crossedCompletionThreshold(100, 100)).toBe(false)
    expect(crossedCompletionThreshold(120, 120)).toBe(false)
  })

  it('creates a prompt target for a newly completed book', () => {
    expect(createCompletionPromptTarget('book-1', 'The Odyssey', 72, 100)).toEqual({
      bookId: 'book-1',
      bookTitle: 'The Odyssey',
    })
  })

  it('does not create a prompt target for an already-completed refresh state', () => {
    expect(createCompletionPromptTarget('book-1', 'The Odyssey', 100, 100)).toBeNull()
    expect(createCompletionPromptTarget('book-1', 'The Odyssey', 100, 105)).toBeNull()
  })

  it('falls back to generic title copy when a book title is missing', () => {
    expect(createCompletionPromptTarget('book-1', '   ', 75, 100)).toEqual({
      bookId: 'book-1',
      bookTitle: 'this book',
    })
  })
})
