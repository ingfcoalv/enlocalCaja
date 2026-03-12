import {
  remissionNotes, remissionNoteItems, remissionStatusHistory,
  customers, products, invoices, invoiceItems, receivables, changeJournal,
} from '@enlocal/core-db'
import { eq, and, ilike, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { getNextRemissionFolio } from './folio.service'
import { checkCredit, recalculateCreditBalance } from './creditCheck.service'
import type { CreateRemissionInput, UpdateRemissionInput } from '../validators/remission.validator'

// ─── Helpers ───────────────────────────────────────────────────
function calcItemTotals(item: { quantity: number; unit_price: number; discount: number; tax_rate?: number }) {
  const taxRate = item.tax_rate ?? 0.16
  const lineSubtotal = Math.round((item.quantity * item.unit_price - item.discount) * 100) / 100
  const taxAmount = Math.round(lineSubtotal * taxRate * 100) / 100
  const total = Math.round((lineSubtotal + taxAmount) * 100) / 100
  return { lineSubtotal, taxAmount, total }
}

async function recordStatusChange(
  db: any,
  remissionNoteId: string,
  fromStatus: string | null,
  toStatus: string,
  userId: string,
  userName: string,
  userRole: string,
  notes?: string
) {
  await db.insert(remissionStatusHistory).values({
    remissionNoteId,
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
  data: CreateRemissionInput,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'operator'
): Promise<any> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, data.customer_id))
  if (!customer) throw new Error('Cliente no encontrado')

  const folio = await getNextRemissionFolio(db)

  // Lookup products for snapshots and tax rates
  const productIds = data.items.map(i => i.product_id)
  const productRows = await db.select().from(products).where(inArray(products.id, productIds))
  const productMap: Record<string, any> = {}
  for (const p of productRows) productMap[p.id] = p

  // Calculate totals
  let subtotal = 0
  let totalTax = 0
  let totalAmount = 0
  const itemValues: any[] = []

  for (let idx = 0; idx < data.items.length; idx++) {
    const item = data.items[idx]
    const prod = productMap[item.product_id]
    if (!prod) throw new Error(`Producto no encontrado: ${item.product_id}`)

    const taxRate = Number(prod.taxRate ?? 0.16)
    const { lineSubtotal, taxAmount, total } = calcItemTotals({
      quantity: item.quantity,
      unit_price: item.unit_price,
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
      unitPrice: String(item.unit_price),
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

  // Calculate due date for credit
  let dueDate: Date | null = null
  let creditDays: number | null = null
  if (data.payment_type === 'credit') {
    creditDays = Number(customer.creditDays) || 0
    dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + creditDays)
  }

  const [note] = await db.insert(remissionNotes).values({
    folio,
    customerId: data.customer_id,
    customerName: customer.name,
    customerRfc: customer.rfc ?? null,
    paymentType: data.payment_type,
    creditDays,
    dueDate,
    status: 'draft',
    subtotal: String(subtotal.toFixed(2)),
    taxAmount: String(totalTax.toFixed(2)),
    total: String(totalAmount.toFixed(2)),
    deliveryAddress: data.delivery_address ?? null,
    deliveryNotes: data.delivery_notes ?? null,
    internalNotes: data.internal_notes ?? null,
    createdBy: userId,
  }).returning()

  // Insert items
  const itemsWithNoteId = itemValues.map(v => ({ ...v, remissionNoteId: note.id }))
  const insertedItems = await db.insert(remissionNoteItems).values(itemsWithNoteId).returning()

  await db.insert(changeJournal).values({
    tableName: 'remission_notes',
    recordId: note.id,
    action: 'insert',
    data: note,
    userId,
    synced: false,
  })

  await recordStatusChange(db, note.id, null, 'draft', userId, userName, userRole)

  return { ...note, items: insertedItems }
}

// ─── Update (draft only) ──────────────────────────────────────
export async function update(
  db: any,
  id: string,
  data: UpdateRemissionInput,
  userId: string
): Promise<any> {
  const [existing] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, id))
  if (!existing) throw new Error('Nota de remision no encontrada')
  if (existing.status !== 'draft') throw new Error('Solo se pueden editar notas en borrador')

  const updateData: any = { updatedAt: sql`now()` }

  if (data.customer_id) {
    const [customer] = await db.select().from(customers).where(eq(customers.id, data.customer_id))
    if (!customer) throw new Error('Cliente no encontrado')
    updateData.customerId = data.customer_id
    updateData.customerName = customer.name
    updateData.customerRfc = customer.rfc ?? null
  }
  if (data.payment_type) updateData.paymentType = data.payment_type
  if (data.delivery_address !== undefined) updateData.deliveryAddress = data.delivery_address
  if (data.delivery_notes !== undefined) updateData.deliveryNotes = data.delivery_notes
  if (data.internal_notes !== undefined) updateData.internalNotes = data.internal_notes

  // Recalculate items if provided
  if (data.items && data.items.length > 0) {
    await db.delete(remissionNoteItems).where(eq(remissionNoteItems.remissionNoteId, id))

    const productIds = data.items.map(i => i.product_id)
    const productRows = await db.select().from(products).where(inArray(products.id, productIds))
    const productMap: Record<string, any> = {}
    for (const p of productRows) productMap[p.id] = p

    let subtotal = 0, totalTax = 0, totalAmount = 0
    const itemValues: any[] = []

    for (let idx = 0; idx < data.items.length; idx++) {
      const item = data.items[idx]
      const prod = productMap[item.product_id]
      if (!prod) throw new Error(`Producto no encontrado: ${item.product_id}`)

      const taxRate = Number(prod.taxRate ?? 0.16)
      const { lineSubtotal, taxAmount, total } = calcItemTotals({
        quantity: item.quantity, unit_price: item.unit_price,
        discount: item.discount ?? 0, tax_rate: taxRate,
      })
      subtotal += lineSubtotal; totalTax += taxAmount; totalAmount += total
      itemValues.push({
        remissionNoteId: id, productId: item.product_id, productName: prod.name,
        productSku: prod.sku ?? null, quantity: String(item.quantity),
        unitPrice: String(item.unit_price), discount: String(item.discount ?? 0),
        taxRate: String(taxRate), taxAmount: String(taxAmount.toFixed(2)),
        total: String(total.toFixed(2)), satCode: prod.satCode ?? null,
        satUnit: prod.satUnit ?? 'E48', notes: item.notes ?? null, sortOrder: idx,
      })
    }

    await db.insert(remissionNoteItems).values(itemValues)
    updateData.subtotal = String(subtotal.toFixed(2))
    updateData.taxAmount = String(totalTax.toFixed(2))
    updateData.total = String(totalAmount.toFixed(2))
  }

  if (data.payment_type === 'credit' || (existing.paymentType === 'credit' && !data.payment_type)) {
    const custId = data.customer_id ?? existing.customerId
    const [cust] = await db.select().from(customers).where(eq(customers.id, custId))
    const days = Number(cust?.creditDays ?? 0)
    const due = new Date()
    due.setDate(due.getDate() + days)
    updateData.creditDays = days
    updateData.dueDate = due
  }

  const [updated] = await db.update(remissionNotes).set(updateData).where(eq(remissionNotes.id, id)).returning()
  const items = await db.select().from(remissionNoteItems).where(eq(remissionNoteItems.remissionNoteId, id))
  return { ...updated, items }
}

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    status?: string; customer_id?: string; payment_type?: string;
    from?: string; to?: string; q?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.status) conditions.push(eq(remissionNotes.status, filters.status))
  if (filters.customer_id) conditions.push(eq(remissionNotes.customerId, filters.customer_id))
  if (filters.payment_type) conditions.push(eq(remissionNotes.paymentType, filters.payment_type))
  if (filters.from) conditions.push(gte(remissionNotes.createdAt, new Date(filters.from)))
  if (filters.to) conditions.push(lte(remissionNotes.createdAt, new Date(filters.to)))
  if (filters.q) {
    conditions.push(
      sql`(${remissionNotes.customerName} ILIKE ${'%' + filters.q + '%'} OR CAST(${remissionNotes.folio} AS text) LIKE ${'%' + filters.q + '%'})`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(remissionNotes)
    .where(where).orderBy(desc(remissionNotes.createdAt)).limit(limit).offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(remissionNotes).where(where)

  return { data: rows, total: countResult[0]?.count ?? 0, page, pages: Math.ceil((countResult[0]?.count ?? 0) / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, id))
  if (!note) return null

  const items = await db.select().from(remissionNoteItems)
    .where(eq(remissionNoteItems.remissionNoteId, id)).orderBy(asc(remissionNoteItems.sortOrder))

  const history = await db.select().from(remissionStatusHistory)
    .where(eq(remissionStatusHistory.remissionNoteId, id)).orderBy(asc(remissionStatusHistory.createdAt))

  return { ...note, items, statusHistory: history }
}

// ─── Confirm ──────────────────────────────────────────────────
export async function confirm(
  db: any,
  id: string,
  userId: string,
  userName: string = 'Sistema',
  userRole: string = 'operator'
): Promise<{ remission: any; ticket: any; receivable?: any }> {
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, id))
  if (!note) throw new Error('Nota de remision no encontrada')
  if (note.status !== 'draft') throw new Error('Solo se pueden confirmar notas en borrador')

  // Credit check
  if (note.paymentType === 'credit') {
    const creditResult = await checkCredit(db, note.customerId, Number(note.total))
    if (creditResult.status === 'blocked') {
      throw new Error(`Credito bloqueado: ${creditResult.warnings.join('. ')}`)
    }
  }

  // Create ticket (invoice record)
  const paymentMethod = note.paymentType === 'credit' ? 'PPD' : 'PUE'
  const [ticket] = await db.insert(invoices).values({
    series: 'NR',
    folio: note.folio,
    customerId: note.customerId,
    type: 'I',
    status: note.paymentType === 'credit' ? 'credit' : 'paid',
    paymentMethod,
    subtotal: note.subtotal,
    tax: note.taxAmount,
    total: note.total,
    source: 'remission_note',
    observations: `Nota de remision NR-${note.folio}`,
  }).returning()

  // Copy items to invoice
  const noteItems = await db.select().from(remissionNoteItems).where(eq(remissionNoteItems.remissionNoteId, id))
  if (noteItems.length > 0) {
    const ticketItems = noteItems.map((ni: any) => ({
      invoiceId: ticket.id,
      description: ni.productName,
      quantity: ni.quantity,
      unitPrice: ni.unitPrice,
      amount: ni.total,
      discount: ni.discount,
      productId: ni.productId,
      satCode: ni.satCode,
      satUnit: ni.satUnit,
      taxRate: ni.taxRate,
    }))
    await db.insert(invoiceItems).values(ticketItems)
  }

  // Create receivable for credit sales
  let receivableRow: any = undefined
  if (note.paymentType === 'credit') {
    const [rec] = await db.insert(receivables).values({
      customerId: note.customerId,
      ticketId: ticket.id,
      remissionNoteId: note.id,
      originalAmount: note.total,
      balance: note.total,
      issuedDate: new Date(),
      dueDate: note.dueDate ?? new Date(),
      status: 'current',
    }).returning()
    receivableRow = rec

    await recalculateCreditBalance(db, note.customerId)
  }

  // Update note status
  const [updated] = await db.update(remissionNotes).set({
    status: 'confirmed',
    ticketId: ticket.id,
    confirmedBy: userId,
    confirmedAt: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(remissionNotes.id, id)).returning()

  await recordStatusChange(db, id, 'draft', 'confirmed', userId, userName, userRole)

  await db.insert(changeJournal).values({
    tableName: 'remission_notes', recordId: id, action: 'confirm',
    data: updated, userId, synced: false,
  })

  return { remission: updated, ticket, receivable: receivableRow }
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
  const [note] = await db.select().from(remissionNotes).where(eq(remissionNotes.id, id))
  if (!note) throw new Error('Nota de remision no encontrada')
  if (!['draft', 'confirmed', 'prepared'].includes(note.status)) {
    throw new Error('Solo se pueden cancelar notas en borrador, confirmadas o preparadas')
  }

  const prevStatus = note.status

  // If prepared, revert inventory
  if (note.status === 'prepared') {
    const items = await db.select().from(remissionNoteItems).where(eq(remissionNoteItems.remissionNoteId, id))
    for (const item of items) {
      if (Number(item.quantityPrepared) > 0) {
        try {
          await db.execute(sql`
            INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id)
            VALUES (${item.productId}, 'in', ${item.quantityPrepared}, ${'Cancelacion NR-' + note.folio}, ${'Cancelacion nota de remision NR-' + note.folio}, ${userId})
          `)
        } catch (err: any) {
          console.warn(`[cancel] Could not revert stock movement for product ${item.productId}: ${err.message}`)
        }
      }
    }
  }

  // Cancel ticket if exists
  if (note.ticketId) {
    await db.update(invoices).set({ status: 'cancelled', cancelledAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(invoices.id, note.ticketId))
  }

  // Cancel receivable if exists
  const recRows = await db.select().from(receivables).where(eq(receivables.remissionNoteId, id))
  for (const rec of recRows) {
    await db.update(receivables).set({ status: 'cancelled', updatedAt: sql`now()` })
      .where(eq(receivables.id, rec.id))
  }

  if (note.customerId) {
    await recalculateCreditBalance(db, note.customerId)
  }

  const [updated] = await db.update(remissionNotes).set({
    status: 'cancelled',
    cancelledBy: userId,
    cancelledAt: sql`now()`,
    cancelReason: reason,
    updatedAt: sql`now()`,
  }).where(eq(remissionNotes.id, id)).returning()

  await recordStatusChange(db, id, prevStatus, 'cancelled', userId, userName, userRole, reason)

  return updated
}

// ─── Print Data ───────────────────────────────────────────────
export async function getPrintData(db: any, id: string): Promise<any> {
  const note = await getById(db, id)
  if (!note) throw new Error('Nota de remision no encontrada')

  const [customer] = await db.select().from(customers).where(eq(customers.id, note.customerId))

  return {
    ...note,
    customer,
    formattedFolio: `${note.series}-${String(note.folio).padStart(4, '0')}`,
  }
}
