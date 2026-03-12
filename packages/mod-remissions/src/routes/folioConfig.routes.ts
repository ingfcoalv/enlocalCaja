import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { settings, remissionNotes, remissionReturns } from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const router = Router()

const updateFolioSchema = z.object({
  startingFolio: z.number().int().positive()
})

// GET /remission-folio — get current and next remission folio
router.get(
  '/remission-folio',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(remissionNotes)
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'remission_starting_folio'))
      const currentFolio = maxRow?.max ?? 0
      const configuredStart = configRow ? parseInt(configRow.value) : 0
      const nextFolio = Math.max(currentFolio, configuredStart - 1) + 1
      res.json({ currentFolio, nextFolio, configuredStart, startingFolio: configuredStart })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching folio info' })
    }
  }
)

// PUT /remission-folio — set starting folio for remissions
router.put(
  '/remission-folio',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateFolioSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(remissionNotes)
      const currentMax = maxRow?.max ?? 0
      if (parsed.data.startingFolio <= currentMax) {
        return res.status(400).json({ error: `El folio debe ser mayor al folio actual (${currentMax})` })
      }

      await db.insert(settings).values({ key: 'remission_starting_folio', value: String(parsed.data.startingFolio) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.startingFolio), updatedAt: new Date() } })

      res.json({ success: true, nextFolio: parsed.data.startingFolio })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating folio' })
    }
  }
)

// GET /return-folio — get current and next return folio
router.get(
  '/return-folio',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(remissionReturns)
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'return_starting_folio'))
      const currentFolio = maxRow?.max ?? 0
      const configuredStart = configRow ? parseInt(configRow.value) : 0
      const nextFolio = Math.max(currentFolio, configuredStart - 1) + 1
      res.json({ currentFolio, nextFolio, configuredStart, startingFolio: configuredStart })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching return folio info' })
    }
  }
)

// PUT /return-folio — set starting folio for returns
router.put(
  '/return-folio',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateFolioSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(remissionReturns)
      const currentMax = maxRow?.max ?? 0
      if (parsed.data.startingFolio <= currentMax) {
        return res.status(400).json({ error: `El folio debe ser mayor al folio actual (${currentMax})` })
      }

      await db.insert(settings).values({ key: 'return_starting_folio', value: String(parsed.data.startingFolio) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.startingFolio), updatedAt: new Date() } })

      res.json({ success: true, nextFolio: parsed.data.startingFolio })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating return folio' })
    }
  }
)

export default router
