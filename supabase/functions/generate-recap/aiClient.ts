// deno-lint-ignore-file no-explicit-any
import { GoogleGenAI } from "npm:@google/genai"

export const DEFAULT_THINKING_CONFIG = { thinkingBudget: 0 } as const

export const createGeminiClient = (): any | null => {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}
