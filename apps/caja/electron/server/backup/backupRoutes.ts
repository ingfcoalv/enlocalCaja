import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import type { Pool } from 'pg'
import { SmartBackupService } from './smartBackupService'
import { FullDumpService } from './fullDumpService'

export interface BackupRoutesConfig {
  dbName?: string
  dbPort?: number
  dbUser?: string
  dbPassword?: string
  appVersion?: string
  pgBinPath?: string
}

export function createBackupRoutes(pool: Pool, config: BackupRoutesConfig = {}) {
  const router = Router()

  const smart = new SmartBackupService(pool, {
    dbName: config.dbName,
    dbPort: config.dbPort,
    dbUser: config.dbUser,
    dbPassword: config.dbPassword,
    appVersion: config.appVersion,
  })

  let dump: FullDumpService | null = null
  try {
    dump = new FullDumpService({
      dbName: config.dbName,
      dbPort: config.dbPort,
      dbUser: config.dbUser,
      dbPassword: config.dbPassword,
      appVersion: config.appVersion,
      pgBinPath: config.pgBinPath,
      backupDir: smart.backupDir,
    })
  } catch {
    console.warn('[Backup] pg_dump not found — full dump features disabled')
  }

  // ═══ SMART BACKUP ═══

  router.get('/', async (_req, res) => {
    try {
      const info = smart.getBackupInfo()
      if (dump) {
        ;(info as any).fullDumps = dump.listDumps()
        ;(info as any).totalDumps = (info as any).fullDumps.length
      } else {
        ;(info as any).fullDumps = []
        ;(info as any).totalDumps = 0
      }
      res.json(info)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const { tipo = 'manual' } = req.body || {}
      const result = await smart.createBackup(tipo)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  })

  router.post('/preview', async (req, res) => {
    try {
      const { filepath } = req.body
      if (!filepath) return res.status(400).json({ error: 'Se requiere filepath' })
      const manifest = smart.readBackupManifest(filepath)
      if (!manifest) return res.status(400).json({ error: 'No se pudo leer el archivo de respaldo' })
      const currentSchema = await smart.discoverSchema()
      res.json({ manifest, compatibilityReport: smart.generateCompatibilityReport(manifest, currentSchema) })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/restore', async (req, res) => {
    try {
      const { filepath } = req.body
      if (!filepath) return res.status(400).json({ error: 'Se requiere filepath' })
      const result = await smart.restoreBackup(filepath)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  })

  router.put('/settings', async (req, res) => {
    try {
      const { backupDir } = req.body
      if (!backupDir) return res.status(400).json({ error: 'Se requiere backupDir' })
      res.json(smart.setCustomBackupDirectory(backupDir))
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.delete('/:filename', async (req, res) => {
    try {
      const safeName = path.basename(req.params.filename)
      const filepath = path.join(smart.backupDir, safeName)
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Respaldo no encontrado' })
      fs.unlinkSync(filepath)
      res.json({ success: true, deleted: req.params.filename })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/rotate', async (_req, res) => {
    try {
      res.json(smart.applyRotation())
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  // ═══ FULL DUMP ═══

  router.get('/dumps', async (_req, res) => {
    try {
      res.json(dump ? dump.listDumps() : [])
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/dumps', async (_req, res) => {
    try {
      if (!dump) return res.status(503).json({ error: 'pg_dump no disponible en este sistema' })
      const result = await dump.createFullDump()
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.error || error.message })
    }
  })

  router.post('/dumps/restore', async (req, res) => {
    try {
      if (!dump) return res.status(503).json({ error: 'pg_restore no disponible en este sistema' })
      const { filepath } = req.body
      if (!filepath) return res.status(400).json({ error: 'Se requiere filepath' })
      const result = await dump.restoreFullDump(filepath, smart)
      res.json(result)
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message })
    }
  })

  router.delete('/dumps/:filename', async (req, res) => {
    try {
      if (!dump) return res.status(503).json({ error: 'Dumps no disponibles' })
      const safeName = path.basename(req.params.filename)
      const filepath = path.join(dump.backupDir, safeName)
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Dump no encontrado' })
      fs.unlinkSync(filepath)
      res.json({ success: true, deleted: req.params.filename })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  router.post('/dumps/clean', async (req, res) => {
    try {
      if (!dump) return res.status(503).json({ error: 'Dumps no disponibles' })
      const { keepCount = 5 } = req.body || {}
      res.json(dump.cleanOldDumps(keepCount))
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  })

  return router
}
