<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useBookQuiz } from '@/composables/useBookQuiz'
import { useRecapsStore } from '@/stores/recaps'
import type { BookQuiz } from '@/types'

// Memory Check quiz dialog (035). Two modes:
//  - 'session': shown by SessionStartButton in the "Previously" slot when the
//    reader has been away 2+ days. Opens on an intro step (Quiz me / Skip) so
//    the AI call is only spent when the reader opts in. The session timer
//    starts only when the parent receives `begin` — dismissing the dialog any
//    other way aborts the session start entirely, same as the resume dialog.
//  - 'ondemand': opened from the Book Detail "Memory check" chip. No intro,
//    no session — closes with Done.
const props = defineProps<{
  bookId: string
  visible: boolean
  mode: 'session' | 'ondemand'
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  begin: []
}>()

const router = useRouter()
const recapsStore = useRecapsStore()
const bookQuiz = useBookQuiz(props.bookId)

type Step = 'intro' | 'loading' | 'question' | 'summary' | 'empty' | 'error'
const step = ref<Step>('intro')

const activeQuiz = ref<BookQuiz | null>(null)
const qIndex = ref(0)
const answers = ref<(number | null)[]>([])

const questions = computed(() => activeQuiz.value?.questions ?? [])
const question = computed(() => questions.value[qIndex.value] ?? null)
const picked = computed(() => answers.value[qIndex.value] ?? null)
const isLastQuestion = computed(() => qIndex.value >= questions.value.length - 1)
const score = computed(
  () => questions.value.filter((q, i) => answers.value[i] === q.correctIndex).length,
)

const hasRecap = computed(() => Boolean(recapsStore.latestRecapForBook(props.bookId)))

const awayLabel = computed(() => {
  const days = bookQuiz.awayDays.value
  if (days === null || days < 2) return 'It has been a little while'
  return `It's been ${days} days`
})

const startQuiz = async (): Promise<void> => {
  step.value = 'loading'
  try {
    await bookQuiz.prepare()
    if (!bookQuiz.hasMaterial.value) {
      step.value = 'empty'
      return
    }
    const quiz = await bookQuiz.loadOrGenerate()
    if (!quiz || quiz.questions.length === 0) {
      step.value = 'error'
      return
    }
    activeQuiz.value = quiz
    qIndex.value = 0
    answers.value = quiz.questions.map(() => null)
    step.value = 'question'
  } catch {
    step.value = 'error'
  }
}

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    activeQuiz.value = null
    qIndex.value = 0
    answers.value = []
    if (props.mode === 'session') step.value = 'intro'
    else void startQuiz()
  },
  { immediate: true },
)

const pick = (optionIndex: number): void => {
  if (picked.value !== null) return
  answers.value[qIndex.value] = optionIndex
}

const next = (): void => {
  if (isLastQuestion.value) {
    void bookQuiz.saveScore(score.value)
    step.value = 'summary'
    return
  }
  qIndex.value += 1
}

const begin = (): void => {
  emit('update:visible', false)
  emit('begin')
}

const close = (): void => {
  emit('update:visible', false)
}

const viewRecaps = async (): Promise<void> => {
  emit('update:visible', false)
  await router.push({ name: 'recap-history', params: { id: props.bookId } })
}

const optionClass = (optionIndex: number): Record<string, boolean> => {
  const answered = picked.value !== null
  const correct = question.value?.correctIndex === optionIndex
  return {
    'memory-check__option--correct': answered && correct,
    'memory-check__option--wrong': answered && picked.value === optionIndex && !correct,
    'memory-check__option--faded': answered && picked.value !== optionIndex && !correct,
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :dismissable-mask="true"
    :draggable="false"
    :style="{ width: '92vw', maxWidth: '480px' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <template #header>
      <div class="memory-check__header">
        <i class="pi pi-bolt" aria-hidden="true" />
        <span class="memory-check__title">Memory check</span>
        <span v-if="step === 'question'" class="memory-check__pill">
          {{ qIndex + 1 }} of {{ questions.length }}
        </span>
      </div>
    </template>

    <!-- Intro (session mode only) -->
    <div v-if="step === 'intro'" class="memory-check__body">
      <p class="memory-check__lede">
        {{ awayLabel }} since page {{ bookQuiz.currentPage.value }}.
        A few quick questions before you dive back in?
      </p>
    </div>

    <!-- Loading -->
    <div v-else-if="step === 'loading'" class="memory-check__body memory-check__center">
      <i class="pi pi-spin pi-spinner memory-check__spinner" aria-hidden="true" />
      <p class="memory-check__muted">Building your quiz from your captured pages…</p>
    </div>

    <!-- Question -->
    <div v-else-if="step === 'question' && question" class="memory-check__body">
      <p class="memory-check__question">{{ question.question }}</p>
      <div class="memory-check__options">
        <button
          v-for="(option, i) in question.options"
          :key="i"
          type="button"
          class="memory-check__option"
          :class="optionClass(i)"
          :disabled="picked !== null"
          @click="pick(i)"
        >
          <i
            v-if="picked !== null && i === question.correctIndex"
            class="pi pi-check"
            aria-hidden="true"
          />
          <i
            v-else-if="picked === i && i !== question.correctIndex"
            class="pi pi-times"
            aria-hidden="true"
          />
          <span>{{ option }}</span>
        </button>
      </div>
      <p
        v-if="picked !== null && question.sourcePage !== null"
        class="memory-check__source"
      >
        <i class="pi pi-camera" aria-hidden="true" />
        From your capture · page {{ question.sourcePage }}
      </p>
    </div>

    <!-- Summary -->
    <div v-else-if="step === 'summary'" class="memory-check__body">
      <div class="memory-check__score">
        <span class="memory-check__score-value">{{ score }} / {{ questions.length }}</span>
        <span class="memory-check__muted">
          {{ score === questions.length ? 'Perfect recall' : score > 0 ? 'Solid recall' : 'It happens — memory fades' }}
        </span>
      </div>
      <ul class="memory-check__recap-list">
        <li v-for="(q, i) in questions" :key="i">
          <i
            :class="`pi ${answers[i] === q.correctIndex ? 'pi-check memory-check__ok' : 'pi-times memory-check__miss'}`"
            aria-hidden="true"
          />
          {{ q.question }}
        </li>
      </ul>
      <button
        v-if="hasRecap && score < questions.length"
        type="button"
        class="memory-check__recap-link"
        @click="viewRecaps"
      >
        Feeling hazy? Read the full recap
      </button>
    </div>

    <!-- No captures yet (on-demand entry only) -->
    <div v-else-if="step === 'empty'" class="memory-check__body memory-check__center">
      <i class="pi pi-camera memory-check__spinner" aria-hidden="true" />
      <p class="memory-check__muted">
        Quizzes are built from your page captures. Capture a page at the end of a
        session and the memory check unlocks.
      </p>
    </div>

    <!-- Generation failed -->
    <div v-else-if="step === 'error'" class="memory-check__body memory-check__center">
      <p class="memory-check__muted">Couldn't build a quiz this time.</p>
    </div>

    <template #footer>
      <div class="memory-check__footer">
        <!-- Intro: opt in or skip straight to reading -->
        <template v-if="step === 'intro'">
          <Button label="Skip to reading" text @click="begin" />
          <Button label="Quiz me" icon="pi pi-bolt" @click="startQuiz" />
        </template>

        <!-- Question: advance once answered -->
        <template v-else-if="step === 'question'">
          <span class="memory-check__hint">
            {{ mode === 'session' ? 'Your timer starts once you begin.' : '' }}
          </span>
          <Button
            :label="isLastQuestion ? 'See results' : 'Next question'"
            :disabled="picked === null"
            @click="next"
          />
        </template>

        <!-- Summary / empty / error -->
        <template v-else-if="step !== 'loading'">
          <span class="memory-check__hint">
            {{ mode === 'session' ? 'Your timer starts once you begin.' : '' }}
          </span>
          <Button
            v-if="mode === 'session'"
            label="Begin reading"
            icon="pi pi-play"
            @click="begin"
          />
          <Button v-else label="Done" @click="close" />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.memory-check__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.memory-check__header .pi {
  color: var(--p-indigo-300);
  font-size: 0.9rem;
}

.memory-check__title {
  font-size: 1rem;
  font-weight: 600;
}

.memory-check__pill {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.18);
  color: var(--p-indigo-300);
  white-space: nowrap;
}

.memory-check__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.memory-check__center {
  align-items: center;
  text-align: center;
  padding: 0.75rem 0;
}

.memory-check__spinner {
  font-size: 1.4rem;
  color: var(--p-indigo-300);
}

.memory-check__lede {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.55;
}

.memory-check__muted {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.7;
  line-height: 1.5;
}

.memory-check__question {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.5;
}

.memory-check__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.memory-check__option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 0.8rem;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: var(--p-border-radius-lg, 12px);
  background: rgba(99, 102, 241, 0.08);
  color: inherit;
  font: inherit;
  font-size: 0.88rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
}

.memory-check__option:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.16);
}

.memory-check__option:disabled {
  cursor: default;
}

.memory-check__option .pi {
  flex: none;
  font-size: 0.8rem;
}

.memory-check__option--correct {
  border-color: rgba(52, 211, 153, 0.6);
  background: rgba(52, 211, 153, 0.14);
}

.memory-check__option--correct .pi {
  color: var(--p-green-400, #34d399);
}

.memory-check__option--wrong {
  border-color: rgba(248, 113, 113, 0.6);
  background: rgba(248, 113, 113, 0.12);
}

.memory-check__option--wrong .pi {
  color: var(--p-red-400);
}

.memory-check__option--faded {
  opacity: 0.55;
}

.memory-check__source {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.memory-check__score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.25rem 0;
}

.memory-check__score-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--p-indigo-300);
}

.memory-check__recap-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  line-height: 1.5;
}

.memory-check__recap-list .pi {
  font-size: 0.75rem;
  margin-right: 0.35rem;
}

.memory-check__ok {
  color: var(--p-green-400, #34d399);
}

.memory-check__miss {
  color: var(--p-red-400);
}

.memory-check__recap-link {
  align-self: flex-start;
  padding: 0;
  border: none;
  background: none;
  color: var(--p-indigo-300);
  font: inherit;
  font-size: 0.82rem;
  text-decoration: underline;
  cursor: pointer;
}

.memory-check__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.memory-check__hint {
  font-size: 0.72rem;
  opacity: 0.55;
  text-align: left;
}

[data-p-theme='light'] .memory-check__pill,
[data-p-theme='light'] .memory-check__header .pi,
[data-p-theme='light'] .memory-check__score-value,
[data-p-theme='light'] .memory-check__recap-link,
[data-p-theme='light'] .memory-check__spinner {
  color: var(--p-primary-700, #4338ca);
}
</style>
