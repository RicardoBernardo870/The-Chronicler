import { describe, expect, it } from 'vitest'
import {
  classifyQuestStatus,
  computeLevel,
  mapQuestResponse,
} from '@/stores/readingQuest'
import type { ReadingQuestResponse } from '@/types'

describe('reading quest status', () => {
  it('classifies no goal, complete, and low-history states', () => {
    expect(classifyQuestStatus({
      targetBooks: null,
      completedBooks: 0,
      projectedBooks: null,
      hasProjection: false,
    })).toBe('no_goal')

    expect(classifyQuestStatus({
      targetBooks: 12,
      completedBooks: 12,
      projectedBooks: 12,
      hasProjection: true,
    })).toBe('complete')

    expect(classifyQuestStatus({
      targetBooks: 12,
      completedBooks: 0,
      projectedBooks: null,
      hasProjection: false,
    })).toBe('no_projection')
  })

  it('classifies projected pace bands', () => {
    expect(classifyQuestStatus({
      targetBooks: 20,
      completedBooks: 3,
      projectedBooks: 23,
      hasProjection: true,
    })).toBe('ahead')

    expect(classifyQuestStatus({
      targetBooks: 20,
      completedBooks: 3,
      projectedBooks: 20,
      hasProjection: true,
    })).toBe('on_track')

    expect(classifyQuestStatus({
      targetBooks: 20,
      completedBooks: 3,
      projectedBooks: 16,
      hasProjection: true,
    })).toBe('behind')

    expect(classifyQuestStatus({
      targetBooks: 20,
      completedBooks: 3,
      projectedBooks: 10,
      hasProjection: true,
    })).toBe('comeback')
  })
})

describe('reader level helper', () => {
  it('calculates deterministic level progress', () => {
    expect(computeLevel(0)).toMatchObject({
      level: 0,
      title: 'Page Turner',
      totalXp: 0,
      currentLevelXp: 0,
      nextLevelXp: 1500,
      xpToNextLevel: 1500,
      progressPercent: 0,
    })

    expect(computeLevel(1500)).toMatchObject({
      level: 1,
      title: 'Chapter Seeker',
      currentLevelXp: 0,
      nextLevelXp: 2500,
      xpToNextLevel: 2500,
    })

    expect(computeLevel(2480)).toMatchObject({
      level: 1,
      title: 'Chapter Seeker',
      currentLevelXp: 980,
      nextLevelXp: 2500,
      xpToNextLevel: 1520,
      progressPercent: 39.2,
    })
  })

  it('caps at Library Legend', () => {
    expect(computeLevel(34000)).toMatchObject({
      level: 6,
      title: 'Library Legend',
      xpToNextLevel: 0,
      progressPercent: 100,
    })
  })
})

describe('reading quest response mapping', () => {
  it('normalizes status labels and recomputes level from XP', () => {
    const response: ReadingQuestResponse = {
      goal: {
        id: 'goal-1',
        userId: 'user-1',
        year: 2026,
        targetBooks: 24,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      quest: {
        year: 2026,
        targetBooks: 24,
        completedBooks: 4,
        progressPercent: 16.7,
        requiredBooksPerMonth: 2,
        currentBooksPerMonth: 1.4,
        projectedBooks: 17,
        hasProjection: true,
        status: 'on_track',
        statusLabel: 'On track',
      },
      level: {
        level: 1,
        title: 'Page Turner',
        totalXp: 2480,
        currentLevelXp: 0,
        nextLevelXp: 0,
        xpToNextLevel: 0,
        progressPercent: 0,
      },
      sources: {
        pagesRead: 1200,
        completedBooks: 4,
        readingSessions: 80,
        pageCaptures: 12,
        recapsGenerated: 6,
        loreCardsUnlocked: 4,
      },
    }

    expect(mapQuestResponse(response).quest).toMatchObject({
      status: 'comeback',
      statusLabel: 'Comeback arc available',
    })
    expect(mapQuestResponse(response).level).toMatchObject({
      level: 1,
      title: 'Chapter Seeker',
      totalXp: 2480,
    })
  })
})
