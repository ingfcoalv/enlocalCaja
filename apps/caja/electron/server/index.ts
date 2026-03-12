import express from 'express'
import http from 'http'
import path from 'path'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Server as SocketServer } from 'socket.io'
import { setupSocketHandlers, setMaxConnections } from '@enlocal/core-server'
import { SyncEngine } from '@enlocal/core-sync'
import {
  getTerminalToken,
  syncLicenseToSettings,
  readLicenseFile,
  validateLicense,
  getEnabledModules,
  generateFingerprint,
} from '@enlocal/core-license'
import { runMigrations } from '@enlocal/core-db'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import licenseRoutes from './routes/license.routes'
import syncRoutes from './routes/sync.routes'
import setupRoutes from './routes/setup.routes'
import connectionsRoutes from './routes/connections.routes'
import { createBackupRoutes } from './backup/backupRoutes'
import { createOnlineOrderRoutes } from './routes/onlineOrders.routes'
import { SmartBackupService } from './backup/smartBackupService'
import { BackupScheduler } from './backup/backupScheduler'

export async function startServer(config: {
  port: number
  dbName: string
  pgPort: number
  enabledModules: string[]
  multiuser: boolean
  maxConnections?: number
  isTrialMode?: boolean
  onConnectionChange?: (count: number) => void
  onLicenseRevoked?: () => void
  onMaxTerminalsChanged?: (max: number) => void
}) {
  const app = express()
  const httpServer = http.createServer(app)
  const io = new SocketServer(httpServer, {
    cors: { origin: [`http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`], methods: ['GET', 'POST'] },
  })

  // Middleware
  app.use(express.json({ limit: '10mb' }))

  // Create DB pool
  const pool = new Pool({
    host: 'localhost',
    port: config.pgPort,
    database: config.dbName,
    user: 'enlocal',
    password: 'enlocal',
    max: 10,
  })

  // Wrap pool with Drizzle ORM
  const db = drizzle(pool)

  // Run database migrations
  const migrationsPath = process.env.NODE_ENV === 'development'
    ? undefined
    : path.join((process as any).resourcesPath, 'migrations')
  await runMigrations(db, migrationsPath)

  // ─── Seed: create default admin if DB is empty ───
  try {
    const userCount = await pool.query(`SELECT COUNT(*)::int as count FROM users`)
    if (userCount.rows[0]?.count === 0) {
      const adminId = uuidv4()
      const pinHash = await bcrypt.hash('123456', 10)
      // 3.5 — Add must_change_pin column and flag default admin
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false`)
      await pool.query(
        `INSERT INTO users (id, name, email, pin_hash, role, active, must_change_pin, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, 'admin', true, true, now(), now())`,
        [adminId, 'Administrador', pinHash]
      )
      console.log('[server] Created default admin user (PIN: 123456, must change on first login)')

      // Sync license data to settings if license file exists
      const fingerprint = generateFingerprint()
      const licenseFile = readLicenseFile(fingerprint)
      if (licenseFile) {
        const settingsDb = {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params) as any,
          execute: (sql: string, params?: unknown[]) => pool.query(sql, params) as any,
        }
        await syncLicenseToSettings(settingsDb, {
          plan: licenseFile.plan,
          state: licenseFile.licenseState,
          expiresAt: licenseFile.expiresAt,
          modules: licenseFile.modules,
          addons: licenseFile.addons,
          stamps: licenseFile.stamps,
          maxRegisters: licenseFile.maxRegisters,
        })
        console.log('[server] Synced license data to settings')
      }
    }
  } catch (err: any) {
    console.error('[server] Seed error:', err.message)
  }

  // JWT secret — generate random per-session if none set via env
  if (!process.env.JWT_SECRET) {
    const crypto = await import('crypto')
    process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex')
  }
  const jwtSecret = process.env.JWT_SECRET
  app.set('jwtSecret', jwtSecret)
  app.set('db', db)
  app.set('pool', pool)
  app.set('io', io)
  app.set('enabledModules', config.enabledModules)
  app.set('isTrialMode', config.isTrialMode ?? false)

  // Setup Socket.io auth and handlers
  setupSocketHandlers(io, jwtSecret, {
    maxConnections: config.maxConnections,
    onCountChange: config.onConnectionChange,
  })

  // Health check
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ status: 'ok', app: 'enlocal-caja', port: config.port })
    } catch {
      res.status(503).json({ status: 'error' })
    }
  })

  // ─── Mount license, sync, setup, connections routes (no auth required) ───
  app.use('/api/license', licenseRoutes)
  app.use('/api/sync', syncRoutes)
  app.use('/api/setup', setupRoutes)
  app.use('/api/connections', connectionsRoutes)

  // ─── Mount backup routes ───
  const appVersion = require('../../package.json').version || '1.0.0'
  const backupRoutes = createBackupRoutes(pool, {
    dbName: config.dbName,
    dbPort: config.pgPort,
    dbUser: 'enlocal',
    dbPassword: 'enlocal',
    appVersion,
  })
  app.use('/api/backups', backupRoutes)

  // ─── Mount online order routes ───
  app.use('/api/online-orders', createOnlineOrderRoutes(pool))

  // ─── Initialize backup scheduler ───
  const smartBackup = new SmartBackupService(pool, {
    dbName: config.dbName,
    dbPort: config.pgPort,
    dbUser: 'enlocal',
    dbPassword: 'enlocal',
    appVersion,
  })
  const backupScheduler = new BackupScheduler(smartBackup)
  app.set('backupScheduler', backupScheduler)

  // Mount modules dynamically

  // Always mount default modules
  if (config.enabledModules.includes('mod-config')) {
    const { mountConfigRoutes } = await import('@enlocal/mod-config')
    mountConfigRoutes(app, db)
  }
  if (config.enabledModules.includes('mod-catalogs')) {
    const { mountCatalogRoutes } = await import('@enlocal/mod-catalogs')
    mountCatalogRoutes(app, db)
  }
  if (config.enabledModules.includes('mod-pos')) {
    const { mountPosRoutes } = await import('@enlocal/mod-pos')
    mountPosRoutes(app, db)
  }
  if (config.enabledModules.includes('mod-reports')) {
    const { mountReportRoutes } = await import('@enlocal/mod-reports')
    mountReportRoutes(app, db)
  }

  // Conditional addons
  if (config.enabledModules.includes('mod-invoicing')) {
    const { mountInvoicingRoutes, startInvoicingCronJobs } = await import('@enlocal/mod-invoicing')
    mountInvoicingRoutes(app, db)
    startInvoicingCronJobs(db)
  }
  if (config.enabledModules.includes('mod-inventory')) {
    const { mountInventoryRoutes } = await import('@enlocal/mod-inventory')
    mountInventoryRoutes(app, db)
  }
  if (config.enabledModules.includes('mod-remissions')) {
    const { mountRemissionRoutes, startRemissionCronJobs } = await import('@enlocal/mod-remissions')
    mountRemissionRoutes(app, db)
    startRemissionCronJobs(db)
  }
  if (config.enabledModules.includes('mod-quotes')) {
    const { mountQuoteRoutes, startQuoteCronJobs } = await import('@enlocal/mod-quotes')
    mountQuoteRoutes(app, db)
    startQuoteCronJobs(db)
  }
  if (config.enabledModules.includes('mod-payables')) {
    const { mountPayableRoutes, startPayableCronJobs } = await import('@enlocal/mod-payables')
    mountPayableRoutes(app, db)
    startPayableCronJobs(db)
  }

  // Mount generic settings CRUD (/:key catch-all) LAST so it doesn't intercept
  // module-specific routes like /api/settings/quote-folio, /api/settings/email, etc.
  if (config.enabledModules.includes('mod-config')) {
    const { mountGenericSettingsRoutes } = await import('@enlocal/mod-config')
    mountGenericSettingsRoutes(app)
  }

  // ─── Auto-connect default scale ───
  if (config.enabledModules.includes('mod-config')) {
    try {
      const { ScaleService, loadScales } = await import('@enlocal/mod-config')
      const scaleService = new ScaleService()
      app.set('scaleService', scaleService)

      const scales = await loadScales(db)
      const defaultScale = scales.find((s: any) => s.isDefault) || scales[0]
      if (defaultScale) {
        await scaleService.connect(defaultScale, io)
        console.log('[server] Scale connected:', defaultScale.name)
      }
    } catch {
      // Non-critical — scale may not be configured
    }
  }

  // ─── Start SyncEngine (skip during trial) ───
  const terminalToken = getTerminalToken()
  if (terminalToken && !config.isTrialMode) {
    try {
      const syncEngine = new SyncEngine(pool, {
        cloudApiUrl: process.env.CLOUD_API_URL || 'https://todoenlocal.com',
        branchId: '', // Will be resolved from license file
        getTerminalToken: () => getTerminalToken() || '',
        getFingerprint: () => generateFingerprint(),
        hashPin: (pin: string) => bcrypt.hash(pin, 10),
      })

      app.set('syncEngine', syncEngine)

      // Listen for sync:completed to refresh license data
      const settingsDb = {
        query: (sql: string, params?: unknown[]) => pool.query(sql, params) as any,
        execute: (sql: string, params?: unknown[]) => pool.query(sql, params) as any,
      }

      syncEngine.on('sync:completed', async (info: any) => {
        // Handle incoming online orders from marketplace
        if (info?.trigger === 'ws_new_order' && info?.data) {
          try {
            const { handleIncomingOnlineOrder } = await import('./services/onlineOrderHandler')
            await handleIncomingOnlineOrder(pool, info.data, io, syncEngine)
          } catch (err: any) {
            console.error('[server] Online order handler error:', err.message)
          }
          return
        }

        // Handle delivery status updates from marketplace drivers
        if (info?.trigger === 'ws_delivery_status_update' && info?.data) {
          try {
            const { handleDeliveryStatusUpdate } = await import('./services/onlineOrderHandler')
            await handleDeliveryStatusUpdate(pool, info.data, io)
          } catch (err: any) {
            console.error('[server] Delivery status update error:', err.message)
          }
          return
        }

        try {
          const result = await validateLicense({
            cloudApiUrl: process.env.CLOUD_API_URL || 'https://todoenlocal.com',
            appId: 'enlocal-caja',
            productCode: 'enlocal_caja',
          })

          // Handle revoked license at runtime
          if (result.reason === 'LICENSE_REVOKED') {
            console.log('[server] License revoked — notifying launcher')
            io.emit('license:revoked')
            config.onLicenseRevoked?.()
            return
          }

          if (result.valid) {
            // Sync license data to settings table
            await syncLicenseToSettings(settingsDb, {
              plan: result.plan,
              state: result.licenseState,
              expiresAt: result.expiresAt,
              modules: result.modules,
              addons: result.addons,
              stamps: result.stampsAvailable != null
                ? { available: result.stampsAvailable, totalPurchased: 0, totalUsed: 0 }
                : undefined,
              maxRegisters: result.maxRegisters,
            })

            // Update max terminals if changed
            if (result.maxTerminals != null && result.maxTerminals > 0) {
              setMaxConnections(result.maxTerminals)
              config.onMaxTerminalsChanged?.(result.maxTerminals)
            }

            // Check if new addons appeared
            const currentModules = app.get('enabledModules') as string[]
            const newModules = getEnabledModules('enlocal-caja', result.plan, result.addons)
            const newlyAdded = newModules.filter(m => !currentModules.includes(m))

            if (newlyAdded.length > 0) {
              // Update tracked list so we don't re-notify on next sync
              app.set('enabledModules', newModules)

              // Emit socket event — frontend will show restart notification
              io.emit('license:modules-changed', {
                newModules: newlyAdded,
                requiresRestart: true,
              })
            }
          }
        } catch {
          // Non-critical — ignore
        }
      })

      await syncEngine.start()
      console.log('[server] SyncEngine started')
    } catch (err: any) {
      console.error('[server] SyncEngine start failed:', err.message)
    }
  }

  // Serve static webapp
  // In production, esbuild copies webapp to dist/electron/webapp/dist/ which goes into the asar.
  // asarUnpack extracts it to app.asar.unpacked/ and Electron's fs patches handle the redirect.
  const webappPath = path.join(__dirname, '../webapp/dist')
  app.use(express.static(webappPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webappPath, 'index.html'))
  })

  // 3.2 — Listen on 0.0.0.0 for LAN access with port conflict handling
  return new Promise<{ httpServer: http.Server; io: SocketServer; backupScheduler: BackupScheduler }>((resolve, reject) => {
    httpServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`El puerto ${config.port} ya está en uso. Cierra otras instancias de ${config.dbName || 'enLocal'} e intenta de nuevo.`))
      } else {
        reject(err)
      }
    })
    httpServer.listen(config.port, '0.0.0.0', () => {
      console.log(`[server] Listening on 0.0.0.0:${config.port}`)
      resolve({ httpServer, io, backupScheduler })
    })
  })
}
