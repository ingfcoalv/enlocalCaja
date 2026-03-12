import { Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import type { EnLocalAppConfig } from './createApp'

interface TrayCallbacks {
  onOpen: () => void
  onQuit: () => void
  onSync?: () => void
}

let trayInstance: Tray | null = null

export function createTray(config: EnLocalAppConfig, callbacks: TrayCallbacks): Tray {
  const iconPath = config.theme.icon ? path.resolve(config.theme.icon) : undefined
  const icon = iconPath ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }) : nativeImage.createEmpty()

  trayInstance = new Tray(icon)
  trayInstance.setToolTip(config.appName)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Abrir ${config.appName}`,
      click: callbacks.onOpen,
    },
    { type: 'separator' },
    {
      label: 'Estado del servidor',
      sublabel: `Puerto ${config.port}`,
      enabled: false,
    },
    ...(callbacks.onSync
      ? [{ label: 'Sincronizar', click: callbacks.onSync }]
      : []),
    { type: 'separator' },
    {
      label: 'Salir',
      click: callbacks.onQuit,
    },
  ])

  trayInstance.setContextMenu(contextMenu)

  return trayInstance
}

export function updateTrayStatus(status: 'ok' | 'warning' | 'error', tooltip?: string): void {
  if (!trayInstance) return
  if (tooltip) trayInstance.setToolTip(tooltip)
}
