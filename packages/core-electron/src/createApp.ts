import { app, BrowserWindow } from 'electron'
import path from 'path'
import { createMainWindow } from './windowManager'
import { createTray } from './tray'
import { registerAllIPCHandlers } from './ipc'

export interface EnLocalAppConfig {
  appId: string
  appName: string
  port: number
  multiuser: boolean
  theme: {
    primaryColor: string
    icon: string
  }
  onReady: (win: BrowserWindow) => Promise<void>
}

export function createEnLocalApp(config: EnLocalAppConfig): void {
  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.setName(config.appName)

  app.whenReady().then(async () => {
    // Register IPC handlers
    registerAllIPCHandlers()

    // Create main window
    const win = createMainWindow({
      title: config.appName,
      icon: config.theme.icon,
      width: 1200,
      height: 800,
    })

    // Create system tray
    createTray(config, {
      onOpen: () => win.show(),
      onQuit: () => app.quit(),
    })

    // Call the app-specific onReady callback
    await config.onReady(win)
  })

  app.on('window-all-closed', () => {
    // On macOS, apps typically stay active until explicit quit
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('second-instance', () => {
    // Focus existing window when a second instance is launched
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}
