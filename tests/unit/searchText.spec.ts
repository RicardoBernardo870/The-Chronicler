import { describe, expect, it } from 'vitest'
import { normalizeForSearch } from '@/utils/searchText'

describe('normalizeForSearch', () => {
  it('lowercases and trims', () => {
    expect(normalizeForSearch('  The Hobbit ')).toBe('the hobbit')
  })

  it('strips accents so Zafón matches zafon', () => {
    expect(normalizeForSearch('Carlos Ruiz Zafón')).toBe('carlos ruiz zafon')
    expect(normalizeForSearch('Éowyn')).toBe('eowyn')
  })

  it('keeps digits and punctuation', () => {
    expect(normalizeForSearch('1984')).toBe('1984')
  })
})
