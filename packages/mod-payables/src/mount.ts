import type { Express } from 'express'
import { authMiddleware } from '@enlocal/core-server'
import { sql } from 'drizzle-orm'
import purchaseOrdersRoutes from './routes/purchaseOrders.routes'
import warehouseReceivingRoutes from './routes/warehouseReceiving.routes'
import supplierInvoicesRoutes from './routes/supplierInvoices.routes'
import payablesRoutes from './routes/payables.routes'
import purchaseReturnsRoutes from './routes/purchaseReturns.routes'
import payablesConfigRoutes from './routes/payablesConfig.routes'

async function ensurePayablesSchema(db: any): Promise<void> {
  await db.execute(sql`ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS parent_invoice_id uuid REFERENCES supplier_invoices(id) ON DELETE SET NULL`)
  await db.execute(sql`ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS amount_complemented numeric(12,2) NOT NULL DEFAULT '0'`)
}

export function mountPayableRoutes(app: Express, db: any): void {
  app.set('db', db)

  ensurePayablesSchema(db).catch((err: any) =>
    console.error('[mod-payables] Schema migration error:', err.message)
  )

  app.use('/api/purchase-orders', authMiddleware as any, purchaseOrdersRoutes)
  app.use('/api/purchase-orders', authMiddleware as any, warehouseReceivingRoutes)
  app.use('/api/supplier-invoices', authMiddleware as any, supplierInvoicesRoutes)
  app.use('/api/payables', authMiddleware as any, payablesRoutes)
  app.use('/api/purchase-returns', authMiddleware as any, purchaseReturnsRoutes)
  app.use('/api/payables-config', authMiddleware as any, payablesConfigRoutes)
}
