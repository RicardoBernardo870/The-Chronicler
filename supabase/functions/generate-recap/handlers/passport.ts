// deno-lint-ignore-file no-explicit-any
import { buildPassportSummaryPrompt } from "../prompts/passport.ts"
import { DEFAULT_THINKING_CONFIG } from "../aiClient.ts"
import { corsHeaders } from "../cors.ts"
import type { RequestBody } from "../types.ts"

export const handlePassport = async (ai: any, body: RequestBody): Promise<Response> => {
  const userMsg = `Write the reading journey narrative for "${body.title}" by ${body.author}.${body.isbn ? ` ISBN: ${body.isbn}.` : ""}`

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: userMsg }] }],
    config: {
      systemInstruction: buildPassportSummaryPrompt(body.title, body.author),
      temperature:       0.8,
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
        console.error("Passport summary stream error:", err)
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
