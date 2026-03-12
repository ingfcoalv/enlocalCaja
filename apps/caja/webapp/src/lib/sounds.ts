// Cached Audio element for the order alert MP3
let alertAudio: HTMLAudioElement | null = null

/**
 * Play the new online order alert sound.
 * Uses /alerta_pedidos.mp3 from the public folder.
 */
export function playNewOrderAlert() {
  try {
    if (!alertAudio) {
      alertAudio = new Audio('/alerta_pedidos.mp3')
      alertAudio.volume = 0.8
    }
    // Reset to start in case it's still playing from a previous order
    alertAudio.currentTime = 0
    alertAudio.play().catch(() => { /* autoplay blocked or audio unavailable */ })
  } catch { /* audio not available */ }
}
