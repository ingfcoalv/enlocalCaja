import {
  purchaseOrders, purchaseOrderItems, purchaseReturns, purchaseReturnItems,
  payables, changeJournal,
} from '@enlocal/core-db'
import { eq, and, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { getNextPurchaseReturnFolio } from './folio.service'
import { recalculateSupplierBalance } from './supplierBalance.service'
import type { CreatePurchaseReturnInput } from '../validators/purchaseReturn.validator'

// ─── Create Return ────────────────────────────────────────────
export async function create(
  db: any,
  data: CreatePurchaseReturnInput,
  userId: string
): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, data.purchase_order_id))
  if (!order) throw new Error('Orden de compra no encontrada')
  if (!['received', 'partial_received'].includes(order.status)) {
    throw new Error('Solo se pueden devolver ordenes recibidas')
  }

  // Validate quantities
  for (const item of data.items) {
    const [orderItem] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.order_item_id))
    if (!orderItem) throw new Error(`Item de orden no encontrado: ${item.order_item_id}`)

    const available = Number(orderItem.quantityReceived) - Number(orderItem.quantityReturned)
    if (item.quantity_returned > available) {
      throw new Error(`Cantidad devuelta (${item.quantity_returned}) excede disponible (${available}) para ${orderItem.productName}`)
    }
  }

  const folio = await getNextPurchaseReturnFolio(db)

  const [ret] = await db.insert(purchaseReturns).values({
    purchaseOrderId: data.purchase_order_id,
    folio,
    returnType: data.return_type,
    reasonCategory: data.reason_category,
    reason: data.reason,
    createdBy: userId,
  }).returning()

  const returnItemValues: any[] = []
  for (const item of data.items) {
    const [orderItem] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.order_item_id))

    returnItemValues.push({
      returnId: ret.id,
      orderItemId: item.order_item_id,
      productId: orderItem.productId,
      productName: orderItem.productName,
      quantityReturned: String(item.quantity_returned),
      unitCost: orderItem.unitCost,
      totalRefund: String((item.quantity_returned * Number(orderItem.unitCost)).toFixed(2)),
      condition: item.condition ?? null,
      conditionNotes: item.condition_notes ?? null,
    })
  }

  const insertedItems = await db.insert(purchaseReturnItems).values(returnItemValues).returning()

  await db.insert(changeJournal).values({
    tableName: 'purchase_returns', recordId: ret.id, action: 'insert',
    data: ret, userId, synced: false,
  })

  return { ...ret, items: insertedItems }
}

// ─── Send (ship items back to supplier — inventory OUT) ───────
export async function send(
  db: any,
  returnId: string,
  userId: string
): Promise<any> {
  const [ret] = await db.select().from(purchaseReturns).where(eq(purchaseReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'draft') throw new Error('Solo se pueden enviar devoluciones en borrador')

  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, ret.purchaseOrderId))

  // Reduce inventory (stock_movements type='out')
  const items = await db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.returnId, returnId))
  for (const item of items) {
    try {
      const movResult = await db.execute(sql`
        INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
        VALUES (${item.productId}, 'out', ${item.quantityReturned}, ${'DPR-' + ret.folio}, ${'Devolucion a proveedor DPR-' + ret.folio}, ${userId})
        RETURNING id
      `)
      const movId = movResult.rows?.[0]?.id ?? null
      await db.update(purchaseReturnItems).set({ inventoryMovementId: movId })
        .where(eq(purchaseReturnItems.id, item.id))
    } catch (err: any) {
      console.warn(`[purchaseReturn] Could not record stock movement for product ${item.productId}: ${err.message}`)
    }

    // Update order item qty_returned
    const [orderItem] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.orderItemId))
    if (orderItem) {
      const newReturned = Number(orderItem.quantityReturned) + Number(item.quantityReturned)
      await db.update(purchaseOrderItems).set({
        quantityReturned: String(newReturned),
      }).where(eq(purchaseOrderItems.id, item.orderItemId))
    }
  }

  const totalRefund = items.reduce((s: number, i: any) => s + Number(i.totalRefund), 0)

  const [updated] = await db.update(purchaseReturns).set({
    status: 'sent',
    sentAt: sql`now()`,
    sentBy: userId,
    totalReturned: String(totalRefund.toFixed(2)),
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturns.id, returnId)).returning()

  return updated
}

// ─── Complete (supplier confirms, adjust payable) ─────────────
export async function complete(
  db: any,
  returnId: string,
  userId: string,
  notes?: string
): Promise<any> {
  const [ret] = await db.select().from(purchaseReturns).where(eq(purchaseReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'sent') throw new Error('Solo se pueden completar devoluciones enviadas')

  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, ret.purchaseOrderId))

  const totalRefund = Number(ret.totalReturned)

  // Adjust payable
  let payableAdjusted = false
  if (totalRefund > 0) {
    const payableRows = await db.select().from(payables)
      .where(eq(payables.purchaseOrderId, ret.purchaseOrderId))
    for (const p of payableRows) {
      const newAdjustments = Number(p.adjustments) + totalRefund
      const newBalance = Number(p.originalAmount) - newAdjustments - Number(p.amountPaid)
      await db.update(payables).set({
        adjustments: String(newAdjustments.toFixed(2)),
        balance: String(Math.max(0, newBalance).toFixed(2)),
        status: newBalance <= 0 ? 'paid' : p.status,
        updatedAt: sql`now()`,
      }).where(eq(payables.id, p.id))
      payableAdjusted = true
    }

    if (order) {
      await recalculateSupplierBalance(db, order.supplierId)
    }
  }

  const [updated] = await db.update(purchaseReturns).set({
    status: 'completed',
    completedAt: sql`now()`,
    completedBy: userId,
    payableAdjusted,
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturns.id, returnId)).returning()

  return updated
}

// ─── Reject (supplier rejects — inventory back IN) ────────────
export async function reject(
  db: any,
  returnId: string,
  userId: string,
  reason: string
): Promise<any> {
  const [ret] = await db.select().from(purchaseReturns).where(eq(purchaseReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'sent') throw new Error('Solo se pueden rechazar devoluciones enviadas')

  // Revert inventory (stock_movements type='in' reingreso)
  const items = await db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.returnId, returnId))
  for (const item of items) {
    try {
      await db.execute(sql`
        INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
        VALUES (${item.productId}, 'in', ${item.quantityReturned}, ${'DPR-' + ret.folio + '-REINGRESO'}, ${'Reingreso por rechazo devolucion DPR-' + ret.folio}, ${userId})
      `)
    } catch (err: any) {
      console.warn(`[purchaseReturn] Could not record reingreso movement for product ${item.productId}: ${err.message}`)
    }

    // Revert order item qty_returned
    const [orderItem] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.orderItemId))
    if (orderItem) {
      const newReturned = Math.max(0, Number(orderItem.quantityReturned) - Number(item.quantityReturned))
      await db.update(purchaseOrderItems).set({
        quantityReturned: String(newReturned),
      }).where(eq(purchaseOrderItems.id, item.orderItemId))
    }
  }

  const [updated] = await db.update(purchaseReturns).set({
    status: 'rejected',
    rejectedAt: sql`now()`,
    rejectedBy: userId,
    rejectedReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(purchaseReturns.id, returnId)).returning()

  return updated
}

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    status?: string; purchase_order_id?: string;
    from?: string; to?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.status) conditions.push(eq(purchaseReturns.status, filters.status))
  if (filters.purchase_order_id) conditions.push(eq(purchaseReturns.purchaseOrderId, filters.purchase_order_id))
  if (filters.from) conditions.push(gte(purchaseReturns.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(purchaseReturns.createdAt, new Date(filters.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(purchaseReturns)
    .where(where).orderBy(desc(purchaseReturns.createdAt)).limit(limit).offset(offset)

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseReturns).where(where)
  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [ret] = await db.select().from(purchaseReturns).where(eq(purchaseReturns.id, id))
  if (!ret) return null

  const items = await db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.returnId, id))
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, ret.purchaseOrderId))

  return { ...ret, items, purchaseOrder: order }
}
