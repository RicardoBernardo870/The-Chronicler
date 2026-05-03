<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'
import { useCommunityProfile } from '@/composables/useCommunityProfile'
import type { UsernameAvailability } from '@/types'

const props = defineProps<{
  modelValue: string
  currentUsername?: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'validity-change': [state: { valid: boolean; pending: boolean; message: string | null }]
}>()

const { checkUsernameAvailability } = useCommunityProfile()
const pending = ref(false)
const message = ref<string | null>(null)
const valid = ref(false)
const lastAvailability = ref<UsernameAvailability | null>(null)
const reservedUsernames = new Set(['admin', 'api', 'auth', 'bookhero', 'login', 'profile', 'u'])

const normalized = computed(() => props.modelValue.trim().toLowerCase())
const currentNormalized = computed(() => props.currentUsername?.trim().toLowerCase() ?? '')
const formatMessage = computed(() => {
  if (!normalized.value) return 'Choose a URL-safe username.'
  if (normalized.value.length < 3) return 'Use at least 3 characters.'
  if (normalized.value.length > 30) return 'Use 30 characters or fewer.'
  if (!/^[a-z0-9_-]+$/.test(normalized.value)) {
    return 'Use letters, numbers, underscores, or hyphens.'
  }
  if (reservedUsernames.has(normalized.value)) return 'That username is reserved.'
  return null
})

const publish = () => {
  emit('validity-change', {
    valid: valid.value,
    pending: pending.value,
    message: message.value,
  })
}

const onInput = (value: string | undefined) => {
  emit('update:modelValue', (value ?? '').trim().toLowerCase())
}

watch(
  () => props.modelValue,
  () => {
    valid.value = false
    message.value = formatMessage.value
    lastAvailability.value = null
    publish()
  },
  { immediate: true },
)

watchDebounced(
  normalized,
  async (username) => {
    if (formatMessage.value) {
      pending.value = false
      message.value = formatMessage.value
      valid.value = false
      publish()
      return
    }

    if (username === currentNormalized.value) {
      pending.value = false
      message.value = 'Current username.'
      valid.value = true
      publish()
      return
    }

    pending.value = true
    message.value = null
    publish()
    try {
      const availability = await checkUsernameAvailability(username)
      lastAvailability.value = availability
      valid.value = availability.available
      message.value = availability.available
        ? 'Username available.'
        : 'That username is already taken.'
    } catch (err) {
      valid.value = false
      message.value = err instanceof Error ? err.message : 'Could not check username.'
    } finally {
      pending.value = false
      publish()
    }
  },
  { debounce: 350, maxWait: 900 },
)
</script>

<template>
  <div class="username-field">
    <label class="username-field__label" for="community-username">Username</label>
    <div class="username-field__control">
      <span class="username-field__prefix">bookhero.app/u/</span>
      <InputText
        id="community-username"
        :model-value="modelValue"
        :disabled="disabled"
        autocomplete="off"
        class="username-field__input"
        @update:model-value="onInput(String($event ?? ''))"
      />
      <ProgressSpinner
        v-if="pending"
        class="username-field__spinner"
        stroke-width="4"
      />
    </div>

    <Message
      v-if="message"
      :severity="valid ? 'success' : 'warn'"
      size="small"
      class="username-field__message"
    >
      {{ message }}
    </Message>
  </div>
</template>

<style scoped>
.username-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.username-field__label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.68;
}

.username-field__control {
  min-height: 3rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.45rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: var(--surface-card);
}

.username-field__prefix {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 0.8rem;
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.username-field__input {
  flex: 1 1 auto;
  min-width: 5rem;
  border: 0;
  box-shadow: none;
  background: transparent;
  padding-inline: 0.25rem;
}

.username-field__spinner {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
}

.username-field__message {
  margin: 0;
}
</style>
