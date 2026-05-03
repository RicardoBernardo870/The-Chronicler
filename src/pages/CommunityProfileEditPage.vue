<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import BlockedUsersPanel from '@/components/community/BlockedUsersPanel.vue'
import ProfilePrivacyControls from '@/components/community/ProfilePrivacyControls.vue'
import PublicProfilePreview from '@/components/community/PublicProfilePreview.vue'
import ReaderSearchCard from '@/components/community/ReaderSearchCard.vue'
import UsernameField from '@/components/community/UsernameField.vue'
import {
  sanitizeCommunityProfileForm,
  useCommunityProfile,
  //usernameFormatError,
} from '@/composables/useCommunityProfile'

const router = useRouter()
const toast = useToast()
const {
  form,
  myProfile,
  previewProfile,
  status,
  error,
  getMyProfile,
  saveProfile,
  uploadAvatar,
  syncForm,
} = useCommunityProfile()

const loading = ref(true)
const saveError = ref<string | null>(null)
const usernameState = ref({ valid: false, pending: false, message: null as string | null })
const editDialogVisible = ref(false)
const avatarFile = ref<File | null>(null)
const avatarPreviewUrl = ref<string | null>(null)
const avatarInput = ref<HTMLInputElement | null>(null)

const saving = computed(() => status.value === 'saving')
const bioRemaining = computed(() => 160 - (form.bio?.length ?? 0))
const avatarPreview = computed(() => avatarPreviewUrl.value || form.avatarUrl || null)
// const saveDisabled = computed(() => {
//   const normalized = form.username.trim().toLowerCase()
//   const formatError = usernameFormatError(normalized)
//   return saving.value ||
//     usernameState.value.pending ||
//     !!formatError ||
//     bioRemaining.value < 0 ||
//     !usernameState.value.valid
// })

const friendlyError = computed(() => {
  const code = saveError.value || error.value
  if (code === 'username_invalid') return 'Choose a URL-safe, non-reserved username between 3 and 30 characters.'
  if (code === 'username_taken') return 'That username is already taken.'
  if (code === 'bio_too_long') return 'Bio must be 160 characters or fewer.'
  if (code === 'visibility_invalid') return 'One of the privacy settings is invalid.'
  return code
})

onMounted(async () => {
  await getMyProfile({ force: true })
  syncForm()
  loading.value = false
})

onBeforeUnmount(() => {
  revokeAvatarPreview()
})

const revokeAvatarPreview = () => {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = null
  }
}

const onAvatarSelected = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  saveError.value = null
  revokeAvatarPreview()
  avatarFile.value = null

  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    saveError.value = 'Use a JPG, PNG, or WebP image.'
    input.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    saveError.value = 'Choose an image smaller than 5 MB.'
    input.value = ''
    return
  }

  avatarFile.value = file
  avatarPreviewUrl.value = URL.createObjectURL(file)
}

const clearAvatar = () => {
  revokeAvatarPreview()
  avatarFile.value = null
  form.avatarUrl = null
  if (avatarInput.value) avatarInput.value.value = ''
}

const onSave = async () => {
  saveError.value = null
  try {
    if (avatarFile.value) {
      form.avatarUrl = await uploadAvatar(avatarFile.value)
    }

    const saved = await saveProfile(sanitizeCommunityProfileForm(form))
    avatarFile.value = null
    revokeAvatarPreview()
    if (avatarInput.value) avatarInput.value.value = ''
    syncForm()
    editDialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Profile saved',
      detail: `@${saved.profile.username} is ready.`,
      life: 2800,
    })
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : 'Could not save profile.'
  }
}

const openEditDialog = () => {
  syncForm()
  saveError.value = null
  avatarFile.value = null
  revokeAvatarPreview()
  if (avatarInput.value) avatarInput.value.value = ''
  editDialogVisible.value = true
}
</script>

<template>
  <section class="community-edit-page">
    <header class="community-edit-page__header">
      <div>
        <h1>Community Profile</h1>
        <p>Shape what other BookHero readers can see.</p>
      </div>
      <Button
        icon="pi pi-arrow-left"
        text
        rounded
        aria-label="Back to private profile"
        @click="router.push({ name: 'profile' })"
      />
    </header>

    <Message v-if="friendlyError" severity="error" class="community-edit-page__message">
      {{ friendlyError }}
    </Message>

    <div v-if="loading" class="community-edit-page__loading glass-surface">
      Loading community profile...
    </div>

    <div v-else class="community-edit-page__cards">
      <PublicProfilePreview
        :profile="previewProfile"
        mode="viewer"
        editable
        @edit="openEditDialog"
      />

      <ReaderSearchCard />

      <BlockedUsersPanel />
    </div>

    <Dialog
      v-model:visible="editDialogVisible"
      modal
      header="Edit community profile"
      :style="{ width: 'min(93vw, 38rem)' }"
    >
      <form class="community-edit-page__form" @submit.prevent="onSave">
        <UsernameField
          v-model="form.username"
          :current-username="myProfile?.profile.username"
          :disabled="saving"
          @validity-change="usernameState = $event"
        />

        <label class="community-edit-page__field">
          <span>Display name</span>
          <InputText v-model="form.displayName" :disabled="saving" maxlength="80" />
        </label>

        <label class="community-edit-page__field">
          <span>Profile picture</span>
          <div class="community-edit-page__avatar-control">
            <div class="community-edit-page__avatar-preview">
              <img
                v-if="avatarPreview"
                :src="avatarPreview"
                :alt="form.displayName || form.username || 'Profile picture'"
              >
              <span v-else>{{ (form.username || '?').slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="community-edit-page__avatar-actions">
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="community-edit-page__avatar-input"
                :disabled="saving"
                @change="onAvatarSelected"
              >
              <div class="community-edit-page__avatar-buttons">
                <Button
                  type="button"
                  label="Upload image"
                  icon="pi pi-upload"
                  outlined
                  :disabled="saving"
                  @click="avatarInput?.click()"
                />
                <Button
                  type="button"
                  label="Remove"
                  icon="pi pi-times"
                  text
                  :disabled="saving || !avatarPreview"
                  @click="clearAvatar"
                />
              </div>
              <small>JPG, PNG, or WebP. Max 5 MB.</small>
            </div>
          </div>
        </label>

        <label class="community-edit-page__field">
          <span>Bio</span>
          <Textarea
            v-model="form.bio"
            :disabled="saving"
            rows="4"
            auto-resize
            maxlength="180"
          />
          <small :class="{ 'community-edit-page__counter--bad': bioRemaining < 0 }">
            {{ bioRemaining }} characters left
          </small>
        </label>

        <ProfilePrivacyControls
          :is-public="form.isPublic"
          :privacy="form.privacy"
          :disabled="saving"
          @update:is-public="form.isPublic = $event"
          @update:privacy="form.privacy = $event"
        />

        <div class="community-edit-page__actions">
          <Button
            type="submit"
            label="Save profile"
            icon="pi pi-check"
            :loading="saving"
          />
        </div>
      </form>
    </Dialog>
  </section>
</template>

<style scoped>
.community-edit-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem var(--app-nav-bottom-clearance);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.community-edit-page__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 0.35rem 0.25rem;
}

.community-edit-page__header h1,
.community-edit-page__header p {
  margin: 0;
}

.community-edit-page__header h1 {
  font-size: 1.45rem;
}

.community-edit-page__header p {
  margin-top: 0.2rem;
  font-size: 0.9rem;
  opacity: 0.66;
}

.community-edit-page__message {
  margin: 0;
}

.community-edit-page__loading {
  padding: 1.25rem;
}

.community-edit-page__cards,
.community-edit-page__form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.community-edit-page__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.community-edit-page__field small {
  font-weight: 500;
  opacity: 0.65;
}

.community-edit-page__counter--bad {
  color: var(--red-500);
  opacity: 1;
}

.community-edit-page__avatar-control {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.community-edit-page__avatar-preview {
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background: var(--surface-card);
  font-size: 1.35rem;
  font-weight: 800;
  flex: 0 0 auto;
}

.community-edit-page__avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.community-edit-page__avatar-actions {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.community-edit-page__avatar-input {
  display: none;
}

.community-edit-page__avatar-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.community-edit-page__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

@media (min-width: 860px) {
  .community-edit-page__cards {
    max-width: 42rem;
    width: 100%;
    align-self: center;
  }
}
</style>
