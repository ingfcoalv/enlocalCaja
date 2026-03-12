import { Router } from 'express'
import {
  getStampsBalance,
  getAllModulesWithStatus,
  getTrialStatus,
  readLicenseFile,
  generateFingerprint,
} from '@enlocal/core-license'

const router: ReturnType<typeof Router> = Router()

// GET /api/license/full-info — license + modules + stamps
router.get('/full-info', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const enabledModules = req.app.get('enabledModules') as string[]

    // Use pool as the settings DB interface
    const settingsDb = {
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      execute: (sql: string, params?: unknown[]) => pool.query(sql, params),
    }

    const [stamps, modules] = await Promise.all([
      getStampsBalance(settingsDb),
      getAllModulesWithStatus(settingsDb, enabledModules),
    ])

    // Read license state from settings
    const licenseResult = await pool.query(
      `SELECT key, value FROM settings WHERE key IN ('license_plan', 'license_state', 'license_expires_at', 'license_max_registers')`
    )

    const licenseData: Record<string, string> = {}
    for (const row of licenseResult.rows) {
      licenseData[row.key] = row.value
    }

    // Read trial info from license file
    const isTrialMode = req.app.get('isTrialMode') as boolean
    let trialInfo = null
    if (isTrialMode) {
      try {
        const fp = generateFingerprint()
        const lf = readLicenseFile(fp)
        if (lf) {
          trialInfo = {
            trialStartedAt: lf.trialStartedAt ?? null,
            trialEndsAt: lf.trialEndsAt ?? null,
            trialRegistered: lf.trialRegistered ?? false,
            daysRemaining: getTrialStatus().daysRemaining,
          }
        }
      } catch {}
    }

    res.json({
      plan: isTrialMode ? 'trial' : (licenseData.license_plan ?? null),
      licenseState: isTrialMode ? 'trial' : (licenseData.license_state ?? null),
      expiresAt: isTrialMode ? (trialInfo?.trialEndsAt ?? null) : (licenseData.license_expires_at ?? null),
      modules,
      stamps,
      isTrial: isTrialMode,
      trial: trialInfo,
      maxRegisters: parseInt(licenseData.license_max_registers ?? '1', 10),
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/license/modules — array of modules with active/inactive
router.get('/modules', async (req, res) => {
  try {
    const pool = req.app.get('pool')
    const enabledModules = req.app.get('enabledModules') as string[]

    const settingsDb = {
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      execute: (sql: string, params?: unknown[]) => pool.query(sql, params),
    }

    const modules = await getAllModulesWithStatus(settingsDb, enabledModules)
    res.json(modules)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/license/stamps — stamp balance
router.get('/stamps', async (req, res) => {
  try {
    const pool = req.app.get('pool')

    const settingsDb = {
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      execute: (sql: string, params?: unknown[]) => pool.query(sql, params),
    }

    const stamps = await getStampsBalance(settingsDb)
    res.json(stamps)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/license/trial-status — trial-specific info for webapp
router.get('/trial-status', (_req, res) => {
  try {
    const status = getTrialStatus()
    res.json(status)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
