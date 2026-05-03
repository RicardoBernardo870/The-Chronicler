<script setup lang="ts">
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { visibilityOptions } from '@/composables/useCommunityProfile'
import type { CommunityProfilePrivacy, ProfileVisibility } from '@/types'

defineProps<{
  isPublic: boolean
  privacy: CommunityProfilePrivacy
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:isPublic': [value: boolean]
  'update:privacy': [value: CommunityProfilePrivacy]
}>()

const setVisibility = (
  privacy: CommunityProfilePrivacy,
  key: keyof CommunityProfilePrivacy,
  value: ProfileVisibility,
) => {
  emit('update:privacy', { ...privacy, [key]: value })
}
</script>

<template>
  <section class="privacy-controls glass-subtle">
    <div class="privacy-controls__public-row">
      <div>
        <h3 class="privacy-controls__title">Public profile</h3>
        <p class="privacy-controls__hint">Turn this off to hide the public profile completely.</p>
      </div>
      <ToggleSwitch
        :model-value="isPublic"
        :disabled="disabled"
        @update:model-value="emit('update:isPublic', Boolean($event))"
      />
    </div>

    <div class="privacy-controls__grid">
      <label class="privacy-controls__field">
        <span>Progress stats</span>
        <Select
          :model-value="privacy.progress"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          :disabled="disabled"
          @update:model-value="setVisibility(privacy, 'progress', $event as ProfileVisibility)"
        />
      </label>

      <label class="privacy-controls__field">
        <span>Currently reading</span>
        <Select
          :model-value="privacy.currentlyReading"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          :disabled="disabled"
          @update:model-value="setVisibility(privacy, 'currentlyReading', $event as ProfileVisibility)"
        />
      </label>

      <label class="privacy-controls__field">
        <span>Lexicon highlights</span>
        <Select
          :model-value="privacy.lexicon"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          :disabled="disabled"
          @update:model-value="setVisibility(privacy, 'lexicon', $event as ProfileVisibility)"
        />
      </label>

      <label class="privacy-controls__field">
        <span>Reader DNA</span>
        <Select
          :model-value="privacy.readerDna"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          :disabled="disabled"
          @update:model-value="setVisibility(privacy, 'readerDna', $event as ProfileVisibility)"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.privacy-controls {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.privacy-controls__public-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.privacy-controls__title {
  margin: 0;
  font-size: 0.95rem;
}

.privacy-controls__hint {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  opacity: 0.66;
}

.privacy-controls__grid {
  display: grid;
  gap: 0.8rem;
}

.privacy-controls__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.82rem;
  font-weight: 700;
  opacity: 0.82;
}

@media (min-width: 640px) {
  .privacy-controls__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
