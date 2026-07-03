<script setup lang="ts">
// Book-scoped recap image carousel — same look as the profile's Recap
// memories (near-full-width snap cards). Paths come from this book's recap
// history; the private bucket paths are exchanged for signed URLs in batch.
import { ref, watch } from 'vue'
import { Skeleton } from 'primevue'
import { supabase } from '@/services/supabase'
import type { Recap } from '@/types'
import { formatShortDate } from '@/utils/date'

const props = defineProps<{
  recaps: Recap[] // already filtered to imageStatus === 'succeeded'
}>()

interface Slide {
  id: string
  imageUrl: string
  createdAt: string
}

const slides = ref<Slide[]>([])
const loading = ref(false)
let signedSignature = ''

const resolve = async () => {
  const withPaths = props.recaps.filter((r) => r.imagePath)
  const signature = withPaths.map((r) => r.id).join('~')
  if (signature === signedSignature) return
  signedSignature = signature

  if (withPaths.length === 0) {
    slides.value = []
    return
  }

  loading.value = true
  try {
    const { data, error } = await supabase.storage
      .from('recap-images')
      .createSignedUrls(withPaths.map((r) => r.imagePath as string), 3600)
    if (error) throw error
    slides.value = withPaths.flatMap((r, i) => {
      const url = data?.[i]?.signedUrl
      return url ? [{ id: r.id, imageUrl: url, createdAt: r.createdAt }] : []
    })
  } catch {
    slides.value = []
  } finally {
    loading.value = false
  }
}

watch(() => props.recaps, () => void resolve(), { immediate: true, deep: false })
</script>

<template>
  <div v-if="loading" class="book-recap-carousel__track">
    <Skeleton width="calc(100% - 2rem)" height="11rem" border-radius="14px" style="flex: none" />
  </div>

  <div v-else-if="slides.length > 0" class="book-recap-carousel__track">
    <figure v-for="slide in slides" :key="slide.id" class="book-recap-carousel__card">
      <img
        :src="slide.imageUrl"
        alt="Recap image"
        class="book-recap-carousel__img"
        loading="lazy"
      />
      <figcaption class="book-recap-carousel__caption">
        {{ formatShortDate(slide.createdAt) }}
      </figcaption>
    </figure>
  </div>

  <p v-else class="book-recap-carousel__empty">
    <i class="pi pi-image" aria-hidden="true" />
    Generate recaps as you read — your moments become images that gather here.
  </p>
</template>

<style scoped>
.book-recap-carousel__track {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.125rem 0.125rem 0.375rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.book-recap-carousel__track::-webkit-scrollbar {
  display: none;
}

.book-recap-carousel__card {
  position: relative;
  flex: none;
  width: calc(100% - 2rem);
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  scroll-snap-align: center;
}

/* A single image fills the section — the peek gap only matters with 2+. */
.book-recap-carousel__card:only-child {
  width: 100%;
}

.book-recap-carousel__img {
  display: block;
  width: 100%;
  height: auto;
}

.book-recap-carousel__caption {
  position: absolute;
  inset: auto 0 0 0;
  padding: 1.1rem 0.6rem 0.5rem;
  background: linear-gradient(to top, rgba(6, 4, 24, 0.82), transparent);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.72rem;
}

.book-recap-carousel__empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.82rem;
  opacity: 0.6;
  line-height: 1.5;
}

.book-recap-carousel__empty .pi {
  flex: none;
  color: var(--p-indigo-300);
}
</style>
