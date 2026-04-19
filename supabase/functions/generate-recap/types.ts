// Shared TypeScript types for the generate-recap edge function.

export type Mode = 'blurb' | 'recap' | 'passport_summary'

export interface RequestBody {
  title:        string
  author:       string
  isbn?:        string
  currentPage:  number
  totalPages:   number
  percentage:   number
  mode?:        'passport_summary'
  from_page?:   number
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
