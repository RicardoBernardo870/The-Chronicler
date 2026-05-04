// Shared TypeScript types for the generate-recap edge function.

export type Mode = 'blurb' | 'recap' | 'passport_summary' | 'recap_image'

export interface RequestBody {
  title:        string
  author:       string
  isbn?:        string
  currentPage:  number
  totalPages:   number
  percentage:   number
  mode?:        'passport_summary' | 'recap_image'
  from_page?:   number
  // 015-corpus-recaps: when present, the recap handler bypasses the
  // extraction stage and composes directly from the supplied captured
  // page text. Each entry MUST satisfy fromPage < page <= currentPage
  // (the client is responsible for the delta-range filter).
  captures?:    CapturedPage[]
}

export interface RecapImageRequestBody {
  mode: "recap_image"
  recapId: string
  title: string
  author: string | null
  genre: string | null
  memoryJogger: string
  fromPage?: number
  currentPage?: number
  textStageDurationMs?: number
}

export interface CapturedPage {
  page: number
  text: string
}

export interface ExtractionResult {
  chapters_covered:  string[]
  key_events:        string[]
  active_characters: string[]
  current_conflicts: string
  mood:              string
  confidence_level:  'high' | 'medium' | 'low'
}

export interface RecapPayload {
  memory_jogger:     string
  concept_watchlist: string
  thematic_bridge:   string
}

export interface StageLogEntry {
  stage:           'extractor' | 'recap' | 'blurb' | 'passport'
  attempt?:        number
  finishReason?:   string
  blockReason?:    string | null
  safetyRatings?:  unknown
  usage?:          unknown
  rawTextLength?:  number
  rawTextPreview?: string
}
