<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'

const props = defineProps<{
  /**
   * The composable's startCamera fn — the parent passes it so the camera
   * lifecycle stays owned by the parent's useCapture() instance.
   */
  startCamera: (videoEl: HTMLVideoElement) => Promise<void>
}>()

const emit = defineEmits<{
  snap: []
  cancel: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

onMounted(async () => {
  if (videoRef.value) {
    await props.startCamera(videoRef.value)
  }
})
</script>

<template>
  <div class="capture-camera">
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="capture-camera__video"
      aria-label="Camera preview"
    />

    <div class="capture-camera__controls">
      <Button
        label="Snap"
        icon="pi pi-camera"
        size="large"
        class="capture-camera__snap"
        aria-label="Capture a photo of the last page you read"
        @click="emit('snap')"
      />
      <button
        type="button"
        class="capture-camera__cancel"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </div>
</template>

<style scoped>
.capture-camera {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.capture-camera__video {
  width: 100%;
  max-height: 70vh;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  background: #000;
  border-radius: 12px;
}

.capture-camera__controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.capture-camera__snap {
  min-width: 140px;
}

.capture-camera__cancel {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0.6;
  color: inherit;
  transition: opacity 0.15s;
}

.capture-camera__cancel:hover {
  opacity: 1;
  text-decoration: underline;
}
</style>
