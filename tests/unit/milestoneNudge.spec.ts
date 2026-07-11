import { describe, expect, it } from 'vitest'
import { pagesToNextInsight } from '@/utils/milestoneDetect'

describe('pagesToNextInsight', () => {
  it('counts pages to the next 10% milestone', () => {
    // 300 pages, at page 19 (6.3%) → next milestone 10% = page 30
    expect(pagesToNextInsight(19, 300)).toBe(11)
  })

  it('targets the next bucket when sitting exactly on a milestone', () => {
    // at page 30 (10%) → next is 20% = page 60
    expect(pagesToNextInsight(30, 300)).toBe(30)
  })

  it('returns null past the 90% milestone (no lore at 100%)', () => {
    expect(pagesToNextInsight(280, 300)).toBeNull()
    expect(pagesToNextInsight(271, 300)).toBeNull() // 90.3%
  })

  it('still nudges toward 90% from just below it', () => {
    // page 265 of 300 (88.3%) → 90% = page 270
    expect(pagesToNextInsight(265, 300)).toBe(5)
  })

  it('returns null for unusable inputs', () => {
    expect(pagesToNextInsight(10, 0)).toBeNull()
    expect(pagesToNextInsight(-1, 300)).toBeNull()
  })
})
