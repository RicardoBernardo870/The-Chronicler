export interface OpenAIClient {
  apiKey: string
  imageModel: string
}

export const createOpenAIClient = (): OpenAIClient | null => {
  const apiKey = Deno.env.get("OPENAI_API_KEY")
  if (!apiKey) return null

  return {
    apiKey,
    imageModel:"gpt-image-2",
  }
}
