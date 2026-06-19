import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getSessionMock = vi.hoisted(() => vi.fn())
const imageNormalizeMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/supabase', () => ({
  supabase: { auth: { getSession: getSessionMock } },
}))

vi.mock('@/utils/imageNormalize', () => ({
  imageNormalize: (...args: unknown[]) => imageNormalizeMock(...args),
}))

// Imported after the mocks so the composable binds to them.
import { useCapture } from '@/composables/useCapture'

const fakeFile = new File(['x'], 'page.png', { type: 'image/png' })
const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })

beforeEach(() => {
  getSessionMock.mockReset()
  imageNormalizeMock.mockReset()
  setOnline(true)
  getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCapture.importImage', () => {
  it('goes offline without normalizing or calling OCR when offline', async () => {
    setOnline(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const capture = useCapture()
    await capture.importImage(fakeFile)

    expect(capture.state.value).toBe('offline')
    expect(imageNormalizeMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('errors (no OCR call) when the file cannot be normalized', async () => {
    imageNormalizeMock.mockRejectedValue(new Error('not-an-image'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const capture = useCapture()
    await capture.importImage(fakeFile)

    expect(capture.state.value).toBe('error')
    expect(capture.errorMessage.value).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes, runs OCR, and reaches verify on a successful upload', async () => {
    imageNormalizeMock.mockResolvedValue({ base64: 'BASE64', mimeType: 'image/jpeg' })
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ text: 'hello', confidence: 0.9, wordCount: 1 }),
    }))
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const capture = useCapture()
    await capture.importImage(fakeFile)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(capture.ocrResult.value).toEqual({ text: 'hello', confidence: 0.9, wordCount: 1 })
    expect(capture.state.value).toBe('verify')
    expect(capture.previewImage.value?.dataUrl).toBe('data:image/jpeg;base64,BASE64')
  })
})
