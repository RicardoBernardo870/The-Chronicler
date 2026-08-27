import { computed, ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import type { CommunityPrivacy, MyCommunityProfile } from '@/types'

/**
 * Community profile state for the profile header + customization page.
 * A profile row does NOT exist after sign-up — it is created only when the
 * reader saves the customization page for the first time, so every consumer
 * must treat `profile === null` as a normal state, never an error.
 */

const AVATAR_BUCKET = 'community-avatars'
const AVATAR_MAX_DIMENSION = 512
const AVATAR_JPEG_QUALITY = 0.85

export const USERNAME_PATTERN = /^[a-z0-9_-]{3,30}$/

export interface SaveProfilePayload {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isPublic: boolean
  privacy: CommunityPrivacy
}

export const DEFAULT_PRIVACY: CommunityPrivacy = {
  progress: 'nobody',
  currentlyReading: 'nobody',
  lexicon: 'nobody',
  readerDna: 'nobody',
}

// RPC raises typed exceptions; map them to copy the reader can act on.
const SAVE_ERROR_MESSAGES: Record<string, string> = {
  username_invalid:
    'Usernames are 3–30 characters: lowercase letters, numbers, - and _.',
  username_taken: "That username's already taken. Try another.",
  bio_too_long: 'Your bio can be up to 160 characters.',
  visibility_invalid: 'One of the privacy options is invalid.',
}

// A failed fetch must never be recorded as "fetched": the refs below are
// module-level singletons, so marking failure as done blanked the profile for
// the rest of the session — every later mount early-returned on
// _fetchedForUserId and only a full reload recovered it. That turned a single
// transient 401 (see the retry note in services/supabase.ts) into a persistently
// empty greeting. Failures now leave the entry unfetched so the next mount
// retries, capped so a genuinely broken RPC isn't hammered on every mount.
const MAX_FETCH_ATTEMPTS = 3

// Module-level singleton refs — survive component remounts (same pattern as
// useReadingProfile).
const _myProfile = ref<MyCommunityProfile | null>(null)
const _fetchedForUserId = ref<string | null>(null)
const _attemptedForUserId = ref<string | null>(null)
const _failedAttempts = ref(0)
const _loaded = ref(false)

export const useCommunityIdentity = () => {
  const authStore = useAuthStore()

  const fetchIdentity = async (options: { force?: boolean } = {}): Promise<void> => {
    if (!authStore.user) return
    const userId = authStore.user.id
    if (!options.force && _fetchedForUserId.value === userId) return
    // Tracked separately from _fetchedForUserId so a failed attempt doesn't
    // reset its own retry budget on the next mount.
    if (_attemptedForUserId.value !== userId) {
      _myProfile.value = null
      _loaded.value = false
      _failedAttempts.value = 0
      _attemptedForUserId.value = userId
    }
    if (!options.force && _failedAttempts.value >= MAX_FETCH_ATTEMPTS) return

    try {
      const { data, error } = await supabase.rpc('get_my_community_profile')
      if (error) throw error
      // null is a legitimate result — the row exists only once the reader has
      // saved the customization page, so it must stay distinct from a failure.
      _myProfile.value = (data as MyCommunityProfile | null) ?? null
      _fetchedForUserId.value = userId
      _loaded.value = true
      _failedAttempts.value = 0
    } catch (err) {
      console.warn('[communityIdentity] fetch failed', err)
      _failedAttempts.value += 1
    }
  }

  const saveProfile = async (payload: SaveProfilePayload): Promise<void> => {
    const { data, error } = await supabase.rpc('upsert_my_community_profile', {
      payload,
    })
    if (error) {
      const key = Object.keys(SAVE_ERROR_MESSAGES).find((k) =>
        error.message.includes(k),
      )
      throw new Error(
        key ? SAVE_ERROR_MESSAGES[key] : 'Your profile could not be saved. Try again.',
      )
    }
    _myProfile.value = (data as MyCommunityProfile | null) ?? _myProfile.value
  }

  const checkUsername = async (username: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_username_available', {
      p_username: username,
    })
    if (error) throw error
    return Boolean((data as { available?: boolean } | null)?.available)
  }

  /**
   * Downscale to ≤512px JPEG (phone photos are multi-MB) and upload under the
   * caller's folder — the bucket's RLS requires `{userId}/…` paths. Filenames
   * are timestamped so the public-bucket CDN never serves a stale avatar.
   */
  const uploadAvatar = async (file: File): Promise<string> => {
    if (!authStore.user) throw new Error('Not authenticated')
    const userId = authStore.user.id

    const blob = await downscaleImage(file)
    const path = `${userId}/avatar-${Date.now()}.jpg`
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
    if (error) throw new Error('The image could not be uploaded. Try again.')

    // Best-effort cleanup of previous avatars — never blocks the save.
    void supabase.storage
      .from(AVATAR_BUCKET)
      .list(userId)
      .then(({ data: files }) => {
        const stale = (files ?? [])
          .map((f) => `${userId}/${f.name}`)
          .filter((p) => p !== path)
        if (stale.length > 0)
          return supabase.storage.from(AVATAR_BUCKET).remove(stale)
      })
      .catch(() => {})

    return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
  }

  // ── Derived identity (header) ────────────────────────────────────────────────

  const profile = computed(() => _myProfile.value?.profile ?? null)
  const privacy = computed<CommunityPrivacy>(
    () => _myProfile.value?.privacy ?? DEFAULT_PRIVACY,
  )
  const hasProfile = computed(() => profile.value !== null)

  const emailHandle = computed(
    () => authStore.user?.email?.split('@')[0] ?? 'Reader',
  )

  const readerName = computed(() => {
    const fromProfile =
      profile.value?.displayName?.trim() || profile.value?.username?.trim()
    return fromProfile || emailHandle.value
  })

  const avatarUrl = computed(() => profile.value?.avatarUrl ?? null)

  const initials = computed(() => {
    const parts = readerName.value.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return readerName.value.slice(0, 2).toUpperCase()
  })

  /** Pattern-safe username suggestion from the auth email for first-time setup. */
  const suggestedUsername = computed(() => {
    const cleaned = emailHandle.value
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 30)
    return cleaned.length >= 3 ? cleaned : ''
  })

  return {
    fetchIdentity,
    saveProfile,
    checkUsername,
    uploadAvatar,
    profile,
    privacy,
    hasProfile,
    identityLoaded: _loaded,
    readerName,
    avatarUrl,
    initials,
    suggestedUsername,
  }
}

const downscaleImage = async (file: File): Promise<Blob> => {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(
      1,
      AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
        'image/jpeg',
        AVATAR_JPEG_QUALITY,
      )
    })
  } finally {
    bitmap.close()
  }
}
