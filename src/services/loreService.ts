import { supabase } from '@/services/supabase'
import type { LoreType } from '@/types'

export interface LoreGenerateRequest {
  title: string
  author: string
  isbn?: string | null
  currentPage: number
  totalPages: number
  percentage: number
  milestone: number
  masterRecap: string
  /** Titles of lore cards already generated for this book — AI must not repeat them */
  existingTopics?: string[]
}

export interface LoreGenerateResponse {
  title: string
  content: string
  type: LoreType
  linked_entities: string[]
}

/**
 * Thin fetch wrapper for the generate-lore edge function.
 * Attaches the Supabase access token and throws on non-2xx responses.
 */
export const loreService = {
  generate: async (req: LoreGenerateRequest): Promise<LoreGenerateResponse> => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not authenticated')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

    const res = await fetch(`${supabaseUrl}/functions/v1/generate-lore`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
    }

    return res.json() as Promise<LoreGenerateResponse>
  },
}
