import { describe, it, expect } from 'vitest'
import { detectImportSource } from '@/utils/import/csvFormat'

describe('detectImportSource', () => {
  it('detects Goodreads by its header signature', () => {
    const headers = ['Book Id', 'Title', 'Author', 'My Rating', 'Exclusive Shelf', 'ISBN13']
    expect(detectImportSource(headers)).toBe('goodreads')
  })

  it('detects StoryGraph by its header signature', () => {
    const headers = ['Title', 'Authors', 'ISBN/UID', 'Read Status', 'Star Rating']
    expect(detectImportSource(headers)).toBe('storygraph')
  })

  it('returns null for an unrecognized file', () => {
    expect(detectImportSource(['Name', 'Email', 'Phone'])).toBeNull()
    expect(detectImportSource([])).toBeNull()
  })

  it('tolerates surrounding whitespace in headers', () => {
    expect(detectImportSource([' Book Id ', 'Exclusive Shelf', 'My Rating'])).toBe('goodreads')
  })
})
