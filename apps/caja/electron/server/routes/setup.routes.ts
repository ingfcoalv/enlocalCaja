import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import {
  getTerminalToken,
  readLicenseFile,
  generateFingerprint,
  syncLicenseToSettings,
} from '@enlocal/core-license'

const router: ReturnType<typeof Router> = Router()

// GET /api/setup/state — initial setup state
router.get('/state', async (req, res) => {
  try {
    const pool = req.app.get('pool')

    // Check if license is activated (terminal token present)
    const hasTerminalToken = !!getTerminalToken()

    // Check if DB is initialized (settings table exists and has data)
    let dbInitialized = false
    try {
      const result = await pool.query(`SELECT COUNT(*)::int as count FROM settings`)
      dbInitialized = result.rows[0]?.count > 0
    } catch {
      dbInitialized = false
    }

    // Check if at least one user exists
    let hasUsers = false
    try {
      const result = await pool.query(`SELECT COUNT(*)::int as count FROM users`)
      hasUsers = result.rows[0]?.count > 0
    } catch {
      hasUsers = false
    }

    // Check fiscal config
    let hasFiscalConfig = false
    try {
      const result = await pool.query(`SELECT COUNT(*)::int as count FROM fiscal_config`)
      hasFiscalConfig = result.rows[0]?.count > 0
    } catch {
      hasFiscalConfig = false
    }

    res.json({
      licenseActivated: hasTerminalToken,
      dbInitialized,
      hasUsers,
      hasFiscalConfig,
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/setup/init — initialize DB after first activation
// Creates default admin user + syncs license to settings.
// Idempotent: skips if users already exist.
router.post('/init', async (req, res) => {
  try {
    const pool = req.app.get('pool')

    // Guard: only run if no users exist yet
    const userCount = await pool.query(`SELECT COUNT(*)::int as count FROM users`)
    if (userCount.rows[0]?.count > 0) {
      res.json({ ok: true, skipped: true, message: 'Already initialized' })
      return
    }

    // 1. Create default admin user (PIN: 123456)
    const adminId = uuidv4()
    const pinHash = await bcrypt.hash('123456', 10)

    await pool.query(
      `INSERT INTO users (id, name, email, pin_hash, role, active, created_at, updated_at)
       VALUES ($1, $2, NULL, $3, 'admin', true, now(), now())`,
      [adminId, 'Administrador', pinHash]
    )

    // 2. Sync license data to settings table
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
        stamps: licenseFile.stamps
          ? {
              available: licenseFile.stamps.available,
              totalPurchased: licenseFile.stamps.totalPurchased,
              totalUsed: licenseFile.stamps.totalUsed,
            }
          : undefined,
        maxRegisters: licenseFile.maxRegisters,
      })
    }

    res.json({ ok: true, message: 'Initialized successfully' })
  } catch (err: any) {
    console.error('[setup/init] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
