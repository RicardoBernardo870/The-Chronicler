<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'

const props = defineProps<{
  imageSrc: string
  initialText: string
  confidence: number
}>()

const emit = defineEmits<{
  confirm: [text: string]
  cancelRetake: []
}>()

const MAX_CHARS = 10_000
const LOW_CONFIDENCE_THRESHOLD = 0.7

const text = ref(props.initialText.slice(0, MAX_CHARS))
let previousBodyOverflow = ''

const charsUsed = computed(() => text.value.length)
const charsRemaining = computed(() => MAX_CHARS - charsUsed.value)
const showLowConfidence = computed(() => props.confidence < LOW_CONFIDENCE_THRESHOLD)
const canConfirm = computed(() => text.value.trim().length > 0 && charsUsed.value <= MAX_CHARS)

const handleConfirm = (): void => {
  if (!canConfirm.value) return
  emit('confirm', text.value.trim())
}

const handleCancelRetake = (): void => {
  emit('cancelRetake')
}

const handlePopState = (): void => {
  emit('cancelRetake')
}

onMounted(() => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.history.pushState({ captureReview: true }, '')
  window.addEventListener('popstate', handlePopState)
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
  window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
  <Teleport to="body">
    <section class="capture-review" aria-label="Review captured page">
      <div class="capture-review__image-shell">
        <img
          :src="imageSrc"
          alt="Captured page preview"
          class="capture-review__image"
        />
      </div>

      <div class="capture-review__editor" aria-label="Captured text review">
        <Message
          v-if="showLowConfidence"
          severity="warn"
          class="capture-review__warning"
        >
          OCR confidence is low. Review the text before saving.
        </Message>

        <label for="capture-review-text" class="capture-review__label">
          <i class="pi pi-pencil" /> Captured text
        </label>

        <div class="capture-review__input-wrap">
          <Textarea
            id="capture-review-text"
            v-model="text"
            :maxlength="MAX_CHARS"
            rows="4"
            class="capture-review__textarea"
            placeholder="Captured text will appear here..."
          />
          <span
            class="capture-review__counter"
            :class="{ 'capture-review__counter--warn': charsRemaining <= 200 }"
          >
            {{ charsRemaining }}
          </span>
        </div>
      </div>

      <div class="capture-review__actions" aria-label="Capture review actions">
        <Button
          label="Use Capture"
          icon="pi pi-check"
          size="large"
          class="capture-review__confirm"
          :disabled="!canConfirm"
          aria-label="Use this captured page"
          @click="handleConfirm"
        />
        <Button
          label="Retake"
          icon="pi pi-refresh"
          size="large"
          severity="secondary"
          outlined
          class="capture-review__retake"
          aria-label="Retake this captured page"
          @click="handleCancelRetake"
        />
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.capture-review {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: 0.75rem;
  min-height: 100dvh;
  padding: max(0.75rem, env(safe-area-inset-top)) 0.85rem
    max(0.85rem, env(safe-area-inset-bottom));
  background:
    linear-gradient(180deg, rgba(10, 10, 14, 0.98), rgba(18, 18, 25, 0.98)),
    var(--p-surface-950);
  color: var(--p-surface-0);
}

.capture-review__image-shell {
  min-height: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--p-surface-900);
  border: 1px solid color-mix(in srgb, var(--p-surface-0), transparent 88%);
}

.capture-review__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.capture-review__editor {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-height: 0;
}

.capture-review__warning {
  margin: 0;
  font-size: 0.78rem;
}

.capture-review__label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--p-surface-200);
}

.capture-review__label .pi {
  font-size: 0.75rem;
}

.capture-review__input-wrap {
  position: relative;
}

.capture-review__textarea {
  width: 100%;
  max-height: 22dvh;
  font-size: 0.88rem;
  resize: none;
}

.capture-review__counter {
  position: absolute;
  right: 0.55rem;
  bottom: 0.45rem;
  pointer-events: none;
  font-size: 0.7rem;
  opacity: 0.55;
}

.capture-review__counter--warn {
  color: var(--p-orange-400);
  font-weight: 700;
  opacity: 1;
}

.capture-review__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, 0.55fr);
  gap: 0.65rem;
}

.capture-review__confirm,
.capture-review__retake {
  width: 100%;
  min-height: 3rem;
}

@media (orientation: landscape) and (max-height: 520px) {
  .capture-review {
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.72fr);
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .capture-review__image-shell {
    grid-row: 1 / span 2;
  }

  .capture-review__actions {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
