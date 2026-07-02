import { ref, watch } from 'vue'
import { searchBooks } from '@/services/bookSearchService'
import { useReadingDnaStore } from '@/stores/readingDna'
import type { BookSearchSource, BookSuggestion } from '@/types'

/**
 * Resolves cover art + a details-route key for the Reading DNA book
 * suggestions (title/author only). Google Books is primary (gives the volume
 * key for the add-book details flow); Open Library search is the cover
 * fallback when Google is unavailable (e.g. 503 rate limiting). Lookups run
 * sequentially — the parallel burst was tripping Google's rate limiter.
 */

const OL_SEARCH_URL = 'https://openlibrary.org/search.json'

export interface DnaRecommendation extends BookSuggestion {
  coverUrl: string | null
  source: BookSearchSource | null
  key: string | null
}

// Module-level cache — covers are resolved once per suggestion set. A set
// with unresolved entries (failed lookups) is retried on the next mount.
const _recommendations = ref<DnaRecommendation[]>([])
const _resolving = ref(false)
let _resolvedSignature: string | null = null
let _inFlight: Promise<void> | null = null

const unresolved = (s: BookSuggestion): DnaRecommendation => ({
  ...s,
  coverUrl: null,
  source: null,
  key: null,
})

const isResolved = (r: DnaRecommendation): boolean => r.coverUrl !== null

const resolveViaGoogle = async (
  s: BookSuggestion,
): Promise<DnaRecommendation | null> => {
  try {
    const results = await searchBooks(`${s.title} ${s.author}`, 1)
    const match = results.find((r) => r.coverUrl) ?? results[0] ?? null
    if (!match) return null
    return {
      ...s,
      coverUrl: match.coverUrl,
      source: match.source,
      key: match.key,
    }
  } catch {
    return null
  }
}

// Cover-only fallback: Open Library has no Google volume id, so `key` stays
// null and the scroller falls back to the add-book search flow on tap.
const resolveViaOpenLibrary = async (
  s: BookSuggestion,
): Promise<DnaRecommendation | null> => {
  try {
    const url =
      `${OL_SEARCH_URL}?title=${encodeURIComponent(s.title)}` +
      `&author=${encodeURIComponent(s.author)}&limit=3&fields=cover_i`
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as { docs?: { cover_i?: number }[] }
    const coverId = json.docs?.find((d) => d.cover_i)?.cover_i
    if (!coverId) return null
    return {
      ...s,
      coverUrl: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
      source: null,
      key: null,
    }
  } catch {
    return null
  }
}

const resolveOne = async (s: BookSuggestion): Promise<DnaRecommendation> =>
  (await resolveViaGoogle(s)) ?? (await resolveViaOpenLibrary(s)) ?? unresolved(s)

export const useDnaRecommendations = () => {
  const dnaStore = useReadingDnaStore()

  const resolve = async (): Promise<void> => {
    const suggestions = dnaStore.dna?.suggestions ?? []
    const signature = suggestions
      .map((s) => `${s.title}|${s.author}`)
      .join('~')

    if (!signature) {
      _recommendations.value = []
      _resolvedSignature = null
      return
    }
    // Skip only when the cached set is fully resolved — otherwise retry the
    // gaps (a Google 503 shouldn't leave placeholders for the whole session).
    if (
      _resolvedSignature === signature &&
      _recommendations.value.every(isResolved)
    ) {
      return
    }
    if (_inFlight) return _inFlight

    _resolving.value = true
    const keepExisting = _resolvedSignature === signature
    if (!keepExisting) _recommendations.value = suggestions.map(unresolved)
    _resolvedSignature = signature

    _inFlight = (async () => {
      try {
        const next = [..._recommendations.value]
        for (let i = 0; i < suggestions.length; i++) {
          if (next[i] && isResolved(next[i])) continue
          next[i] = await resolveOne(suggestions[i])
          _recommendations.value = [...next]
        }
      } finally {
        _resolving.value = false
        _inFlight = null
      }
    })()
    return _inFlight
  }

  watch(() => dnaStore.dna, () => void resolve(), { immediate: true })

  return { recommendations: _recommendations, resolving: _resolving }
}
