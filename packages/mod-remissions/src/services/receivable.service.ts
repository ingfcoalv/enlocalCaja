import {
  receivables, receivablePayments, customers, invoices, remissionNotes, changeJournal,
} from '@enlocal/core-db'
import { eq, and, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { recalculateCreditBalance } from './creditCheck.service'
import type { CollectPaymentInput } from '../validators/receivable.validator'

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    customer_id?: string; status?: string; overdue_only?: boolean;
    from?: string; to?: string; q?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.customer_id) conditions.push(eq(receivables.customerId, filters.customer_id))
  if (filters.status) conditions.push(eq(receivables.status, filters.status))
  if (filters.overdue_only) conditions.push(eq(receivables.status, 'overdue'))
  if (filters.from) conditions.push(gte(receivables.dueDate, new Date(filters.from)))
  if (filters.to) conditions.push(lte(receivables.dueDate, new Date(filters.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  // Query receivables with basic drizzle
  const rows = await db.select().from(receivables)
    .where(where).orderBy(asc(receivables.dueDate)).limit(limit).offset(offset)

  // Enrich with customer name and remission folio
  const customerIds = [...new Set(rows.map((r: any) => r.customerId).filter(Boolean))]
  const remissionIds = [...new Set(rows.map((r: any) => r.remissionNoteId).filter(Boolean))]

  const customerMap: Record<string, any> = {}
  if (customerIds.length > 0) {
    const custs = await db.select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
      .from(customers).where(inArray(customers.id, customerIds as string[]))
    for (const c of custs) customerMap[c.id] = c
  }

  const remissionMap: Record<string, any> = {}
  if (remissionIds.length > 0) {
    const notes = await db.select({ id: remissionNotes.id, folio: remissionNotes.folio, series: remissionNotes.series })
      .from(remissionNotes).where(inArray(remissionNotes.id, remissionIds as string[]))
    for (const n of notes) remissionMap[n.id] = n
  }

  const enriched = rows.map((r: any) => {
    const cust = customerMap[r.customerId]
    const note = r.remissionNoteId ? remissionMap[r.remissionNoteId] : null
    return {
      ...r,
      customerName: cust?.name || null,
      customerPhone: cust?.phone || null,
      customerEmail: cust?.email || null,
      remissionFolio: note?.folio || null,
      remissionSeries: note?.series || null,
    }
  })

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(receivables).where(where)
  const total = countResult[0]?.count ?? 0
  return { data: enriched, total, page, pages: Math.ceil(total / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [rec] = await db.select().from(receivables).where(eq(receivables.id, id))
  if (!rec) return null

  const payments = await db.select().from(receivablePayments)
    .where(eq(receivablePayments.receivableId, id)).orderBy(asc(receivablePayments.createdAt))

  const [ticket] = rec.ticketId
    ? await db.select().from(invoices).where(eq(invoices.id, rec.ticketId))
    : [null]

  const [note] = rec.remissionNoteId
    ? await db.select().from(remissionNotes).where(eq(remissionNotes.id, rec.remissionNoteId))
    : [null]

  const [customer] = await db.select().from(customers).where(eq(customers.id, rec.customerId))

  return {
    ...rec,
    customerName: customer?.name,
    customerPhone: customer?.phone,
    customerEmail: customer?.email,
    remissionFolio: note?.folio,
    remissionSeries: note?.series,
    payments,
    ticket,
    remissionNote: note,
    customer,
  }
}

// ─── Customer Statement ───────────────────────────────────────
export async function getCustomerStatement(db: any, customerId: string): Promise<any> {
  const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))
  if (!customer) throw new Error('Cliente no encontrado')

  // Get all receivables (active + paid) with remission folio
  const recs = await db.select({
    id: receivables.id,
    originalAmount: receivables.originalAmount,
    adjustments: receivables.adjustments,
    amountPaid: receivables.amountPaid,
    balance: receivables.balance,
    issuedDate: receivables.issuedDate,
    dueDate: receivables.dueDate,
    status: receivables.status,
    lastPaymentDate: receivables.lastPaymentDate,
    remissionNoteId: receivables.remissionNoteId,
    createdAt: receivables.createdAt,
    updatedAt: receivables.updatedAt,
    remissionFolio: remissionNotes.folio,
    remissionSeries: remissionNotes.series,
  })
    .from(receivables)
    .leftJoin(remissionNotes, eq(receivables.remissionNoteId, remissionNotes.id))
    .where(eq(receivables.customerId, customerId))
    .orderBy(asc(receivables.issuedDate))

  // Build statement entries with individual payments
  const entries: { date: string; concept: string; charge: number; credit: number; balance: number }[] = []

  // Collect all movements
  const movements: { date: string; concept: string; charge: number; credit: number }[] = []

  for (const rec of recs) {
    const folioLabel = rec.remissionSeries && rec.remissionFolio
      ? `${rec.remissionSeries}-${String(rec.remissionFolio).padStart(4, '0')}`
      : `CxC-${(rec.id as string).slice(0, 8)}`

    // Charge: original amount
    movements.push({
      date: rec.issuedDate?.toISOString?.() || String(rec.issuedDate) || String(rec.createdAt),
      concept: `Remision ${folioLabel}`,
      charge: Number(rec.originalAmount) || 0,
      credit: 0,
    })

    // Get individual payments for this receivable
    const payments = await db.select().from(receivablePayments)
      .where(eq(receivablePayments.receivableId, rec.id as string))
      .orderBy(asc(receivablePayments.createdAt))

    for (const pmt of payments) {
      movements.push({
        date: pmt.createdAt?.toISOString?.() || String(pmt.createdAt),
        concept: `Pago ${folioLabel} (${pmt.paymentMethod || 'efectivo'})${pmt.reference ? ' - ' + pmt.reference : ''}`,
        charge: 0,
        credit: Number(pmt.amount) || 0,
      })
    }

    // Adjustments (returns, etc.)
    const adj = Number(rec.adjustments) || 0
    if (adj > 0) {
      movements.push({
        date: rec.updatedAt?.toISOString?.() || String(rec.updatedAt),
        concept: `Ajuste / Devolucion ${folioLabel}`,
        charge: 0,
        credit: adj,
      })
    }
  }

  // Sort by date and compute running balance
  movements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let runningBalance = 0
  for (const m of movements) {
    runningBalance += m.charge - m.credit
    entries.push({ ...m, balance: runningBalance })
  }

  const totalOwed = recs
    .filter((r: any) => ['current', 'overdue', 'partial'].includes(r.status))
    .reduce((s: number, r: any) => s + Number(r.balance), 0)

  return { customer, entries, currentBalance: totalOwed, totalOwed }
}

// ─── Aging Report ─────────────────────────────────────────────
export async function getAgingReport(db: any, asOfDate?: string): Promise<any> {
  const refDate = asOfDate ? `'${asOfDate}'::date` : 'CURRENT_DATE'

  const result = await db.execute(sql`
    SELECT
      c.id as customer_id,
      c.name as customer_name,
      coalesce(sum(CASE WHEN r.due_date >= ${sql.raw(refDate)} THEN r.balance::numeric ELSE 0 END), 0) as current_amount,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - r.due_date::date BETWEEN 1 AND 30 THEN r.balance::numeric ELSE 0 END), 0) as days_1_30,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - r.due_date::date BETWEEN 31 AND 60 THEN r.balance::numeric ELSE 0 END), 0) as days_31_60,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - r.due_date::date BETWEEN 61 AND 90 THEN r.balance::numeric ELSE 0 END), 0) as days_61_90,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - r.due_date::date > 90 THEN r.balance::numeric ELSE 0 END), 0) as days_90_plus,
      coalesce(sum(r.balance::numeric), 0) as total
    FROM receivables r
    JOIN customers c ON c.id = r.customer_id
    WHERE r.status IN ('current', 'overdue', 'partial')
    GROUP BY c.id, c.name
    ORDER BY total DESC
  `)

  const rows = result.rows ?? []
  const totals = {
    current_amount: rows.reduce((s: number, r: any) => s + Number(r.current_amount), 0),
    days_1_30: rows.reduce((s: number, r: any) => s + Number(r.days_1_30), 0),
    days_31_60: rows.reduce((s: number, r: any) => s + Number(r.days_31_60), 0),
    days_61_90: rows.reduce((s: number, r: any) => s + Number(r.days_61_90), 0),
    days_90_plus: rows.reduce((s: number, r: any) => s + Number(r.days_90_plus), 0),
    total: rows.reduce((s: number, r: any) => s + Number(r.total), 0),
  }

  return { customers: rows, totals }
}

// ─── Collection Schedule ──────────────────────────────────────
export async function getCollectionSchedule(
  db: any,
  from?: string,
  to?: string
): Promise<any[]> {
  const fromDate = from ? new Date(from) : new Date()
  const toDate = to ? new Date(to) : (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d })()

  return db.select({
    receivable: receivables,
    customerName: customers.name,
    customerPhone: customers.phone,
  })
    .from(receivables)
    .innerJoin(customers, eq(receivables.customerId, customers.id))
    .where(
      and(
        inArray(receivables.status, ['current', 'overdue', 'partial']),
        gte(receivables.dueDate, fromDate),
        lte(receivables.dueDate, toDate),
      )
    )
    .orderBy(asc(receivables.dueDate))
}

// ─── Collect Payment ──────────────────────────────────────────
export async function collectPayment(
  db: any,
  receivableId: string,
  data: CollectPaymentInput,
  userId: string
): Promise<{ payment: any; receivable: any }> {
  const [rec] = await db.select().from(receivables).where(eq(receivables.id, receivableId))
  if (!rec) throw new Error('Cuenta por cobrar no encontrada')
  if (data.amount <= 0) throw new Error('El monto debe ser positivo')
  if (data.amount > Number(rec.balance)) throw new Error(`El monto ($${data.amount}) excede el saldo pendiente ($${rec.balance})`)

  // SAT payment form mapping
  const satPaymentForms: Record<string, string> = {
    cash: '01', debit_card: '04', credit_card: '04', spei: '03', check: '02',
  }

  // Insert payment
  const [payment] = await db.insert(receivablePayments).values({
    receivableId,
    amount: String(data.amount.toFixed(2)),
    paymentMethod: data.payment_method,
    reference: data.reference ?? null,
    receivedBy: userId,
    notes: data.notes ?? null,
  }).returning()

  // Update receivable
  const newAmountPaid = Number(rec.amountPaid) + data.amount
  const newBalance = Number(rec.originalAmount) - Number(rec.adjustments) - newAmountPaid
  const newStatus = newBalance <= 0 ? 'paid' : 'partial'

  const [updatedRec] = await db.update(receivables).set({
    amountPaid: String(newAmountPaid.toFixed(2)),
    balance: String(Math.max(0, newBalance).toFixed(2)),
    status: newStatus,
    lastPaymentDate: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(receivables.id, receivableId)).returning()

  // Update ticket
  if (rec.ticketId) {
    const [ticket] = await db.select().from(invoices).where(eq(invoices.id, rec.ticketId))
    if (ticket) {
      const ticketNewTotal = Number(ticket.total)
      const ticketPaid = newAmountPaid
      await db.update(invoices).set({
        status: newBalance <= 0 ? 'paid' : 'partial',
        updatedAt: sql`now()`,
      }).where(eq(invoices.id, rec.ticketId))
    }
  }

  // Emit payment complement if requested
  if (data.emit_complement && rec.invoiceId) {
    const [complement] = await db.insert(invoices).values({
      type: 'P',
      status: 'draft',
      customerId: rec.customerId,
      paymentMethod: 'PPD',
      paymentForm: satPaymentForms[data.payment_method] ?? '99',
      total: String(data.amount.toFixed(2)),
      subtotal: String(data.amount.toFixed(2)),
      tax: '0',
      source: 'receivable_payment',
      relatedInvoiceId: rec.invoiceId,
      observations: `Complemento de pago - CxC #${receivableId.slice(0, 8)}`,
    }).returning()

    await db.update(receivablePayments).set({
      paymentComplementId: complement.id,
      complementEmitted: true,
    }).where(eq(receivablePayments.id, payment.id))
  }

  // Recalculate customer credit balance
  await recalculateCreditBalance(db, rec.customerId)

  await db.insert(changeJournal).values({
    tableName: 'receivable_payments', recordId: payment.id, action: 'insert',
    data: payment, userId, synced: false,
  })

  return { payment, receivable: updatedRec }
}

// ─── Pending Complements ──────────────────────────────────────
export async function getPendingComplements(db: any): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT rp.*,
           r.customer_id, r.invoice_id, r.ticket_id, r.remission_note_id,
           c.name as customer_name,
           rn.folio as remission_folio, rn.series as remission_series
    FROM receivable_payments rp
    JOIN receivables r ON r.id = rp.receivable_id
    JOIN customers c ON c.id = r.customer_id
    LEFT JOIN remission_notes rn ON rn.id = r.remission_note_id
    WHERE rp.complement_emitted = false
      AND (r.invoice_id IS NOT NULL OR r.ticket_id IS NOT NULL)
    ORDER BY rp.created_at ASC
  `)
  const rows = (result as any).rows ?? result ?? []
  // Map snake_case to camelCase for frontend
  return rows.map((r: any) => ({
    id: r.id,
    receivableId: r.receivable_id,
    amount: r.amount,
    paymentMethod: r.payment_method,
    reference: r.reference,
    complementEmitted: r.complement_emitted,
    paymentComplementId: r.payment_complement_id,
    receivedBy: r.received_by,
    notes: r.notes,
    createdAt: r.created_at,
    customerId: r.customer_id,
    invoiceId: r.invoice_id,
    ticketId: r.ticket_id,
    remissionNoteId: r.remission_note_id,
    customerName: r.customer_name,
    remissionFolio: r.remission_folio,
    remissionSeries: r.remission_series,
  }))
}
