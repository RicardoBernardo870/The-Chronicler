import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useReadingQuestStore } from '@/stores/readingQuest'
import { useReadingProfile } from '@/composables/useReadingProfile'
import { useReadingRecords } from '@/composables/useReadingRecords'
import { ACHIEVEMENTS, type AchievementContext } from '@/utils/achievements'
import type { AchievementView } from '@/types'

/**
 * Achievements — merges the client-side catalog (src/utils/achievements.ts)
 * with the insert-only `achievements` ledger. `sync()` loads everything the
 * conditions need (quest sources, lifetime stats, records — all SWR-cached),
 * then persists any newly-satisfied keys so their earned date is remembered
 * even if the underlying stat later regresses.
 */

// Module-level singletons — one earned-map per app session.
const _earned = ref<Record<string, string>>({}) // key → earned_at
const _earnedLoaded = ref(false)

export const useAchievements = () => {
  const authStore = useAuthStore()
  const questStore = useReadingQuestStore()
  const { longestStreak, fetchStats } = useReadingProfile()
  const { records, fetchRecords } = useReadingRecords()

  const ctx = computed((): AchievementContext => ({
    sources: questStore.summary?.sources ?? null,
    longestStreakDays: longestStreak.value,
    records: records.value,
  }))

  const list = computed((): AchievementView[] =>
    ACHIEVEMENTS.map((def) => {
      const earnedAt = _earned.value[def.key] ?? null
      return {
        key: def.key,
        title: def.title,
        description: def.description,
        icon: def.icon,
        earned: earnedAt !== null || def.isEarned(ctx.value),
        earnedAt,
      }
    }),
  )

  const earnedCount = computed(() => list.value.filter((a) => a.earned).length)
  const totalCount = ACHIEVEMENTS.length

  const fetchEarned = async (): Promise<void> => {
    if (_earnedLoaded.value) return
    if (!authStore.user) return

    const { data, error } = await supabase
      .from('achievements')
      .select('achievement_key, earned_at')
      .eq('user_id', authStore.user.id)
    if (error) throw error

    const map: Record<string, string> = {}
    for (const row of (data ?? []) as { achievement_key: string; earned_at: string }[]) {
      map[row.achievement_key] = row.earned_at
    }
    _earned.value = map
    _earnedLoaded.value = true
  }

  const sync = async (): Promise<void> => {
    await Promise.all([
      questStore.fetchQuestSummary().catch(() => {}),
      fetchStats().catch(() => {}),
      fetchRecords().catch(() => {}),
      fetchEarned().catch(() => {}),
    ])

    const user = authStore.user
    if (!user || !_earnedLoaded.value) return

    const newlyEarned = ACHIEVEMENTS.filter(
      (def) => !_earned.value[def.key] && def.isEarned(ctx.value),
    )
    if (newlyEarned.length === 0) return

    const now = new Date().toISOString()
    const { error } = await supabase.from('achievements').upsert(
      newlyEarned.map((def) => ({ user_id: user.id, achievement_key: def.key })),
      { onConflict: 'user_id,achievement_key', ignoreDuplicates: true },
    )
    if (error) {
      console.warn('[achievements] persist failed', error)
      return
    }
    const map = { ..._earned.value }
    newlyEarned.forEach((def) => { map[def.key] = now })
    _earned.value = map
  }

  return { list, earnedCount, totalCount, sync }
}
