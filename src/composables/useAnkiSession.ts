import { ref, computed, watch } from 'vue'
import type { LexiconEntry } from '@/types'
import { useLexiconStore } from '@/stores/lexicon'
import { useAnkiSessionStore } from '@/stores/ankiSession'

export const useAnkiSession = () => {
  const lexiconStore = useLexiconStore()
  const ankiSessionStore = useAnkiSessionStore()

  // 032 — draw from the shared, daily-capped today's-set; 031 — order later
  // (higher) boxes first so recall/graduation concentrate on mature words.
  const buildDeck = (): LexiconEntry[] =>
    [...lexiconStore.activeReviewWords].sort((a, b) => b.leitnerBox - a.leitnerBox).slice(0, 20)

  // Snapshot the deck so answering a card (which removes it from the live set)
  // does not shift the remaining cards mid-session.
  const dueCards = ref<LexiconEntry[]>(buildDeck())
  const currentIndex = ref(0)
  const sessionKnown = ref(0)
  const sessionUnknown = ref(0)

  // Keep the deck fresh until the session actually starts (e.g. entries load
  // async); freeze it once the reader begins answering.
  watch(
    () => lexiconStore.activeReviewWords,
    () => {
      if (currentIndex.value === 0 && sessionKnown.value === 0 && sessionUnknown.value === 0) {
        dueCards.value = buildDeck()
      }
    },
  )

  const currentCard = computed(() => dueCards.value[currentIndex.value] ?? null)
  const isComplete = computed(() => currentIndex.value >= dueCards.value.length)

  // 031 — "Knew it" masters the word (terminal), regardless of its box.
  const onKnew = async () => {
    const card = currentCard.value
    if (!card) return
    await lexiconStore.masterWord(card.id)
    sessionKnown.value++
    currentIndex.value++
  }

  const onDidntKnow = async () => {
    const card = currentCard.value
    if (!card) return
    await lexiconStore.updateLeitner(card.id, 'reset')
    sessionUnknown.value++
    currentIndex.value++
  }

  // 032 — "review more": lift the daily cap and start a fresh deck of the next words.
  const reviewMore = () => {
    lexiconStore.enableReviewMore()
    dueCards.value = buildDeck()
    currentIndex.value = 0
    sessionKnown.value = 0
    sessionUnknown.value = 0
  }

  const onExit = async (userId: string) => {
    if (sessionKnown.value + sessionUnknown.value >= 1) {
      await ankiSessionStore.saveSession(userId, sessionKnown.value, sessionUnknown.value)
    }
  }

  return {
    dueCards,
    currentCard,
    currentIndex,
    sessionKnown,
    sessionUnknown,
    isComplete,
    onKnew,
    onDidntKnow,
    reviewMore,
    onExit,
  }
}
