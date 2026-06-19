import { describe, it, expect } from 'vitest'
import { cleanIsbn, makeDedupeKey, parsePages, mapStatusToInitial, firstAuthor } from '@/utils/import/shared'

describe('import dedupe helpers', () => {
  it('cleanIsbn strips Excel guard + non-ISBN chars, drops too-short values', () => {
    expect(cleanIsbn('="9780261102217"')).toBe('9780261102217')
    expect(cleanIsbn('0-261-10221-4')).toBe('0261102214')
    expect(cleanIsbn('123456789X')).toBe('123456789X')
    expect(cleanIsbn('=""')).toBeNull()
    expect(cleanIsbn('')).toBeNull()
    expect(cleanIsbn(null)).toBeNull()
  })

  it('makeDedupeKey prefers ISBN, else normalized title+author', () => {
    expect(makeDedupeKey('9780261102217', 'The Hobbit', 'Tolkien')).toBe('isbn:9780261102217')
    expect(makeDedupeKey(null, '  The Hobbit ', ' J.R.R. Tolkien ')).toBe(
      'ta:the hobbit j.r.r. tolkien',
    )
  })

  it('the same book from two files collapses to one key', () => {
    const a = makeDedupeKey(cleanIsbn('="9780593135204"'), 'Project Hail Mary', 'Andy Weir')
    const b = makeDedupeKey(cleanIsbn('9780593135204'), 'project hail mary', 'andy weir')
    expect(a).toBe(b)
  })

  it('parsePages returns null for blank / non-positive', () => {
    expect(parsePages('310')).toBe(310)
    expect(parsePages('')).toBeNull()
    expect(parsePages('0')).toBeNull()
    expect(parsePages(null)).toBeNull()
  })

  it('mapStatusToInitial only completes "read"', () => {
    expect(mapStatusToInitial('read')).toBe('completed')
    expect(mapStatusToInitial('READ')).toBe('completed')
    expect(mapStatusToInitial('to-read')).toBe('queued')
    expect(mapStatusToInitial(undefined)).toBe('queued')
  })

  it('firstAuthor extracts the first of a list', () => {
    expect(firstAuthor('Andy Weir, Someone Else')).toBe('Andy Weir')
    expect(firstAuthor('Solo Author')).toBe('Solo Author')
    expect(firstAuthor('')).toBe('Unknown Author')
  })
})
