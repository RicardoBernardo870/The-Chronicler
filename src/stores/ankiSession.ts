import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { diffInDays } from '@/utils/date'

const REVIEW_INTERVAL_DAYS = 3

export const useAnkiSessionStore = defineStore('ankiSession', () => {
  const lastReviewedAt = ref<string | null>(null)
  const totalSessions = ref(0)
  const knownCount = ref(0)
  const unknownCount = ref(0)
  const _loaded = ref(false)

  const isDueForReview = computed(() => {
    if (!_loaded.value) return false
    if (lastReviewedAt.value === null) return true
    return diffInDays(new Date(), lastReviewedAt.value) >= REVIEW_INTERVAL_DAYS
  })

  const fetchSession = async (userId: string) => {
    const { data, error } = await supabase
      .from('anki_review_sessions')
      .select('last_reviewed_at, total_sessions, known_count, unknown_count')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      _loaded.value = true
      return
    }

    if (data) {
      lastReviewedAt.value = data.last_reviewed_at
      totalSessions.value = data.total_sessions
      knownCount.value = data.known_count
      unknownCount.value = data.unknown_count
    } else {
      lastReviewedAt.value = null
      totalSessions.value = 0
      knownCount.value = 0
      unknownCount.value = 0
    }
    _loaded.value = true
  }

  const saveSession = async (userId: string, known: number, unknown: number) => {
    const now = new Date().toISOString()
    const newTotal = totalSessions.value + 1
    const newKnown = knownCount.value + known
    const newUnknown = unknownCount.value + unknown

    const { error } = await supabase
      .from('anki_review_sessions')
      .upsert({
        user_id: userId,
        last_reviewed_at: now,
        total_sessions: newTotal,
        known_count: newKnown,
        unknown_count: newUnknown,
      }, { onConflict: 'user_id' })

    if (!error) {
      lastReviewedAt.value = now
      totalSessions.value = newTotal
      knownCount.value = newKnown
      unknownCount.value = newUnknown
    }
  }

  return {
    lastReviewedAt,
    totalSessions,
    knownCount,
    unknownCount,
    isDueForReview,
    fetchSession,
    saveSession,
  }
})
