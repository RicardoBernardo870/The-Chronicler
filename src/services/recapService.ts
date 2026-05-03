import { supabase } from '@/services/supabase'
import type { StreamingRecap } from '@/types'

export type StreamRecapResult = StreamingRecap & { aborted: boolean }

export interface RecapRequest {
  title: string
  author: string
  isbn?: string | null
  percentage: number
  currentPage: number
  totalPages: number
  /** Start of the incremental recap range. AI covers from_page+1 → currentPage only. Omit for full recap from page 1. */
  from_page?: number
  /**
   * 015-corpus-recaps: captured page text within the delta range
   * (fromPage, currentPage]. When supplied, the edge function bypasses the
   * extraction stage and composes the recap directly from this text.
   */
  captures?: Array<{ page: number; text: string }>
}


const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-recap`

/**
 * Calls the generate-recap Edge Function and streams the response.
 * `onToken` is called with each decoded chunk as it arrives.
 * Returns the fully parsed StreamingRecap on completion.
 */
const ABORTED_RESULT: StreamRecapResult = {
  memoryJogger: '',
  conceptWatchlist: '',
  thematicBridge: '',
  aborted: true,
}

export async function streamRecap(
  request: RecapRequest,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<StreamRecapResult> {
  // Low-level transport only. Callers decide when AI is appropriate; completed
  // book imports never route here unless the user explicitly requests a recap.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  if (signal?.aborted) return ABORTED_RESULT

  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
    signal,
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

  try {
    while (true) {
      if (signal?.aborted) return ABORTED_RESULT
      const { done, value } = await reader.read()
      if (done) break
      if (signal?.aborted) return ABORTED_RESULT
      const chunk = decoder.decode(value, { stream: true })
      accumulated += chunk
      onToken(chunk)
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError' || signal?.aborted) return ABORTED_RESULT
    throw err
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
    aborted: false,
  }
}

