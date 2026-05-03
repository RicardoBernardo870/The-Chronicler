import { computed, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useCommunityProfileStore } from '@/stores/communityProfile'
import type {
  CommunityProfileInput,
  CommunityProfilePrivacy,
  MyCommunityProfile,
  ProfileVisibility,
} from '@/types'

export const defaultCommunityPrivacy = (): CommunityProfilePrivacy => ({
  progress: 'nobody',
  currentlyReading: 'nobody',
  lexicon: 'nobody',
  readerDna: 'nobody',
})

export const visibilityOptions: Array<{ label: string; value: ProfileVisibility }> = [
  { label: 'Everyone', value: 'everyone' },
  { label: 'Followers', value: 'followers' },
  { label: 'Nobody', value: 'nobody' },
]

export const createEmptyCommunityProfileForm = (email?: string): CommunityProfileInput => ({
  username: email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) ?? '',
  displayName: '',
  bio: '',
  avatarUrl: '',
  isPublic: true,
  privacy: defaultCommunityPrivacy(),
})

export const toCommunityProfileForm = (
  profile: MyCommunityProfile | null,
  email?: string,
): CommunityProfileInput => {
  if (!profile) return createEmptyCommunityProfileForm(email)
  return {
    username: profile.profile.username,
    displayName: profile.profile.displayName ?? '',
    bio: profile.profile.bio ?? '',
    avatarUrl: profile.profile.avatarUrl ?? '',
    isPublic: profile.profile.isPublic,
    privacy: { ...profile.privacy },
  }
}

export const sanitizeCommunityProfileForm = (
  form: CommunityProfileInput,
): CommunityProfileInput => ({
  username: form.username.trim().toLowerCase(),
  displayName: form.displayName?.trim() || null,
  bio: form.bio?.trim() || null,
  avatarUrl: form.avatarUrl?.trim() || null,
  isPublic: form.isPublic,
  privacy: { ...form.privacy },
})

export const usernameFormatError = (username: string): string | null => {
  const normalized = username.trim().toLowerCase()
  if (normalized.length < 3) return 'Use at least 3 characters.'
  if (normalized.length > 30) return 'Use 30 characters or fewer.'
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return 'Use letters, numbers, underscores, or hyphens.'
  }
  return null
}

export const useCommunityProfile = () => {
  const store = useCommunityProfileStore()
  const authStore = useAuthStore()
  const refs = storeToRefs(store)
  const form = reactive<CommunityProfileInput>(createEmptyCommunityProfileForm(authStore.user?.email))

  const syncForm = () => {
    Object.assign(form, toCommunityProfileForm(refs.myProfile.value, authStore.user?.email))
  }

  const previewProfile = computed(() => ({
    profile: {
      userId: authStore.user?.id ?? refs.myProfile.value?.profile.userId ?? '',
      username: form.username.trim().toLowerCase(),
      displayName: form.displayName || null,
      bio: form.bio || null,
      avatarUrl: form.avatarUrl || null,
      isPublic: form.isPublic,
    },
    privacy: { ...form.privacy },
  }))

  return {
    ...refs,
    form,
    previewProfile,
    syncForm,
    getMyProfile: store.getMyProfile,
    saveProfile: store.saveProfile,
    uploadAvatar: store.uploadAvatar,
    checkUsernameAvailability: store.checkUsernameAvailability,
    fetchPublicProfileByUsername: store.fetchPublicProfileByUsername,
  }
}
