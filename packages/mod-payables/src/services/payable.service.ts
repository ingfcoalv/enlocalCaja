import {
  payables, payablePayments, suppliers, supplierInvoices, changeJournal,
} from '@enlocal/core-db'
import { eq, and, inArray, sql, asc, desc, gte, lte } from 'drizzle-orm'
import { recalculateSupplierBalance } from './supplierBalance.service'
import type { PayInput, BatchPayInput, UpdatePriorityInput } from '../validators/payable.validator'

// ─── Get All ──────────────────────────────────────────────────
export async function getAll(
  db: any,
  filters: {
    supplier_id?: string; status?: string; overdue_only?: boolean;
    from?: string; to?: string; q?: string; page?: number; limit?: number
  }
): Promise<{ data: any[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const conditions: any[] = []

  if (filters.supplier_id) conditions.push(eq(payables.supplierId, filters.supplier_id))
  if (filters.status) conditions.push(eq(payables.status, filters.status))
  if (filters.overdue_only) conditions.push(eq(payables.status, 'overdue'))
  if (filters.from) conditions.push(gte(payables.dueDate, new Date(filters.from)))
  if (filters.to) conditions.push(lte(payables.dueDate, new Date(filters.to)))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db.select().from(payables)
    .where(where).orderBy(asc(payables.dueDate)).limit(limit).offset(offset)

  // Enrich with supplier name
  const supplierIds = [...new Set(rows.map((r: any) => r.supplierId).filter(Boolean))]
  const supplierMap: Record<string, any> = {}
  if (supplierIds.length > 0) {
    const sups = await db.select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone })
      .from(suppliers).where(inArray(suppliers.id, supplierIds as string[]))
    for (const s of sups) supplierMap[s.id] = s
  }

  const enriched = rows.map((r: any) => {
    const sup = supplierMap[r.supplierId]
    return {
      ...r,
      supplierName: sup?.name || null,
      supplierPhone: sup?.phone || null,
    }
  })

  const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(payables).where(where)
  const total = countResult[0]?.count ?? 0
  return { data: enriched, total, page, pages: Math.ceil(total / limit) }
}

// ─── Get By ID ────────────────────────────────────────────────
export async function getById(db: any, id: string): Promise<any> {
  const [p] = await db.select().from(payables).where(eq(payables.id, id))
  if (!p) return null

  const payments = await db.select().from(payablePayments)
    .where(eq(payablePayments.payableId, id)).orderBy(asc(payablePayments.createdAt))

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, p.supplierId))

  let invoice = null
  if (p.supplierInvoiceId) {
    const [inv] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, p.supplierInvoiceId))
    invoice = inv
  }

  return { ...p, payments, supplier, invoice }
}

// ─── Pay ──────────────────────────────────────────────────────
export async function pay(
  db: any,
  payableId: string,
  data: PayInput,
  userId: string
): Promise<{ payment: any; payable: any }> {
  const [p] = await db.select().from(payables).where(eq(payables.id, payableId))
  if (!p) throw new Error('Cuenta por pagar no encontrada')
  if (data.amount <= 0) throw new Error('El monto debe ser positivo')
  if (data.amount > Number(p.balance)) throw new Error(`El monto ($${data.amount}) excede el saldo pendiente ($${p.balance})`)

  const [payment] = await db.insert(payablePayments).values({
    payableId,
    amount: String(data.amount.toFixed(2)),
    paymentMethod: data.payment_method,
    reference: data.reference ?? null,
    paidBy: userId,
    notes: data.notes ?? null,
  }).returning()

  const newAmountPaid = Number(p.amountPaid) + data.amount
  const newBalance = Number(p.originalAmount) - Number(p.adjustments) - newAmountPaid
  const newStatus = newBalance <= 0 ? 'paid' : 'partial'

  const [updatedPayable] = await db.update(payables).set({
    amountPaid: String(newAmountPaid.toFixed(2)),
    balance: String(Math.max(0, newBalance).toFixed(2)),
    status: newStatus,
    lastPaymentDate: sql`now()`,
    updatedAt: sql`now()`,
  }).where(eq(payables.id, payableId)).returning()

  await recalculateSupplierBalance(db, p.supplierId)

  await db.insert(changeJournal).values({
    tableName: 'payable_payments', recordId: payment.id, action: 'insert',
    data: payment, userId, synced: false,
  })

  return { payment, payable: updatedPayable }
}

// ─── Batch Pay ────────────────────────────────────────────────
export async function batchPay(
  db: any,
  data: BatchPayInput,
  userId: string
): Promise<{ results: any[] }> {
  const results: any[] = []

  for (const item of data.payments) {
    const result = await pay(db, item.payable_id, {
      amount: item.amount,
      payment_method: data.payment_method,
      reference: data.reference ?? null,
      notes: data.notes ?? null,
    }, userId)
    results.push(result)
  }

  return { results }
}

// ─── Aging Report ─────────────────────────────────────────────
export async function getAgingReport(db: any, asOfDate?: string): Promise<any> {
  const refDate = asOfDate ? `'${asOfDate}'::date` : 'CURRENT_DATE'

  const result = await db.execute(sql`
    SELECT
      s.id as supplier_id,
      s.name as supplier_name,
      coalesce(sum(CASE WHEN p.due_date >= ${sql.raw(refDate)} THEN p.balance::numeric ELSE 0 END), 0) as current_amount,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - p.due_date::date BETWEEN 1 AND 30 THEN p.balance::numeric ELSE 0 END), 0) as days_1_30,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - p.due_date::date BETWEEN 31 AND 60 THEN p.balance::numeric ELSE 0 END), 0) as days_31_60,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - p.due_date::date BETWEEN 61 AND 90 THEN p.balance::numeric ELSE 0 END), 0) as days_61_90,
      coalesce(sum(CASE WHEN ${sql.raw(refDate)} - p.due_date::date > 90 THEN p.balance::numeric ELSE 0 END), 0) as days_90_plus,
      coalesce(sum(p.balance::numeric), 0) as total
    FROM payables p
    JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.status IN ('current', 'overdue', 'partial')
    GROUP BY s.id, s.name
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

  return { suppliers: rows, totals }
}

// ─── Payment Schedule ─────────────────────────────────────────
export async function getPaymentSchedule(
  db: any,
  from?: string,
  to?: string
): Promise<any[]> {
  const fromDate = from ? new Date(from) : new Date()
  const toDate = to ? new Date(to) : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d })()

  return db.select({
    payable: payables,
    supplierName: suppliers.name,
    supplierPhone: suppliers.phone,
  })
    .from(payables)
    .innerJoin(suppliers, eq(payables.supplierId, suppliers.id))
    .where(
      and(
        inArray(payables.status, ['current', 'overdue', 'partial']),
        gte(payables.dueDate, fromDate),
        lte(payables.dueDate, toDate),
      )
    )
    .orderBy(asc(payables.dueDate), desc(payables.priority))
}

// ─── Cash Flow Projection ─────────────────────────────────────
export async function getCashFlowProjection(db: any, weeks?: number): Promise<any> {
  const numWeeks = weeks ?? 8
  const result = await db.execute(sql`
    SELECT
      date_trunc('week', p.due_date)::date as week_start,
      sum(p.balance::numeric) as total_due,
      count(*) as count
    FROM payables p
    WHERE p.status IN ('current', 'overdue', 'partial')
      AND p.due_date >= CURRENT_DATE
      AND p.due_date < CURRENT_DATE + ${sql.raw(String(numWeeks * 7))}
    GROUP BY date_trunc('week', p.due_date)
    ORDER BY week_start
  `)

  const rows = result.rows ?? []
  const totalProjected = rows.reduce((s: number, r: any) => s + Number(r.total_due), 0)

  return { weeks: rows, totalProjected }
}

// ─── Supplier Statement ───────────────────────────────────────
export async function getSupplierStatement(db: any, supplierId: string): Promise<any> {
  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId))
  if (!supplier) throw new Error('Proveedor no encontrado')

  const recs = await db.select().from(payables)
    .where(
      and(
        eq(payables.supplierId, supplierId),
        inArray(payables.status, ['current', 'overdue', 'partial'])
      )
    )
    .orderBy(asc(payables.dueDate))

  const totalOwed = recs.reduce((s: number, r: any) => s + Number(r.balance), 0)
  const totalOverdue = recs
    .filter((r: any) => r.status === 'overdue')
    .reduce((s: number, r: any) => s + Number(r.balance), 0)

  return { supplier, payables: recs, totalOwed, totalOverdue }
}

// ─── Update Priority ──────────────────────────────────────────
export async function updatePriority(
  db: any,
  payableId: string,
  data: UpdatePriorityInput
): Promise<any> {
  const [p] = await db.select().from(payables).where(eq(payables.id, payableId))
  if (!p) throw new Error('Cuenta por pagar no encontrada')

  const [updated] = await db.update(payables).set({
    priority: data.priority,
    updatedAt: sql`now()`,
  }).where(eq(payables.id, payableId)).returning()

  return updated
}

// ─── Pending By Method ────────────────────────────────────────
export async function getPendingByMethod(db: any): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT
      coalesce(p.payment_method, 'sin_asignar') as method,
      count(*) as count,
      sum(p.balance::numeric) as total
    FROM payables p
    WHERE p.status IN ('current', 'overdue', 'partial')
    GROUP BY p.payment_method
    ORDER BY total DESC
  `)

  return result.rows ?? []
}
