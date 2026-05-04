<script setup lang="ts">
import { computed } from 'vue'
import Image from 'primevue/image'
import Skeleton from 'primevue/skeleton'
import { useRecapImage } from '@/composables/useRecapImage'
import type { RecapImageStatus } from '@/types'

const props = defineProps<{
  recapId: string
  imageStatus: RecapImageStatus
  imagePath: string | null
}>()

const { imageStatus, signedUrl, isLoading } = useRecapImage({
  recapId: () => props.recapId,
  imageStatus: () => props.imageStatus,
  imagePath: () => props.imagePath,
})

const showPlaceholder = computed(() =>
  imageStatus.value === 'failed_safety' || imageStatus.value === 'failed_transient',
)

const shouldRender = computed(() =>
  isLoading.value || Boolean(signedUrl.value) || showPlaceholder.value,
)
</script>

<template>
  <div v-if="shouldRender" class="recap-image-panel">
    <Skeleton
      v-if="isLoading"
      class="recap-image-panel__skeleton"
      width="100%"
      height="100%"
    />

    <Image
      v-else-if="signedUrl"
      :src="signedUrl"
      alt=""
      aria-hidden="true"
      :preview="false"
      image-class="recap-image-panel__img"
    />

    <div
      v-else-if="showPlaceholder"
      class="recap-image-panel__placeholder"
      aria-hidden="true"
    />

    <!-- Legacy recaps map null image_status to skipped and intentionally render no image slot. -->
  </div>
</template>

<style scoped>
.recap-image-panel {
  width: 100%;
  max-width: 360px;
  aspect-ratio: 1 / 1;
  border-radius: var(--p-border-radius-lg, 12px);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
  align-self: center;
}

.recap-image-panel__skeleton {
  width: 100%;
  height: 100%;
}

.recap-image-panel :deep(.p-image),
.recap-image-panel :deep(.p-image img),
.recap-image-panel__img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.recap-image-panel__placeholder {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 28% 24%, rgba(167, 139, 250, 0.30), transparent 30%),
    linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(16, 185, 129, 0.14));
}
</style>
