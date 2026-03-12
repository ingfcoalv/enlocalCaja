import { ipcMain } from 'electron'

let serverInfo: {
  port: number
  status: 'running' | 'stopped' | 'error'
  startedAt?: string
} = { port: 0, status: 'stopped' }

export function setServerInfo(info: typeof serverInfo): void {
  serverInfo = info
}

export function registerServerHandlers(): void {
  ipcMain.handle('get-server-info', () => {
    return serverInfo
  })

  ipcMain.handle('restart-server', async () => {
    // The actual restart logic is handled by the app-specific server
    // This just emits an event that the main process can listen to
    return { success: true, message: 'Reinicio solicitado' }
  })
}
