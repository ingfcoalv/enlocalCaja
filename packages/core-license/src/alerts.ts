import type { ValidationResult } from './types'

export function checkAndShowExpiryAlert(license: ValidationResult, win: any): void {
  if (!license.showExpiryAlert) return

  // Send IPC message to renderer
  if (win?.webContents) {
    win.webContents.send('license:expiry-warning', {
      daysRemaining: license.daysRemaining,
      expiresAt: license.expiresAt,
      plan: license.plan,
    })
  }

  // Show native OS notification
  try {
    const { Notification } = require('electron')
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Licencia por vencer',
        body: `Tu licencia vence en ${license.daysRemaining} día${license.daysRemaining !== 1 ? 's' : ''}. Renueva para evitar interrupciones.`,
        urgency: 'critical',
      })
      notification.show()
    }
  } catch {
    // Not in Electron environment
  }
}
