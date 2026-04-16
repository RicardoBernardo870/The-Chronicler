import { onUnmounted } from 'vue'
import Quagga from '@ericblade/quagga2'

export type DetectedCallback = (isbn: string) => void

export const useScanner = () => {
  let running = false

  const startScanning = (videoEl: HTMLElement, onDetected: DetectedCallback) => {
    if (running) return

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: videoEl,
          constraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader'],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error('[useScanner] init error', err)
          return
        }
        Quagga.start()
        running = true
      },
    )

    Quagga.onDetected((result) => {
      const code = result.codeResult?.code
      if (!code) return
      // Require at least 2 consistent reads to reduce false positives
      const counts = result.codeResult.decodedCodes
        ?.filter((c) => c.error !== undefined)
        .map((c) => c.error as number)
      const avgError = counts?.length
        ? counts.reduce((a, b) => a + b, 0) / counts.length
        : 1
      if (avgError < 0.15) {
        onDetected(code)
      }
    })
  }

  const stopScanning = () => {
    if (!running) return
    Quagga.stop()
    running = false
  }

  onUnmounted(stopScanning)

  return { startScanning, stopScanning }
}
