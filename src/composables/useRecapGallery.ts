import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'

/**
 * Recap image gallery for the profile carousel: the reader's most recent
 * successfully generated recap images across all books. The bucket is
 * private, so paths are exchanged for signed URLs in one batch call.
 */

const GALLERY_LIMIT = 12
const SIGNED_URL_TTL_SECONDS = 3600

export interface RecapGalleryItem {
  recapId: string
  bookId: string
  bookTitle: string
  createdAt: string
  imageUrl: string
}

// Module-level singleton refs — survive component remounts.
const _items = ref<RecapGalleryItem[]>([])
const _loading = ref(false)
const _loaded = ref(false)
const _fetchedForUserId = ref<string | null>(null)

interface GalleryRow {
  id: string
  book_id: string
  created_at: string
  image_path: string
  books: { title: string | null } | null
}

export const useRecapGallery = () => {
  const authStore = useAuthStore()

  const fetchGallery = async (): Promise<void> => {
    if (!authStore.user) return
    const userId = authStore.user.id
    // Signed URLs expire — refetch when a different user signs in, otherwise
    // serve the cached set for the session (new images are rare events).
    if (_fetchedForUserId.value === userId && _loaded.value) return

    _loading.value = true
    try {
      const { data, error } = await supabase
        .from('recaps')
        .select('id, book_id, created_at, image_path, books(title)')
        .eq('user_id', userId)
        .eq('image_status', 'succeeded')
        .not('image_path', 'is', null)
        .order('created_at', { ascending: false })
        .limit(GALLERY_LIMIT)
      if (error) throw error

      const rows = (data ?? []) as unknown as GalleryRow[]
      if (rows.length === 0) {
        _items.value = []
        return
      }

      const { data: signed, error: signError } = await supabase.storage
        .from('recap-images')
        .createSignedUrls(
          rows.map((r) => r.image_path),
          SIGNED_URL_TTL_SECONDS,
        )
      if (signError) throw signError

      _items.value = rows.flatMap((row, i) => {
        const url = signed?.[i]?.signedUrl
        if (!url) return []
        return [
          {
            recapId: row.id,
            bookId: row.book_id,
            bookTitle: row.books?.title ?? 'Untitled',
            createdAt: row.created_at,
            imageUrl: url,
          },
        ]
      })
    } catch (err) {
      console.warn('[recapGallery] fetch failed', err)
      _items.value = []
    } finally {
      _loading.value = false
      _loaded.value = true
      _fetchedForUserId.value = userId
    }
  }

  return { items: _items, loading: _loading, loaded: _loaded, fetchGallery }
}
