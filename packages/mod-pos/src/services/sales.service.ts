import { invoices, invoiceItems, products, customers } from '@enlocal/core-db'
import { eq, and, gte, lte, ilike, sql, desc, inArray } from 'drizzle-orm'

/**
 * Ensure new columns exist on invoices and payments tables (migration helper).
 */
export async function ensureSchemaMigrations(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pos';
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS observations text;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL;
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invoice_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      cfdi_invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await db.execute(sql`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_abono boolean NOT NULL DEFAULT false;
  `)
}

interface SalesFilters {
  from?: string
  to?: string
  status?: string
  method?: string
  q?: string
  registerId?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface DashboardResult {
  totalSales: number
  totalOrders: number
  avgTicket: number
  byMethod: { method: string; total: number; count: number }[]
  byHour: { hour: number; total: number; count: number }[]
  topProducts: { name: string; quantity: number; total: number }[]
}

interface SalesSummaryResult {
  totalSales: number
  totalOrders: number
  avgTicket: number
  totalTax: number
  totalDiscount: number
}

export async function listSales(
  db: any,
  filters: SalesFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  // Include POS and remission sales, but hide unpaid credit
  const conditions: any[] = [
    inArray(invoices.source, ['pos', 'remission_note', 'online']),
    sql`${invoices.status} != 'credit'`,
  ]

  if (filters.from) {
    const [y, m, d] = filters.from.split('-').map(Number)
    const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0)
    conditions.push(gte(invoices.createdAt, fromDate))
  }

  if (filters.to) {
    const [y, m, d] = filters.to.split('-').map(Number)
    const toDate = new Date(y, m - 1, d, 23, 59, 59, 999)
    conditions.push(lte(invoices.createdAt, toDate))
  }

  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status))
  }

  if (filters.method) {
    conditions.push(eq(invoices.paymentMethod, filters.method))
  }

  if (filters.q) {
    const search = `%${filters.q}%`
    conditions.push(
      sql`(${invoices.series} ILIKE ${search} OR ${invoices.ticketNumber} ILIKE ${search} OR ${invoices.customerName} ILIKE ${search})`
    )
  }

  if (filters.registerId) {
    conditions.push(eq(invoices.registerId, filters.registerId))
  }

  const where = and(...conditions)

  const rows = await db
    .select({
      id: invoices.id,
      ticketNumber: invoices.ticketNumber,
      series: invoices.series,
      folio: invoices.folio,
      customerId: invoices.customerId,
      customerName: customers.name,
      type: invoices.type,
      status: invoices.status,
      paymentMethod: invoices.paymentMethod,
      paymentForm: invoices.paymentForm,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      total: invoices.total,
      observations: invoices.observations,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(where)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoices)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getSaleDetail(
  db: any,
  pool: any,
  saleId: string
): Promise<any | null> {
  // Fetch invoice
  const invoiceResult = await db
    .select({
      id: invoices.id,
      ticketNumber: invoices.ticketNumber,
      series: invoices.series,
      folio: invoices.folio,
      customerId: invoices.customerId,
      customerName: customers.name,
      type: invoices.type,
      status: invoices.status,
      paymentMethod: invoices.paymentMethod,
      paymentForm: invoices.paymentForm,
      subtotal: invoices.subtotal,
      tax: invoices.tax,
      total: invoices.total,
      currency: invoices.currency,
      observations: invoices.observations,
      source: invoices.source,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .where(eq(invoices.id, saleId))
    .limit(1)

  if (!invoiceResult.length) return null

  const invoice = invoiceResult[0]

  // Fetch items
  const items = await db
    .select({
      id: invoiceItems.id,
      description: invoiceItems.description,
      quantity: invoiceItems.quantity,
      unitPrice: invoiceItems.unitPrice,
      amount: invoiceItems.amount,
      discount: invoiceItems.discount,
      productId: invoiceItems.productId,
      taxRate: invoiceItems.taxRate,
    })
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, saleId))

  // Fetch all payments (including abonos)
  const paymentsResult = await pool.query(
    `SELECT id, method, amount::numeric, reference, tip::numeric, is_abono, customer_id, created_at
     FROM payments
     WHERE invoice_id = $1
     ORDER BY created_at ASC`,
    [saleId]
  )
  const payments = paymentsResult.rows.map((r: any) => ({
    id: r.id,
    method: r.method,
    amount: parseFloat(r.amount),
    reference: r.reference,
    tip: parseFloat(r.tip ?? '0'),
    isAbono: r.is_abono,
    customerId: r.customer_id,
    createdAt: r.created_at,
  }))

  // Calculate balance
  const totalPaid = payments
    .filter((p: any) => p.amount > 0 && p.method !== 'credit')
    .reduce((sum: number, p: any) => sum + p.amount, 0)
  const invoiceTotal = parseFloat(invoice.total)
  const balance = invoiceTotal - totalPaid

  // Fetch linked CFDI invoices
  const linksResult = await pool.query(
    `SELECT il.id, il.cfdi_invoice_id, i.series, i.folio, i.status, i.type, i.uuid_fiscal, i.stamped_at, i.total::numeric
     FROM invoice_links il
     JOIN invoices i ON il.cfdi_invoice_id = i.id
     WHERE il.sale_invoice_id = $1
     ORDER BY i.created_at DESC`,
    [saleId]
  )
  const linkedInvoices = (linksResult.rows || []).map((r: any) => ({
    id: r.cfdi_invoice_id,
    series: r.series,
    folio: r.folio,
    status: r.status,
    type: r.type,
    uuidFiscal: r.uuid_fiscal,
    stampedAt: r.stamped_at,
    total: parseFloat(r.total),
  }))

  return {
    ...invoice,
    items,
    payments,
    abonos: payments.filter((p: any) => p.isAbono),
    totalPaid,
    balance: Math.max(0, balance),
    linkedInvoices,
  }
}

export async function getSalesDashboard(
  db: any,
  date: string,
  registerId?: string
): Promise<DashboardResult> {
  const dayStart = new Date(date + 'T00:00:00')
  const dayEnd = new Date(date + 'T23:59:59.999')

  const conditions = [
    gte(invoices.createdAt, dayStart),
    lte(invoices.createdAt, dayEnd),
    inArray(invoices.source, ['pos', 'online']),
  ]
  if (registerId) {
    conditions.push(eq(invoices.registerId, registerId))
  }
  const dateCondition = and(...conditions)

  // Total sales and orders
  const totalsResult = await db
    .select({
      totalSales: sql<number>`coalesce(sum(${invoices.total}), 0)::numeric`,
      totalOrders: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(dateCondition)

  const totalSales = parseFloat(totalsResult[0]?.totalSales ?? '0')
  const totalOrders = totalsResult[0]?.totalOrders ?? 0
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0

  // By payment method
  let byMethod: { method: string; total: number; count: number }[] = []
  try {
    const byMethodResult = await db.execute(
      registerId
        ? sql`SELECT p.method, coalesce(sum(p.amount), 0)::numeric as total, count(*)::int as count
              FROM payments p
              JOIN invoices i ON p.invoice_id = i.id
              WHERE i.created_at >= ${dayStart} AND i.created_at <= ${dayEnd} AND i.source = 'pos' AND i.register_id = ${registerId}
              GROUP BY p.method
              ORDER BY total DESC`
        : sql`SELECT p.method, coalesce(sum(p.amount), 0)::numeric as total, count(*)::int as count
              FROM payments p
              JOIN invoices i ON p.invoice_id = i.id
              WHERE i.created_at >= ${dayStart} AND i.created_at <= ${dayEnd} AND i.source = 'pos'
              GROUP BY p.method
              ORDER BY total DESC`
    )
    const rows = (byMethodResult as any).rows ?? byMethodResult
    byMethod = Array.isArray(rows) ? rows.map((r: any) => ({
      method: r.method,
      total: parseFloat(r.total),
      count: parseInt(r.count, 10),
    })) : []
  } catch {
    // payments table may not exist or query failed
  }

  // By hour
  const byHourResult = await db
    .select({
      hour: sql<number>`extract(hour from ${invoices.createdAt})::int`,
      total: sql<number>`coalesce(sum(${invoices.total}), 0)::numeric`,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(dateCondition)
    .groupBy(sql`extract(hour from ${invoices.createdAt})`)
    .orderBy(sql`extract(hour from ${invoices.createdAt})`)

  const byHour = byHourResult.map((r: any) => ({
    hour: r.hour,
    total: parseFloat(r.total),
    count: r.count,
  }))

  // Top products
  const topProductsResult = await db
    .select({
      name: products.name,
      quantity: sql<number>`coalesce(sum(${invoiceItems.quantity}), 0)::numeric`,
      total: sql<number>`coalesce(sum(${invoiceItems.amount}), 0)::numeric`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .innerJoin(products, eq(invoiceItems.productId, products.id))
    .where(dateCondition)
    .groupBy(products.name)
    .orderBy(sql`sum(${invoiceItems.amount}) desc`)
    .limit(10)

  const topProducts = topProductsResult.map((r: any) => ({
    name: r.name,
    quantity: parseFloat(r.quantity),
    total: parseFloat(r.total),
  }))

  return {
    totalSales,
    totalOrders,
    avgTicket: Math.round(avgTicket * 100) / 100,
    byMethod,
    byHour,
    topProducts,
  }
}

export async function getSalesSummary(
  db: any,
  from: string,
  to: string,
  registerId?: string
): Promise<SalesSummaryResult> {
  const dateFrom = new Date(from + 'T00:00:00')
  const dateTo = new Date(to + 'T23:59:59.999')

  const conditions = [
    gte(invoices.createdAt, dateFrom),
    lte(invoices.createdAt, dateTo),
    inArray(invoices.source, ['pos', 'online']),
  ]
  if (registerId) {
    conditions.push(eq(invoices.registerId, registerId))
  }
  const dateCondition = and(...conditions)

  const result = await db
    .select({
      totalSales: sql<number>`coalesce(sum(${invoices.total}), 0)::numeric`,
      totalOrders: sql<number>`count(*)::int`,
      totalTax: sql<number>`coalesce(sum(${invoices.tax}), 0)::numeric`,
    })
    .from(invoices)
    .where(dateCondition)

  const totalSales = parseFloat(result[0]?.totalSales ?? '0')
  const totalOrders = result[0]?.totalOrders ?? 0
  const totalTax = parseFloat(result[0]?.totalTax ?? '0')

  // Calculate total discount from invoice items
  const discountResult = await db
    .select({
      totalDiscount: sql<number>`coalesce(sum(${invoiceItems.discount}), 0)::numeric`,
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(dateCondition)

  const totalDiscount = parseFloat(discountResult[0]?.totalDiscount ?? '0')
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0

  return {
    totalSales,
    totalOrders,
    avgTicket: Math.round(avgTicket * 100) / 100,
    totalTax,
    totalDiscount,
  }
}
