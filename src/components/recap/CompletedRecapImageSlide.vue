<script setup lang="ts">
import { computed } from 'vue'
import Image from 'primevue/image'
import Skeleton from 'primevue/skeleton'
import { useRecapImage } from '@/composables/useRecapImage'
import type { Recap } from '@/types'

const props = defineProps<{
  recap: Recap
}>()

const { signedUrl } = useRecapImage({
  recapId: () => props.recap.id,
  imageStatus: () => props.recap.imageStatus,
  imagePath: () => props.recap.imagePath,
})

const pageLabel = computed(() =>
  typeof props.recap.pageSnapshot === 'number'
    ? `Page ${props.recap.pageSnapshot}`
    : `${Math.round(props.recap.progressSnapshot)}%`,
)
</script>

<template>
  <figure class="completed-recap-slide">
    <div class="completed-recap-slide__frame">
      <Image
        v-if="signedUrl"
        :src="signedUrl"
        :alt="pageLabel"
        :preview="false"
        image-class="completed-recap-slide__image"
      />
      <Skeleton
        v-else
        class="completed-recap-slide__skeleton"
        width="100%"
        height="100%"
      />
    </div>
    <figcaption class="completed-recap-slide__caption">
      <span>{{ pageLabel }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.completed-recap-slide {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.completed-recap-slide__frame {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--p-border-radius-lg, 12px);
  overflow: hidden;
  background: color-mix(in srgb, var(--p-surface-900, #111827) 8%, transparent);
}

.completed-recap-slide :deep(.p-image),
.completed-recap-slide :deep(.p-image img),
.completed-recap-slide__image,
.completed-recap-slide__skeleton {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.completed-recap-slide__caption {
  display: flex;
  justify-content: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  line-height: 1.3;
}
</style>
