import { describe, it, expect } from 'vitest'
import { parseGoodreadsRow } from '@/utils/import/goodreadsParser'

const base = {
  Title: 'The Hobbit',
  Author: 'J.R.R. Tolkien',
  'Author l-f': 'Tolkien, J.R.R.',
  ISBN13: '="9780261102217"',
  ISBN: '="0261102214"',
  'Number of Pages': '310',
  'Exclusive Shelf': 'read',
}

describe('parseGoodreadsRow', () => {
  it('strips the Excel-guard from ISBN13 and keeps digits', () => {
    const res = parseGoodreadsRow({ ...base })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.row.isbn).toBe('9780261102217')
  })

  it('maps "read" to completed and other shelves to queued', () => {
    const read = parseGoodreadsRow({ ...base, 'Exclusive Shelf': 'read' })
    const toRead = parseGoodreadsRow({ ...base, 'Exclusive Shelf': 'to-read' })
    const reading = parseGoodreadsRow({ ...base, 'Exclusive Shelf': 'currently-reading' })
    if (read.ok) expect(read.row.initialStatus).toBe('completed')
    if (toRead.ok) expect(toRead.row.initialStatus).toBe('queued')
    if (reading.ok) expect(reading.row.initialStatus).toBe('queued')
  })

  it('keeps a comma-bearing title intact and parses pages', () => {
    const res = parseGoodreadsRow({ ...base, Title: 'Cosmos, Revisited', 'Number of Pages': '432' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.row.title).toBe('Cosmos, Revisited')
      expect(res.row.totalPages).toBe(432)
    }
  })

  it('returns null pages when page count is blank', () => {
    const res = parseGoodreadsRow({ ...base, 'Number of Pages': '' })
    if (res.ok) expect(res.row.totalPages).toBeNull()
  })

  it('fails a row with no title', () => {
    const res = parseGoodreadsRow({ ...base, Title: '   ' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe('no title')
  })
})
