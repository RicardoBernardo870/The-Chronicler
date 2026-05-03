<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'
import ProfilePrivacyControls from '@/components/community/ProfilePrivacyControls.vue'
import PublicProfilePreview from '@/components/community/PublicProfilePreview.vue'
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
  syncForm,
} = useCommunityProfile()

const loading = ref(true)
const saveError = ref<string | null>(null)
const usernameState = ref({ valid: false, pending: false, message: null as string | null })

const saving = computed(() => status.value === 'saving')
const bioRemaining = computed(() => 160 - (form.bio?.length ?? 0))
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

const onSave = async () => {
  saveError.value = null
  try {
    const saved = await saveProfile(sanitizeCommunityProfileForm(form))
    syncForm()
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

    <div v-else class="community-edit-page__layout">
      <form class="community-edit-page__form glass-surface" @submit.prevent="onSave">
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
          <span>Avatar URL</span>
          <InputText v-model="form.avatarUrl" :disabled="saving" inputmode="url" />
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
            type="button"
            label="View public page"
            icon="pi pi-external-link"
            text
            :disabled="!myProfile?.profile.username"
            @click="router.push({ name: 'public-profile', params: { username: myProfile?.profile.username } })"
          />
          <Button
            type="submit"
            label="Save profile"
            icon="pi pi-check"
            :loading="saving"
          />
        </div>
      </form>

      <aside class="community-edit-page__preview">
        <h2>Preview</h2>
        <PublicProfilePreview :profile="previewProfile" mode="viewer" />
      </aside>
    </div>
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
.community-edit-page__header p,
.community-edit-page__preview h2 {
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

.community-edit-page__layout {
  display: grid;
  gap: 1rem;
}

.community-edit-page__form {
  padding: 1rem;
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

.community-edit-page__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.community-edit-page__preview {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.community-edit-page__preview h2 {
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.65;
}

@media (min-width: 860px) {
  .community-edit-page__layout {
    grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
    align-items: start;
  }
}
</style>
