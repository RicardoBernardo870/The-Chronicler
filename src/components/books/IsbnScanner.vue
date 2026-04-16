<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useScanner } from '@/composables/useScanner'
import Button from 'primevue/button'

const emit = defineEmits<{
  detected: [isbn: string]
}>()

const videoWrapper = ref<HTMLElement | null>(null)
const error = ref<string | null>(null)
const scanning = ref(false)
const detected = ref(false)

const { startScanning, stopScanning } = useScanner()

const handleDetected = (isbn: string) => {
  if (detected.value) return
  detected.value = true
  stopScanning()
  emit('detected', isbn)
}

const start = () => {
  error.value = null
  if (!videoWrapper.value) return
  try {
    startScanning(videoWrapper.value, handleDetected)
    scanning.value = true
  } catch (e: unknown) {
    error.value = 'Could not access camera. Please check permissions.'
    scanning.value = false
  }
}

onMounted(start)
</script>

<template>
  <div class="isbn-scanner">
    <!-- Camera feed -->
    <div class="isbn-scanner__viewport glass-subtle" ref="videoWrapper">
      <div v-if="!scanning && !error" class="isbn-scanner__starting">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem; opacity: 0.5" />
      </div>

      <!-- Targeting overlay -->
      <div v-if="scanning" class="isbn-scanner__reticle">
        <div class="isbn-scanner__reticle-inner" />
        <p class="isbn-scanner__reticle-label">Aim at the barcode</p>
      </div>

      <!-- Success flash -->
      <Transition name="flash">
        <div v-if="detected" class="isbn-scanner__success">
          <i class="pi pi-check-circle" style="font-size: 3rem; color: var(--p-green-400)" />
          <p>Barcode detected!</p>
        </div>
      </Transition>
    </div>

    <!-- Permission error -->
    <div v-if="error" class="isbn-scanner__error glass-subtle">
      <i class="pi pi-exclamation-circle" style="font-size: 1.5rem; color: var(--p-red-400)" />
      <p>{{ error }}</p>
      <Button label="Retry" icon="pi pi-refresh" outlined size="small" @click="start" />
    </div>
  </div>
</template>

<style scoped>
.isbn-scanner {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.isbn-scanner__viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Quagga injects a <video> and <canvas> directly into videoWrapper */
:deep(video),
:deep(canvas) {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover;
}

:deep(canvas.drawingBuffer) {
  opacity: 0; /* hide Quagga's debug canvas */
}

.isbn-scanner__starting {
  color: var(--p-text-muted-color);
}

.isbn-scanner__reticle {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}

.isbn-scanner__reticle-inner {
  width: 70%;
  height: 30%;
  border: 2px solid rgba(99, 102, 241, 0.8);
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.35);
}

.isbn-scanner__reticle-label {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.4);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
}

.isbn-scanner__success {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #fff;
  z-index: 3;
  font-weight: 600;
}

.isbn-scanner__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  text-align: center;
  padding: 1.5rem;
  border-radius: 12px;
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
}

/* Flash transition */
.flash-enter-active { transition: opacity 0.2s ease; }
.flash-enter-from   { opacity: 0; }
</style>
