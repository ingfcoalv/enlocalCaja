import { Router } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '@enlocal/core-server'
import { requirePermission } from '@enlocal/core-server'
import { products } from '@enlocal/core-db'
import { eq } from 'drizzle-orm'
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkCreateProducts,
  validateImportData,
  executeImport,
  exportProductsCSV,
} from '../services/products.service'
import type { ImportRawRow, ValidatedRow } from '../services/products.service'
import { buildProductPayload } from '@enlocal/core-sync'

const priceEntrySchema = z.object({
  priceListId: z.string().uuid(),
  price: z.union([z.string(), z.number()]).transform(String),
})

const optStr = z.string().optional().nullable()

const createProductSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255),
  description: optStr.default(''),
  price: z.union([z.string(), z.number()]).transform(String),
  cost: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : '0'),
  sku: optStr.default(''),
  barcode: optStr.default(''),
  satCode: optStr.default('01010101'),
  satUnit: optStr.default('E48'),
  taxRate: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : '0.16'),
  objetoImpuesto: z.string().optional().default('02'),
  iepsRate: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : '0'),
  active: z.boolean().optional().default(true),
  cloudId: optStr,
  prices: z.array(priceEntrySchema).optional(),
  // Stock
  currentStock: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : '0'),
  minStock: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : '0'),
  // Bulk / weight selling
  sellByWeight: z.boolean().optional().default(false),
  saleUnit: optStr,
  stockUnit: optStr,
  conversionFactor: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
})

const updateProductSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(255).optional(),
  description: optStr,
  price: z.union([z.string(), z.number()]).transform(String).optional(),
  cost: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
  sku: optStr,
  barcode: optStr,
  satCode: optStr,
  satUnit: optStr,
  taxRate: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
  objetoImpuesto: z.string().optional(),
  iepsRate: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
  active: z.boolean().optional(),
  cloudId: optStr,
  prices: z.array(priceEntrySchema).optional(),
  // Stock
  currentStock: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
  minStock: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
  // Bulk / weight selling
  sellByWeight: z.boolean().optional(),
  saleUnit: optStr,
  stockUnit: optStr,
  conversionFactor: z.union([z.string(), z.number()]).optional().nullable().transform(v => v != null ? String(v) : undefined),
})

const bulkProductSchema = z.object({
  items: z.array(createProductSchema).min(1).max(500),
})

async function enqueueProductSync(req: AuthenticatedRequest, row: any, entityType: string) {
  try {
    const pool = req.app.get('pool')
    const catCloudId = row.categoryId
      ? (await pool.query('SELECT cloud_id FROM categories WHERE id = $1', [row.categoryId])).rows[0]?.cloud_id
      : null

    // Fetch price list prices for this product
    const plResult = await pool.query(
      `SELECT pp.price, pl.cloud_id AS price_list_cloud_id, pl.name AS price_list_name
       FROM product_prices pp
       JOIN price_lists pl ON pl.id = pp.price_list_id
       WHERE pp.product_id = $1 AND pl.active = true`,
      [row.id]
    )
    const priceListPrices = plResult.rows.map((r: any) => ({
      priceListCloudId: r.price_list_cloud_id as string | null,
      priceListName: r.price_list_name as string,
      price: parseFloat(r.price),
    }))

    const payload = buildProductPayload(row, catCloudId, priceListPrices)
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

// GET / — list products with filters
router.get(
  '/',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const filters = {
        categoryId: req.query.categoryId as string | undefined,
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        q: req.query.q as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      }

      const result = await listProducts(db, filters)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listing products' })
    }
  }
)

// GET /export — export products as CSV
router.get(
  '/export',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const csv = await exportProductsCSV(db)
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="productos.csv"')
      // BOM for Excel UTF-8 compatibility
      res.send('\uFEFF' + csv)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error exporting products' })
    }
  }
)

// POST /import/validate — validate CSV data before import
router.post(
  '/import/validate',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { rows } = req.body as { rows: ImportRawRow[] }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No se enviaron filas para validar' })
      }
      if (rows.length > 5000) {
        return res.status(400).json({ error: 'Maximo 5000 filas por importacion' })
      }

      const result = await validateImportData(db, rows)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error validating import' })
    }
  }
)

// POST /import/execute — execute validated import
router.post(
  '/import/execute',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { rows, mode } = req.body as { rows: ValidatedRow[]; mode: 'skip' | 'update' }

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No se enviaron filas para importar' })
      }

      const userId = req.user?.id ?? 'system'
      const result = await executeImport(db, rows, mode || 'skip', userId)
      res.json(result)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error executing import' })
    }
  }
)

// POST /bulk — bulk import products
router.post(
  '/bulk',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = bulkProductSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const rows = await bulkCreateProducts(db, parsed.data.items, userId)
      res.status(201).json({ data: rows, count: rows.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error bulk creating products' })
    }
  }
)

// POST / — create product
router.post(
  '/',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const parsed = createProductSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await createProduct(db, parsed.data, userId)
      await enqueueProductSync(req, row, 'product')
      res.status(201).json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error creating product' })
    }
  }
)

// GET /:id — get product by ID
router.get(
  '/:id',
  requirePermission('catalogs.read') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const rows = await db.select().from(products).where(eq(products.id, id)).limit(1)

      if (!rows.length) {
        return res.status(404).json({ error: 'Product not found' })
      }

      res.json(rows[0])
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error fetching product' })
    }
  }
)

// PUT /:id — update product
router.put(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const parsed = updateProductSchema.safeParse(req.body)

      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation error', details: parsed.error.flatten() })
      }

      const userId = req.user?.id ?? 'system'
      const row = await updateProduct(db, id, parsed.data, userId)

      if (!row) {
        return res.status(404).json({ error: 'Product not found' })
      }

      await enqueueProductSync(req, row, 'product_update')
      res.json(row)
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error updating product' })
    }
  }
)

// DELETE /:id — soft delete product
router.delete(
  '/:id',
  requirePermission('catalogs.write') as any,
  async (req: AuthenticatedRequest, res) => {
    try {
      const db = req.app.get('db')
      const { id } = req.params
      const userId = req.user?.id ?? 'system'
      const row = await deleteProduct(db, id, userId)

      if (!row) {
        return res.status(404).json({ error: 'Product not found' })
      }

      await enqueueProductSync(req, row, 'product_update')
      res.json({ success: true, data: row })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error deleting product' })
    }
  }
)

export default router
