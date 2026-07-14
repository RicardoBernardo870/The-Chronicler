<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from "vue";
import { useProgressStore } from "@/stores/progress";
import { useCapturesStore } from "@/stores/captures";
import { useCapture } from "@/composables/useCapture";
import { useGlassToast } from "@/composables/useGlassToast";
import Button from "primevue/button";
import { useToast } from "primevue/usetoast";

// "Add note instead" fallback re-uses the existing component
import SessionNoteField from "@/components/session/SessionNoteField.vue";

// Capture views are heavy (camera + textarea + Message); load lazily
const CaptureCameraView = defineAsyncComponent(
  () => import("@/components/capture/CaptureCameraView.vue"),
);
const CaptureReviewViewport = defineAsyncComponent(
  () => import("@/components/capture/CaptureReviewViewport.vue"),
);

const props = defineProps<{
  // Only render this component from a real progress_history-backed
  // lastSessionEnded event. Initial completed imports never create that event.
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
const glassToast = useGlassToast();

const {
  state,
  ocrResult,
  previewImage,
  errorMessage,
  startCamera,
  snap,
  importImage,
  retake,
  cancel,
} = useCapture();

// Hidden file input for the "Upload image" path (ebooks / no camera).
const fileInput = ref<HTMLInputElement | null>(null);

// Which method produced the current capture, so "Retake" returns to the same
// path (re-open the camera vs re-open the file picker).
const lastMethod = ref<"camera" | "upload">("camera");

const handlePickUpload = (): void => {
  fileInput.value?.click();
};

const handleUploadChange = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // allow re-picking the same file
  if (!file) return;
  lastMethod.value = "upload";
  glassToast.showLoading("Reading the page…");
  await importImage(file);
  if (state.value === "error" && errorMessage.value) {
    glassToast.dismiss();
    toast.add({
      severity: "error",
      summary: "Couldn't read that image",
      detail: errorMessage.value,
      life: 4000,
    });
    return;
  }
  await finishCapture();
};

// 'note' = user chose "Add note instead"; rendered SessionNoteField fallback
const mode = ref<"capture" | "note">("capture");

// Captures at or above this confidence save without the manual review step.
const AUTO_SAVE_CONFIDENCE = 0.9;
// Mirrors CaptureVerifyView's textarea limit so auto-saved text obeys the
// same cap as manually reviewed text.
const MAX_CHARS = 10_000;

// True while a high-confidence capture is being saved automatically; keeps
// the loading state on screen instead of flashing the review UI.
const autoSaving = ref(false);

const currentPage = computed(
  () => progressStore.progressForBook(props.bookId)?.currentPage ?? 0,
);

const handleStartCapture = (): void => {
  // CaptureCameraView mounts and calls startCamera via prop; flip state so view appears
  lastMethod.value = "camera";
  state.value = "camera";
};

const handleSnap = async (): Promise<void> => {
  glassToast.showLoading("Reading the page…", "Analysing the text");
  await snap();
  if (state.value === "error" && errorMessage.value) {
    glassToast.dismiss();
    toast.add({
      severity: "error",
      summary: "OCR failed",
      detail: errorMessage.value,
      life: 4000,
    });
    return;
  }
  await finishCapture();
};

const handleSave = async (text: string): Promise<boolean> => {
  if (!ocrResult.value) return false;
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
    return true;
  } catch (e) {
    toast.add({
      severity: "error",
      summary: "Could not save capture",
      detail: e instanceof Error ? e.message : "Unknown error",
      life: 4000,
    });
    return false;
  }
};

// Runs after OCR completes, while the loading glass toast is still up.
// High confidence → save immediately and swap the toast to success. Low
// confidence (or empty text) → the review UI appears; swap the toast to a
// warning so the user knows why they're being asked to check the text. On
// save failure the error toast has already fired and state stays 'verify',
// so the review UI is the fallback.
const finishCapture = async (): Promise<void> => {
  if (state.value !== "verify" || !ocrResult.value) {
    // denied / offline / preview-missing paths — the inline panels take over
    glassToast.dismiss();
    return;
  }

  const text = ocrResult.value.text.slice(0, MAX_CHARS).trim();
  if (ocrResult.value.confidence >= AUTO_SAVE_CONFIDENCE && text) {
    autoSaving.value = true;
    try {
      const saved = await handleSave(text);
      if (saved) {
        glassToast.show("Page captured", "Text analysed successfully.");
      } else {
        glassToast.dismiss();
      }
    } finally {
      autoSaving.value = false;
    }
    return;
  }

  glassToast.showWarn(
    "Check the captured text",
    "The scan wasn't clear — review the text or retake the photo.",
  );
};

const handleCancelRetake = (): void => {
  // Re-run the same capture method the user chose.
  if (lastMethod.value === "upload") {
    handlePickUpload();
  } else {
    retake();
  }
};

// Close the review and return to the method picker (idle prompt).
const handleReviewClose = (): void => {
  cancel();
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
  <div
    v-else
    class="session-capture"
    :class="{ 'session-capture--busy': state === 'ocr-running' || autoSaving }"
  >
    <!-- Hidden upload input, triggered by the "Upload image" buttons -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="session-capture__file-input"
      @change="handleUploadChange"
    />

    <!-- State: idle (default prompt) -->
    <template v-if="state === 'idle'">
      <p class="session-capture__prompt">
        <i class="pi pi-camera" /> Capture this page
      </p>
      <p class="session-capture__hint">
        Reading a paper book? Take a photo. On an ebook or device? Upload a
        screenshot instead. We'll save the text so future recaps come straight
        from what you actually read.
      </p>
      <div class="session-capture__idle-actions">
        <div class="session-capture__methods">
          <Button
            label="Take photo"
            icon="pi pi-camera"
            class="session-capture__method-btn"
            aria-label="Take a photo of the last page you read"
            @click="handleStartCapture"
          />
          <Button
            label="Upload image"
            icon="pi pi-upload"
            outlined
            class="session-capture__method-btn"
            aria-label="Upload a screenshot of the last page you read"
            @click="handlePickUpload"
          />
        </div>
        <div class="session-capture__secondary">
          <Button
            label="Add note instead"
            icon="pi pi-pencil"
            size="small"
            severity="secondary"
            text
            @click="handleAddNoteInstead"
          />
          <Button
            label="Skip"
            size="small"
            severity="secondary"
            text
            class="session-capture__skip-btn"
            @click="handleSkip"
          />
        </div>
      </div>
    </template>

    <!-- State: camera viewport -->
    <CaptureCameraView
      v-else-if="state === 'camera'"
      :start-camera="startCamera"
      @snap="handleSnap"
      @cancel="handleSkip"
    />

    <!-- State: OCR running (or auto-saving a high-confidence capture).
         No inline UI — the glass toast carries the loading feedback and the
         whole panel is hidden via .session-capture--busy on the root. -->

    <!-- State: review captured image + OCR text -->
    <CaptureReviewViewport
      v-else-if="state === 'verify' && ocrResult && previewImage"
      :image-src="previewImage.dataUrl"
      :initial-text="ocrResult.text"
      :confidence="ocrResult.confidence"
      :retake-label="lastMethod === 'upload' ? 'Re-upload' : 'Retake'"
      @confirm="handleSave"
      @cancel-retake="handleCancelRetake"
      @close="handleReviewClose"
    />

    <div v-else-if="state === 'verify'" class="session-capture__panel">
      <p class="session-capture__panel-text">
        We could not prepare the capture preview. Try taking the photo again.
      </p>
      <div class="session-capture__actions">
        <Button
          label="Try again"
          icon="pi pi-refresh"
          outlined
          @click="retake"
        />
        <button type="button" class="session-capture__link" @click="handleSkip">
          Skip
        </button>
      </div>
    </div>

    <!-- State: camera permission denied -->
    <div v-else-if="state === 'denied'" class="session-capture__panel">
      <p class="session-capture__panel-text">
        Camera access was denied. You can upload a screenshot of the page
        instead, leave a note, or grant camera access and try again.
      </p>
      <div class="session-capture__actions">
        <Button
          label="Upload image"
          icon="pi pi-upload"
          @click="handlePickUpload"
        />
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
        You're offline; capture needs internet to extract text. Try again
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

.session-capture__file-input {
  display: none;
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

/* Idle prompt: two capture methods side by side, secondary actions below */
.session-capture__idle-actions {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.session-capture__methods {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.session-capture__method-btn {
  width: 100%;
}

/* Keep method labels on a single line so the buttons stay a normal height */
.session-capture__method-btn :deep(.p-button-label) {
  white-space: nowrap;
}

.session-capture__secondary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.55rem;
  padding-top: 0.55rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);

  .p-button-secondary {
    color: var(--p-indigo-300) !important;
  }
}

/* Skip is the most dismissive — push it furthest into the background */
.session-capture__skip-btn {
  opacity: 0.55;
  color: var(--p-indigo-300) !important;
}

.session-capture__skip-btn:hover {
  opacity: 1;
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

/* While OCR/auto-save runs, the glass toast is the only loading indicator —
   collapse the panel entirely so no empty chrome sits on the hero card. */
.session-capture--busy {
  display: none;
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
