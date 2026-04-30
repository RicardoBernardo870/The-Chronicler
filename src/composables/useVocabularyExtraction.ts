import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/auth'
import { useLexiconStore } from '@/stores/lexicon'

/**
 * 016 — Auto-vocabulary extraction trigger.
 *
 * Fire-and-forget: callers must NOT await this. The capture flow has already
 * completed by the time this runs; any failure here is silent and never
 * surfaces to the user (FR-020, FR-021).
 *
 * Flow:
 *   1. INSERT vocabulary_extractions ledger row (pending). Idempotent by
 *      capture_id unique constraint — re-captures of same capture_id no-op.
 *   2. Call extract-vocabulary edge function with the OCR text.
 *   3. Dedup candidates against existing lexicon_entries for this user
 *      (case-insensitive on term).
 *   4. INSERT survivors into lexicon_entries with source='auto'.
 *   5. UPDATE the ledger row to 'succeeded' / 'skipped' / 'failed'.
 */

interface TriggerInput {
  captureId: string
  bookId: string
  page: number
  ocrText: string
}

const PROPER_NOUN_RE = /^[A-Z]/

const sentenceContaining = (text: string, word: string): string | null => {
  // Cheap split — good enough for an in-context anchor sentence.
  const sentences = text.split(/(?<=[.!?])\s+/)
  const lower = word.toLowerCase()
  for (const s of sentences) {
    if (s.toLowerCase().includes(lower)) return s.trim().slice(0, 280)
  }
  return null
}

const looksLikeProperNoun = (word: string, ocrText: string): boolean => {
  // The word IS capitalized in OCR text AND not at sentence start.
  if (!PROPER_NOUN_RE.test(word)) return false
  const idx = ocrText.indexOf(word)
  if (idx <= 0) return false
  // Look at preceding non-space char
  const before = ocrText.slice(0, idx).trimEnd()
  const lastChar = before[before.length - 1]
  if (!lastChar) return false
  return !/[.!?]/.test(lastChar)
}

const _runExtraction = async (input: TriggerInput): Promise<void> => {
  const authStore = useAuthStore()
  if (!authStore.user) return
  const userId = authStore.user.id

  // Step 1: ledger insert (idempotent on capture_id unique constraint)
  const { data: ledgerData, error: ledgerErr } = await supabase
    .from('vocabulary_extractions')
    .insert({
      user_id: userId,
      capture_id: input.captureId,
      book_id: input.bookId,
      page: input.page,
      status: 'pending',
    })
    .select('id')
    .single()

  if (ledgerErr) {
    // Unique violation = already processed; nothing to do.
    if ((ledgerErr as { code?: string }).code === '23505') return
    console.warn('[vocab] ledger insert failed', ledgerErr)
    return
  }
  const ledgerRowId = (ledgerData as { id: string }).id

  // Step 2: invoke edge function
  let words: { word: string; definition: string }[] = []
  try {
    const { data, error } = await supabase.functions.invoke('extract-vocabulary', {
      body: { ocrText: input.ocrText },
    })
    if (error) throw error
    words = Array.isArray(data?.words) ? data.words : []
  } catch (err) {
    console.warn('[vocab] edge function failed', err)
    await supabase
      .from('vocabulary_extractions')
      .update({ status: 'failed', error_message: String((err as Error)?.message ?? err) })
      .eq('id', ledgerRowId)
    return
  }

  if (words.length === 0) {
    await supabase
      .from('vocabulary_extractions')
      .update({ status: 'skipped', words_added: 0 })
      .eq('id', ledgerRowId)
    return
  }

  // Step 3: dedup against existing lexicon_entries (case-insensitive)
  const candidateTerms = words
    .filter(w => !looksLikeProperNoun(w.word, input.ocrText))
    .map(w => ({ ...w, lower: w.word.toLowerCase() }))

  if (candidateTerms.length === 0) {
    await supabase
      .from('vocabulary_extractions')
      .update({ status: 'skipped', words_added: 0 })
      .eq('id', ledgerRowId)
    return
  }

  const { data: existing, error: existErr } = await supabase
    .from('lexicon_entries')
    .select('term')
    .eq('user_id', userId)
    .in('term', candidateTerms.map(c => c.word))   // exact-case match
  if (existErr) {
    console.warn('[vocab] existing lookup failed', existErr)
  }

  // Also fetch lowercase comparison — Supabase doesn't have a direct
  // case-insensitive `in` filter, so we additionally fetch a broader
  // set and compare client-side.
  const { data: existingByLowerSeed } = await supabase
    .from('lexicon_entries')
    .select('term')
    .eq('user_id', userId)
  const existingLower = new Set<string>(
    [
      ...((existing as { term: string }[] | null) ?? []),
      ...((existingByLowerSeed as { term: string }[] | null) ?? []),
    ].map(r => r.term.toLowerCase())
  )

  const survivors = candidateTerms.filter(c => !existingLower.has(c.lower))

  if (survivors.length === 0) {
    await supabase
      .from('vocabulary_extractions')
      .update({ status: 'skipped', words_added: 0 })
      .eq('id', ledgerRowId)
    return
  }

  // Step 4: insert into lexicon_entries
  const nowIso = new Date().toISOString()
  const tomorrowIso = new Date(Date.now() + 86_400_000).toISOString()
  const rows = survivors.map(s => ({
    user_id: userId,
    book_id: input.bookId,
    term: s.word,
    definition: s.definition,
    entry_type: 'dictionary',
    context_sentence: sentenceContaining(input.ocrText, s.word),
    page_found: input.page,
    leitner_box: 1,
    next_review_at: tomorrowIso,
    created_at: nowIso,
    source: 'auto',
  }))

  const { error: insertErr } = await supabase.from('lexicon_entries').insert(rows)
  if (insertErr) {
    console.warn('[vocab] lexicon insert failed', insertErr)
    await supabase
      .from('vocabulary_extractions')
      .update({ status: 'failed', error_message: String(insertErr.message ?? insertErr) })
      .eq('id', ledgerRowId)
    return
  }

  // Step 5: ledger success + force lexicon store revalidation so the
  // Vocabulary Garden picks up the new rows on next visit.
  await supabase
    .from('vocabulary_extractions')
    .update({ status: 'succeeded', words_added: rows.length })
    .eq('id', ledgerRowId)

  try {
    const lexiconStore = useLexiconStore()
    await lexiconStore.fetchEntriesForAllBooks()
  } catch {
    // Non-critical — store will refresh next time it's read.
  }
}

export const useVocabularyExtraction = () => {
  const triggerExtraction = (input: TriggerInput): void => {
    // Fire-and-forget. Catch absolutely everything.
    void _runExtraction(input).catch(err => {
      console.warn('[vocab] extraction failed', err)
    })
  }

  return { triggerExtraction }
}
