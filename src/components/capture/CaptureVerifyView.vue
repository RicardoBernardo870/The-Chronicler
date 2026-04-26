<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import InlineMessage from 'primevue/inlinemessage'

const props = defineProps<{
  initialText: string
  confidence: number
}>()

const emit = defineEmits<{
  save: [text: string]
  retake: []
  cancel: []
}>()

const MAX_CHARS = 10_000
const LOW_CONFIDENCE_THRESHOLD = 0.7

const text = ref(props.initialText.slice(0, MAX_CHARS))
const saving = ref(false)

const charsUsed = computed(() => text.value.length)
const charsRemaining = computed(() => MAX_CHARS - charsUsed.value)
const showLowConfidence = computed(() => props.confidence < LOW_CONFIDENCE_THRESHOLD)
const canSave = computed(() => text.value.trim().length > 0 && charsUsed.value <= MAX_CHARS)

const handleSave = (): void => {
  if (!canSave.value) return
  saving.value = true
  emit('save', text.value.trim())
}
</script>

<template>
  <div class="capture-verify">
    <label for="capture-verify-text" class="capture-verify__label">
      <i class="pi pi-pencil" /> Verify the captured text
    </label>

    <InlineMessage v-if="showLowConfidence" severity="warn" class="capture-verify__warning">
      OCR confidence is low — please review the text carefully before saving.
    </InlineMessage>

    <div class="capture-verify__input-wrap">
      <Textarea
        id="capture-verify-text"
        v-model="text"
        :maxlength="MAX_CHARS"
        rows="8"
        auto-resize
        class="capture-verify__textarea"
        placeholder="Captured text will appear here…"
      />
      <span
        class="capture-verify__counter"
        :class="{ 'capture-verify__counter--warn': charsRemaining <= 200 }"
      >
        {{ charsRemaining }}
      </span>
    </div>

    <div class="capture-verify__actions">
      <Button
        label="Save"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!canSave"
        @click="handleSave"
      />
      <Button
        label="Retake"
        icon="pi pi-refresh"
        outlined
        @click="emit('retake')"
      />
      <button
        type="button"
        class="capture-verify__cancel"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.capture-verify {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.07);
  border: 1px solid rgba(99, 102, 241, 0.2);
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.capture-verify__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.capture-verify__label .pi {
  font-size: 0.75rem;
}

.capture-verify__warning {
  align-self: stretch;
  font-size: 0.8rem;
}

.capture-verify__input-wrap {
  position: relative;
}

.capture-verify__textarea {
  width: 100%;
  font-size: 0.88rem;
  resize: vertical;
}

.capture-verify__counter {
  position: absolute;
  bottom: 0.4rem;
  right: 0.5rem;
  font-size: 0.7rem;
  opacity: 0.5;
  pointer-events: none;
}

.capture-verify__counter--warn {
  color: var(--p-orange-400);
  opacity: 1;
  font-weight: 700;
}

.capture-verify__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.capture-verify__cancel {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.82rem;
  opacity: 0.5;
  color: inherit;
  transition: opacity 0.15s;
}

.capture-verify__cancel:hover {
  opacity: 0.85;
  text-decoration: underline;
}
</style>
