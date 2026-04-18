import { describe, it, expect } from 'vitest'
import { buildMasterRecap } from '@/utils/masterRecap'
import type { Recap } from '@/types'

const makeRecap = (overrides: Partial<Recap> = {}): Recap => ({
  id: 'r1',
  bookId: 'b1',
  userId: 'u1',
  progressSnapshot: 10,
  pageSnapshot: 30,
  memoryJogger: 'jogger',
  conceptWatchlist: 'concept',
  thematicBridge: 'bridge',
  createdAt: new Date().toISOString(),
  ...overrides,
})

describe('buildMasterRecap', () => {
  it('returns empty string for an empty recap list', () => {
    expect(buildMasterRecap([], 100)).toBe('')
  })

  it('returns empty string when all recaps are page-0 blurbs (progressSnapshot = 0)', () => {
    const recaps = [
      makeRecap({ progressSnapshot: 0, pageSnapshot: 0 }),
    ]
    expect(buildMasterRecap(recaps, 100)).toBe('')
  })

  it('includes a single qualifying recap and formats it correctly', () => {
    const recap = makeRecap({
      progressSnapshot: 10,
      pageSnapshot: 30,
      memoryJogger: 'Frodo sets out',
      conceptWatchlist: 'Shire, Ring',
      thematicBridge: 'A reluctant hero theme',
    })
    const result = buildMasterRecap([recap], 100)
    expect(result).toContain('Memory jogger: Frodo sets out')
    expect(result).toContain('Concept watchlist: Shire, Ring')
    expect(result).toContain('Thematic bridge: A reluctant hero theme')
  })

  it('includes multiple qualifying recaps joined by separator', () => {
    const r1 = makeRecap({ id: 'r1', progressSnapshot: 10, pageSnapshot: 30, memoryJogger: 'First recap' })
    const r2 = makeRecap({ id: 'r2', progressSnapshot: 20, pageSnapshot: 60, memoryJogger: 'Second recap' })
    const result = buildMasterRecap([r1, r2], 100)
    // Separator must be present
    expect(result).toContain('---')
    // Both recap blocks must appear in the output
    expect(result).toContain('First recap')
    expect(result).toContain('Second recap')
  })

  it('sorts multiple recaps by pageSnapshot ascending', () => {
    const r1 = makeRecap({ id: 'r1', progressSnapshot: 20, pageSnapshot: 60, memoryJogger: 'Second' })
    const r2 = makeRecap({ id: 'r2', progressSnapshot: 10, pageSnapshot: 30, memoryJogger: 'First' })
    const result = buildMasterRecap([r1, r2], 100)
    const firstIdx = result.indexOf('First')
    const secondIdx = result.indexOf('Second')
    expect(firstIdx).toBeLessThan(secondIdx)
  })

  it('excludes recaps where progressSnapshot = 0 (blurb guard)', () => {
    const blurb = makeRecap({ progressSnapshot: 0, pageSnapshot: 0, memoryJogger: 'Blurb text' })
    const real  = makeRecap({ progressSnapshot: 10, pageSnapshot: 30, memoryJogger: 'Real recap' })
    const result = buildMasterRecap([blurb, real], 100)
    expect(result).not.toContain('Blurb text')
    expect(result).toContain('Real recap')
  })

  it('excludes recaps where pageSnapshot > currentPage (spoiler wall)', () => {
    const future = makeRecap({ progressSnapshot: 50, pageSnapshot: 200, memoryJogger: 'Spoiler content' })
    const past   = makeRecap({ progressSnapshot: 10, pageSnapshot: 30,  memoryJogger: 'Safe content' })
    const result = buildMasterRecap([future, past], 50)
    expect(result).not.toContain('Spoiler content')
    expect(result).toContain('Safe content')
  })

  it('includes a recap exactly at currentPage (boundary inclusive)', () => {
    const exact = makeRecap({ progressSnapshot: 10, pageSnapshot: 50, memoryJogger: 'At boundary' })
    const result = buildMasterRecap([exact], 50)
    expect(result).toContain('At boundary')
  })

  it('handles null pageSnapshot by treating it as page 0', () => {
    const noPage = makeRecap({ progressSnapshot: 10, pageSnapshot: null, memoryJogger: 'No page' })
    // pageSnapshot null → treated as 0 → included when currentPage >= 0
    const result = buildMasterRecap([noPage], 100)
    expect(result).toContain('No page')
  })

  it('returns empty string when all recaps are beyond currentPage', () => {
    const future = makeRecap({ progressSnapshot: 80, pageSnapshot: 300, memoryJogger: 'Not yet' })
    expect(buildMasterRecap([future], 50)).toBe('')
  })
})
