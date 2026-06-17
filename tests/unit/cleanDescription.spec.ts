import { describe, it, expect } from 'vitest'
import { cleanDescription } from '@/utils/cleanDescription'

describe('cleanDescription', () => {
  it('returns null for empty input', () => {
    expect(cleanDescription(null)).toBeNull()
    expect(cleanDescription('')).toBeNull()
    expect(cleanDescription('   ')).toBeNull()
  })

  it('strips HTML tags and decodes common entities', () => {
    expect(cleanDescription('<p>Tom &amp; Jerry<br>are <b>friends</b>.</p>')).toBe(
      'Tom & Jerry\nare friends.',
    )
  })

  it('removes Open Library "([source][1])" markers and reference-link footers', () => {
    const raw = 'A classic tale. ([source][1])\n\n  [1]: https://en.wikipedia.org/wiki/Book'
    expect(cleanDescription(raw)).toBe('A classic tale.')
  })

  it('drops a bare trailing URL', () => {
    expect(cleanDescription('Great book. https://example.com/x')).toBe('Great book.')
  })

  it('collapses excessive blank lines', () => {
    expect(cleanDescription('Line one.\n\n\n\nLine two.')).toBe('Line one.\n\nLine two.')
  })
})
