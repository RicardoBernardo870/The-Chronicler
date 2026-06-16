import { describe, it, expect } from 'vitest'
import { isDuplicateBook } from '@/utils/duplicateBook'
import type { Book } from '@/types'

const makeBook = (overrides: Partial<Book>): Book => ({
  id: 'b1',
  userId: 'u1',
  title: 'The Hobbit',
  author: 'J.R.R. Tolkien',
  isbn: '9780261102217',
  coverUrl: null,
  totalPages: 310,
  genre: null,
  description: null,
  createdAt: '',
  ...overrides,
})

describe('isDuplicateBook', () => {
  it('matches on normalized ISBN regardless of formatting', () => {
    const library = [makeBook({ isbn: '978-0-261-10221-7' })]
    expect(
      isDuplicateBook(
        { isbn: '9780261102217', title: 'Different Title', author: 'Someone Else' },
        library,
      ),
    ).toBe(true)
  })

  it('falls back to case-insensitive title + author when candidate has no ISBN', () => {
    const library = [makeBook({ isbn: null })]
    expect(
      isDuplicateBook({ isbn: null, title: 'the hobbit', author: 'j.r.r. tolkien' }, library),
    ).toBe(true)
  })

  it('does not match a different book', () => {
    const library = [makeBook({})]
    expect(
      isDuplicateBook({ isbn: '9999999999999', title: 'Dune', author: 'Frank Herbert' }, library),
    ).toBe(false)
  })

  it('does not match on title alone when authors differ', () => {
    const library = [makeBook({ isbn: null })]
    expect(
      isDuplicateBook({ isbn: null, title: 'The Hobbit', author: 'Someone Else' }, library),
    ).toBe(false)
  })
})
