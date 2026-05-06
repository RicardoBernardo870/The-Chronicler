import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { LexiconEntry } from '@/types'
import { useLexiconStore } from '@/stores/lexicon'
import { useAnkiSessionStore } from '@/stores/ankiSession'

const TODAY = () => new Date().toISOString().slice(0, 10)

export const useAnkiSession = (entries: ComputedRef<LexiconEntry[]>) => {
  const lexiconStore = useLexiconStore()
  const ankiSessionStore = useAnkiSessionStore()

  const dueCards = computed(() =>
    [...entries.value]
      .filter(e => e.nextReviewAt <= TODAY())
      .sort((a, b) => a.leitnerBox - b.leitnerBox)
      .slice(0, 20),
  )

  const currentIndex = ref(0)
  const sessionKnown = ref(0)
  const sessionUnknown = ref(0)

  const currentCard = computed(() => dueCards.value[currentIndex.value] ?? null)
  const isComplete = computed(() => currentIndex.value >= dueCards.value.length)

  const onKnew = async () => {
    const card = currentCard.value
    if (!card) return
    await lexiconStore.updateLeitner(card.id, 'advance')
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
    onExit,
  }
}
