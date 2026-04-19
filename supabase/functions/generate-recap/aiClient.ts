// deno-lint-ignore-file no-explicit-any
import { GoogleGenAI } from "npm:@google/genai"

/**
 * Disable Gemini 2.5 Flash "thinking tokens". Thinking tokens consume the
 * maxOutputTokens budget and can starve visible output (observed earlier as
 * intermittent empty-text responses on sibling generate-lore function).
 */
export const DEFAULT_THINKING_CONFIG = { thinkingBudget: 0 } as const

/**
 * Returns a configured Gemini client or null if GEMINI_API_KEY is missing.
 * Callers should surface a 503 to the user when this returns null.
 */
export const createGeminiClient = (): any | null => {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}
