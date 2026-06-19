// Normalizes an uploaded image (e.g. an ebook screenshot — possibly a large
// high-resolution PNG or a HEIC photo) into a base64 `image/jpeg` that fits the
// ocr-page edge function's limits (`image/jpeg`/`image/png`, <= 5 MB decoded).
// The image is downscaled so its long edge is <= MAX_EDGE and re-encoded as JPEG,
// so the reader never has to resize or convert anything by hand (033 / FR-007).

const MAX_EDGE = 2000
const JPEG_QUALITY = 0.85

export interface NormalizedImage {
  base64: string // no `data:` prefix
  mimeType: 'image/jpeg'
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('not-an-image'))
    }
    img.src = url
  })

/**
 * Decode `file`, downscale to fit MAX_EDGE, and return base64 JPEG bytes.
 * Throws if the file cannot be decoded as an image (e.g. a non-image file, or a
 * format the browser can't decode such as HEIC on some browsers).
 */
export const imageNormalize = async (file: File): Promise<NormalizedImage> => {
  const img = await loadImage(file)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) throw new Error('not-an-image')

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * scale))
  const targetH = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unavailable')
  ctx.drawImage(img, 0, 0, targetW, targetH)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')
  return { base64, mimeType: 'image/jpeg' }
}
