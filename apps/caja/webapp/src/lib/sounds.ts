// Cached Audio element for the order alert MP3
let alertAudio: HTMLAudioElement | null = null

/**
 * Play the new online order alert sound.
 * Uses alerta_pedidos.mp3 from the public folder.
 * Recreates the Audio element on error to recover from broken state.
 */
export function playNewOrderAlert() {
  try {
    if (!alertAudio) {
      alertAudio = new Audio('./alerta_pedidos.mp3')
      alertAudio.volume = 0.8
    }
    // Reset to start in case it's still playing from a previous order
    alertAudio.currentTime = 0
    alertAudio.play().catch((err) => {
      console.warn('[sounds] Audio play failed, recreating element:', err.message)
      // Recreate on next call to recover from error state
      alertAudio = null
    })
  } catch {
    alertAudio = null
  }
}
