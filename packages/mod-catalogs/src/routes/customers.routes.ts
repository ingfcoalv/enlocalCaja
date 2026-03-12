import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBirthdays,
  getCustomerStats,
} from '../services/customers.service'
import { buildCustomerPayload } from '@enlocal/core-sync'

const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().optional().default(''),
  cellphone: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  contactName: z.string().optional().default(''),
  priceListId: z.string().uuid().optional().nullable(),
  defaultDiscount: z.string().optional().default('0'),
  creditLimit: z.union([z.string(), z.number()]).transform(String).optional().default('0'),
  creditDays: z.union([z.string(), z.number()]).transform(String).optional().default('0'),
  address: z.string().optional().default(''),
  personType: z.string().optional().default('fisica'),
  rfc: z.string().optional().default(''),
  razonSocial: z.string().optional().default(''),
  regimenFiscal: z.string().optional().default(''),
  usoCfdi: z.string().optional().default('G03'),
  codigoPostalFiscal: z.string().optional().default(''),
  emailFacturas: z.string().optional().default(''),
  birthday: z.string().optional(),
  cloudId: z.string().optional(),
  notes: z.string().optional().default(''),
  active: z.boolean().optional().default(true),
})

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().optional().nullable(),
  cellphone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  contactName: z.string().optional().nullable(),
  priceListId: z.string().uuid().optional().nullable(),
  defaultDiscount: z.union([z.string(), z.number()]).optional().nullable(),
  creditLimit: z.union([z.string(), z.number()]).optional().nullable(),
  creditDays: z.union([z.string(), z.number()]).optional().nullable(),
  creditEnabled: z.boolean().optional(),
  creditStatus: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  personType: z.string().optional().nullable(),
  rfc: z.string().optional().nullable(),
  razonSocial: z.string().optional().nullable(),
  regimenFiscal: z.string().optional().nullable(),
  usoCfdi: z.string().optional().nullable(),
  codigoPostalFiscal: z.string().optional().nullable(),
  emailFacturas: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  cloudId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

async function enqueueCustomerSync(req: AuthenticatedRequest, row: any, entityType: string) {
  try {
    const pool = req.app.get('pool')

    // Resolve price list cloud_id
    let priceListCloudId: string | null = null
    if (row.priceListId) {
      const plr = await pool.query('SELECT cloud_id FROM price_lists WHERE id = $1', [row.priceListId])
      priceListCloudId = plr.rows[0]?.cloud_id ?? null
    }

    const payload = buildCustomerPayload(row, priceListCloudId)
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

// GET /birthdays — customers with upcoming birthdays (must be before /:id)
router.get(
  '/birthdays',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30

      const rows = await getCustomerBirthdays(db, days)
      res.json({ data: rows })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching birthdays' })
    }
  }
)

// GET /:id/stats — customer statistics
router.get(
  '/:id/stats',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params

      const stats = await getCustomerStats(db, id)
      res.json(stats)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching customer stats' })
    }
  }
)

// GET / — list customers with filters
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listCustomers(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing customers' })
    }
  }
)

// GET /:id — get single customer
router.get(
  '/:id',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const row = await getCustomerById(db, req.params.id)
      if (!row) return res.status(404).json({ error: 'Customer not found' })
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching customer' })
    }
  }
)

// POST / — create customer
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createCustomerSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createCustomer(db, parsed.data, userId)
      await enqueueCustomerSync(req, row, 'customer')
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating customer' })
    }
  }
)

// PUT /:id — update customer
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateCustomerSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateCustomer(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Customer not found' })
      }

      await enqueueCustomerSync(req, row, 'customer')
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating customer' })
    }
  }
)

// DELETE /:id — soft delete customer
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteCustomer(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Customer not found' })
      }

      await enqueueCustomerSync(req, row, 'customer')
      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting customer' })
    }
  }
)

export default router
