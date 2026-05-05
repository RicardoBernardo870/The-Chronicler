import { describe, expect, it } from 'vitest'
import {
  getReadingPulseCelebration,
  getReadingPulseState,
  readingPulseErrorState,
  readingPulseLoadingState,
} from '@/domain/retention/rules'
import type { RetentionSummary } from '@/types'

const baseSummary: RetentionSummary = {
  weekStart: '2026-05-04T00:00:00.000Z',
  weekEnd: '2026-05-11T00:00:00.000Z',
  timezone: 'Europe/Lisbon',
  sessionsThisWeek: 1,
  weeklyGoal: 3,
  goalProgressPct: 33,
  activeDaysThisWeek: 1,
  lastSessionAt: '2026-05-05T20:00:00.000Z',
  daysSinceLastSession: 0,
  nudgeCode: 'keep_going',
}

describe('Reading Pulse rules', () => {
  it('maps one confirmed session to supportive progress copy', () => {
    const state = getReadingPulseState(baseSummary)

    expect(state.tone).toBe('progress')
    expect(state.sessionsLabel).toBe('1 of 3 sessions')
    expect(state.progressLabel).toBe('2 to go')
    expect(state.progressValue).toBe(33)
    expect(state.nextActionLabel).toBe('Read another bit')
    expect(state.body).toContain('momentum')
  })

  it('softens an empty week with a tiny next action', () => {
    const state = getReadingPulseState({
      ...baseSummary,
      sessionsThisWeek: 0,
      goalProgressPct: 0,
      nudgeCode: 'start_week',
    })

    expect(state.tone).toBe('empty')
    expect(state.title).toBe('Start the pulse')
    expect(state.nextActionLabel).toBe('Read one page')
    expect(state.body).not.toMatch(/fail|debt|penalty|missed/i)
  })

  it('uses comeback copy without guilt language', () => {
    const state = getReadingPulseState({
      ...baseSummary,
      sessionsThisWeek: 1,
      daysSinceLastSession: 14,
      nudgeCode: 'comeback',
    })

    expect(state.tone).toBe('comeback')
    expect(state.title).toBe('Welcome back to the page')
    expect(state.body).toBe('Back in the story. That absolutely counts.')
    expect(state.body).not.toMatch(/fail|debt|penalty|streak broke/i)
  })

  it('caps goal-met progress at 100 percent', () => {
    const state = getReadingPulseState({
      ...baseSummary,
      sessionsThisWeek: 4,
      goalProgressPct: 133,
      nudgeCode: 'goal_met',
    })

    expect(state.tone).toBe('goal-met')
    expect(state.progressValue).toBe(100)
    expect(state.progressLabel).toBe('Pulse complete')
    expect(state.body).toContain('wizardry')
  })

  it('provides loading and error states that do not block reading', () => {
    expect(readingPulseLoadingState().title).toBe('Reading Pulse')
    expect(readingPulseErrorState().nextActionLabel).toBe('Keep reading')
    expect(readingPulseErrorState().body).toContain('catch up later')
  })

  it('creates comeback celebration only from an active session transition', () => {
    const previous = {
      ...baseSummary,
      sessionsThisWeek: 0,
      daysSinceLastSession: 14,
      nudgeCode: 'start_week' as const,
    }
    const current = {
      ...baseSummary,
      sessionsThisWeek: 1,
      daysSinceLastSession: 0,
      nudgeCode: 'keep_going' as const,
    }

    expect(getReadingPulseCelebration(previous, current, true)?.title).toBe('Return win')
    expect(getReadingPulseCelebration(previous, current, false)).toBeNull()
  })

  it('creates goal-met celebration only when crossing the weekly goal', () => {
    const previous = { ...baseSummary, sessionsThisWeek: 2, weeklyGoal: 3 }
    const current = {
      ...baseSummary,
      sessionsThisWeek: 3,
      weeklyGoal: 3,
      goalProgressPct: 100,
      nudgeCode: 'goal_met' as const,
    }

    expect(getReadingPulseCelebration(previous, current, true)?.title).toBe('Pulse complete')
    expect(getReadingPulseCelebration(current, current, true)).toBeNull()
  })
})
