import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import {
  cacheKeys,
  invalidate,
  registerRevalidator,
  swrRun,
  swrStatus,
  swrTouch,
} from '@/composables/useCache'
import type {
  CommunityProfileInput,
  MyCommunityProfile,
  PublicCommunityProfile,
  UsernameAvailability,
} from '@/types'

export type CommunityProfileStatus = 'idle' | 'loading' | 'saving' | 'error'

const TTL = 60_000

const normalizeUsername = (value: string): string => value.trim().toLowerCase()

const rpcMessage = (error: { message?: string; details?: string } | null): string => {
  const raw = `${error?.message ?? ''} ${error?.details ?? ''}`
  if (raw.includes('username_taken')) return 'username_taken'
  if (raw.includes('username_invalid')) return 'username_invalid'
  if (raw.includes('bio_too_long')) return 'bio_too_long'
  if (raw.includes('visibility_invalid')) return 'visibility_invalid'
  return error?.message ?? 'Community profile request failed'
}

export const useCommunityProfileStore = defineStore('communityProfile', () => {
  const myProfile = ref<MyCommunityProfile | null>(null)
  const publicProfiles = ref<Record<string, PublicCommunityProfile | null>>({})
  const status = ref<CommunityProfileStatus>('idle')
  const publicStatus = ref<CommunityProfileStatus>('idle')
  const error = ref<string | null>(null)
  const publicError = ref<string | null>(null)

  const hasProfile = computed(() => !!myProfile.value)

  const _myProfileFetcher = async () => {
    const { data, error: err } = await supabase.rpc('get_my_community_profile')
    if (err) throw err
    myProfile.value = (data as MyCommunityProfile | null) ?? null
  }

  const getMyProfile = async (options: { force?: boolean } = {}): Promise<void> => {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const key = cacheKeys.communityProfile(authStore.user.id)
    registerRevalidator(key, () => swrRun(key, _myProfileFetcher).catch(() => {}))

    const cacheState = options.force ? 'loading' : swrStatus(key, TTL)
    if (cacheState === 'fresh') return

    if (cacheState === 'background') {
      swrRun(key, _myProfileFetcher).catch(() => {})
      return
    }

    status.value = 'loading'
    error.value = null
    try {
      await swrRun(key, _myProfileFetcher)
      status.value = 'idle'
    } catch (err) {
      error.value = rpcMessage(err as { message?: string; details?: string })
      status.value = 'error'
    }
  }

  const saveProfile = async (payload: CommunityProfileInput): Promise<MyCommunityProfile> => {
    const authStore = useAuthStore()
    if (!authStore.user) throw new Error('Not authenticated')

    status.value = 'saving'
    error.value = null
    const { data, error: err } = await supabase.rpc('upsert_my_community_profile', {
      payload: {
        ...payload,
        username: normalizeUsername(payload.username),
      },
    })

    if (err) {
      const message = rpcMessage(err)
      error.value = message
      status.value = 'error'
      throw new Error(message)
    }

    const profile = data as MyCommunityProfile
    myProfile.value = profile
    swrTouch(cacheKeys.communityProfile(authStore.user.id))
    invalidate(cacheKeys.publicProfile(profile.profile.username))
    status.value = 'idle'
    return profile
  }

  const checkUsernameAvailability = async (username: string): Promise<UsernameAvailability> => {
    const { data, error: err } = await supabase.rpc('is_username_available', {
      p_username: username,
    })
    if (err) throw new Error(rpcMessage(err))
    return data as UsernameAvailability
  }

  const fetchPublicProfileByUsername = async (
    username: string,
    options: { force?: boolean } = {},
  ): Promise<PublicCommunityProfile | null> => {
    const normalized = normalizeUsername(username)
    if (!normalized) return null

    const key = cacheKeys.publicProfile(normalized)
    const fetcher = async () => {
      const { data, error: err } = await supabase.rpc('get_public_profile_by_username', {
        p_username: normalized,
      })
      if (err) throw err
      publicProfiles.value[normalized] = (data as PublicCommunityProfile | null) ?? null
    }
    registerRevalidator(key, () => swrRun(key, fetcher).catch(() => {}))

    const cacheState = options.force ? 'loading' : swrStatus(key, TTL)
    if (cacheState === 'fresh') return publicProfiles.value[normalized] ?? null

    if (cacheState === 'background') {
      swrRun(key, fetcher).catch(() => {})
      return publicProfiles.value[normalized] ?? null
    }

    publicStatus.value = 'loading'
    publicError.value = null
    try {
      await swrRun(key, fetcher)
      publicStatus.value = 'idle'
      return publicProfiles.value[normalized] ?? null
    } catch (err) {
      publicError.value = rpcMessage(err as { message?: string; details?: string })
      publicStatus.value = 'error'
      return null
    }
  }

  return {
    myProfile,
    publicProfiles,
    status,
    publicStatus,
    error,
    publicError,
    hasProfile,
    getMyProfile,
    saveProfile,
    checkUsernameAvailability,
    fetchPublicProfileByUsername,
  }
})
