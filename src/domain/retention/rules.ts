import type { RetentionNudgeCode, RetentionSummary } from '@/types'

export type ReadingPulseTone =
  | 'loading'
  | 'error'
  | 'empty'
  | 'comeback'
  | 'goal-met'
  | 'almost-there'
  | 'progress'

export interface ReadingPulseViewState {
  tone: ReadingPulseTone
  title: string
  body: string
  nextActionLabel: string
  progressLabel: string
  progressValue: number
  sessionsLabel: string
}

export interface ReadingPulseCelebration {
  id: string
  title: string
  body: string
}

const clampProgress = (value: number): number => Math.max(0, Math.min(100, value))

const sessionsLabel = (sessions: number, goal: number): string =>
  `${sessions} of ${goal} sessions`

const progressLabel = (sessions: number, goal: number): string => {
  if (sessions >= goal) return 'Pulse complete'
  if (sessions === 0) return 'Fresh week'
  return `${goal - sessions} to go`
}

const titleByNudge: Record<RetentionNudgeCode, string> = {
  signed_out: 'Reading Pulse',
  start_week: 'Start the pulse',
  keep_going: 'Pulse is warming up',
  almost_there: 'One more nudge',
  goal_met: 'Reading Pulse complete',
  comeback: 'Welcome back to the page',
}

const bodyByNudge: Record<RetentionNudgeCode, string> = {
  signed_out: 'Sign in to keep this week counted.',
  start_week: 'One page is a perfectly respectable plot twist.',
  keep_going: 'You have momentum. Suspiciously heroic behavior.',
  almost_there: 'One more session and this week gets a little gold star energy.',
  goal_met: 'Three readings this week. Extremely legal wizardry.',
  comeback: 'Back in the story. That absolutely counts.',
}

const toneByNudge: Record<RetentionNudgeCode, ReadingPulseTone> = {
  signed_out: 'empty',
  start_week: 'empty',
  keep_going: 'progress',
  almost_there: 'almost-there',
  goal_met: 'goal-met',
  comeback: 'comeback',
}

export const readingPulseLoadingState = (): ReadingPulseViewState => ({
  tone: 'loading',
  title: 'Reading Pulse',
  body: "Checking this week's rhythm.",
  nextActionLabel: 'Keep reading',
  progressLabel: 'Loading',
  progressValue: 0,
  sessionsLabel: '0 of 3 sessions',
})

export const readingPulseErrorState = (): ReadingPulseViewState => ({
  tone: 'error',
  title: 'Reading Pulse is taking a breather',
  body: 'Your book is still ready. The tiny chart can catch up later.',
  nextActionLabel: 'Keep reading',
  progressLabel: 'Not synced',
  progressValue: 0,
  sessionsLabel: '0 of 3 sessions',
})

export const getReadingPulseState = (
  summary: RetentionSummary | null,
): ReadingPulseViewState => {
  if (!summary) return readingPulseLoadingState()

  const sessions = Math.max(0, summary.sessionsThisWeek)
  const goal = Math.max(1, summary.weeklyGoal)
  const nudge = summary.nudgeCode

  return {
    tone: toneByNudge[nudge] ?? 'progress',
    title: titleByNudge[nudge] ?? 'Reading Pulse',
    body: bodyByNudge[nudge] ?? bodyByNudge.keep_going,
    nextActionLabel: sessions > 0 ? 'Read another bit' : 'Read one page',
    progressLabel: progressLabel(sessions, goal),
    progressValue: clampProgress(summary.goalProgressPct),
    sessionsLabel: sessionsLabel(sessions, goal),
  }
}

export const getReadingPulseCelebration = (
  previous: RetentionSummary | null,
  current: RetentionSummary | null,
  hasRecentSessionEvent: boolean,
): ReadingPulseCelebration | null => {
  if (!previous || !current || !hasRecentSessionEvent) return null

  const sessionsIncreased = current.sessionsThisWeek > previous.sessionsThisWeek
  if (!sessionsIncreased) return null

  if ((previous.daysSinceLastSession ?? 0) >= 14) {
    return {
      id: `comeback:${current.sessionsThisWeek}:${current.lastSessionAt ?? ''}`,
      title: 'Return win',
      body: 'Back in the story. The plot noticed, respectfully.',
    }
  }

  if (
    previous.sessionsThisWeek < previous.weeklyGoal &&
    current.sessionsThisWeek >= current.weeklyGoal
  ) {
    return {
      id: `goal-met:${current.sessionsThisWeek}:${current.weekStart ?? ''}`,
      title: 'Pulse complete',
      body: 'Three readings this week. Extremely legal wizardry.',
    }
  }

  return null
}
