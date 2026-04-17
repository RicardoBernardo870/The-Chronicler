import { supabase } from '@/services/supabase'
import type { StreamingRecap } from '@/types'

export interface RecapRequest {
  title: string
  author: string
  isbn?: string | null
  percentage: number
  currentPage: number
  totalPages: number
}

export interface FragmentRequest {
  bookId: string
  bookTitle: string
  bookAuthor: string
  isbn?: string | null
  currentPage: number
  totalPages: number
  percentage: number
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recap`

/**
 * Calls the generate-recap Edge Function and streams the response.
 * `onToken` is called with each decoded chunk as it arrives.
 * Returns the fully parsed StreamingRecap on completion.
 */
export async function streamRecap(
  request: RecapRequest,
  onToken: (text: string) => void,
): Promise<StreamingRecap> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const err = await response.json()
      message = err.error ?? message
    } catch { /* ignore parse errors */ }
    throw new Error(message)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body from Edge Function')

  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    accumulated += chunk
    onToken(chunk)
  }

  // Extract and parse JSON — strip markdown fences if the model added them
  const extractJSON = (text: string): string => {
    const trimmed = text.trim()
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (fenceMatch) return fenceMatch[1].trim()
    const objectMatch = trimmed.match(/\{[\s\S]*\}/)
    if (objectMatch) return objectMatch[0]
    return trimmed
  }

  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(extractJSON(accumulated))
  } catch {
    throw new Error('AI returned an unexpected response format. Please try again.')
  }

  const { memory_jogger, concept_watchlist, thematic_bridge } = parsed
  if (!memory_jogger || !concept_watchlist || !thematic_bridge) {
    throw new Error('Incomplete recap received. Please try again.')
  }

  return {
    memoryJogger: memory_jogger,
    conceptWatchlist: concept_watchlist,
    thematicBridge: thematic_bridge,
  }
}

/**
 * Calls the edge function in extract_only mode (Pass 1 only).
 * Returns the raw extraction JSON, or null on any error (fire-and-forget safe).
 */
export const extractFragment = async (req: FragmentRequest): Promise<Record<string, unknown> | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        title: req.bookTitle,
        author: req.bookAuthor,
        isbn: req.isbn,
        percentage: req.percentage,
        currentPage: req.currentPage,
        totalPages: req.totalPages,
        mode: 'extract_only',
      }),
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
