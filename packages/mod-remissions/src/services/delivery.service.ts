import {
  remissionNotes, remissionNoteItems, remissionStatusHistory,
  invoices, receivables, changeJournal,
} from '@enlocal/core-db'
import { eq, sql } from 'drizzle-orm'
import type { PrepareRemissionInput, DeliverRemissionInput } from '../validators/remission.validator'
import { recalculateCreditBalance } from './creditCheck.service'

async function recordStatusChange(
  db: any, remissionNoteId: string, fromStatus: string, toStatus: string,
  userId: string, userName: string, userRole: string
) {
  await db.insert(remissionStatusHistory).values({
    remissionNoteId, fromStatus, toStatus,
    changedBy: userId, changedByName: userName, changedByRole: userRole,
  })
}

// ─── Prepare (warehouse picks items) ──────────────────────────
export async function prepare(
  db: any,
  remissionId: string,
  data: PrepareRemissionInput,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'warehouse'
): Promise<any> {
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, remissionId))
  if (!note) throw new Error('Nota de remision no encontrada')
  if (note.status !== 'confirmed') throw new Error('Solo se pueden preparar notas confirmadas')

  for (const item of data.items) {
    const [noteItem] = await db.select().from(remissionNoteItems)
      .where(eq(remissionNoteItems.id, item.remission_item_id))
    if (!noteItem) throw new Error(`Item no encontrado: ${item.remission_item_id}`)
    if (item.quantity_prepared > Number(noteItem.quantity)) {
      throw new Error(`Cantidad preparada (${item.quantity_prepared}) excede cantidad solicitada (${noteItem.quantity}) para ${noteItem.productName}`)
    }

    await db.update(remissionNoteItems).set({
      quantityPrepared: String(item.quantity_prepared),
    }).where(eq(remissionNoteItems.id, item.remission_item_id))
  }

  const [updated] = await db.update(remissionNotes).set({
    status: 'prepared',
    preparedBy: userId,
    preparedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(remissionNotes.id, remissionId)).returning()

  await recordStatusChange(db, remissionId, 'confirmed', 'prepared', userId, userName, userRole)

  return updated
}

// ─── Deliver (hand off to customer, deduct inventory) ─────────
export async function deliver(
  db: any,
  remissionId: string,
  data: DeliverRemissionInput,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'warehouse'
): Promise<{ remission: any; inventoryMovements: any[] }> {
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, remissionId))
  if (!note) throw new Error('Nota de remision no encontrada')
  if (note.status !== 'prepared') throw new Error('Solo se pueden entregar notas preparadas')

  const inventoryMovements: any[] = []
  let totalDelivered = 0
  let totalOrdered = 0

  for (const item of data.items) {
    const [noteItem] = await db.select().from(remissionNoteItems)
      .where(eq(remissionNoteItems.id, item.remission_item_id))
    if (!noteItem) throw new Error(`Item no encontrado: ${item.remission_item_id}`)
    if (item.quantity_delivered > Number(noteItem.quantityPrepared)) {
      throw new Error(`Cantidad entregada (${item.quantity_delivered}) excede cantidad preparada (${noteItem.quantityPrepared}) para ${noteItem.productName}`)
    }

    totalDelivered += item.quantity_delivered * Number(noteItem.unitPrice)
    totalOrdered += Number(noteItem.quantity) * Number(noteItem.unitPrice)

    // Deduct inventory (optional — stock_movements table may not exist if mod-inventory is not loaded)
    let movementId: string | null = null
    try {
      const movementResult = await db.execute(sql`
        INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
        VALUES (${noteItem.productId}, 'out', ${String(item.quantity_delivered)}, ${'NR-' + note.folio}, ${'Entrega remision NR-' + note.folio}, ${userId})
        RETURNING id
      `)
      movementId = movementResult.rows?.[0]?.id ?? null
    } catch (err: any) {
      console.warn(`[delivery] Could not record stock movement for product ${noteItem.productId}: ${err.message}`)
    }

    inventoryMovements.push({
      productId: noteItem.productId,
      productName: noteItem.productName,
      quantity: item.quantity_delivered,
      movementId,
    })

    await db.update(remissionNoteItems).set({
      quantityDelivered: String(item.quantity_delivered),
      inventoryDeducted: true,
      inventoryMovementId: movementId,
    }).where(eq(remissionNoteItems.id, item.remission_item_id))
  }

  // If partial delivery, recalculate note totals
  const allItems = await db.select().from(remissionNoteItems)
    .where(eq(remissionNoteItems.remissionNoteId, remissionId))

  let newSubtotal = 0, newTax = 0, newTotal = 0
  for (const ni of allItems) {
    const qty = Number(ni.quantityDelivered)
    const price = Number(ni.unitPrice)
    const disc = Number(ni.discount)
    const rate = Number(ni.taxRate)
    const lineSub = Math.round((qty * price - disc) * 100) / 100
    const lineTax = Math.round(lineSub * rate * 100) / 100
    newSubtotal += lineSub
    newTax += lineTax
    newTotal += lineSub + lineTax
  }

  const updateData: any = {
    status: 'delivered',
    deliveredBy: userId,
    deliveredAt: sql`now()`,
    receivedBy: data.received_by,
    receivedIdDoc: data.received_id_doc ?? null,
    signatureUrl: data.signature_url ?? null,
    updatedAt: sql`now()`,
  }

  // Update totals if delivery was partial
  const originalTotal = Number(note.total)
  if (Math.abs(newTotal - originalTotal) > 0.01) {
    updateData.subtotal = String(newSubtotal.toFixed(2))
    updateData.taxAmount = String(newTax.toFixed(2))
    updateData.total = String(newTotal.toFixed(2))

    // Update ticket
    if (note.ticketId) {
      await db.update(invoices).set({
        subtotal: String(newSubtotal.toFixed(2)),
        tax: String(newTax.toFixed(2)),
        total: String(newTotal.toFixed(2)),
        updatedAt: sql`now()`,
      }).where(eq(invoices.id, note.ticketId))
    }

    // Update receivable if exists
    const recRows = await db.select().from(receivables).where(eq(receivables.remissionNoteId, remissionId))
    for (const rec of recRows) {
      const newBalance = newTotal - Number(rec.adjustments) - Number(rec.amountPaid)
      await db.update(receivables).set({
        originalAmount: String(newTotal.toFixed(2)),
        balance: String(Math.max(0, newBalance).toFixed(2)),
        status: newBalance <= 0 ? 'paid' : rec.status,
        updatedAt: sql`now()`,
      }).where(eq(receivables.id, rec.id))
    }

    if (note.customerId) {
      await recalculateCreditBalance(db, note.customerId)
    }
  }

  if (data.delivery_notes) updateData.deliveryNotes = data.delivery_notes

  const [updated] = await db.update(remissionNotes).set(updateData)
    .where(eq(remissionNotes.id, remissionId)).returning()

  await recordStatusChange(db, remissionId, 'prepared', 'delivered', userId, userName, userRole)

  await db.insert(changeJournal).values({
    tableName: 'remission_notes', recordId: remissionId, action: 'deliver',
    data: updated, userId, synced: false,
  })

  return { remission: updated, inventoryMovements }
}
