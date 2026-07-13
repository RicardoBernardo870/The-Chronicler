// deno-lint-ignore-file no-explicit-any
// Synced with the deployed generate-recap (v84, 2026-07-13): full-frame
// square composition guidance, "source recap is the source of truth" rule,
// gemini refinement at temperature 0.4 / 4096 tokens.
import { DEFAULT_THINKING_CONFIG } from "../aiClient.ts"

export interface ImagePromptInput {
  bookTitle: string
  bookAuthor: string | null
  bookGenre: string | null
  memoryJogger: string
  pageRange?: {
    fromPage: number
    toPage: number
  }
  softer?: boolean
}

const compact = (text: string): string => text.replace(/\s+/g, " ").trim()

const stripPromptWrapping = (text: string): string => {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:text)?\s*([\s\S]*?)\s*```/)
  const unwrapped = fenceMatch ? fenceMatch[1].trim() : trimmed
  return unwrapped
    .replace(/^final prompt:\s*/i, "")
    .replace(/^prompt:\s*/i, "")
    .trim()
}

const buildFallbackPrompt = (input: ImagePromptInput): string => {
  const source = compact(input.memoryJogger)
  const softer = input.softer
    ? "Use a softer, atmospheric treatment with silhouettes, implied action, reduced literal intensity, and subdued detail."
    : "Use a direct, cinematic depiction of the central visible moment."

  return compact(
    `${source}. ${softer} Choose the last scene you can identify from the source and preserve all specific character names, locations, and unique terms exactly as written. Use professional cinematography and image-generation language: dynamic camera angle, clear subject focus, volumetric lighting, chiaroscuro, global illumination, 8k detail, atmospheric depth, and a cohesive sensory mood. Keep character appearance consistent with the literary source and do not add plot events beyond the provided recap.`,
  )
}

const buildRefinementRequest = (input: ImagePromptInput): string => {
  const softer = input.softer
    ? "This is a safety retry: make the prompt less graphic and less literal while preserving the named entities and scene identity."
    : "Make the prompt visually rich and faithful."

  return `Refine the source recap into a single final image-generation prompt for a recap illustration.

Book title: ${input.bookTitle}
Book author: ${input.bookAuthor ?? "Unknown"}
Book genre: ${input.bookGenre ?? "Unknown"}
Source recap:
${input.memoryJogger}

Guidelines:
- Do Not Scrub: keep all specific character names, locations, and unique terms exactly as they appear in the source recap.
- Visual Fidelity: use professional photography, cinematography, and high-end render terms such as anamorphic lens, volumetric lighting, chiaroscuro, global illumination, depth of field, and production design when appropriate.
- Composition: define the camera angle and focus, such as low-angle hero shot, wide-angle landscape, close-up macro, over-the-shoulder framing, foreground/background separation, and visual hierarchy.
-Full-Frame Square Image: the final image will be 1024x1024, so compose the scene to fully occupy a square frame edge-to-edge. Avoid letterboxing, pillarboxing, black bars, embedded borders, or any movie-screen framing effect. Ensure the composition is designed natively for a full square image, with important subjects and environmental storytelling filling the frame naturally.
- Atmosphere: describe the vibe with sensory details grounded in the source, such as light, texture, weather, temperature, sound, smell, or material detail.
- Consistency: ensure characters match their canonical literary descriptions when known, while avoiding contradictions with the source recap.
- Source recap is the source of truth nothing else.
- Minimal invention: do not add new characters, locations, objects, relationships, or events not present in the source recap unless they are basic visual staging needed for an image.
- ${softer}

Output Format:
Provide only the final prompt. No labels, no markdown, no JSON, no commentary.`
}

export const refineImagePrompt = async (ai: any, input: ImagePromptInput): Promise<string> => {
  const fallback = buildFallbackPrompt(input)

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: buildRefinementRequest(input) }] }],
      config: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    })

    const refined = stripPromptWrapping((response as any).text ?? "")
    return refined ? refined : fallback
  } catch (err) {
    console.error("Image prompt refinement failed:", String(err).slice(0, 500))
    return fallback
  }
}
