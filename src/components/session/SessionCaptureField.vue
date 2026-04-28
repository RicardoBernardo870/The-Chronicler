<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from "vue";
import { useProgressStore } from "@/stores/progress";
import { useCapturesStore } from "@/stores/captures";
import { useCapture } from "@/composables/useCapture";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

// "Add note instead" fallback re-uses the existing component
import SessionNoteField from "@/components/session/SessionNoteField.vue";

// Capture views are heavy (camera + textarea + Message) — load lazily
const CaptureCameraView = defineAsyncComponent(
  () => import("@/components/capture/CaptureCameraView.vue"),
);
const CaptureVerifyView = defineAsyncComponent(
  () => import("@/components/capture/CaptureVerifyView.vue"),
);

const props = defineProps<{
  historyRowId: string;
  bookId: string;
}>();

const emit = defineEmits<{
  saved: [];
  skipped: [];
}>();

const progressStore = useProgressStore();
const capturesStore = useCapturesStore();
const toast = useToast();

const { state, ocrResult, errorMessage, startCamera, snap, retake, cancel } =
  useCapture();

// 'note' = user chose "Add note instead"; rendered SessionNoteField fallback
const mode = ref<"capture" | "note">("capture");

const currentPage = computed(
  () => progressStore.progressForBook(props.bookId)?.currentPage ?? 0,
);

const handleStartCapture = (): void => {
  // CaptureCameraView mounts and calls startCamera via prop — flip state so view appears
  state.value = "camera";
};

const handleSnap = async (): Promise<void> => {
  await snap();
  if (state.value === "error" && errorMessage.value) {
    toast.add({
      severity: "error",
      summary: "OCR failed",
      detail: errorMessage.value,
      life: 4000,
    });
  }
};

const handleSave = async (text: string): Promise<void> => {
  if (!ocrResult.value) return;
  try {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    await capturesStore.saveCapture({
      bookId: props.bookId,
      page: currentPage.value,
      text,
      confidence: ocrResult.value.confidence,
      wordCount,
    });
    emit("saved");
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Could not save capture",
      detail: e instanceof Error ? e.message : "Unknown error",
      life: 4000,
    });
  }
};

const handleAddNoteInstead = (): void => {
  cancel();
  mode.value = "note";
};

const handleNoteFallbackSaved = (): void => emit("saved");
const handleNoteFallbackSkipped = (): void => emit("skipped");

const handleSkip = (): void => {
  cancel();
  emit("skipped");
};
</script>

<template>
  <!-- Note-fallback path -->
  <SessionNoteField
    v-if="mode === 'note'"
    :history-row-id="historyRowId"
    @saved="handleNoteFallbackSaved"
    @skipped="handleNoteFallbackSkipped"
  />

  <!-- Capture flow -->
  <div v-else class="session-capture">
    <!-- State: idle (default prompt) -->
    <template v-if="state === 'idle'">
      <p class="session-capture__prompt">
        <i class="pi pi-camera" /> Capture this page
      </p>
      <p class="session-capture__hint">
        Take a quick photo of the page you just finished. We'll save the text so
        future recaps come straight from what you actually read.
      </p>
      <div class="session-capture__actions">
        <Button
          label="Capture"
          icon="pi pi-camera"
          aria-label="Capture a photo of the last page you read"
          @click="handleStartCapture"
        />
        <button
          type="button"
          class="session-capture__link"
          @click="handleAddNoteInstead"
        >
          Add note instead
        </button>
        <button
          type="button"
          class="session-capture__link session-capture__skip"
          @click="handleSkip"
        >
          Skip
        </button>
      </div>
    </template>

    <!-- State: camera viewport -->
    <CaptureCameraView
      v-else-if="state === 'camera'"
      :start-camera="startCamera"
      @snap="handleSnap"
      @cancel="handleSkip"
    />

    <!-- State: OCR running -->
    <div v-else-if="state === 'ocr-running'" class="session-capture__loading">
      <i class="pi pi-spin pi-spinner" /> Reading the page…
    </div>

    <!-- State: verify the OCR text -->
    <CaptureVerifyView
      v-else-if="state === 'verify' && ocrResult"
      :initial-text="ocrResult.text"
      :confidence="ocrResult.confidence"
      @save="handleSave"
      @retake="retake"
      @cancel="handleSkip"
    />

    <!-- State: camera permission denied -->
    <div v-else-if="state === 'denied'" class="session-capture__panel">
      <p class="session-capture__panel-text">
        Camera access was denied. You can still leave a note for this session,
        or grant camera access in your browser settings and try again.
      </p>
      <div class="session-capture__actions">
        <Button
          label="Add note instead"
          icon="pi pi-pencil"
          outlined
          @click="handleAddNoteInstead"
        />
        <button type="button" class="session-capture__link" @click="handleSkip">
          Cancel
        </button>
      </div>
    </div>

    <!-- State: offline -->
    <div v-else-if="state === 'offline'" class="session-capture__panel">
      <p class="session-capture__panel-text">
        You're offline — capture needs internet to extract text. Try again
        later, or leave a note for now.
      </p>
      <div class="session-capture__actions">
        <Button
          label="Add note instead"
          icon="pi pi-pencil"
          outlined
          @click="handleAddNoteInstead"
        />
        <button type="button" class="session-capture__link" @click="handleSkip">
          Cancel
        </button>
      </div>
    </div>

    <!-- State: generic error -->
    <div v-else-if="state === 'error'" class="session-capture__panel">
      <p class="session-capture__panel-text">
        {{ errorMessage ?? "Something went wrong." }}
      </p>
      <div class="session-capture__actions">
        <Button
          label="Try again"
          icon="pi pi-refresh"
          outlined
          @click="retake"
        />
        <Button
          label="Add note instead"
          icon="pi pi-pencil"
          text
          @click="handleAddNoteInstead"
        />
        <button type="button" class="session-capture__link" @click="handleSkip">
          Skip
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-capture {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem 1rem;
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.07);
  border: 1px solid rgba(99, 102, 241, 0.2);
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.session-capture__prompt {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--p-indigo-300);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.session-capture__prompt .pi {
  font-size: 0.85rem;
}

.session-capture__hint {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.65;
  line-height: 1.45;
}

.session-capture__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.session-capture__link {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.82rem;
  opacity: 0.6;
  color: inherit;
  transition: opacity 0.15s;
}

.session-capture__link:hover {
  opacity: 1;
  text-decoration: underline;
}
.session-capture__skip {
  opacity: 0.45;
}

.session-capture__loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  opacity: 0.75;
  padding: 0.5rem 0;
}

.session-capture__panel {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.session-capture__panel-text {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.8;
  line-height: 1.45;
}
</style>
