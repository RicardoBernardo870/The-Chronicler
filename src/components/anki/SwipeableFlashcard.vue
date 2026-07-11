<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSwipe } from '@vueuse/core'
import type { LexiconEntry } from '@/types'
import Button from 'primevue/button'

const props = defineProps<{
  entry: LexiconEntry
  bookTitle: string
}>()

const emit = defineEmits<{ known: []; unknown: [] }>()

const cardRef = ref<HTMLElement | null>(null)
const isFlipped = ref(false)
const exiting = ref<'known' | 'unknown' | null>(null)

const { lengthX, isSwiping } = useSwipe(cardRef, {
  threshold: 60,
  onSwipeEnd(_, direction) {
    if (!isFlipped.value) return
    if (direction === 'left' && Math.abs(lengthX.value) > 80) triggerExit('unknown')
    else if (direction === 'right' && Math.abs(lengthX.value) > 80) triggerExit('known')
  },
})

const dragStyle = computed(() => {
  if (!isSwiping.value || exiting.value) return {}
  const x = -lengthX.value
  return {
    transform: `translateX(${x}px) rotate(${x * 0.04}deg)`,
    transition: 'none',
  }
})

const exitStyle = computed(() => {
  if (exiting.value === 'known') return { transform: 'translateX(120%) rotate(20deg)', opacity: '0', transition: 'transform 0.22s ease, opacity 0.22s ease' }
  if (exiting.value === 'unknown') return { transform: 'translateX(-120%) rotate(-20deg)', opacity: '0', transition: 'transform 0.22s ease, opacity 0.22s ease' }
  return {}
})

const cardStyle = computed(() => ({ ...dragStyle.value, ...exitStyle.value }))

const triggerExit = (result: 'known' | 'unknown') => {
  exiting.value = result
  setTimeout(() => {
    if (result === 'known') emit('known')
    else emit('unknown')
  }, 230)
}

const flipCard = () => {
  if (!exiting.value) isFlipped.value = !isFlipped.value
}

// Pronunciation — built-in speech synthesis (offline, system voices).
// The utterance language is pinned to English: without it the engine uses the
// device locale (e.g. pt-BR) and mangles the accent. Voices load async on
// some browsers, so getVoices() is warmed at setup and re-read at speak time.
const SPEECH_LANG = 'en-US'
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
if (canSpeak) window.speechSynthesis.getVoices()

const pickVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === SPEECH_LANG) ??
    voices.find((v) => v.lang.replace('_', '-').startsWith('en')) ??
    null
  )
}

const speak = () => {
  if (!canSpeak) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(props.entry.term)
  utterance.lang = SPEECH_LANG
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}
</script>

<template>
  <div class="sfc-container">
    <div
      ref="cardRef"
      class="sfc-wrap"
      :style="cardStyle"
      @click="flipCard"
    >
      <div class="sfc-inner" :class="{ 'sfc-inner--flipped': isFlipped }">
        <!-- Front -->
        <div class="sfc-face sfc-front glass-surface">
          <p class="sfc-term">
            {{ entry.term }}
            <button
              v-if="canSpeak"
              type="button"
              class="sfc-speak"
              aria-label="Pronounce this word"
              @click.stop="speak"
            >
              <i class="pi pi-volume-up" aria-hidden="true" />
            </button>
          </p>
          <p class="sfc-hint">tap to reveal</p>
        </div>

        <!-- Back -->
        <div class="sfc-face sfc-back glass-surface" @click.stop="flipCard">
          <p class="sfc-definition">{{ entry.definition }}</p>
          <p v-if="entry.contextSentence" class="sfc-context">"{{ entry.contextSentence }}"</p>
          <p class="sfc-source">
            <em>{{ bookTitle }}</em>
            <span v-if="entry.pageFound"> · p.{{ entry.pageFound }}</span>
          </p>
        </div>
      </div>
    </div>

    <Transition name="sfc-actions">
      <div v-if="isFlipped && !exiting" class="sfc-actions">
        <Button
          label="Didn't know"
          severity="danger"
          outlined
          size="small"
          @click="triggerExit('unknown')"
        />
        <Button
          label="Knew it"
          severity="success"
          outlined
          size="small"
          @click="triggerExit('known')"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.sfc-speak {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  margin-left: 0.3rem;
  padding: 0;
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.12);
  color: var(--p-indigo-300);
  font-size: 0.8rem;
  cursor: pointer;
  vertical-align: middle;
}

.sfc-speak:focus-visible {
  outline: 2px solid var(--p-indigo-300);
  outline-offset: 2px;
}

.sfc-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
}

.sfc-wrap {
  perspective: 900px;
  width: 100%;
  cursor: pointer;
  will-change: transform;
}

.sfc-inner {
  /* Grid-stacked faces: the card grows to fit the taller face instead of
     clipping long definitions inside a fixed-height absolute stack. */
  display: grid;
  width: 100%;
  transform-style: preserve-3d;
  transition: transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.sfc-inner--flipped {
  transform: rotateY(180deg);
}

.sfc-face {
  grid-area: 1 / 1;
  width: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  padding: 1.5rem 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.75rem;
  min-height: 200px;
  max-height: 62vh;
  overflow-y: auto;
  overflow-wrap: anywhere;
}

.sfc-back {
  transform: rotateY(180deg);
}

.sfc-term {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-align: center;
}

.sfc-hint {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.35;
  font-style: italic;
  text-align: center;
}

.sfc-definition {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
}

.sfc-context {
  margin: 0;
  font-size: 0.82rem;
  font-style: italic;
  opacity: 0.65;
  line-height: 1.45;
  border-left: 2px solid rgba(99, 102, 241, 0.4);
  padding-left: 0.6rem;
}

.sfc-source {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.45;
  margin-top: auto;
}

.sfc-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
  justify-content: center;
}

.sfc-actions-enter-active,
.sfc-actions-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.sfc-actions-enter-from,
.sfc-actions-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .sfc-wrap,
  .sfc-inner,
  .sfc-actions-enter-active,
  .sfc-actions-leave-active {
    transition: none;
  }
}
</style>
