import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import config from '../app.config'
import { startServer } from './server'
import {
  validateLicense,
  activateLicense,
  loginWithPin,
  getEnabledModules,
  getTerminalToken,
  fetchFullLicenseStatus,
  generateFingerprint,
  readLicenseFile,
  registerTrial,
  startOfflineTrial,
  getTrialStatus,
} from '@enlocal/core-license'
import { PgManager } from '@enlocal/core-electron'
import { setupAutoUpdate, stopAutoUpdate, checkForUpdatesManual, downloadAndInstall } from '@enlocal/core-updater'

// ─── Startup log for diagnostics ───
const logDir = path.join(
  process.env.APPDATA || process.env.HOME || '',
  'enLocal',
)
try { fs.mkdirSync(logDir, { recursive: true }) } catch {}
const logFile = path.join(logDir, 'caja-startup.log')
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  try { fs.appendFileSync(logFile, line) } catch {}
  console.log(msg)
}

log(`=== enLocal Caja starting (PID ${process.pid}) ===`)
log(`resourcesPath: ${(process as any).resourcesPath}`)
log(`NODE_ENV: ${process.env.NODE_ENV}`)
log(`platform: ${process.platform}`)

let launcherWindow: BrowserWindow | null = null
let posWindow: BrowserWindow | null = null
const pgManager = new PgManager({ port: config.pgPort, log })

// Server state
let serverRunning = false
let serverPort = config.port
let maxConnections = 1
let currentConnections = 0

// Backup scheduler reference (set after server starts)
let backupSchedulerRef: any = null

// FullDumpService for pre-update backups
let fullDumpService: any = null

// Trial state
let isTrialMode = false
let trialCheckInterval: ReturnType<typeof setInterval> | null = null

// ─── Helpers ───

function getLanUrl(port: number): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return `http://${iface.address}:${port}`
      }
    }
  }
  return `http://localhost:${port}`
}

function sendToLauncher(channel: string, ...args: unknown[]) {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.webContents.send(channel, ...args)
  }
}

// ─── Launcher Window ───

function createLauncherWindow() {
  launcherWindow = new BrowserWindow({
    width: 480,
    height: 870,
    resizable: false,
    maximizable: false,
    title: `${config.appName} — Panel de Control`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const launcherPath = path.join(__dirname, 'launcher', 'launcher.html')
  launcherWindow.loadFile(launcherPath)

  launcherWindow.on('close', (e) => {
    if (serverRunning && currentConnections > 0) {
      const choice = dialog.showMessageBoxSync(launcherWindow!, {
        type: 'warning',
        buttons: ['Cerrar de todos modos', 'Cancelar'],
        defaultId: 1,
        title: 'Cerrar enLocal Caja',
        message: `Hay ${currentConnections} dispositivo(s) conectado(s).`,
        detail: 'Cerrar el panel de control detendrá el servidor y desconectará todos los dispositivos.',
      })
      if (choice === 1) {
        e.preventDefault()
        return
      }
    }
  })

  launcherWindow.on('closed', () => {
    launcherWindow = null
  })
}

// ─── POS Window ───

function createPosWindow() {
  if (posWindow && !posWindow.isDestroyed()) {
    posWindow.focus()
    return
  }

  const url = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5175'
    : `http://localhost:${serverPort}`

  posWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: config.appName,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  posWindow.maximize()

  posWindow.loadURL(url)

  posWindow.on('closed', () => {
    posWindow = null
  })
}

// ─── Boot Sequence ───

async function startBootSequence() {
  sendToLauncher('show-section', 'booting')

  try {
    // Step 1: PostgreSQL
    sendToLauncher('boot-progress', { step: 'pg', progress: 0.1, detail: 'Iniciando PostgreSQL...' })
    log('[PgManager] ensureReady...')
    await pgManager.ensureReady()

    sendToLauncher('boot-progress', { step: 'db', progress: 0.25, detail: 'Verificando base de datos...' })
    log('[PgManager] ensureDatabase...')
    await pgManager.ensureDatabase(config.dbName)
    log('[PgManager] OK')

    // Step 2: License validation (non-blocking, uses local file as fallback)
    sendToLauncher('boot-progress', { step: 'license', progress: 0.4, detail: 'Validando licencia...' })
    let enabledModules = [...config.modules.default]
    let licenseValid = false
    let resolvedMaxTerminals = 1

    // ─── Check trial status first ───
    const trialStatus = getTrialStatus()
    log(`[Trial] status: isTrial=${trialStatus.isTrial} registered=${trialStatus.isRegistered} expired=${trialStatus.isExpired} graceExpired=${trialStatus.offlineGraceExpired} daysRemaining=${trialStatus.daysRemaining}`)

    if (trialStatus.isTrial) {
      // ─── Trial flow ───
      if (trialStatus.isExpired) {
        log('[Trial] EXPIRED — blocking boot')
        sendToLauncher('show-section', 'trial-expired')
        return
      }

      if (trialStatus.offlineGraceExpired) {
        log('[Trial] OFFLINE GRACE EXPIRED — need internet')
        sendToLauncher('show-section', 'trial-offline-expired')
        return
      }

      // Trial not registered — try registering now
      if (!trialStatus.isRegistered) {
        try {
          log('[Trial] Attempting cloud registration...')
          const regResult = await registerTrial({
            cloudApiUrl: config.cloudApiUrl,
            appId: config.appId,
            productCode: config.productCode,
            version: app.getVersion(),
          })
          if (!regResult.success) {
            log(`[Trial] Cloud returned expired: ${regResult.message}`)
            sendToLauncher('show-section', 'trial-expired')
            return
          }
          log('[Trial] Registered successfully in cloud')
        } catch (regErr) {
          log(`[Trial] Cloud registration failed (continuing in offline grace): ${(regErr as Error).message}`)
        }
      }

      // Trial is active — enable ALL modules
      isTrialMode = true
      licenseValid = true
      enabledModules = [...config.modules.default, ...config.modules.addons]
      resolvedMaxTerminals = 1
      log('[Trial] Active — all modules enabled')
    }

    // ─── Licensed flow (has terminal token and NOT a trial) ───
    const terminalToken = getTerminalToken()
    if (!licenseValid && terminalToken) {
      const fp = generateFingerprint()
      const lf = readLicenseFile(fp)

      // Skip cloud check for trial tokens (already handled above)
      if (lf?.licenseState !== 'trial') {
        // ─── Direct cloud check (fail-safe before validator) ───
        try {
          log(`[License] Local file: state=${lf?.licenseState} plan=${lf?.plan} expires=${lf?.expiresAt}`)

          if (lf?.terminalToken) {
            const checkParams = new URLSearchParams({
              terminal_token: lf.terminalToken,
              hardware_fingerprint: fp,
              product_code: config.productCode,
            })
            const checkResp = await fetch(`${config.cloudApiUrl}/api/v1/licenses/validate?${checkParams}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            })
            log(`[License] Cloud check: HTTP ${checkResp.status}`)

            if (!checkResp.ok) {
              const errorText = await checkResp.text()
              log(`[License] Cloud error body: ${errorText}`)
              const lower = errorText.toLowerCase()
              if (lower.includes('revoc') || lower.includes('revok')) {
                log('[License] REVOKED by cloud — deleting license and blocking boot')
                const { deleteLicenseFile: delLic } = await import('@enlocal/core-license')
                delLic()
                sendToLauncher('license-revoked')
                return
              }
              if (lower.includes('otro producto') || lower.includes('inválido') || lower.includes('expirado')) {
                log('[License] Cloud rejected license — deleting and blocking boot')
                const { deleteLicenseFile: delLic } = await import('@enlocal/core-license')
                delLic()
                sendToLauncher('boot-error', {
                  message: 'La licencia no es válida para este producto. Activa una licencia válida.',
                })
                return
              }
            }
          }
        } catch (checkErr) {
          log(`[License] Direct cloud check failed (will continue): ${(checkErr as Error).message}`)
        }

        // ─── Standard validation via validator ───
        try {
          const result = await validateLicense({
            cloudApiUrl: config.cloudApiUrl,
            appId: config.appId,
            productCode: config.productCode,
          })
          log(`[License] Validation result: valid=${result.valid} reason=${result.reason} plan=${result.plan} state=${result.licenseState} maxTerminals=${result.maxTerminals}`)

          // ─── Block boot if license is not valid ───
          if (!result.valid) {
            if (result.reason === 'LICENSE_REVOKED') {
              log('[License] LICENSE REVOKED — blocking boot')
              sendToLauncher('license-revoked')
            } else if (result.reason === 'TRIAL_EXPIRED') {
              log('[License] TRIAL EXPIRED — blocking boot')
              sendToLauncher('show-section', 'trial-expired')
            } else if (result.reason === 'TRIAL_OFFLINE_GRACE_EXPIRED') {
              log('[License] TRIAL OFFLINE GRACE EXPIRED — need internet')
              sendToLauncher('show-section', 'trial-offline-expired')
            } else if (result.reason === 'OFFLINE_GRACE_EXPIRED') {
              log('[License] OFFLINE GRACE EXPIRED — blocking boot')
              sendToLauncher('boot-error', {
                message: 'La licencia no ha podido validarse en los últimos 7 días. Conecta a internet para continuar.',
              })
            } else if (result.reason === 'LICENSE_EXPIRED') {
              log('[License] LICENSE EXPIRED — blocking boot')
              sendToLauncher('boot-error', {
                message: 'La licencia ha expirado. Renueva tu licencia para continuar usando el sistema.',
              })
            } else if (result.reason === 'NO_LICENSE_FILE') {
              log('[License] No license file — showing welcome')
              sendToLauncher('show-section', 'welcome')
            } else {
              log(`[License] Invalid license (reason=${result.reason}) — showing activation`)
              sendToLauncher('boot-error', {
                message: 'La licencia no es válida. Activa una licencia válida para continuar.',
              })
            }
            return
          }

          isTrialMode = false
          licenseValid = true
          enabledModules = getEnabledModules(config.appId, result.plan, result.addons)
          resolvedMaxTerminals = result.maxTerminals ?? 1
        } catch (err) {
          log(`[License] Validation error: ${(err as Error).message}`)
          // Check local license file state — may already be marked revoked/expired
          try {
            const fp2 = generateFingerprint()
            const lf2 = readLicenseFile(fp2)
            if (lf2?.licenseState === 'revoked') {
              log('[License] Local file marked as revoked — blocking boot')
              sendToLauncher('license-revoked')
              return
            }
            if (lf2?.licenseState === 'expired') {
              log('[License] Local file marked as expired — blocking boot')
              sendToLauncher('boot-error', {
                message: 'La licencia ha expirado. Renueva tu licencia para continuar usando el sistema.',
              })
              return
            }
            if (lf2?.licenseState === 'trial_expired') {
              log('[License] Local file marked as trial_expired — blocking boot')
              sendToLauncher('show-section', 'trial-expired')
              return
            }
            // Local file exists and is not revoked/expired — allow offline operation
            if (lf2) {
              licenseValid = true
              enabledModules = getEnabledModules(config.appId, lf2.plan ?? '', lf2.addons ?? [])
              if (lf2.maxTerminals) resolvedMaxTerminals = lf2.maxTerminals
            }
          } catch {}
        }
      }
    }

    // ─── Guard: never start server without a valid license or trial ───
    if (!licenseValid) {
      log('[License] No valid license — showing welcome screen')
      sendToLauncher('show-section', 'welcome')
      return
    }

    maxConnections = resolvedMaxTerminals
    log(`[License] maxTerminals: ${maxConnections}`)

    // Step 3: Start server
    sendToLauncher('boot-progress', { step: 'server', progress: 0.6, detail: 'Iniciando servidor...' })
    log('[Server] Starting...')
    const pgConfig = pgManager.getConnectionConfig(config.dbName)

    const { io, backupScheduler } = await startServer({
      port: config.port,
      dbName: config.dbName,
      pgPort: pgConfig.port,
      enabledModules,
      multiuser: config.multiuser,
      maxConnections,
      isTrialMode,
      onConnectionChange: (count) => {
        currentConnections = count
        sendToLauncher('connection-count-updated', { current: count, max: maxConnections })
      },
      onLicenseRevoked: () => {
        log('[License] Revoked at runtime — closing POS window')
        serverRunning = false
        if (posWindow && !posWindow.isDestroyed()) {
          posWindow.close()
        }
        sendToLauncher('license-revoked')
      },
      onMaxTerminalsChanged: (max) => {
        log(`[License] maxTerminals updated at runtime: ${maxConnections} → ${max}`)
        maxConnections = max
        sendToLauncher('connection-count-updated', { current: currentConnections, max: maxConnections })
      },
    })

    serverRunning = true
    serverPort = config.port
    log(`[Server] OK — port ${config.port}`)

    // Initialize backup scheduler with launcher window for notifications
    backupSchedulerRef = backupScheduler
    if (launcherWindow) {
      backupScheduler.init(launcherWindow)
      log('[Backup] Scheduler initialized')
    }

    // Initialize FullDumpService for pre-update backups
    const { FullDumpService } = require('./server/backup/fullDumpService')
    fullDumpService = new FullDumpService({
      dbName: config.dbName,
      dbPort: config.pgPort,
      dbUser: 'enlocal',
      dbPassword: 'enlocal',
      appVersion: app.getVersion(),
      backupDir: backupSchedulerRef?.smart?.backupDir,
    })

    // Setup auto-updates (only for licensed users, not trial)
    if (!isTrialMode) {
      setupAutoUpdate({
        updateServer: config.updateServer,
        onStatusChange: (status) => {
          sendToLauncher('update-status', status)
        },
        createSmartBackup: async () => {
          return backupSchedulerRef?.smart?.createBackup('pre-actualizacion')
        },
        createFullDump: async () => {
          return fullDumpService?.createFullDump()
        },
      })
      log('[Updater] Auto-update initialized')
    }

    // Step 4: Ready
    sendToLauncher('boot-progress', { step: 'ready', progress: 1.0, detail: 'Sistema listo' })

    // Generate QR code
    const lanUrl = getLanUrl(config.port)
    let qrDataUrl = ''
    try {
      const QRCode = require('qrcode')
      qrDataUrl = await QRCode.toDataURL(lanUrl, { width: 200, margin: 1 })
    } catch (err) {
      log(`[QR] Failed to generate: ${(err as Error).message}`)
    }

    // Small delay so the user sees the final progress step
    await new Promise(r => setTimeout(r, 400))

    sendToLauncher('server-ready', { port: config.port, lanUrl, qrDataUrl })
    sendToLauncher('connection-count-updated', { current: currentConnections, max: maxConnections })
    sendToLauncher('show-section', 'ready')

    // ─── Periodic trial expiry check (every hour) ───
    if (isTrialMode && !trialCheckInterval) {
      trialCheckInterval = setInterval(() => {
        const status = getTrialStatus()
        if (status.isExpired) {
          log('[Trial] Expired at runtime — closing POS window')
          serverRunning = false
          if (posWindow && !posWindow.isDestroyed()) {
            posWindow.close()
          }
          sendToLauncher('show-section', 'trial-expired')
          if (trialCheckInterval) {
            clearInterval(trialCheckInterval)
            trialCheckInterval = null
          }
        } else {
          // Update trial badge in launcher
          sendToLauncher('trial-status-updated', status)
        }
      }, 60 * 60 * 1000) // Every hour
    }

  } catch (err: any) {
    log(`[Boot] FAILED: ${err.message}\n${err.stack}`)
    sendToLauncher('boot-error', { message: err.message })
  }
}

// ─── IPC Handlers ───

function registerIpcHandlers() {
  ipcMain.handle('get-server-info', () => ({
    port: config.port,
    appName: config.appName,
    serverUrl: `http://localhost:${config.port}`,
  }))

  ipcMain.handle('get-app-config', () => ({
    appId: config.appId,
    appName: config.appName,
    port: config.port,
    color: config.color,
    multiuser: config.multiuser,
  }))

  ipcMain.handle('get-license-full-status', async () => {
    try {
      return await fetchFullLicenseStatus(config.cloudApiUrl, '', config.productCode)
    } catch {
      return null
    }
  })

  ipcMain.handle('login-with-pin', async (_event, pin: string) => {
    return loginWithPin({
      cloudApiUrl: config.cloudApiUrl,
      pin,
      productCode: config.productCode,
    })
  })

  ipcMain.handle('get-fingerprint', () => {
    try {
      const fp = generateFingerprint()
      log(`[Fingerprint] OK: ${fp.substring(0, 16)}...`)
      return fp
    } catch (err: any) {
      log(`[Fingerprint] FAILED: ${err.message}`)
      return 'error'
    }
  })

  ipcMain.handle('activate-license', async (_event, serialKey: string) => {
    try {
      log(`[Activation] Serial: ${serialKey}`)
      log(`[Activation] Cloud URL: ${config.cloudApiUrl}/api/v1/licenses/activate`)
      const result = await activateLicense({
        cloudApiUrl: config.cloudApiUrl,
        appId: config.appId,
        serialKey,
        productCode: config.productCode,
        version: app.getVersion(),
      })
      log(`[Activation] OK — plan: ${result.plan}`)

      // After successful activation, start boot sequence automatically
      startBootSequence()

      return { success: true, message: 'Licencia activada exitosamente' }
    } catch (err: any) {
      log(`[Activation] FAILED: ${err.message}\n${err.stack}`)
      return { success: false, message: err.message || 'Error al activar la licencia' }
    }
  })

  ipcMain.handle('get-license-state', () => ({
    hasTerminalToken: !!getTerminalToken(),
    licenseValid: serverRunning,
    enabledModules: config.modules.default,
  }))

  // ─── New IPC handlers for launcher ───

  ipcMain.handle('get-license-info', () => {
    try {
      const fp = generateFingerprint()
      const lf = readLicenseFile(fp)
      if (!lf) return null
      return {
        licenseKey: lf.licenseKey,
        plan: lf.plan,
        expiresAt: lf.expiresAt,
        appId: lf.appId,
        trialStartedAt: lf.trialStartedAt,
        trialEndsAt: lf.trialEndsAt,
        trialRegistered: lf.trialRegistered,
        licenseState: lf.licenseState,
        isTrial: lf.licenseState === 'trial',
      }
    } catch {
      return null
    }
  })

  // ─── Trial IPC handlers ───

  ipcMain.handle('start-trial', async () => {
    try {
      log('[Trial] User initiated trial start')
      // Try cloud registration first
      try {
        const regResult = await registerTrial({
          cloudApiUrl: config.cloudApiUrl,
          appId: config.appId,
          productCode: config.productCode,
          version: app.getVersion(),
        })
        if (!regResult.success) {
          log(`[Trial] Cloud says expired: ${regResult.message}`)
          return { success: false, message: regResult.message }
        }
        log('[Trial] Registered in cloud — starting boot')
      } catch (netErr) {
        // Network error — fallback to offline trial
        log(`[Trial] Cloud unreachable, starting offline trial: ${(netErr as Error).message}`)
        const offlineResult = startOfflineTrial({ appId: config.appId })
        if (!offlineResult.success) {
          return { success: false, message: 'El periodo de prueba ya fue utilizado.' }
        }
        log(`[Trial] Offline trial started, ends: ${offlineResult.trialEndsAt}`)
      }
      // Start boot sequence
      startBootSequence()
      return { success: true, message: 'Periodo de prueba iniciado' }
    } catch (err: any) {
      log(`[Trial] Start failed: ${err.message}`)
      return { success: false, message: err.message || 'Error al iniciar periodo de prueba' }
    }
  })

  ipcMain.handle('get-trial-status', () => {
    return getTrialStatus()
  })

  ipcMain.handle('activate-license-from-webapp', async (_event, serialKey: string) => {
    try {
      log(`[Activation-Webapp] Serial: ${serialKey}`)
      const result = await activateLicense({
        cloudApiUrl: config.cloudApiUrl,
        appId: config.appId,
        serialKey,
        productCode: config.productCode,
        version: app.getVersion(),
      })
      log(`[Activation-Webapp] OK — plan: ${result.plan}`)
      isTrialMode = false
      return { success: true, message: 'Licencia activada exitosamente. Reinicia la aplicación para aplicar los cambios.' }
    } catch (err: any) {
      log(`[Activation-Webapp] FAILED: ${err.message}`)
      return { success: false, message: err.message || 'Error al activar la licencia' }
    }
  })

  ipcMain.handle('open-system', () => {
    createPosWindow()
  })

  ipcMain.handle('get-connection-count', () => ({
    current: currentConnections,
    max: maxConnections,
  }))

  ipcMain.handle('retry-boot', () => {
    startBootSequence()
  })

  // ─── Backup IPC handlers ───

  ipcMain.handle('backup:create', async (_event, tipo = 'manual') => {
    if (!backupSchedulerRef) return { error: 'Backup system not initialized' }
    try {
      return await backupSchedulerRef.smart?.createBackup(tipo)
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('backup:list', async () => {
    if (!backupSchedulerRef) return { error: 'Backup system not initialized' }
    try {
      return backupSchedulerRef.smart?.getBackupInfo()
    } catch (e: any) {
      return { error: e.message }
    }
  })

  ipcMain.handle('backup:open-folder', async () => {
    if (!backupSchedulerRef?.smart?.backupDir) return
    shell.openPath(backupSchedulerRef.smart.backupDir)
  })

  ipcMain.handle('backup:change-directory', async () => {
    const win = posWindow || launcherWindow
    if (!win) return { cancelled: true }

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Seleccionar carpeta de respaldos',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (canceled || filePaths.length === 0) return { cancelled: true }
    return backupSchedulerRef?.smart?.setCustomBackupDirectory(filePaths[0])
  })

  ipcMain.handle('backup:restore-external', async () => {
    const win = posWindow || launcherWindow
    if (!win) return { cancelled: true }

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Seleccionar respaldo',
      filters: [
        { name: 'Respaldos enLocal', extensions: ['enlocal-backup'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { cancelled: true }

    const manifest = backupSchedulerRef?.smart?.readBackupManifest(filePaths[0])
    if (!manifest) {
      await dialog.showMessageBox(win, {
        type: 'error',
        title: 'Archivo no válido',
        message: 'Este archivo no es un respaldo compatible de enLocal.',
      })
      return { cancelled: true, error: 'Formato no válido' }
    }

    return { filepath: filePaths[0], manifest }
  })

  // ─── Update IPC handlers ───

  ipcMain.handle('check-for-updates', async () => {
    return checkForUpdatesManual()
  })

  ipcMain.handle('install-update', async () => {
    return downloadAndInstall()
  })

  ipcMain.handle('backup:restore-full-dump-dialog', async () => {
    const win = posWindow || launcherWindow
    if (!win) return { cancelled: true }

    const { filePaths, canceled } = await dialog.showOpenDialog(win, {
      title: 'Seleccionar dump completo',
      filters: [
        { name: 'Dumps PostgreSQL', extensions: ['dump', 'sql', 'backup'] },
        { name: 'Todos los archivos', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return { cancelled: true }

    return { filepath: filePaths[0] }
  })
}

// ─── Main ───

async function main() {
  // 1. Create launcher window INSTANTLY (loads from local file)
  createLauncherWindow()

  // 2. Register all IPC handlers
  registerIpcHandlers()

  // 3. Check license/trial state
  const terminalToken = getTerminalToken()

  if (terminalToken) {
    // License or registered trial exists — start boot sequence
    log('[Main] Terminal token found — starting boot sequence')
    startBootSequence()
  } else {
    // No terminal token — check if there's an offline trial
    const trialStatus = getTrialStatus()

    if (trialStatus.isTrial && !trialStatus.isExpired && !trialStatus.offlineGraceExpired) {
      log('[Main] Active offline trial found — starting boot sequence')
      startBootSequence()
    } else if (trialStatus.isTrial && trialStatus.offlineGraceExpired) {
      log('[Main] Offline trial grace expired — need internet')
      sendToLauncher('show-section', 'trial-offline-expired')
    } else if (trialStatus.isTrial && trialStatus.isExpired) {
      log('[Main] Trial expired — showing trial-expired')
      sendToLauncher('show-section', 'trial-expired')
    } else {
      // First time — show welcome with trial + activation options
      log('[Main] No license, no trial — showing welcome')
      sendToLauncher('show-section', 'welcome')
    }
  }
}

// 3.1 — Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  log(`[FATAL] Uncaught exception: ${err.message}\n${err.stack}`)
  try {
    dialog.showErrorBox(
      `${config.appName} — Error no controlado`,
      `${err.message}\n\nLog: ${logFile}`,
    )
  } catch { /* dialog may not be available yet */ }
})

process.on('unhandledRejection', (reason: any) => {
  log(`[FATAL] Unhandled rejection: ${reason?.message ?? reason}`)
})

app.whenReady().then(main).catch(err => {
  log(`[FATAL] Unhandled error in main: ${err.message}\n${err.stack}`)
  dialog.showErrorBox(
    `${config.appName} — Error fatal`,
    `Error inesperado al iniciar.\n\n${err.message}\n\nLog: ${logFile}`,
  )
  app.quit()
})

// 3.3 — Graceful shutdown: await async operations before quitting
let isShuttingDown = false
app.on('before-quit', (e) => {
  if (isShuttingDown) return
  isShuttingDown = true
  e.preventDefault()

  stopAutoUpdate()

  const doShutdown = async () => {
    // Create closing backup if scheduler is available
    if (backupSchedulerRef) {
      try {
        await backupSchedulerRef.onAppClose()
      } catch {
        // Non-critical: app is closing anyway
      }
    }

    try {
      await pgManager.shutdown()
    } catch (err: any) {
      console.error(`[${config.appName}] PgManager shutdown error:`, err)
    }

    app.quit()
  }

  doShutdown().catch(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
