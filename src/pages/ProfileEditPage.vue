<script setup lang="ts">
// Profile customization — the ONLY place a community profile row is created.
// Sign-up does not create one, so the empty state here is a first-run setup
// ("Create your reader profile"), never an error. Saving calls
// upsert_my_community_profile; the avatar uploads to community-avatars on save.
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import {
  Button,
  InputText,
  Message,
  SelectButton,
  Skeleton,
  Textarea,
  ToggleSwitch,
} from 'primevue'
import {
  useCommunityIdentity,
  DEFAULT_PRIVACY,
  USERNAME_PATTERN,
} from '@/composables/useCommunityIdentity'
import type { CommunityPrivacy, ProfileVisibility } from '@/types'

const BIO_MAX = 160
const AVATAR_MAX_BYTES = 8 * 1024 * 1024

const router = useRouter()
const toast = useToast()
const {
  fetchIdentity,
  saveProfile,
  checkUsername,
  uploadAvatar,
  profile,
  privacy,
  hasProfile,
  initials,
  suggestedUsername,
} = useCommunityIdentity()

const pageReady = ref(false)

// ── Form state ────────────────────────────────────────────────────────────────

const username = ref('')
const displayName = ref('')
const bio = ref('')
const isPublic = ref(true)
const privacyForm = ref<CommunityPrivacy>({ ...DEFAULT_PRIVACY })

const pendingAvatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const avatarError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const saving = ref(false)
const saveError = ref<string | null>(null)

type UsernameCheck = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
const usernameCheck = ref<UsernameCheck>('idle')

const visibilityOptions: { label: string; value: ProfileVisibility }[] = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'Followers', value: 'followers' },
  { label: 'Nobody', value: 'nobody' },
]

const privacyRows: { key: keyof CommunityPrivacy; label: string; hint: string }[] = [
  { key: 'currentlyReading', label: 'Currently reading', hint: 'The book on your nightstand right now' },
  { key: 'progress', label: 'Reading progress', hint: 'Pages, sessions, and streaks' },
  { key: 'lexicon', label: 'Lexicon', hint: 'Words you collect while reading' },
  { key: 'readerDna', label: 'Reading DNA', hint: 'Your AI reading personality' },
]

// ── Hydration ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    await fetchIdentity()
    if (profile.value) {
      username.value = profile.value.username
      displayName.value = profile.value.displayName ?? ''
      bio.value = profile.value.bio ?? ''
      isPublic.value = profile.value.isPublic
      privacyForm.value = { ...privacy.value }
      avatarPreview.value = profile.value.avatarUrl
    } else {
      // First-time setup: suggest a pattern-safe handle from the auth email.
      username.value = suggestedUsername.value
    }
  } finally {
    pageReady.value = true
  }
})

// ── Username availability (debounced, non-blocking) ───────────────────────────

const normalizedUsername = computed(() => username.value.trim().toLowerCase())
const usernameValid = computed(() => USERNAME_PATTERN.test(normalizedUsername.value))

watch(normalizedUsername, () => {
  usernameCheck.value = normalizedUsername.value ? 'checking' : 'idle'
})

watchDebounced(
  normalizedUsername,
  async (value) => {
    if (!value) {
      usernameCheck.value = 'idle'
      return
    }
    if (!USERNAME_PATTERN.test(value)) {
      usernameCheck.value = 'invalid'
      return
    }
    if (value === profile.value?.username) {
      usernameCheck.value = 'available'
      return
    }
    try {
      usernameCheck.value = (await checkUsername(value)) ? 'available' : 'taken'
    } catch {
      usernameCheck.value = 'idle' // availability is re-verified server-side on save
    }
  },
  { debounce: 400, maxWait: 1500 },
)

const usernameHint = computed(() => {
  switch (usernameCheck.value) {
    case 'invalid':
      return '3–30 characters: lowercase letters, numbers, - and _'
    case 'taken':
      return "That username's already taken. Try another."
    default:
      return '3–30 characters: lowercase letters, numbers, - and _'
  }
})

// ── Avatar picking ────────────────────────────────────────────────────────────

const pickAvatar = () => fileInput.value?.click()

const onAvatarSelected = (event: Event) => {
  avatarError.value = null
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Choose an image file.'
    return
  }
  if (file.size > AVATAR_MAX_BYTES) {
    avatarError.value = 'Choose an image under 8 MB.'
    return
  }
  if (avatarPreview.value?.startsWith('blob:')) {
    URL.revokeObjectURL(avatarPreview.value)
  }
  pendingAvatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

// ── Save ──────────────────────────────────────────────────────────────────────

const canSave = computed(
  () => usernameValid.value && usernameCheck.value !== 'taken' && !saving.value,
)

const save = async () => {
  if (!canSave.value) return
  saving.value = true
  saveError.value = null
  try {
    let avatarUrl = profile.value?.avatarUrl ?? null
    if (pendingAvatarFile.value) {
      avatarUrl = await uploadAvatar(pendingAvatarFile.value)
    }
    await saveProfile({
      username: normalizedUsername.value,
      displayName: displayName.value.trim() || null,
      bio: bio.value.trim() || null,
      avatarUrl,
      isPublic: isPublic.value,
      privacy: privacyForm.value,
    })
    pendingAvatarFile.value = null
    toast.add({
      severity: 'success',
      summary: 'Profile saved',
      life: 2500,
    })
    router.push({ name: 'profile' })
  } catch (err) {
    saveError.value =
      err instanceof Error ? err.message : 'Your profile could not be saved. Try again.'
  } finally {
    saving.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'profile' })
}
</script>

<template>
  <section class="profile-edit">
    <header class="profile-edit__header">
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back to profile"
        @click="goBack"
      />
      <h1 class="profile-edit__title">
        {{ hasProfile ? 'Edit profile' : 'Create your reader profile' }}
      </h1>
    </header>

    <div v-if="!pageReady" class="profile-edit__skeletons">
      <Skeleton shape="circle" size="96px" class="profile-edit__skeleton-avatar" />
      <Skeleton height="2.4rem" />
      <Skeleton height="2.4rem" />
      <Skeleton height="5rem" />
    </div>

    <form v-else class="profile-edit__form" @submit.prevent="save">
      <p v-if="!hasProfile" class="profile-edit__intro">
        Pick a username and (optionally) a face for your reading life.
        Everything here is yours to change later — and everything is private
        until you say otherwise.
      </p>

      <!-- Avatar -->
      <div class="profile-edit__avatar-block">
        <button
          type="button"
          class="profile-edit__avatar"
          aria-label="Change profile photo"
          @click="pickAvatar"
        >
          <img
            v-if="avatarPreview"
            :src="avatarPreview"
            alt=""
            class="profile-edit__avatar-img"
          />
          <span v-else class="profile-edit__avatar-initials">{{ initials }}</span>
          <span class="profile-edit__avatar-badge" aria-hidden="true">
            <i class="pi pi-camera" />
          </span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="profile-edit__file-input"
          @change="onAvatarSelected"
        />
        <p class="profile-edit__avatar-hint">
          {{ avatarPreview ? 'Tap to change your photo' : 'Tap to add a photo' }}
        </p>
        <Message v-if="avatarError" severity="warn" size="small">
          {{ avatarError }}
        </Message>
      </div>

      <!-- Username -->
      <div class="profile-edit__field">
        <label for="pe-username" class="profile-edit__label">Username</label>
        <div class="profile-edit__username-wrap">
          <span class="profile-edit__at" aria-hidden="true">@</span>
          <InputText
            id="pe-username"
            v-model="username"
            class="profile-edit__input profile-edit__input--username"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            maxlength="30"
            :invalid="usernameCheck === 'taken' || usernameCheck === 'invalid'"
            aria-describedby="pe-username-hint"
          />
          <span class="profile-edit__username-state" aria-hidden="true">
            <i v-if="usernameCheck === 'checking'" class="pi pi-spinner pi-spin" />
            <i
              v-else-if="usernameCheck === 'available'"
              class="pi pi-check-circle profile-edit__state-ok"
            />
            <i
              v-else-if="usernameCheck === 'taken' || usernameCheck === 'invalid'"
              class="pi pi-times-circle profile-edit__state-bad"
            />
          </span>
        </div>
        <small
          id="pe-username-hint"
          class="profile-edit__hint"
          :class="{ 'profile-edit__hint--bad': usernameCheck === 'taken' }"
        >
          {{ usernameHint }}
        </small>
      </div>

      <!-- Display name -->
      <div class="profile-edit__field">
        <label for="pe-display" class="profile-edit__label">Display name</label>
        <InputText
          id="pe-display"
          v-model="displayName"
          class="profile-edit__input"
          placeholder="How other readers see you"
          maxlength="60"
        />
      </div>

      <!-- Bio -->
      <div class="profile-edit__field">
        <div class="profile-edit__label-row">
          <label for="pe-bio" class="profile-edit__label">Bio</label>
          <span
            class="profile-edit__counter"
            :class="{ 'profile-edit__counter--limit': bio.length >= BIO_MAX }"
          >
            {{ bio.length }}/{{ BIO_MAX }}
          </span>
        </div>
        <Textarea
          id="pe-bio"
          v-model="bio"
          class="profile-edit__input"
          placeholder="Currently haunting the fantasy shelves"
          :maxlength="BIO_MAX"
          rows="3"
          auto-resize
        />
      </div>

      <!-- Visibility -->
      <div class="profile-edit__section glass-surface">
        <div class="profile-edit__toggle-row">
          <div>
            <p class="profile-edit__toggle-label">Public profile</p>
            <p class="profile-edit__toggle-hint">
              Let other readers find you by username
            </p>
          </div>
          <ToggleSwitch v-model="isPublic" aria-label="Public profile" />
        </div>
      </div>

      <div class="profile-edit__section glass-surface">
        <h2 class="profile-edit__section-title">Who can see</h2>
        <div
          v-for="row in privacyRows"
          :key="row.key"
          class="profile-edit__privacy-row"
        >
          <div class="profile-edit__privacy-meta">
            <p class="profile-edit__privacy-label">{{ row.label }}</p>
            <p class="profile-edit__privacy-hint">{{ row.hint }}</p>
          </div>
          <SelectButton
            v-model="privacyForm[row.key]"
            :options="visibilityOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            :aria-label="`${row.label} visibility`"
            class="profile-edit__privacy-select"
            size="small"
          />
        </div>
      </div>

      <Message v-if="saveError" severity="error">{{ saveError }}</Message>

      <Button
        type="submit"
        :label="hasProfile ? 'Save changes' : 'Create profile'"
        :loading="saving"
        :disabled="!canSave"
        class="profile-edit__save"
      />
    </form>
  </section>
</template>

<style scoped>
.profile-edit {
  max-width: 680px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-edit__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.profile-edit__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.profile-edit__skeletons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-edit__skeleton-avatar {
  align-self: center;
}

.profile-edit__form {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}

.profile-edit__intro {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  line-height: 1.5;
}

.profile-edit__avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.profile-edit__avatar {
  position: relative;
  width: 96px;
  height: 96px;
  display: grid;
  place-items: center;
  overflow: visible;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--p-primary-color) 30%, var(--p-content-background));
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.profile-edit__avatar:focus-visible {
  outline: 2px solid var(--p-focus-ring-color, var(--p-primary-color));
  outline-offset: 3px;
}

.profile-edit__avatar-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.profile-edit__avatar-initials {
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.profile-edit__avatar-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  font-size: 0.8rem;
}

.profile-edit__file-input {
  display: none;
}

.profile-edit__avatar-hint {
  margin: 0;
  color: var(--p-text-muted-color);
  font-size: 0.78rem;
}

.profile-edit__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.profile-edit__label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.profile-edit__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.profile-edit__counter {
  color: var(--p-text-muted-color);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.profile-edit__counter--limit {
  color: var(--p-red-400, #f87171);
}

.profile-edit__input {
  width: 100%;
}

.profile-edit__username-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.profile-edit__at {
  position: absolute;
  left: 0.75rem;
  z-index: 1;
  color: var(--p-text-muted-color);
  font-weight: 650;
}

.profile-edit__input--username {
  padding-left: 1.9rem;
  padding-right: 2.4rem;
}

.profile-edit__username-state {
  position: absolute;
  right: 0.75rem;
  display: grid;
  place-items: center;
}

.profile-edit__state-ok {
  color: var(--p-green-400, #4ade80);
}

.profile-edit__state-bad {
  color: var(--p-red-400, #f87171);
}

.profile-edit__hint {
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
}

.profile-edit__hint--bad {
  color: var(--p-red-400, #f87171);
}

.profile-edit__section {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
}

.profile-edit__section-title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.profile-edit__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.profile-edit__toggle-label,
.profile-edit__privacy-label {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 650;
}

.profile-edit__toggle-hint,
.profile-edit__privacy-hint {
  margin: 0.1rem 0 0;
  color: var(--p-text-muted-color);
  font-size: 0.76rem;
}

.profile-edit__privacy-row {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.profile-edit__privacy-row + .profile-edit__privacy-row {
  padding-top: 0.9rem;
  border-top: 1px solid var(--p-content-border-color);
}

.profile-edit__privacy-select {
  width: 100%;
  display: flex;
}

.profile-edit__privacy-select :deep(.p-togglebutton) {
  flex: 1;
}

.profile-edit__save {
  min-height: 2.8rem;
  border-radius: 999px;
}
</style>
