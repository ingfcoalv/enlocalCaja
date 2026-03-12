import { Router } from 'express'
import type { SyncEngine } from '@enlocal/core-sync'

const router: ReturnType<typeof Router> = Router()

// GET /api/sync/status — current sync engine status
router.get('/status', async (req, res) => {
  try {
    const isTrialMode = req.app.get('isTrialMode') as boolean
    if (isTrialMode) {
      return res.json({
        status: 'disabled',
        lastSyncAt: null,
        lastError: null,
        isCloudReachable: false,
        queueStats: { pending: 0, synced: 0, failed: 0 },
        isTrial: true,
      })
    }

    const syncEngine = req.app.get('syncEngine') as SyncEngine | undefined

    if (!syncEngine) {
      return res.json({
        status: 'idle',
        lastSyncAt: null,
        lastError: null,
        isCloudReachable: false,
        queueStats: { pending: 0, synced: 0, failed: 0 },
      })
    }

    const status = await syncEngine.getStatus()
    res.json(status)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sync/trigger — trigger manual sync
router.post('/trigger', async (req, res) => {
  try {
    const isTrialMode = req.app.get('isTrialMode') as boolean
    if (isTrialMode) {
      return res.status(403).json({ error: 'TRIAL_MODE', message: 'Sincronización no disponible durante el periodo de prueba' })
    }

    const syncEngine = req.app.get('syncEngine') as SyncEngine | undefined

    if (!syncEngine) {
      return res.status(503).json({ error: 'Sync engine not initialized' })
    }

    const trigger = req.body?.trigger || 'manual'
    syncEngine.triggerSync(trigger)

    res.json({ success: true, message: `Sync triggered (${trigger})` })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sync/config — sync configuration (non-sensitive)
router.get('/config', (_req, res) => {
  res.json({
    syncIntervalMs: 5 * 60 * 1000,
    triggers: ['startup', 'periodic', 'sale_close', 'shift_close', 'reconnect', 'manual'],
  })
})

export default router
