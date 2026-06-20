import { describe, it, expect } from 'vitest'
import { parseStorygraphRow } from '@/utils/import/storygraphParser'

const base = {
  Title: 'Project Hail Mary',
  Authors: 'Andy Weir, Someone Else',
  'ISBN/UID': '9780593135204',
  'Number of Pages': '496',
  'Read Status': 'read',
}

describe('parseStorygraphRow', () => {
  it('takes the first author from a comma list', () => {
    const res = parseStorygraphRow({ ...base })
    if (res.ok) expect(res.row.author).toBe('Andy Weir')
  })

  it('maps read → completed; to-read / currently-reading / did-not-finish → queued', () => {
    const cases: [string, 'completed' | 'queued'][] = [
      ['read', 'completed'],
      ['to-read', 'queued'],
      ['currently-reading', 'queued'],
      ['did-not-finish', 'queued'],
      ['', 'queued'],
    ]
    for (const [status, expected] of cases) {
      const res = parseStorygraphRow({ ...base, 'Read Status': status })
      if (res.ok) expect(res.row.initialStatus).toBe(expected)
    }
  })

  it('tags the source as storygraph and builds an ISBN dedupe key', () => {
    const res = parseStorygraphRow({ ...base })
    if (res.ok) {
      expect(res.row.source).toBe('storygraph')
      expect(res.row.dedupeKey).toBe('isbn:9780593135204')
    }
  })

  it('falls back to a title+author dedupe key when ISBN is missing', () => {
    const res = parseStorygraphRow({ ...base, 'ISBN/UID': '' })
    if (res.ok) expect(res.row.dedupeKey).toBe('ta:project hail mary andy weir')
  })
})
