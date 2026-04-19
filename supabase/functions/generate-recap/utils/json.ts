/**
 * Robust JSON extractor for LLM output.
 *
 * Tries, in order:
 *   1. ```json ... ``` fenced block
 *   2. First `{` ... last `}` slice
 *   3. Raw text as-is
 *
 * Returns the JSON **string** (not the parsed object) if any attempt parses
 * successfully, otherwise null. Keeping the string form lets callers choose
 * whether to parse or forward verbatim (e.g. as the recap-stage user message).
 */
export const extractJson = (raw: string): string | null => {
  if (!raw) return null
  const trimmed = raw.trim()

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence) {
    const candidate = fence[1].trim()
    try { JSON.parse(candidate); return candidate } catch { /* fall through */ }
  }

  const first = trimmed.indexOf("{")
  const last  = trimmed.lastIndexOf("}")
  if (first !== -1 && last > first) {
    const candidate = trimmed.slice(first, last + 1)
    try { JSON.parse(candidate); return candidate } catch { /* fall through */ }
  }

  try { JSON.parse(trimmed); return trimmed } catch { /* fall through */ }

  return null
}
