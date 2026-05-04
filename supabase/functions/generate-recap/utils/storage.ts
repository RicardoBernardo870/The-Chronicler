// deno-lint-ignore-file no-explicit-any

const BUCKET = "recap-images"

export const uploadRecapImage = async (
  adminClient: any,
  userId: string,
  recapId: string,
  imageBytes: Uint8Array,
): Promise<string> => {
  const path = `${userId}/${recapId}.png`
  const { error } = await adminClient.storage
    .from(BUCKET)
    .upload(path, imageBytes, {
      contentType: "image/png",
      upsert: true,
    })

  if (error) throw error
  return path
}

export const mintSignedUrl = async (
  adminClient: any,
  path: string,
  expiresIn = 60,
): Promise<string> => {
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  if (!data?.signedUrl) throw new Error("Storage did not return a signed URL")
  return data.signedUrl
}
