import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const cardSource = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/ReadingPulseCard.vue'),
  'utf8',
)

describe('ReadingPulseCard source contract', () => {
  it('shows dismissible celebrations without making the fixed card dismissible', () => {
    expect(cardSource).toContain('v-if="celebration"')
    expect(cardSource).toContain('dismissCelebration')
    expect(cardSource).toContain('Dismiss Reading Pulse celebration')
    expect(cardSource).not.toContain('Dismiss Reading Pulse card')
  })

  it('suppresses delayed replay celebrations without a recent session-ended event', () => {
    expect(cardSource).toContain('getReadingPulseCelebration(')
    expect(cardSource).toContain('progressStore.lastSessionEnded !== null')
  })

  it('keeps the card action wired to the existing continue flow', () => {
    expect(cardSource).toContain("continueReading: []")
    expect(cardSource).toContain("@click=\"emit('continueReading')\"")
  })
})
