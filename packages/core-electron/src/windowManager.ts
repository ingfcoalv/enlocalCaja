import { BrowserWindow } from 'electron'
import path from 'path'

export interface WindowConfig {
  title: string
  icon?: string
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
}

export function createMainWindow(config: WindowConfig): BrowserWindow {
  const win = new BrowserWindow({
    title: config.title,
    width: config.width ?? 1200,
    height: config.height ?? 800,
    minWidth: config.minWidth ?? 800,
    minHeight: config.minHeight ?? 600,
    icon: config.icon ? path.resolve(config.icon) : undefined,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'detach' })
  }

  return win
}
