import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listPriceLists,
  createPriceList,
  updatePriceList,
  deletePriceList,
  getProductPrices,
  setProductPrices,
} from '../services/priceLists.service'
import { buildPriceListPayload } from '@enlocal/core-sync'

const createSchema = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().optional().default(false),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
})

const setProductPricesSchema = z.object({
  prices: z.array(
    z.object({
      priceListId: z.string().uuid(),
      price: z.union([z.string(), z.number()]).transform(String),
    })
  ),
})

async function enqueuePriceListSync(req: AuthenticatedRequest, row: any, entityType: string) {
  try {
    const pool = req.app.get('pool')
    const payload = buildPriceListPayload(row)
    await pool.query(
      `INSERT INTO sync_queue (id, entity_type, entity_local_id, payload, status)
       VALUES (gen_random_uuid(), $1, $2, $3, 'pending')`,
      [entityType, row.id, JSON.stringify(payload)]
    )
    const syncEngine = req.app.get('syncEngine')
    if (syncEngine?.triggerSync) syncEngine.triggerSync()
  } catch { /* non-critical */ }
}

const router = Router()

// GET / — list all price lists
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const activeOnly = req.query.active === 'true'
      const rows = await listPriceLists(db, activeOnly)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing price lists' })
    }
  }
)

// POST / — create price list
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const userId = req.user?.id ?? 'system'
      const row = await createPriceList(db, parsed.data, userId)
      await enqueuePriceListSync(req, row, 'price_list')
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating price list' })
    }
  }
)

// PUT /:id — update price list
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      const userId = req.user?.id ?? 'system'
      const row = await updatePriceList(db, id, parsed.data, userId)
      if (!row) return res.status(404).json({ error: 'Price list not found' })
      await enqueuePriceListSync(req, row, 'price_list')
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating price list' })
    }
  }
)

// DELETE /:id — soft delete price list
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deletePriceList(db, id, userId)
      if (!row) return res.status(404).json({ error: 'Price list not found' })
      await enqueuePriceListSync(req, row, 'price_list')
      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting price list' })
    }
  }
)

// GET /product/:productId — get prices for a product
router.get(
  '/product/:productId',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { productId } = req.params
      const rows = await getProductPrices(db, productId)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching product prices' })
    }
  }
)

// PUT /product/:productId — set prices for a product
router.put(
  '/product/:productId',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { productId } = req.params
      const parsed = setProductPricesSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }
      await setProductPrices(db, productId, parsed.data.prices)
      const rows = await getProductPrices(db, productId)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error setting product prices' })
    }
  }
)

export default router
