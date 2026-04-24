<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressStore } from '@/stores/progress'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'

const props = defineProps<{
  historyRowId: string
}>()

const emit = defineEmits<{
  saved: []
  skipped: []
}>()

const progressStore = useProgressStore()

const note = ref('')
const saving = ref(false)

const MAX_CHARS = 160
const COUNTER_THRESHOLD = 140

const charsUsed = computed(() => note.value.length)
const showCounter = computed(() => charsUsed.value >= COUNTER_THRESHOLD)
const charsRemaining = computed(() => MAX_CHARS - charsUsed.value)
const canSave = computed(() => note.value.trim().length > 0)

const handleSave = async () => {
  if (!canSave.value) return
  saving.value = true
  // Fire-and-forget per contract — errors are swallowed in saveSessionNote
  await progressStore.saveSessionNote(props.historyRowId, note.value.trim())
  saving.value = false
  emit('saved')
}

const handleSkip = () => {
  emit('skipped')
}
</script>

<template>
  <div class="session-note">
    <label class="session-note__label" :for="`note-${historyRowId}`">
      <i class="pi pi-pencil" /> Where did you leave off?
    </label>

    <div class="session-note__input-wrap">
      <Textarea
        :id="`note-${historyRowId}`"
        v-model="note"
        :maxlength="MAX_CHARS"
        placeholder="e.g. Just as the group reaches the mountain pass…"
        rows="2"
        auto-resize
        class="session-note__textarea"
      />
      <span v-if="showCounter" class="session-note__counter" :class="{ 'session-note__counter--warn': charsRemaining <= 10 }">
        {{ charsRemaining }}
      </span>
    </div>

    <div class="session-note__actions">
      <Button
        label="Save note"
        icon="pi pi-check"
        size="small"
        :disabled="!canSave"
        :loading="saving"
        @click="handleSave"
      />
      <button class="session-note__skip" @click="handleSkip">Skip</button>
    </div>
  </div>
</template>

<style scoped>
.session-note {
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

.session-note__label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.session-note__label .pi {
  font-size: 0.75rem;
}

.session-note__input-wrap {
  position: relative;
}

.session-note__textarea {
  width: 100%;
  font-size: 0.88rem;
  resize: none;
}

.session-note__counter {
  position: absolute;
  bottom: 0.4rem;
  right: 0.5rem;
  font-size: 0.7rem;
  opacity: 0.5;
  pointer-events: none;
}

.session-note__counter--warn {
  color: var(--p-orange-400);
  opacity: 1;
  font-weight: 700;
}

.session-note__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.session-note__skip {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.82rem;
  opacity: 0.5;
  color: inherit;
  transition: opacity 0.15s;
}

.session-note__skip:hover {
  opacity: 0.85;
  text-decoration: underline;
}
</style>
