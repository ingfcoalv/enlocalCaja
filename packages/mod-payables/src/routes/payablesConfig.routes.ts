import { Router } from 'express'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { settings, purchaseOrders, purchaseReceipts, purchaseReturns } from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const router = Router()

const updateFolioSchema = z.object({
  startingFolio: z.number().int().positive()
})

const updateThresholdSchema = z.object({
  threshold: z.number().positive()
})

// GET /purchase-folio
router.get(
  '/purchase-folio',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(purchaseOrders)
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'purchase_order_starting_folio'))
      const currentFolio = maxRow?.max ?? 0
      const configuredStart = configRow ? parseInt(configRow.value) : 0
      res.json({ currentFolio, nextFolio: Math.max(currentFolio, configuredStart - 1) + 1, startingFolio: configuredStart })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching folio info' })
    }
  }
)

// PUT /purchase-folio
router.put(
  '/purchase-folio',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateFolioSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      await db.insert(settings).values({ key: 'purchase_order_starting_folio', value: String(parsed.data.startingFolio) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.startingFolio), updatedAt: new Date() } })

      res.json({ success: true, nextFolio: parsed.data.startingFolio })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating folio' })
    }
  }
)

// GET /receipt-folio
router.get(
  '/receipt-folio',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(purchaseReceipts)
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'receipt_starting_folio'))
      const currentFolio = maxRow?.max ?? 0
      const configuredStart = configRow ? parseInt(configRow.value) : 0
      res.json({ currentFolio, nextFolio: Math.max(currentFolio, configuredStart - 1) + 1, startingFolio: configuredStart })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching receipt folio info' })
    }
  }
)

// PUT /receipt-folio
router.put(
  '/receipt-folio',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateFolioSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      await db.insert(settings).values({ key: 'receipt_starting_folio', value: String(parsed.data.startingFolio) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.startingFolio), updatedAt: new Date() } })

      res.json({ success: true, nextFolio: parsed.data.startingFolio })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating receipt folio' })
    }
  }
)

// GET /return-folio
router.get(
  '/return-folio',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [maxRow] = await db.select({ max: sql<number>`coalesce(max(folio), 0)` }).from(purchaseReturns)
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'purchase_return_starting_folio'))
      const currentFolio = maxRow?.max ?? 0
      const configuredStart = configRow ? parseInt(configRow.value) : 0
      res.json({ currentFolio, nextFolio: Math.max(currentFolio, configuredStart - 1) + 1, startingFolio: configuredStart })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching return folio info' })
    }
  }
)

// PUT /return-folio
router.put(
  '/return-folio',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateFolioSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      await db.insert(settings).values({ key: 'purchase_return_starting_folio', value: String(parsed.data.startingFolio) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.startingFolio), updatedAt: new Date() } })

      res.json({ success: true, nextFolio: parsed.data.startingFolio })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating return folio' })
    }
  }
)

// GET /payment-threshold
router.get(
  '/payment-threshold',
  requirePermission('settings.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const [configRow] = await db.select().from(settings).where(eq(settings.key, 'payment_threshold'))
      res.json({ threshold: configRow ? parseFloat(configRow.value) : 10000 })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching threshold' })
    }
  }
)

// PUT /payment-threshold
router.put(
  '/payment-threshold',
  requirePermission('settings.update') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = updateThresholdSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })

      await db.insert(settings).values({ key: 'payment_threshold', value: String(parsed.data.threshold) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(parsed.data.threshold), updatedAt: new Date() } })

      res.json({ success: true, threshold: parsed.data.threshold })
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Error updating threshold' })
    }
  }
)

export default router
