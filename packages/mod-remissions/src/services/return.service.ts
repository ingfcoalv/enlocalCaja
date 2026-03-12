import {
  remissionNotes, remissionNoteItems, remissionReturns, remissionReturnItems,
  receivables, invoices, changeJournal,
} from '@enlocal/core-db'
import { eq, and, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { getNextReturnFolio } from './folio.service'
import { recalculateCreditBalance } from './creditCheck.service'
import type { CreateReturnInput, ProcessReturnInput } from '../validators/return.validator'

// ─── Request Return ───────────────────────────────────────────
export async function request(
  db: any,
  data: CreateReturnInput,
  userId: string
): Promise<any> {
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, data.remission_note_id))
  if (!note) throw new Error('Nota de remision no encontrada')
  if (note.status !== 'delivered' && note.status !== 'returned_partial') {
    throw new Error('Solo se pueden devolver notas entregadas')
  }

  // Validate quantities
  for (const item of data.items) {
    const [noteItem] = await db.select().from(remissionNoteItems)
      .where(eq(remissionNoteItems.id, item.remission_item_id))
    if (!noteItem) throw new Error(`Item no encontrado: ${item.remission_item_id}`)

    const available = Number(noteItem.quantityDelivered) - Number(noteItem.quantityReturned)
    if (item.quantity_requested > available) {
      throw new Error(`Cantidad solicitada (${item.quantity_requested}) excede disponible (${available}) para ${noteItem.productName}`)
    }
  }

  const folio = await getNextReturnFolio(db)

  const [ret] = await db.insert(remissionReturns).values({
    remissionNoteId: data.remission_note_id,
    folio,
    returnType: data.return_type,
    reasonCategory: data.reason_category,
    reason: data.reason,
    requestedBy: userId,
  }).returning()

  // Insert return items
  const returnItemValues: any[] = []
  for (const item of data.items) {
    const [noteItem] = await db.select().from(remissionNoteItems)
      .where(eq(remissionNoteItems.id, item.remission_item_id))

    returnItemValues.push({
      returnId: ret.id,
      remissionItemId: item.remission_item_id,
      productId: noteItem.productId,
      productName: noteItem.productName,
      quantityRequested: String(item.quantity_requested),
      unitPrice: noteItem.unitPrice,
    })
  }

  const insertedItems = await db.insert(remissionReturnItems).values(returnItemValues).returning()

  await db.insert(changeJournal).values({
    tableName: 'remission_returns', recordId: ret.id, action: 'insert',
    data: ret, userId, synced: false,
  })

  return { ...ret, items: insertedItems }
}

// ─── Get All Returns ──────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    status?: string; remission_note_id?: string; customer_id?: string;
    from?: string; to?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.status) conditions.push(eq(remissionReturns.status, filters.status))
  if (filters.remission_note_id) conditions.push(eq(remissionReturns.remissionNoteId, filters.remission_note_id))
  if (filters.from) conditions.push(gte(remissionReturns.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(remissionReturns.createdAt, new Date(filters.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(remissionReturns)
    .where(where).orderBy(desc(remissionReturns.createdAt)).limit(limit).offset(offset)

  // If filtering by customer, we need to join through remission_notes
  if (filters.customer_id) {
    const noteIds = await db.select({ id: remissionNotes.id }).from(remissionNotes)
      .where(eq(remissionNotes.customerId, filters.customer_id))
    const ids = noteIds.map((n: any) => n.id)
    if (ids.length > 0) {
      conditions.push(inArray(remissionReturns.remissionNoteId, ids))
    }
  }

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(remissionReturns).where(where)
  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [ret] = await db.select().from(remissionReturns).where(eq(remissionReturns.id, id))
  if (!ret) return null

  const items = await db.select().from(remissionReturnItems).where(eq(remissionReturnItems.returnId, id))
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, ret.remissionNoteId))

  return { ...ret, items, remissionNote: note }
}

// ─── Pending for Warehouse ────────────────────────────────────
export async function getPendingForWarehouse(db: any): Promise<any[]> {
  return db.select().from(remissionReturns)
    .where(inArray(remissionReturns.status, ['requested', 'in_review']))
    .orderBy(asc(remissionReturns.requestedAt))
}

// ─── Review (warehouse starts inspection) ─────────────────────
export async function review(db: any, returnId: string, userId: string): Promise<any> {
  const [ret] = await db.select().from(remissionReturns).where(eq(remissionReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'requested') throw new Error('Solo se pueden revisar devoluciones solicitadas')

  const [updated] = await db.update(remissionReturns).set({
    status: 'in_review',
    reviewedBy: userId,
    reviewedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(remissionReturns.id, returnId)).returning()

  return updated
}

// ─── Process (warehouse accepts/rejects items) ────────────────
export async function process(
  db: any,
  returnId: string,
  data: ProcessReturnInput,
  userId: string
): Promise<{ return_: any; inventoryMovements: any[]; ticketAdjustment: boolean; receivableAdjustment: boolean }> {
  const [ret] = await db.select().from(remissionReturns).where(eq(remissionReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'in_review') throw new Error('Solo se pueden procesar devoluciones en revision')

  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, ret.remissionNoteId))
  if (!note) throw new Error('Nota de remision no encontrada')

  const inventoryMovements: any[] = []
  let totalRefunded = 0

  for (const item of data.items) {
    const [returnItem] = await db.select().from(remissionReturnItems)
      .where(eq(remissionReturnItems.id, item.return_item_id))
    if (!returnItem) throw new Error(`Item de devolucion no encontrado: ${item.return_item_id}`)

    const refund = item.quantity_accepted * Number(returnItem.unitPrice)
    totalRefunded += refund

    // Update return item
    await db.update(remissionReturnItems).set({
      quantityAccepted: String(item.quantity_accepted),
      quantityRejected: String(item.quantity_rejected),
      itemStatus: item.item_status,
      productCondition: item.product_condition,
      conditionNotes: item.condition_notes ?? null,
      rejectReason: item.reject_reason ?? null,
      totalRefund: String(refund.toFixed(2)),
    }).where(eq(remissionReturnItems.id, item.return_item_id))

    // Handle inventory
    if ((item.item_status === 'accepted' || item.item_status === 'partial') && item.quantity_accepted > 0) {
      if (item.restock) {
        // Restock - product is in good condition (optional — stock_movements table may not exist)
        let movId: string | null = null
        try {
          const movResult = await db.execute(sql`
            INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
            VALUES (${returnItem.productId}, 'in', ${String(item.quantity_accepted)}, ${'DEV-' + ret.folio}, ${'Devolucion DEV-' + ret.folio}, ${userId})
            RETURNING id
          `)
          movId = movResult.rows?.[0]?.id ?? null
        } catch (err: any) {
          console.warn(`[return] Could not record restock movement for product ${returnItem.productId}: ${err.message}`)
        }
        inventoryMovements.push({ productId: returnItem.productId, type: 'restock', quantity: item.quantity_accepted, movementId: movId })

        await db.update(remissionReturnItems).set({
          restockedQuantity: String(item.quantity_accepted),
          inventoryMovementId: movId,
        }).where(eq(remissionReturnItems.id, item.return_item_id))
      } else {
        // Damaged/shrinkage - record as adjustment, don't add back to stock (optional — stock_movements table may not exist)
        let shrinkageMovId: string | null = null
        try {
          const movResult = await db.execute(sql`
            INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
            VALUES (${returnItem.productId}, 'adjustment', ${String(-item.quantity_accepted)}, ${'DEV-' + ret.folio + '-MERMA'}, ${'Merma por devolucion - ' + item.product_condition + ': ' + (item.condition_notes || '')}, ${userId})
            RETURNING id
          `)
          shrinkageMovId = movResult.rows?.[0]?.id ?? null
        } catch (err: any) {
          console.warn(`[return] Could not record shrinkage movement for product ${returnItem.productId}: ${err.message}`)
        }
        inventoryMovements.push({ productId: returnItem.productId, type: 'shrinkage', quantity: item.quantity_accepted, movementId: shrinkageMovId })
      }

      // Update quantity_returned on original remission item
      const [origItem] = await db.select().from(remissionNoteItems)
        .where(eq(remissionNoteItems.id, returnItem.remissionItemId))
      if (origItem) {
        const newReturned = Number(origItem.quantityReturned) + item.quantity_accepted
        await db.update(remissionNoteItems).set({
          quantityReturned: String(newReturned),
        }).where(eq(remissionNoteItems.id, returnItem.remissionItemId))
      }
    }
  }

  // Determine return status
  const allReturnItems = await db.select().from(remissionReturnItems).where(eq(remissionReturnItems.returnId, returnId))
  const allAccepted = allReturnItems.every((i: any) => i.itemStatus === 'accepted')
  const allRejected = allReturnItems.every((i: any) => i.itemStatus === 'rejected')
  const finalStatus = allRejected ? 'rejected' : allAccepted ? 'completed' : 'partial'

  // Adjust ticket
  let ticketAdjustment = false
  if (totalRefunded > 0 && note.ticketId) {
    const [ticket] = await db.select().from(invoices).where(eq(invoices.id, note.ticketId))
    if (ticket) {
      const newTotal = Number(ticket.total) - totalRefunded
      await db.update(invoices).set({
        total: String(Math.max(0, newTotal).toFixed(2)),
        updatedAt: sql`now()`,
      }).where(eq(invoices.id, note.ticketId))
      ticketAdjustment = true
    }
  }

  // Adjust receivable if exists
  let receivableAdjustment = false
  if (totalRefunded > 0) {
    const recRows = await db.select().from(receivables).where(eq(receivables.remissionNoteId, note.id))
    for (const rec of recRows) {
      const newAdjustments = Number(rec.adjustments) + totalRefunded
      const newBalance = Number(rec.originalAmount) - newAdjustments - Number(rec.amountPaid)
      await db.update(receivables).set({
        adjustments: String(newAdjustments.toFixed(2)),
        balance: String(Math.max(0, newBalance).toFixed(2)),
        status: newBalance <= 0 ? 'paid' : rec.status,
        updatedAt: sql`now()`,
      }).where(eq(receivables.id, rec.id))
      receivableAdjustment = true
    }

    await recalculateCreditBalance(db, note.customerId)
  }

  // Update remission note status
  const noteItems = await db.select().from(remissionNoteItems)
    .where(eq(remissionNoteItems.remissionNoteId, note.id))
  const totalDelivered = noteItems.reduce((s: number, i: any) => s + Number(i.quantityDelivered), 0)
  const totalReturned = noteItems.reduce((s: number, i: any) => s + Number(i.quantityReturned), 0)

  if (totalReturned > 0) {
    const noteStatus = totalReturned >= totalDelivered ? 'returned_full' : 'returned_partial'
    await db.update(remissionNotes).set({ status: noteStatus, updatedAt: sql`now()` })
      .where(eq(remissionNotes.id, note.id))
  }

  // Update return record
  const [updatedReturn] = await db.update(remissionReturns).set({
    status: finalStatus,
    totalReturned: String(totalRefunded.toFixed(2)),
    reviewNotes: data.review_notes ?? null,
    completedAt: sql`now()`,
    ticketAdjusted: ticketAdjustment,
    receivableAdjusted: receivableAdjustment,
    updatedAt: sql`now()`,
  }).where(eq(remissionReturns.id, returnId)).returning()

  await db.insert(changeJournal).values({
    tableName: 'remission_returns', recordId: returnId, action: 'process',
    data: updatedReturn, userId, synced: false,
  })

  return { return_: updatedReturn, inventoryMovements, ticketAdjustment, receivableAdjustment }
}

// ─── Reject ───────────────────────────────────────────────────
export async function reject(db: any, returnId: string, reason: string, userId: string): Promise<any> {
  const [ret] = await db.select().from(remissionReturns).where(eq(remissionReturns.id, returnId))
  if (!ret) throw new Error('Devolucion no encontrada')
  if (ret.status !== 'in_review') throw new Error('Solo se pueden rechazar devoluciones en revision')

  // Mark all items as rejected
  await db.update(remissionReturnItems).set({ itemStatus: 'rejected', rejectReason: reason })
    .where(eq(remissionReturnItems.returnId, returnId))

  const [updated] = await db.update(remissionReturns).set({
    status: 'rejected',
    reviewNotes: reason,
    completedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(remissionReturns.id, returnId)).returning()

  return updated
}
