import { ipcMain } from 'electron'

export function registerUpdateHandlers(): void {
  ipcMain.handle('check-update', async () => {
    // Delegated to core-updater in Fase 4
    return { updateAvailable: false }
  })

  ipcMain.handle('install-update', async () => {
    // Delegated to core-updater in Fase 4
    return { success: false, message: 'Updater no configurado' }
  })
}
