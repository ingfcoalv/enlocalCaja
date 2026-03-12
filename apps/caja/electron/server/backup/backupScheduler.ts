import type { BrowserWindow } from 'electron'
import type { SmartBackupService } from './smartBackupService'

export class BackupScheduler {
  private smart: SmartBackupService
  private intervalId: ReturnType<typeof setInterval> | null = null
  private autoBackupHours: number
  private mainWindow: BrowserWindow | null = null
  private isRunning = false

  constructor(smart: SmartBackupService, autoBackupHours = 4) {
    this.smart = smart
    this.autoBackupHours = autoBackupHours
  }

  init(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.startAutoBackup()
    this.checkBackupHealth()
  }

  async onTurnoApertura() {
    try {
      const result = await this.smart.createBackup('apertura')
      this.notify('Respaldo de apertura creado', `${result.sizeMB} MB · ${result.totalRows} registros`, 'success')
      return result
    } catch (error: any) {
      this.notify('Error en respaldo de apertura', error.message, 'error')
      throw error
    }
  }

  async onTurnoCierre() {
    try {
      const result = await this.smart.createBackup('cierre')
      this.notify('Respaldo de cierre creado', `${result.sizeMB} MB · ${result.totalRows} registros`, 'success')
      return result
    } catch (error: any) {
      this.notify('Error en respaldo de cierre', error.message, 'error')
      throw error
    }
  }

  async onAppClose() {
    this.stopAutoBackup()
    try {
      const state = this.smart.loadState()
      if (state.lastBackup) {
        const hours = (Date.now() - new Date(state.lastBackup.timestamp).getTime()) / 3600000
        if (hours < 1) return null
      }
      return await this.smart.createBackup('cierre')
    } catch (error: any) {
      console.error('[Backup] Error al cerrar:', error.message)
      return null
    }
  }

  private startAutoBackup() {
    if (this.isRunning) return
    this.isRunning = true
    const ms = this.autoBackupHours * 3600000

    this.intervalId = setInterval(async () => {
      try {
        const result = await this.smart.createBackup('mediodia')
        console.log(`[Backup] Auto: ${result.sizeMB} MB, ${result.totalRows} registros`)
      } catch (error: any) {
        console.error('[Backup] Error auto:', error.message)
        this.notify('Error en respaldo automático', error.message, 'error')
      }
    }, ms)

    console.log(`[Backup] Auto-respaldo cada ${this.autoBackupHours}h activado`)
  }

  private stopAutoBackup() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      this.isRunning = false
    }
  }

  private checkBackupHealth() {
    const info = this.smart.getBackupInfo()
    if (info.healthStatus.status === 'danger') {
      this.notify('Respaldos', info.healthStatus.message, 'warning')
    }
  }

  private notify(title: string, message: string, type = 'info') {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('backup-notification', {
        title, message, type, timestamp: new Date().toISOString(),
      })
    }
  }
}
