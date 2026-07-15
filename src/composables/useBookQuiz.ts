import { computed, reactive, toValue, type Ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCapturesStore } from '@/stores/captures'
import { useProgressStore } from '@/stores/progress'
import { useRecapsStore } from '@/stores/recaps'
import { mapBookQuiz, type BookQuiz, type BookQuizRow } from '@/types'

/**
 * Memory Check quiz (035) — data + eligibility.
 *
 * Exactly two entry points show a quiz:
 *  1. Session start, when the reader has been away from THIS book for 2+
 *     days (last progress_history save) — offered in the "Previously" slot
 *     instead of the passive resume bullets.
 *  2. The "Memory check" chip on Book Detail — on demand, any time.
 *
 * Grounding contract mirrors the session resume: questions come ONLY from
 * the reader's own page captures (+ latest recap memory jogger passed
 * strictly for name continuity). No captures → no quiz, silently.
 *
 * Caching: one row per (user, book), reused while pageSnapshot covers the
 * reader's position — start → cancel → start never re-bills an AI call. A
 * new quiz is generated (upserted) only once the reader has read past the
 * cached one's snapshot.
 */

export const AWAY_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000 // 2 days
const MAX_QUIZ_CAPTURES = 6

// Module-level cache so SessionStartButton and the Book Detail dialog share
// one fetch per book (same singleton pattern as useGreatLibrarySearch).
const quizByBook = reactive<Record<string, BookQuiz | null>>({})

export const useBookQuiz = (bookId: Ref<string> | string) => {
  const authStore = useAuthStore()
  const capturesStore = useCapturesStore()
  const progressStore = useProgressStore()
  const recapsStore = useRecapsStore()

  const id = computed(() => toValue(bookId))

  const quiz = computed((): BookQuiz | null => quizByBook[id.value] ?? null)

  const currentPage = computed(
    () => progressStore.progressForBook(id.value)?.currentPage ?? 0,
  )

  const quizCoversPosition = computed(() => {
    const q = quiz.value
    return q !== null && q.pageSnapshot >= currentPage.value
  })

  const usableCaptures = computed(() =>
    capturesStore.capturesForBook(id.value).filter((c) => c.text?.trim()),
  )

  const hasMaterial = computed(() => usableCaptures.value.length > 0)

  // Whole days since the last real page save (progress_history), or null
  // when the book has never had one.
  const awayDays = computed((): number | null => {
    const last = progressStore.lastPageSavedAt[id.value]
    if (!last) return null
    const ms = Date.now() - new Date(last).getTime()
    return ms >= 0 ? Math.floor(ms / (24 * 60 * 60 * 1000)) : null
  })

  const awayLongEnough = computed(() => {
    const last = progressStore.lastPageSavedAt[id.value]
    if (!last) return false
    return Date.now() - new Date(last).getTime() >= AWAY_THRESHOLD_MS
  })

  // Same suppression rule as the session resume: a recap generated at (or
  // past) the reader's position IS this session's warm-up.
  const suppressedByFreshRecap = computed(() => {
    const recap = recapsStore.latestRecapForBook(id.value)
    if (!recap) return false
    return (recap.pageSnapshot ?? 0) >= currentPage.value
  })

  // Session-start trigger: away 2+ days, material exists, no fresh recap,
  // and the reader hasn't already answered a quiz covering this position
  // (recall already proven — don't nag).
  const sessionPromptEligible = computed(
    () =>
      awayLongEnough.value &&
      hasMaterial.value &&
      !suppressedByFreshRecap.value &&
      !(quizCoversPosition.value && quiz.value?.answeredAt),
  )

  const fetchQuiz = async (): Promise<void> => {
    if (id.value in quizByBook) return
    if (!authStore.user) return

    const { data, error } = await supabase
      .from('book_quizzes')
      .select('id, user_id, book_id, page_snapshot, questions, score, answered_at, generated_at')
      .eq('book_id', id.value)
      .maybeSingle()
    if (error) throw error

    quizByBook[id.value] = data ? mapBookQuiz(data as BookQuizRow) : null
  }

  // Everything the eligibility check and the dialog need, in one await.
  // All reads are cached (stores dedupe), so repeat Start clicks are free.
  const prepare = async (): Promise<void> => {
    await Promise.all([
      capturesStore.fetchCapturesForBook(id.value).catch(() => {}),
      recapsStore.fetchRecapsForBook(id.value).catch(() => {}),
      progressStore.fetchLastPageSavedAt(id.value).catch(() => {}),
      fetchQuiz().catch(() => {}),
    ])
  }

  const generate = async (): Promise<BookQuiz | null> => {
    if (!authStore.user) return null

    const captures = usableCaptures.value
      .slice(-MAX_QUIZ_CAPTURES)
      .map((c) => ({ page: c.page, text: c.text }))
    if (captures.length === 0) return null

    const recapContext = recapsStore.latestRecapForBook(id.value)?.memoryJogger?.trim()

    const { data, error } = await supabase.functions.invoke('generate-book-quiz', {
      body: {
        captures,
        recapContext: recapContext ? recapContext : undefined,
      },
    })
    if (error) throw error

    const questions = data?.quiz?.questions
    if (!Array.isArray(questions) || questions.length === 0) return null

    const { data: row, error: upsertErr } = await supabase
      .from('book_quizzes')
      .upsert(
        {
          user_id: authStore.user.id,
          book_id: id.value,
          page_snapshot: currentPage.value,
          questions,
          score: null,
          answered_at: null,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,book_id' },
      )
      .select('id, user_id, book_id, page_snapshot, questions, score, answered_at, generated_at')
      .single()
    if (upsertErr) throw upsertErr

    const mapped = mapBookQuiz(row as BookQuizRow)
    quizByBook[id.value] = mapped
    return mapped
  }

  // Cached quiz while it covers the reader's position (retakes allowed);
  // otherwise generate a fresh one from the newest captures.
  const loadOrGenerate = async (): Promise<BookQuiz | null> => {
    await fetchQuiz().catch(() => {})
    if (quizCoversPosition.value) return quiz.value
    return generate()
  }

  const saveScore = async (score: number): Promise<void> => {
    const q = quiz.value
    if (!q || !authStore.user) return

    const answeredAt = new Date().toISOString()
    quizByBook[id.value] = { ...q, score, answeredAt }

    const { error } = await supabase
      .from('book_quizzes')
      .update({ score, answered_at: answeredAt })
      .match({ id: q.id, user_id: authStore.user.id })
    if (error) console.warn('[book-quiz] saveScore failed', error)
  }

  return {
    quiz,
    hasMaterial,
    awayDays,
    currentPage,
    sessionPromptEligible,
    prepare,
    loadOrGenerate,
    saveScore,
  }
}
