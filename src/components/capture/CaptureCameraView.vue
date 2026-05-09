<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
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
let previousBodyOverflow = ''

onMounted(async () => {
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  if (videoRef.value) {
    await props.startCamera(videoRef.value)
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
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
        <Button
          type="button"
          class="capture-camera__cancel"
          @click="emit('cancel')"
        >
          Cancel
        </Button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.capture-camera {
  position: fixed;
  inset: 0;
  z-index: 10000;
  overflow: hidden;
  min-height: 100dvh;
  background: #000;
}

.capture-camera__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  border: 0;
  border-radius: 0;
}

.capture-camera__controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, 0.55fr);
  gap: 0.65rem;
  padding: 0.85rem 0.85rem max(0.85rem, env(safe-area-inset-bottom));
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.72));
}

.capture-camera__snap {
  width: 100%;
  min-height: 3rem;
  color: #fff;
}

.capture-camera__cancel {
  min-height: 3rem;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 8px;
  padding: 0 1rem;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(16px);
  transition:
    background 0.15s,
    border-color 0.15s;
}

.capture-camera__cancel:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.48);
}

@media (orientation: landscape) and (max-height: 520px) {
  .capture-camera__controls {
    grid-template-columns: minmax(0, 1fr) minmax(7rem, 0.4fr);
    left: auto;
    width: min(28rem, 54vw);
    padding-left: 0.75rem;
  }
}
</style>
