import { onBeforeUnmount, ref } from 'vue'
import { supabase } from '@/services/supabase'

/**
 * Camera + OCR composable (015-corpus-recaps).
 *
 * Encapsulates the lifecycle of a single-shot page capture:
 *   1. Acquire MediaStream (rear camera if available).
 *   2. User snaps; frame is drawn to a hidden canvas, exported as base64 JPEG.
 *   3. Image is POSTed to the ocr-page edge function.
 *   4. State transitions to 'verify' with the OCR result and ephemeral preview.
 *
 * The image bytes never leave the browser except for the single edge-function
 * call. The MediaStream is always released on cancel/unmount.
 */
export type CaptureState =
  | 'idle'
  | 'camera'
  | 'ocr-running'
  | 'verify'
  | 'denied'
  | 'offline'
  | 'error'

export interface OcrResult {
  text: string
  confidence: number
  wordCount: number
}

export interface CapturePreviewImage {
  dataUrl: string
  mimeType: 'image/jpeg'
}

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-page`

export const useCapture = () => {
  const state = ref<CaptureState>('idle')
  const ocrResult = ref<OcrResult | null>(null)
  const previewImage = ref<CapturePreviewImage | null>(null)
  const errorMessage = ref<string | null>(null)

  let stream: MediaStream | null = null
  let videoEl: HTMLVideoElement | null = null
  let snapInFlight = false

  const releaseStream = (): void => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }
    if (videoEl) {
      videoEl.srcObject = null
      videoEl = null
    }
  }

  const clearCaptureResult = (): void => {
    ocrResult.value = null
    previewImage.value = null
    errorMessage.value = null
  }

  /**
   * Acquire camera and bind to the supplied <video> element. Caller owns the
   * element and must keep it mounted while in 'camera' state.
   */
  const startCamera = async (target: HTMLVideoElement): Promise<void> => {
    clearCaptureResult()
    if (!navigator.onLine) {
      state.value = 'offline'
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      state.value = 'denied'
      errorMessage.value = 'Camera not supported on this device'
      return
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      videoEl = target
      videoEl.srcObject = stream
      await videoEl.play()
      state.value = 'camera'
    } catch (err) {
      const name = (err as DOMException)?.name ?? ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        state.value = 'denied'
      } else {
        state.value = 'error'
        errorMessage.value = (err as Error).message ?? 'Could not start camera'
      }
    }
  }

  /**
   * Snap the current video frame, encode as base64 JPEG, send to OCR endpoint.
   * Releases the camera stream regardless of OCR outcome.
   */
  const snap = async (): Promise<void> => {
    if (snapInFlight || !videoEl || !stream) return
    if (!navigator.onLine) {
      state.value = 'offline'
      clearCaptureResult()
      releaseStream()
      return
    }

    snapInFlight = true
    state.value = 'ocr-running'
    clearCaptureResult()

    const canvas = document.createElement('canvas')
    canvas.width = videoEl.videoWidth || 1280
    canvas.height = videoEl.videoHeight || 960
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      state.value = 'error'
      errorMessage.value = 'Could not capture frame'
      releaseStream()
      snapInFlight = false
      return
    }
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    previewImage.value = { dataUrl, mimeType: 'image/jpeg' }
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')

    releaseStream()

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      })

      if (!response.ok) {
        let msg = `OCR failed (HTTP ${response.status})`
        try {
          const err = await response.json()
          msg = err.message ?? err.error ?? msg
        } catch {
          /* ignore */
        }
        throw new Error(msg)
      }

      const data = (await response.json()) as OcrResult
      ocrResult.value = data
      state.value = 'verify'
    } catch (err) {
      state.value = 'error'
      errorMessage.value = (err as Error).message ?? 'OCR failed'
      previewImage.value = null
    } finally {
      snapInFlight = false
    }
  }

  const retake = (): void => {
    releaseStream()
    clearCaptureResult()
    state.value = 'camera'
  }

  const cancel = (): void => {
    releaseStream()
    clearCaptureResult()
    state.value = 'idle'
  }

  onBeforeUnmount(() => {
    releaseStream()
    previewImage.value = null
  })

  return {
    state,
    ocrResult,
    previewImage,
    errorMessage,
    startCamera,
    snap,
    retake,
    cancel,
  }
}
