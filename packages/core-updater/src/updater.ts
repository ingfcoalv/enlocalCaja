import { autoUpdater } from 'electron-updater'
import { app } from 'electron'

export interface UpdateConfig {
  updateServer?: string
  onStatusChange?: (status: UpdateStatus) => void
  createSmartBackup?: () => Promise<any>
  createFullDump?: () => Promise<any>
}

export type UpdateStatus = {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'backing-up' | 'downloaded' | 'error' | 'up-to-date'
  version?: string
  progress?: number
  error?: string
}

let updateCheckInterval: ReturnType<typeof setInterval> | null = null
let currentConfig: UpdateConfig | null = null
let pendingVersion: string | null = null

function emit(status: UpdateStatus) {
  currentConfig?.onStatusChange?.(status)
}

export function setupAutoUpdate(config: UpdateConfig): void {
  currentConfig = config

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  if (config.updateServer) {
    autoUpdater.setFeedURL({ provider: 'generic', url: config.updateServer })
  }

  autoUpdater.on('checking-for-update', () => {
    emit({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version
    emit({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    emit({ state: 'up-to-date', version: app.getVersion() })
  })

  autoUpdater.on('download-progress', (progress) => {
    emit({ state: 'downloading', version: pendingVersion || undefined, progress: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  autoUpdater.on('error', (err) => {
    console.error('[core-updater] Error:', err.message)
    emit({ state: 'error', error: err.message })
  })

  // Check on startup (silent — errors go to 'error' event)
  autoUpdater.checkForUpdates().catch(() => {})

  // Check every 4 hours
  updateCheckInterval = setInterval(
    () => autoUpdater.checkForUpdates().catch(() => {}),
    4 * 60 * 60 * 1000
  )
}

export function stopAutoUpdate(): void {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
    updateCheckInterval = null
  }
}

export async function checkForUpdatesManual(): Promise<void> {
  emit({ state: 'checking' })
  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    emit({ state: 'error', error: err.message })
  }
}

export async function downloadAndInstall(): Promise<void> {
  if (!currentConfig) {
    emit({ state: 'error', error: 'Updater no inicializado' })
    return
  }

  try {
    // Step 1: Backups
    emit({ state: 'backing-up', version: pendingVersion || undefined })

    if (currentConfig.createSmartBackup) {
      try {
        await currentConfig.createSmartBackup()
      } catch (err: any) {
        emit({ state: 'error', error: `Error en respaldo inteligente: ${err.message}` })
        return
      }
    }

    if (currentConfig.createFullDump) {
      try {
        await currentConfig.createFullDump()
      } catch (err: any) {
        emit({ state: 'error', error: `Error en dump completo: ${err.message}` })
        return
      }
    }

    // Step 2: Download
    emit({ state: 'downloading', version: pendingVersion || undefined, progress: 0 })
    await autoUpdater.downloadUpdate()
    // 'update-downloaded' event will call quitAndInstall
  } catch (err: any) {
    emit({ state: 'error', error: `Error al descargar: ${err.message}` })
  }
}
