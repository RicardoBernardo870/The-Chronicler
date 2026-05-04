// deno-lint-ignore-file no-explicit-any
import { refineImagePrompt, type ImagePromptInput } from "../prompts/imagePromptRefiner.ts"
import { uploadRecapImage } from "../utils/storage.ts"
import type { OpenAIClient } from "../openaiClient.ts"

type FinalImageStatus = "succeeded" | "failed_safety" | "failed_transient"

export interface ImageGenerationJob extends ImagePromptInput {
  recapId: string
  userId: string
  textStageDurationMs?: number
  retryBackoffMs?: number
}

class ImageGenerationError extends Error {
  constructor(readonly kind: "safety" | "transient", message: string) {
    super(message)
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const updateRecapImage = async (
  adminClient: any,
  recapId: string,
  userId: string,
  values: Record<string, unknown>,
): Promise<void> => {
  const { error } = await adminClient
    .from("recaps")
    .update(values)
    .eq("id", recapId)
    .eq("user_id", userId)
  if (error) throw error
}

const classifyThrownError = (err: unknown): ImageGenerationError => {
  if (err instanceof ImageGenerationError) return err
  const status = Number((err as { status?: number })?.status ?? (err as { code?: number })?.code ?? 0)
  const message = err instanceof Error ? err.message : String(err)
  if (/safety|policy|moderation|content policy|blocked/i.test(message)) {
    return new ImageGenerationError("safety", message)
  }
  if (status === 429 || status >= 500 || /network|fetch|timeout|temporar/i.test(message)) {
    return new ImageGenerationError("transient", message)
  }
  return new ImageGenerationError("transient", message)
}

const generateImageBytes = async (openai: OpenAIClient, prompt: string): Promise<Uint8Array> => {
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openai.imageModel,
        prompt,
        size: "1024x1024",
        n: 1,
        quality: "low",
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = payload?.error?.message ?? `OpenAI image generation failed with HTTP ${response.status}`
      const kind = response.status === 429 || response.status >= 500
        ? "transient"
        : /safety|policy|moderation|content policy|blocked/i.test(message)
          ? "safety"
          : "transient"
      throw new ImageGenerationError(kind, message)
    }

    const base64 = payload?.data?.[0]?.b64_json
    if (!base64) {
      throw new ImageGenerationError("transient", "OpenAI image generation returned no image bytes")
    }

    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  } catch (err) {
    throw classifyThrownError(err)
  }
}

export const handleImageGeneration = async (
  adminClient: any,
  ai: any,
  openai: OpenAIClient,
  job: ImageGenerationJob,
): Promise<void> => {
  const startedAt = Date.now()
  let transientRetryUsed = false
  let safetyRetryUsed = false
  let finalStatus: FinalImageStatus = "failed_transient"

  try {
    await updateRecapImage(adminClient, job.recapId, job.userId, {
      image_status: "pending",
      image_path: null,
      image_generated_at: null,
    })

    let prompt = await refineImagePrompt(ai, job)
    let imageBytes: Uint8Array | null = null

    try {
      imageBytes = await generateImageBytes(openai, prompt)
    } catch (err) {
      const imageErr = classifyThrownError(err)

      if (imageErr.kind === "safety") {
        safetyRetryUsed = true
        prompt = await refineImagePrompt(ai, { ...job, softer: true })
        try {
          imageBytes = await generateImageBytes(openai, prompt)
        } catch (retryErr) {
          const retryImageErr = classifyThrownError(retryErr)
          finalStatus = retryImageErr.kind === "safety" ? "failed_safety" : "failed_transient"
        }
      } else {
        transientRetryUsed = true
        await sleep(job.retryBackoffMs ?? 2000)
        try {
          imageBytes = await generateImageBytes(openai, prompt)
        } catch {
          finalStatus = "failed_transient"
        }
      }
    }

    if (!imageBytes) {
      await updateRecapImage(adminClient, job.recapId, job.userId, {
        image_status: finalStatus,
        image_path: null,
      })
      return
    }

    const path = await uploadRecapImage(adminClient, job.userId, job.recapId, imageBytes)
    finalStatus = "succeeded"
    await updateRecapImage(adminClient, job.recapId, job.userId, {
      image_status: finalStatus,
      image_path: path,
      image_generated_at: new Date().toISOString(),
    })
  } finally {
    console.log(JSON.stringify({
      stage: "recap_image",
      recap_id: job.recapId,
      text_stage_duration_ms: job.textStageDurationMs ?? null,
      image_stage_duration_ms: Date.now() - startedAt,
      transient_retry_used: transientRetryUsed,
      safety_retry_used: safetyRetryUsed,
      final_image_status: finalStatus,
    }))
  }
}
