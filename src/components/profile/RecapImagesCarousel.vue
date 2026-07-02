<script setup lang="ts">
// Recap memories carousel — the reader's generated recap images, newest
// first, as a swipeable strip at the bottom of the profile. Tapping a memory
// opens that book's recap history. Empty state invites the reader to earn
// their first image recap.
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Skeleton } from 'primevue'
import { useRecapGallery, type RecapGalleryItem } from '@/composables/useRecapGallery'
import { formatShortDate } from '@/utils/date'

const router = useRouter()
const { items, loading, loaded, fetchGallery } = useRecapGallery()

onMounted(() => void fetchGallery())

const openRecapHistory = (item: RecapGalleryItem) =>
  router.push({ name: 'recap-history', params: { id: item.bookId } })
</script>

<template>
  <section class="recap-carousel" aria-label="Your recap memories">
    <h2 class="recap-carousel__heading">Recap memories</h2>

    <!-- Loading -->
    <div v-if="loading && !loaded" class="recap-carousel__track">
      <Skeleton
        v-for="i in 2"
        :key="i"
        class="recap-carousel__skeleton"
        width="calc(100% - 2rem)"
        height="12rem"
        border-radius="14px"
      />
    </div>

    <!-- Empty: no generated images yet -->
    <div v-else-if="items.length === 0" class="recap-carousel__empty glass-surface">
      <i class="pi pi-image recap-carousel__empty-icon" aria-hidden="true" />
      <div>
        <p class="recap-carousel__empty-title">No memories yet</p>
        <p class="recap-carousel__empty-copy">
          Keep reading and generating recaps — your favorite moments become
          images that gather here.
        </p>
      </div>
    </div>

    <!-- Gallery -->
    <div v-else class="recap-carousel__track">
      <button
        v-for="item in items"
        :key="item.recapId"
        type="button"
        class="recap-carousel__card"
        :aria-label="`Open recaps for ${item.bookTitle}`"
        @click="openRecapHistory(item)"
      >
        <img
          :src="item.imageUrl"
          :alt="`Recap image from ${item.bookTitle}`"
          class="recap-carousel__img"
          loading="lazy"
        />
        <span class="recap-carousel__caption">
          <span class="recap-carousel__book">{{ item.bookTitle }}</span>
          <span class="recap-carousel__date">{{ formatShortDate(item.createdAt) }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.recap-carousel {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-width: 0;
}

.recap-carousel__heading {
  margin: 0;
  padding: 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}

.recap-carousel__track {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.25rem 0.25rem 0.5rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.recap-carousel__track::-webkit-scrollbar {
  display: none;
}

.recap-carousel__skeleton {
  flex: none;
}

.recap-carousel__card {
  position: relative;
  flex: none;
  width: calc(100% - 2rem);
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--p-content-border-color);
  border-radius: 14px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  scroll-snap-align: center;
}

.recap-carousel__card:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 3px;
}

.recap-carousel__img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
}

.recap-carousel__caption {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  padding: 1.1rem 0.6rem 0.5rem;
  background: linear-gradient(to top, rgba(6, 4, 24, 0.82), transparent);
  text-align: left;
}

.recap-carousel__book {
  overflow: hidden;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recap-carousel__date {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.72rem;
}

.recap-carousel__empty {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
}

.recap-carousel__empty-icon {
  flex: none;
  margin-top: 0.15rem;
  color: var(--p-primary-color);
  font-size: 1.1rem;
}

.recap-carousel__empty-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
}

.recap-carousel__empty-copy {
  margin: 0.2rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  line-height: 1.45;
}
</style>
