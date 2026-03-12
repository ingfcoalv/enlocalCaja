import {
  purchaseOrders, purchaseOrderItems, purchaseOrderStatusHistory,
  purchaseReceipts, suppliers, products, changeJournal, payables,
} from '@enlocal/core-db'
import { eq, and, ilike, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { getNextPurchaseOrderFolio } from './folio.service'
import type { CreatePurchaseOrderInput, UpdatePurchaseOrderInput } from '../validators/purchaseOrder.validator'

// ─── Helpers ───────────────────────────────────────────────────
function calcItemTotals(item: { quantity: number; unit_cost: number; discount: number; tax_rate?: number }) {
  const taxRate = item.tax_rate ?? 0.16
  // Prices in DB are NET (tax-inclusive), so we extract tax from the total
  const lineTotal = item.quantity * item.unit_cost - item.discount
  const lineSubtotal = lineTotal / (1 + taxRate)
  const taxAmount = lineTotal - lineSubtotal
  return { lineSubtotal, taxAmount, total: lineTotal }
}

async function recordStatusChange(
  db: any,
  purchaseOrderId: string,
  fromStatus: string | null,
  toStatus: string,
  userId: string,
  userName: string,
  userRole: string,
  notes?: string
) {
  await db.insert(purchaseOrderStatusHistory).values({
    purchaseOrderId,
    fromStatus,
    toStatus,
    changedBy: userId,
    changedByName: userName,
    changedByRole: userRole,
    notes: notes ?? null,
  })
}

// ─── Create ────────────────────────────────────────────────────
export async function create(
  db: any,
  data: CreatePurchaseOrderInput,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'operator'
): Promise<any> {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, data.supplier_id))
  if (!supplier) throw new Error('Proveedor no encontrado')

  const folio = await getNextPurchaseOrderFolio(db)

  const productIds = data.items.map(i => i.product_id)
  const productRows = await db.select().from(products).where(inArray(products.id, productIds))
  const productMap: Record<string, any> = {}
  for (const p of productRows) productMap[p.id] = p

  let subtotal = 0
  let totalTax = 0
  let totalAmount = 0
  const itemValues: any[] = []

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx]
    const prod = productMap[item.product_id]
    if (!prod) throw new Error(`Producto no encontrado: ${item.product_id}`)

    const taxRate = Number(supplier.taxRate ?? prod.taxRate ?? 0.16)
    const { lineSubtotal, taxAmount, total } = calcItemTotals({
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      discount: item.discount ?? 0,
      tax_rate: taxRate,
    })

    subtotal += lineSubtotal
    totalTax += taxAmount
    totalAmount += total

    itemValues.push({
      productId: item.product_id,
      productName: prod.name,
      productSku: prod.sku ?? null,
      quantity: String(item.quantity),
      unitCost: String(item.unit_cost),
      discount: String(item.discount ?? 0),
      taxRate: String(taxRate),
      taxAmount: String(taxAmount.toFixed(2)),
      total: String(total.toFixed(2)),
      satCode: prod.satCode ?? null,
      satUnit: prod.satUnit ?? 'E48',
      notes: item.notes ?? null,
      sortOrder: idx,
    })
  }

  const creditDays = data.payment_terms === 'credit' ? (supplier.defaultCreditDays ?? 30) : null
  const expectedDate = data.expected_date ? new Date(data.expected_date) : null

  const [order] = await db.insert(purchaseOrders).values({
    folio,
    supplierId: data.supplier_id,
    supplierName: supplier.name,
    supplierRfc: supplier.rfc ?? null,
    paymentTerms: data.payment_terms ?? 'credit',
    creditDays,
    expectedDate,
    status: 'draft',
    subtotal: String(subtotal.toFixed(2)),
    taxAmount: String(totalTax.toFixed(2)),
    total: String(totalAmount.toFixed(2)),
    deliveryAddress: data.delivery_address ?? null,
    deliveryNotes: data.delivery_notes ?? null,
    internalNotes: data.internal_notes ?? null,
    createdBy: userId,
  }).returning()

  const itemsWithOrderId = itemValues.map(v => ({ ...v, purchaseOrderId: order.id }))
  const insertedItems = await db.insert(purchaseOrderItems).values(itemsWithOrderId).returning()

  await db.insert(changeJournal).values({
    tableName: 'purchase_orders',
    recordId: order.id,
    action: 'insert',
    data: order,
    userId,
    synced: false,
  })

  await recordStatusChange(db, order.id, null, 'draft', userId, userName, userRole)

  return { ...order, items: insertedItems }
}

// ─── Update (draft only) ──────────────────────────────────────
export async function update(
  db: any,
  id: string,
  data: UpdatePurchaseOrderInput,
  userId: string
): Promise<any> {
  const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  if (!existing) throw new Error('Orden de compra no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden editar ordenes en borrador')

  const updateData: any = { updatedAt: sql`now()` }

  if (data.supplier_id) {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, data.supplier_id))
    if (!supplier) throw new Error('Proveedor no encontrado')
    updateData.supplierId = data.supplier_id
    updateData.supplierName = supplier.name
    updateData.supplierRfc = supplier.rfc ?? null
  }
  if (data.payment_terms) updateData.paymentTerms = data.payment_terms
  if (data.expected_date !== undefined) updateData.expectedDate = data.expected_date ? new Date(data.expected_date) : null
  if (data.delivery_address !== undefined) updateData.deliveryAddress = data.delivery_address
  if (data.delivery_notes !== undefined) updateData.deliveryNotes = data.delivery_notes
  if (data.internal_notes !== undefined) updateData.internalNotes = data.internal_notes

  if (data.items && data.items.length > 0) {
    await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id))

    const productIds = data.items.map(i => i.product_id)
    const productRows = await db.select().from(products).where(inArray(products.id, productIds))
    const productMap: Record<string, any> = {}
    for (const p of productRows) productMap[p.id] = p

    const suppId = data.supplier_id ?? existing.supplierId
    const [supp] = await db.select().from(suppliers).where(eq(suppliers.id, suppId))

    let subtotal = 0, totalTax = 0, totalAmount = 0
    const itemValues: any[] = []

    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx]
      const prod = productMap[item.product_id]
      if (!prod) throw new Error(`Producto no encontrado: ${item.product_id}`)

      const taxRate = Number(supp?.taxRate ?? prod.taxRate ?? 0.16)
      const { lineSubtotal, taxAmount, total } = calcItemTotals({
        quantity: item.quantity, unit_cost: item.unit_cost,
        discount: item.discount ?? 0, tax_rate: taxRate,
      })
      subtotal += lineSubtotal; totalTax += taxAmount; totalAmount += total
      itemValues.push({
        purchaseOrderId: id, productId: item.product_id, productName: prod.name,
        productSku: prod.sku ?? null, quantity: String(item.quantity),
        unitCost: String(item.unit_cost), discount: String(item.discount ?? 0),
        taxRate: String(taxRate), taxAmount: String(taxAmount.toFixed(2)),
        total: String(total.toFixed(2)), satCode: prod.satCode ?? null,
        satUnit: prod.satUnit ?? 'E48', notes: item.notes ?? null, sortOrder: idx,
      })
    }

    await db.insert(purchaseOrderItems).values(itemValues)
    updateData.subtotal = String(subtotal.toFixed(2))
    updateData.taxAmount = String(totalTax.toFixed(2))
    updateData.total = String(totalAmount.toFixed(2))
  }

  const [updated] = await db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, id)).returning()
  const items = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id))
  return { ...updated, items }
}

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    status?: string; supplier_id?: string; payment_terms?: string;
    from?: string; to?: string; q?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.status) conditions.push(eq(purchaseOrders.status, filters.status))
  if (filters.supplier_id) conditions.push(eq(purchaseOrders.supplierId, filters.supplier_id))
  if (filters.payment_terms) conditions.push(eq(purchaseOrders.paymentTerms, filters.payment_terms))
  if (filters.from) conditions.push(gte(purchaseOrders.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(purchaseOrders.createdAt, new Date(filters.to)))
  if (filters.q) {
    conditions.push(
      sql`(${purchaseOrders.supplierName} ILIKE ${'%' + filters.q + '%'} OR CAST(${purchaseOrders.folio} AS text) LIKE ${'%' + filters.q + '%'})`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(purchaseOrders)
    .where(where).orderBy(desc(purchaseOrders.createdAt)).limit(limit).offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrders).where(where)

  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  if (!order) return null

  const items = await db.select().from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, id)).orderBy(asc(purchaseOrderItems.sortOrder))

  const receipts = await db.select().from(purchaseReceipts)
    .where(eq(purchaseReceipts.purchaseOrderId, id)).orderBy(asc(purchaseReceipts.createdAt))

  const history = await db.select().from(purchaseOrderStatusHistory)
    .where(eq(purchaseOrderStatusHistory.purchaseOrderId, id)).orderBy(asc(purchaseOrderStatusHistory.createdAt))

  return { ...order, items, receipts, statusHistory: history }
}

// ─── Approve ──────────────────────────────────────────────────
export async function approve(
  db: any,
  id: string,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'manager'
): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  if (!order) throw new Error('Orden de compra no encontrada')
  if (order.status !== 'draft') throw new Error('Solo se pueden aprobar ordenes en borrador')

  const [updated] = await db.update(purchaseOrders).set({
    status: 'approved',
    approvedBy: userId,
    approvedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrders.id, id)).returning()

  await recordStatusChange(db, id, 'draft', 'approved', userId, userName, userRole)

  await db.insert(changeJournal).values({
    tableName: 'purchase_orders', recordId: id, action: 'approve',
    data: updated, userId, synced: false,
  })

  return updated
}

// ─── Cancel ───────────────────────────────────────────────────
export async function cancel(
  db: any,
  id: string,
  userId: string,
  reason: string,
  userName: string = 'Sistema',
  userRole: string = 'operator'
): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  if (!order) throw new Error('Orden de compra no encontrada')
  if (!['draft', 'approved'].includes(order.status)) {
    throw new Error('Solo se pueden cancelar ordenes en borrador o aprobadas')
  }

  const prevStatus = order.status

  const [updated] = await db.update(purchaseOrders).set({
    status: 'cancelled',
    cancelledBy: userId,
    cancelledAt: sql`now()`,
    cancelReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrders.id, id)).returning()

  await recordStatusChange(db, id, prevStatus, 'cancelled', userId, userName, userRole, reason)

  return updated
}

// ─── Close Order (partial received) ──────────────────────────
export async function closeOrder(
  db: any,
  id: string,
  userId: string,
  reason: string,
  userName: string = 'Sistema',
  userRole: string = 'operator'
): Promise<any> {
  const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id))
  if (!order) throw new Error('Orden de compra no encontrada')
  if (!['approved', 'partial_received'].includes(order.status)) {
    throw new Error('Solo se pueden cerrar ordenes aprobadas o con recepcion parcial')
  }

  const prevStatus = order.status

  const [updated] = await db.update(purchaseOrders).set({
    status: 'closed',
    closedBy: userId,
    closedAt: sql`now()`,
    closeReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(purchaseOrders.id, id)).returning()

  await recordStatusChange(db, id, prevStatus, 'closed', userId, userName, userRole, reason)

  // Auto-create CxP for credit orders based on received amount
  let payable = null
  if (order.paymentTerms === 'credit') {
    const [existing] = await db.select().from(payables)
      .where(eq(payables.purchaseOrderId, id))
    if (!existing) {
      // Calculate received value from order items
      const items = await db.select().from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, id))
      let receivedTotal = 0
      for (const item of items) {
        const received = Number(item.quantityReceived) || 0
        if (received > 0) {
          const unitCost = Number(item.unitCost) || 0
          const totalQty = Number(item.quantity) || 1
          const itemTotal = Number(item.total) || 0
          // Proportional: (received / ordered) * item total
          receivedTotal += (received / totalQty) * itemTotal
        }
      }
      if (receivedTotal > 0) {
        const creditDays = order.creditDays || 30
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + creditDays)
        const [created] = await db.insert(payables).values({
          supplierId: order.supplierId,
          purchaseOrderId: id,
          originalAmount: String(receivedTotal.toFixed(2)),
          balance: String(receivedTotal.toFixed(2)),
          issuedDate: sql`now()`,
          dueDate,
          status: 'current',
        }).returning()
        payable = created
      }
    }
  }

  await db.insert(changeJournal).values({
    tableName: 'purchase_orders', recordId: id, action: 'close',
    data: updated, userId, synced: false,
  })

  return { ...updated, payable }
}

// ─── Print Data ───────────────────────────────────────────────
export async function getPrintData(db: any, id: string): Promise<any> {
  const order = await getById(db, id)
  if (!order) throw new Error('Orden de compra no encontrada')

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, order.supplierId))

  return {
    ...order,
    supplier,
    formattedFolio: `${order.series}-${String(order.folio).padStart(4, '0')}`,
  }
}
