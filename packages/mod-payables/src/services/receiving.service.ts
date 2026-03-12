import {
  purchaseOrders, purchaseOrderItems, purchaseReceipts, purchaseReceiptItems,
  payables, changeJournal,
} from '@enlocal/core-db'
import { eq, and, inArray, sql, asc, desc } from 'drizzle-orm'
import { getNextReceiptFolio } from './folio.service'
import type { ReceiveItemsInput } from '../validators/receiving.validator'

// ─── Receive Items ────────────────────────────────────────────
export async function receiveItems(
  db: any,
  orderId: string,
  data: ReceiveItemsInput,
  userId: string
): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, orderId))
  if (!order) throw new Error('Orden de compra no encontrada')
  if (!['approved', 'partial_received'].includes(order.status)) {
    throw new Error('Solo se pueden recibir ordenes aprobadas o parcialmente recibidas')
  }

  const folio = await getNextReceiptFolio(db)

  const [receipt] = await db.insert(purchaseReceipts).values({
    purchaseOrderId: orderId,
    folio,
    receivedBy: userId,
    notes: data.notes ?? null,
  }).returning()

  const receiptItemValues: any[] = []

  for (const item of data.items) {
    const [orderItem] = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.id, item.order_item_id))
    if (!orderItem) throw new Error(`Item de orden no encontrado: ${item.order_item_id}`)

    const available = Number(orderItem.quantity) - Number(orderItem.quantityReceived)
    if (item.quantity_received > available) {
      throw new Error(`Cantidad recibida (${item.quantity_received}) excede pendiente (${available}) para ${orderItem.productName}`)
    }

    // Create stock movement (type='in')
    let movId: string | null = null
    try {
      const movResult = await db.execute(sql`
        INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
        VALUES (${orderItem.productId}, 'in', ${String(item.quantity_received)}, ${'REC-' + folio}, ${'Recepcion OC-' + order.folio}, ${userId})
        RETURNING id
      `)
      movId = movResult.rows?.[0]?.id ?? null
    } catch (err: any) {
      console.warn(`[receiving] Could not record stock movement for product ${orderItem.productId}: ${err.message}`)
    }

    receiptItemValues.push({
      receiptId: receipt.id,
      orderItemId: item.order_item_id,
      productId: orderItem.productId,
      productName: orderItem.productName,
      quantityReceived: String(item.quantity_received),
      quantityRejected: String(item.quantity_rejected ?? 0),
      condition: item.condition ?? 'good',
      conditionNotes: item.condition_notes ?? null,
      inventoryMovementId: movId,
    })

    // Update order item qty_received
    const newReceived = Number(orderItem.quantityReceived) + item.quantity_received
    await db.update(purchaseOrderItems).set({
      quantityReceived: String(newReceived),
    }).where(eq(purchaseOrderItems.id, item.order_item_id))
  }

  const insertedItems = await db.insert(purchaseReceiptItems).values(receiptItemValues).returning()

  // Determine order status
  const allItems = await db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, orderId))

  const allFullyReceived = allItems.every((i: any) => Number(i.quantityReceived) >= Number(i.quantity))
  const anyReceived = allItems.some((i: any) => Number(i.quantityReceived) > 0)

  let newStatus = order.status
  if (allFullyReceived) {
    newStatus = 'received'
  } else if (anyReceived) {
    newStatus = 'partial_received'
  }

  if (newStatus !== order.status) {
    await db.update(purchaseOrders).set({ status: newStatus, updatedAt: sql`now()` })
      .where(eq(purchaseOrders.id, orderId))
  }

  // Auto-create payable (CxP) for credit orders when fully received
  let payable = null
  if (newStatus === 'received' && order.paymentTerms === 'credit') {
    // Check if a payable already exists for this order
    const [existing] = await db.select().from(payables)
      .where(eq(payables.purchaseOrderId, orderId))
    if (!existing) {
      const totalAmount = Number(order.total)
      const creditDays = order.creditDays || 30
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + creditDays)
      const [created] = await db.insert(payables).values({
        supplierId: order.supplierId,
        purchaseOrderId: orderId,
        originalAmount: String(totalAmount.toFixed(2)),
        balance: String(totalAmount.toFixed(2)),
        issuedDate: sql`now()`,
        dueDate,
        status: 'current',
      }).returning()
      payable = created
    }
  }

  await db.insert(changeJournal).values({
    tableName: 'purchase_receipts', recordId: receipt.id, action: 'insert',
    data: receipt, userId, synced: false,
  })

  return { receipt: { ...receipt, items: insertedItems }, orderStatus: newStatus, payable }
}

// ─── Get Pending for Warehouse ────────────────────────────────
export async function getPendingForWarehouse(db: any): Promise<any[]> {
  const orders = await db.select().from(purchaseOrders)
    .where(inArray(purchaseOrders.status, ['approved', 'partial_received']))
    .orderBy(asc(purchaseOrders.expectedDate))

  // Enrich each order with its items
  for (const order of orders) {
    const items = await db.select().from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, order.id))
    order.items = items
  }

  return orders
}

// ─── Get Receipts ─────────────────────────────────────────────
export async function getReceipts(
  db: any,
  filters: { purchase_order_id?: string; page?: number; limit?: number }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.purchase_order_id) conditions.push(eq(purchaseReceipts.purchaseOrderId, filters.purchase_order_id))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(purchaseReceipts)
    .where(where).orderBy(desc(purchaseReceipts.createdAt)).limit(limit).offset(offset)

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(purchaseReceipts).where(where)
  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get Receipt By ID ────────────────────────────────────────
export async function getReceiptById(db: any, id: string): Promise<any> {
  const [receipt] = await db.select().from(purchaseReceipts).where(eq(purchaseReceipts.id, id))
  if (!receipt) return null

  const items = await db.select().from(purchaseReceiptItems)
    .where(eq(purchaseReceiptItems.receiptId, id))

  return { ...receipt, items }
}
