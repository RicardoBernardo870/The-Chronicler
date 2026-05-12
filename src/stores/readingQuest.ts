import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  cacheKeys,
  invalidate,
  registerRevalidator,
  swrRun,
  swrStatus,
} from '@/composables/useCache'
import type {
  ReaderXpSummary,
  ReadingGoal,
  ReadingQuestResponse,
  ReadingQuestStatus,
  ReadingQuestSummary,
} from '@/types'

const TTL = 60_000

export const LEVEL_THRESHOLDS = [0, 1500, 4000, 8000, 14000, 22000, 34000] as const
export const LEVEL_TITLES = [
  'Page Turner',
  'Chapter Seeker',
  'Margin Walker',
  'Lore Keeper',
  'Archive Runner',
  'Chapter Sage',
  'Library Legend',
] as const

export const statusLabels: Record<ReadingQuestStatus, string> = {
  no_goal: 'Set your reading quest',
  no_projection: 'Pace warming up',
  ahead: 'Ahead of pace',
  on_track: 'On track',
  behind: 'A little behind',
  comeback: 'Comeback arc available',
  complete: 'Quest complete',
}

export interface QuestStatusInput {
  targetBooks: number | null
  completedBooks: number
  projectedBooks: number | null
  hasProjection: boolean
}

export const classifyQuestStatus = ({
  targetBooks,
  completedBooks,
  projectedBooks,
  hasProjection,
}: QuestStatusInput): ReadingQuestStatus => {
  if (!targetBooks) return 'no_goal'
  if (completedBooks >= targetBooks) return 'complete'
  if (!hasProjection || projectedBooks === null) return 'no_projection'
  if (projectedBooks >= targetBooks * 1.1) return 'ahead'
  if (projectedBooks >= targetBooks) return 'on_track'
  if (projectedBooks >= targetBooks * 0.75) return 'behind'
  return 'comeback'
}

export const computeLevel = (totalXp: number): ReaderXpSummary => {
  const safeXp = Math.max(0, Math.floor(totalXp))
  const index = LEVEL_THRESHOLDS.findIndex((threshold, i) => {
    const next = LEVEL_THRESHOLDS[i + 1]
    return safeXp >= threshold && (next === undefined || safeXp < next)
  })
  const levelIndex = index === -1 ? LEVEL_THRESHOLDS.length - 1 : index
  const currentFloor = LEVEL_THRESHOLDS[levelIndex]
  const nextThreshold = LEVEL_THRESHOLDS[levelIndex + 1] ?? null
  const currentLevelXp = safeXp - currentFloor
  const nextLevelXp = nextThreshold === null ? 0 : nextThreshold - currentFloor
  const xpToNextLevel = nextThreshold === null ? 0 : Math.max(0, nextThreshold - safeXp)
  const progressPercent = nextThreshold === null
    ? 100
    : Math.round((currentLevelXp / nextLevelXp) * 1000) / 10

  return {
    level: levelIndex,
    title: LEVEL_TITLES[levelIndex],
    totalXp: safeXp,
    currentLevelXp,
    nextLevelXp,
    xpToNextLevel,
    progressPercent,
  }
}

export const mapQuestResponse = (response: ReadingQuestResponse): ReadingQuestResponse => {
  const status = classifyQuestStatus(response.quest)
  return {
    ...response,
    quest: {
      ...response.quest,
      status,
      statusLabel: statusLabels[status],
    },
    level: computeLevel(response.level.totalXp),
  }
}

export const useReadingQuestStore = defineStore('readingQuest', () => {
  const summary = ref<ReadingQuestResponse | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const currentYear = computed(() => new Date().getFullYear())
  const goal = computed<ReadingGoal | null>(() => summary.value?.goal ?? null)
  const quest = computed<ReadingQuestSummary | null>(() => summary.value?.quest ?? null)

  const keyFor = (uid: string, year: number) => `${cacheKeys.readingQuest(uid)}:${year}`

  const fetchQuestSummary = async (year = currentYear.value): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = keyFor(authStore.user.id, year)
    const fetcher = async () => {
      error.value = null
      const { data, error: rpcError } = await supabase.rpc('get_reading_quest_summary', {
        p_user_id: authStore.user!.id,
        p_year: year,
      })
      if (rpcError) throw rpcError
      summary.value = mapQuestResponse(data as ReadingQuestResponse)
    }

    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))
    const status = swrStatus(key, TTL)
    if (status === 'fresh') return
    if (status === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return
    }

    loading.value = true
    try {
      await swrRun(key, fetcher)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Reading quest could not be loaded.'
    } finally {
      loading.value = false
    }
  }

  const saveGoal = async (targetBooks: number, year = currentYear.value): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    const target = Math.floor(targetBooks)
    if (!Number.isFinite(target) || target < 1) {
      error.value = 'Choose at least 1 book for your yearly goal.'
      throw new Error(error.value)
    }

    saving.value = true
    error.value = null
    try {
      const { error: saveError } = await supabase
        .from('reading_goals')
        .upsert(
          { user_id: authStore.user.id, year, target_books: target },
          { onConflict: 'user_id,year' },
        )
      if (saveError) throw saveError

      invalidate(cacheKeys.readingQuest(authStore.user.id), { prefix: true })
      await fetchQuestSummary(year)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Reading goal could not be saved.'
      throw e
    } finally {
      saving.value = false
    }
  }

  return {
    summary,
    loading,
    saving,
    error,
    currentYear,
    goal,
    quest,
    fetchQuestSummary,
    saveGoal,
  }
})
