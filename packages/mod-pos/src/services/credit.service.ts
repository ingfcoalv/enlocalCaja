import { invoices, customers, changeJournal } from '@enlocal/core-db'
import { eq, sql, and, desc } from 'drizzle-orm'

interface CreditCustomer {
  id: string
  name: string
  creditLimit: number
  totalOutstanding: number
  available: number
  invoiceCount: number
}

interface CreditInvoice {
  id: string
  folio: number | null
  total: number
  totalPaid: number
  balance: number
  status: string
  createdAt: string
}

interface CreditCustomerDetail {
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
    creditLimit: number
    totalOutstanding: number
    available: number
  }
  invoices: CreditInvoice[]
}

export async function listCreditCustomers(
  db: any,
  pool: any,
  filters: { q?: string; page?: number; limit?: number }
): Promise<{ data: CreditCustomer[]; total: number; page: number; pages: number }> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit
  const search = filters.q ? `%${filters.q}%` : null

  const result = await pool.query(
    `WITH credit_invoices AS (
      SELECT
        i.customer_id,
        i.id as invoice_id,
        i.total::numeric as invoice_total,
        coalesce((
          SELECT sum(p.amount)
          FROM payments p
          WHERE p.invoice_id = i.id AND p.method != 'credit'
        ), 0) as total_paid
      FROM invoices i
      WHERE i.source = 'pos'
        AND i.status IN ('credit', 'partial')
        AND i.customer_id IS NOT NULL
    ),
    customer_balances AS (
      SELECT
        ci.customer_id,
        sum(ci.invoice_total - ci.total_paid) as total_outstanding,
        count(*) as invoice_count
      FROM credit_invoices ci
      GROUP BY ci.customer_id
      HAVING sum(ci.invoice_total - ci.total_paid) > 0
    )
    SELECT
      c.id,
      c.name,
      c.credit_limit::numeric as credit_limit,
      cb.total_outstanding,
      cb.invoice_count::int
    FROM customer_balances cb
    JOIN customers c ON cb.customer_id = c.id
    ${search ? 'WHERE c.name ILIKE $3' : ''}
    ORDER BY cb.total_outstanding DESC
    LIMIT $1 OFFSET $2`,
    search ? [limit, offset, search] : [limit, offset]
  )

  const countResult = await pool.query(
    `WITH credit_invoices AS (
      SELECT i.customer_id, i.total::numeric as invoice_total,
        coalesce((SELECT sum(p.amount) FROM payments p WHERE p.invoice_id = i.id AND p.method != 'credit'), 0) as total_paid
      FROM invoices i
      WHERE i.source = 'pos' AND i.status IN ('credit', 'partial') AND i.customer_id IS NOT NULL
    ),
    customer_balances AS (
      SELECT ci.customer_id FROM credit_invoices ci
      GROUP BY ci.customer_id HAVING sum(ci.invoice_total - ci.total_paid) > 0
    )
    SELECT count(*)::int as cnt FROM customer_balances cb
    JOIN customers c ON cb.customer_id = c.id
    ${search ? 'WHERE c.name ILIKE $1' : ''}`,
    search ? [search] : []
  )

  const total = countResult.rows[0]?.cnt ?? 0

  const data: CreditCustomer[] = result.rows.map((r: any) => {
    const creditLimit = parseFloat(r.credit_limit ?? '0')
    const totalOutstanding = parseFloat(r.total_outstanding ?? '0')
    return {
      id: r.id,
      name: r.name,
      creditLimit,
      totalOutstanding,
      available: Math.max(0, creditLimit - totalOutstanding),
      invoiceCount: r.invoice_count,
    }
  })

  return { data, total, page, pages: Math.ceil(total / limit) }
}

export async function getCustomerCreditDetail(
  db: any,
  pool: any,
  customerId: string
): Promise<CreditCustomerDetail | null> {
  // Fetch customer
  const customerResult = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      creditLimit: customers.creditLimit,
    })
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1)

  if (!customerResult.length) return null
  const customer = customerResult[0]

  // Fetch credit invoices with balances
  const invoicesResult = await pool.query(
    `SELECT
      i.id,
      i.folio,
      i.total::numeric as total,
      i.status,
      i.created_at,
      coalesce((
        SELECT sum(p.amount)
        FROM payments p
        WHERE p.invoice_id = i.id AND p.method != 'credit'
      ), 0) as total_paid
    FROM invoices i
    WHERE i.customer_id = $1
      AND i.source = 'pos'
      AND i.status IN ('credit', 'partial')
    ORDER BY i.created_at DESC`,
    [customerId]
  )

  const creditInvoices: CreditInvoice[] = invoicesResult.rows.map((r: any) => {
    const total = parseFloat(r.total)
    const totalPaid = parseFloat(r.total_paid)
    return {
      id: r.id,
      folio: r.folio,
      total,
      totalPaid,
      balance: Math.max(0, total - totalPaid),
      status: r.status,
      createdAt: r.created_at,
    }
  })

  const totalOutstanding = creditInvoices.reduce((sum, inv) => sum + inv.balance, 0)
  const creditLimit = parseFloat(customer.creditLimit ?? '0')

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      creditLimit,
      totalOutstanding,
      available: Math.max(0, creditLimit - totalOutstanding),
    },
    invoices: creditInvoices,
  }
}

export async function createAbono(
  db: any,
  pool: any,
  data: {
    customerId: string
    invoiceId: string
    payments: { method: string; amount: number; reference?: string }[]
    shiftId?: string
    userId: string
  }
): Promise<{ payments: any[]; invoice: any; balance: number }> {
  const { customerId, invoiceId, payments, shiftId, userId } = data

  // Validate invoice exists and has outstanding balance
  const invoiceResult = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, invoiceId),
        eq(invoices.customerId, customerId)
      )
    )
    .limit(1)

  if (!invoiceResult.length) {
    throw new Error('Factura no encontrada')
  }

  const invoice = invoiceResult[0]
  if (!['credit', 'partial'].includes(invoice.status)) {
    throw new Error('Esta factura no tiene saldo pendiente')
  }

  // Calculate current balance
  const paidResult = await pool.query(
    `SELECT coalesce(sum(amount), 0)::numeric as total_paid
     FROM payments
     WHERE invoice_id = $1 AND amount > 0 AND method != 'credit'`,
    [invoiceId]
  )
  const currentPaid = parseFloat(paidResult.rows[0]?.total_paid ?? '0')
  const invoiceTotal = parseFloat(invoice.total)
  const currentBalance = invoiceTotal - currentPaid

  // Validate payment amount doesn't exceed balance
  const abonoTotal = payments.reduce((sum, p) => sum + p.amount, 0)
  if (abonoTotal > currentBalance + 0.01) {
    throw new Error(`El monto del abono ($${abonoTotal.toFixed(2)}) excede el saldo pendiente ($${currentBalance.toFixed(2)})`)
  }

  // Insert payment records
  const insertedPayments: any[] = []
  for (const payment of payments) {
    const result = await pool.query(
      `INSERT INTO payments (invoice_id, method, amount, reference, shift_id, user_id, customer_id, is_abono)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [invoiceId, payment.method, payment.amount, payment.reference || null, shiftId || null, userId, customerId]
    )
    insertedPayments.push(result.rows[0])
  }

  // Recalculate balance
  const newPaidResult = await pool.query(
    `SELECT coalesce(sum(amount), 0)::numeric as total_paid
     FROM payments
     WHERE invoice_id = $1 AND amount > 0 AND method != 'credit'`,
    [invoiceId]
  )
  const newTotalPaid = parseFloat(newPaidResult.rows[0]?.total_paid ?? '0')
  const newBalance = invoiceTotal - newTotalPaid

  // Update invoice status if fully paid
  let updatedInvoice = invoice
  if (newBalance <= 0.01) {
    const [updated] = await db
      .update(invoices)
      .set({ status: 'paid', updatedAt: sql`now()` })
      .where(eq(invoices.id, invoiceId))
      .returning()
    updatedInvoice = updated || invoice

    await db.insert(changeJournal).values({
      tableName: 'invoices',
      recordId: invoiceId,
      action: 'update',
      data: { status: 'paid', abonoPayments: insertedPayments },
      userId,
      synced: false,
    })
  }

  return {
    payments: insertedPayments,
    invoice: updatedInvoice,
    balance: Math.max(0, newBalance),
  }
}
