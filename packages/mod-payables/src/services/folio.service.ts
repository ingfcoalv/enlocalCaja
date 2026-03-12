import { purchaseOrders, purchaseReceipts, purchaseReturns, settings } from '@enlocal/core-db'
import { sql, eq } from 'drizzle-orm'

export async function getNextPurchaseOrderFolio(db: any, series: string = 'OC'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${purchaseOrders.folio}), 0)` })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'purchase_order_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}

export async function getNextReceiptFolio(db: any, series: string = 'REC'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${purchaseReceipts.folio}), 0)` })
    .from(purchaseReceipts)
    .where(eq(purchaseReceipts.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'receipt_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}

export async function getNextPurchaseReturnFolio(db: any, series: string = 'DPR'): Promise<number> {
  const [maxRow] = await db
    .select({ maxFolio: sql<number>`coalesce(max(${purchaseReturns.folio}), 0)` })
    .from(purchaseReturns)
    .where(eq(purchaseReturns.series, series))

  const [configRow] = await db.select().from(settings)
    .where(eq(settings.key, 'purchase_return_starting_folio'))

  const maxCurrent = maxRow?.maxFolio ?? 0
  const startingFolio = configRow ? parseInt(configRow.value) : 0

  return Math.max(maxCurrent, startingFolio - 1) + 1
}
