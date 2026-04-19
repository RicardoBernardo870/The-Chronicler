// deno-lint-ignore-file no-explicit-any
import { buildBlurbPrompt } from "../prompts/blurb.ts"
import { DEFAULT_THINKING_CONFIG } from "../aiClient.ts"
import { corsHeaders } from "../cors.ts"
import type { RequestBody } from "../types.ts"

export const handleBlurb = async (ai: any, body: RequestBody): Promise<Response> => {
  const userMsg = `Book: "${body.title}" by ${body.author}.${body.isbn ? ` ISBN: ${body.isbn}.` : ""} The reader is about to start this book. Write the preview.`

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    config: {
      systemInstruction: buildBlurbPrompt(),
      temperature:       0.7,
      maxOutputTokens:   4096,
      thinkingConfig:    DEFAULT_THINKING_CONFIG,
    },
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = (chunk as any).text
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (err) {
        console.error("Blurb stream error:", err)
        controller.error(err)
      }
    },
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  })
}
