// deno-lint-ignore-file no-explicit-any
import { refineImagePrompt, type ImagePromptInput } from "../prompts/imagePromptRefiner.ts"
import { uploadRecapImage } from "../utils/storage.ts"

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

const isSafetyResponse = (response: any): boolean => {
  const reason = String(
    response?.promptFeedback?.blockReason
      ?? response?.candidates?.[0]?.finishReason
      ?? "",
  ).toLowerCase()
  return reason.includes("safety") || reason.includes("block") || reason.includes("prohibited")
}

const extractImageBytes = (response: any): Uint8Array => {
  if (isSafetyResponse(response)) {
    throw new ImageGenerationError("safety", "Image generation blocked by safety filters")
  }

  const parts = response?.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data)
  const base64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data
  if (!base64) throw new ImageGenerationError("transient", "Image generation returned no image bytes")

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

const classifyThrownError = (err: unknown): ImageGenerationError => {
  if (err instanceof ImageGenerationError) return err
  const status = Number((err as { status?: number })?.status ?? (err as { code?: number })?.code ?? 0)
  const message = err instanceof Error ? err.message : String(err)
  if (status === 429 || status >= 500 || /network|fetch|timeout|temporar/i.test(message)) {
    return new ImageGenerationError("transient", message)
  }
  return new ImageGenerationError("transient", message)
}

const generateImageBytes = async (ai: any, prompt: string): Promise<Uint8Array> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["IMAGE"],
      },
    })
    return extractImageBytes(response)
  } catch (err) {
    throw classifyThrownError(err)
  }
}

export const handleImageGeneration = async (
  adminClient: any,
  ai: any,
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
      imageBytes = await generateImageBytes(ai, prompt)
    } catch (err) {
      const imageErr = classifyThrownError(err)

      if (imageErr.kind === "safety") {
        safetyRetryUsed = true
        prompt = await refineImagePrompt(ai, { ...job, softer: true })
        try {
          imageBytes = await generateImageBytes(ai, prompt)
        } catch (retryErr) {
          const retryImageErr = classifyThrownError(retryErr)
          finalStatus = retryImageErr.kind === "safety" ? "failed_safety" : "failed_transient"
        }
      } else {
        transientRetryUsed = true
        await sleep(job.retryBackoffMs ?? 2000)
        try {
          imageBytes = await generateImageBytes(ai, prompt)
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
