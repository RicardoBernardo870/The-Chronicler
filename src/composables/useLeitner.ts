import type { LexiconEntry } from '@/types'

// Days between reviews per box (box 1 → 5)
const INTERVALS = [1, 2, 4, 8, 16]

const todayStr = () => new Date().toISOString().split('T')[0]

const addDays = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export const useLeitner = () => {
  const advanceBox = (entry: LexiconEntry): { leitnerBox: number; nextReviewAt: string } => {
    const newBox = Math.min(entry.leitnerBox + 1, 5)
    return { leitnerBox: newBox, nextReviewAt: addDays(INTERVALS[newBox - 1]) }
  }

  const resetBox = (_entry: LexiconEntry): { leitnerBox: number; nextReviewAt: string } => ({
    leitnerBox: 1,
    nextReviewAt: todayStr(),
  })

  const getDueWord = (entries: LexiconEntry[]): LexiconEntry | null => {
    const today = todayStr()
    const due = entries.filter(e => e.nextReviewAt <= today)
    if (!due.length) return null
    return due.sort((a, b) =>
      a.leitnerBox - b.leitnerBox || a.nextReviewAt.localeCompare(b.nextReviewAt)
    )[0]
  }

  return { advanceBox, resetBox, getDueWord }
}
