import {
  invoices,
  invoiceItems,
  products,
  categories,
  customers,
  changeJournal,
  users,
} from '@enlocal/core-db'
import { eq, and, gte, lte, sql, desc, inArray, asc } from 'drizzle-orm'

// Statuses that represent completed POS sales
const SALE_STATUSES = ['paid', 'credit', 'partial', 'stamped']

// ---------------------------------------------------------------------------
// Dashboard KPIs
// ---------------------------------------------------------------------------
export async function getDashboard(db: any, from?: Date, to?: Date) {
  const dateFrom = from || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d })()
  const dateTo = to || new Date()

  // Sales totals for period (POS sales + stamped invoices)
  const salesResult = await db
    .select({
      salesTotal: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
      salesCount: sql<number>`COUNT(*)::int`,
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
        inArray(invoices.status, SALE_STATUSES)
      )
    )

  const totalSales = parseFloat(salesResult[0]?.salesTotal ?? '0')
  const orderCount = salesResult[0]?.salesCount ?? 0

  // Unique customers with sales in last 30 days
  const customersResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${invoices.customerId})::int` })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
        inArray(invoices.status, SALE_STATUSES)
      )
    )

  const customerCount = customersResult[0]?.count ?? 0

  // Average ticket
  const averageTicket = orderCount > 0 ? Math.round((totalSales / orderCount) * 100) / 100 : 0

  // Top products by revenue
  const topProductsRows = await db
    .select({
      name: sql<string>`COALESCE(${products.name}, ${invoiceItems.description})`.as('name'),
      quantity: sql<string>`SUM(${invoiceItems.quantity}::numeric)`.as('quantity'),
      revenue: sql<string>`SUM(${invoiceItems.amount}::numeric)`.as('revenue'),
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(
        gte(invoices.createdAt, dateFrom),
        lte(invoices.createdAt, dateTo),
        inArray(invoices.status, SALE_STATUSES)
      )
    )
    .groupBy(products.name, invoiceItems.description)
    .orderBy(sql`SUM(${invoiceItems.amount}::numeric) DESC`)
    .limit(10)

  const topProducts = topProductsRows.map((r: any) => ({
    name: r.name,
    quantity: parseFloat(r.quantity),
    revenue: parseFloat(r.revenue),
  }))

  // Payment methods breakdown
  let paymentMethods: Array<{ method: string; count: number; total: number }> = []
  try {
    const pmRows = await db
      .select({
        method: sql<string>`p.method`,
        count: sql<number>`COUNT(*)::int`,
        total: sql<string>`COALESCE(SUM(p.amount::numeric), 0)`,
      })
      .from(sql`payments p`)
      .innerJoin(invoices, sql`p.invoice_id = ${invoices.id}`)
      .where(
        and(
          gte(invoices.createdAt, dateFrom),
          lte(invoices.createdAt, dateTo),
          inArray(invoices.status, SALE_STATUSES)
        )
      )
      .groupBy(sql`p.method`)
      .orderBy(sql`SUM(p.amount::numeric) DESC`)

    paymentMethods = pmRows.map((r: any) => ({
      method: r.method,
      count: r.count,
      total: parseFloat(r.total),
    }))
  } catch {
    // payments table may not exist in all setups
  }

  return {
    totalSales,
    orderCount,
    averageTicket,
    customerCount,
    topProducts,
    paymentMethods,
  }
}

// ---------------------------------------------------------------------------
// Sales report — grouped by day / week / month
// ---------------------------------------------------------------------------
export async function getSalesReport(
  db: any,
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
) {
  let periodExpr: ReturnType<typeof sql>

  switch (groupBy) {
    case 'day':
      periodExpr = sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM-DD')`
      break
    case 'week':
      periodExpr = sql`TO_CHAR(DATE_TRUNC('week', ${invoices.createdAt}), 'YYYY-MM-DD')`
      break
    case 'month':
      periodExpr = sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`
      break
  }

  const rows = await db
    .select({
      period: periodExpr.as('period'),
      total: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`.as('total'),
      count: sql<number>`COUNT(*)::int`.as('count'),
      avgTicket: sql<string>`ROUND(COALESCE(AVG(${invoices.total}::numeric), 0), 2)`.as('avg_ticket'),
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, from),
        lte(invoices.createdAt, to),
        inArray(invoices.status, SALE_STATUSES)
      )
    )
    .groupBy(periodExpr)
    .orderBy(periodExpr)

  return rows.map((row: any) => ({
    date: row.period,
    sales: parseFloat(row.total),
    orders: row.count,
    average: parseFloat(row.avgTicket),
  }))
}

// ---------------------------------------------------------------------------
// Products report — top products by revenue
// ---------------------------------------------------------------------------
export async function getProductsReport(db: any, from: Date, to: Date) {
  const rows = await db
    .select({
      productId: invoiceItems.productId,
      name: sql<string>`COALESCE(${products.name}, ${invoiceItems.description})`.as('name'),
      quantity: sql<string>`SUM(${invoiceItems.quantity}::numeric)`.as('quantity'),
      total: sql<string>`SUM(${invoiceItems.amount}::numeric)`.as('total'),
      avgPrice: sql<string>`ROUND(AVG(${invoiceItems.unitPrice}::numeric), 2)`.as('avg_price'),
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .leftJoin(products, eq(invoiceItems.productId, products.id))
    .where(
      and(
        gte(invoices.createdAt, from),
        lte(invoices.createdAt, to),
        inArray(invoices.status, SALE_STATUSES)
      )
    )
    .groupBy(invoiceItems.productId, products.name, invoiceItems.description)
    .orderBy(sql`SUM(${invoiceItems.amount}::numeric) DESC`)
    .limit(50)

  return rows.map((row: any) => ({
    productId: row.productId,
    name: row.name,
    quantity: parseFloat(row.quantity),
    total: parseFloat(row.total),
    avgPrice: parseFloat(row.avgPrice),
  }))
}

// ---------------------------------------------------------------------------
// Customers report — customer analysis
// ---------------------------------------------------------------------------
export async function getCustomersReport(db: any, from: Date, to: Date) {
  const rows = await db
    .select({
      customerId: invoices.customerId,
      name: customers.name,
      totalOrders: sql<number>`COUNT(*)::int`.as('total_orders'),
      totalSpent: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`.as('total_spent'),
      avgTicket: sql<string>`ROUND(COALESCE(AVG(${invoices.total}::numeric), 0), 2)`.as('avg_ticket'),
      lastOrder: sql<string>`MAX(${invoices.createdAt})`.as('last_order'),
    })
    .from(invoices)
    .innerJoin(customers, eq(invoices.customerId, customers.id))
    .where(
      and(
        gte(invoices.createdAt, from),
        lte(invoices.createdAt, to),
        inArray(invoices.status, SALE_STATUSES)
      )
    )
    .groupBy(invoices.customerId, customers.name)
    .orderBy(sql`SUM(${invoices.total}::numeric) DESC`)
    .limit(50)

  return rows.map((row: any) => ({
    customerId: row.customerId,
    name: row.name,
    totalOrders: row.totalOrders,
    totalSpent: parseFloat(row.totalSpent),
    avgTicket: parseFloat(row.avgTicket),
    lastOrder: row.lastOrder,
  }))
}

// ---------------------------------------------------------------------------
// Audit log — paginated change_journal with user info
// ---------------------------------------------------------------------------
interface AuditFilters {
  from?: Date
  to?: Date
  table?: string
  action?: string
  page?: number
  limit?: number
}

export async function getAuditLog(db: any, filters: AuditFilters) {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  if (filters.from) {
    conditions.push(gte(changeJournal.createdAt, filters.from))
  }

  if (filters.to) {
    conditions.push(lte(changeJournal.createdAt, filters.to))
  }

  if (filters.table) {
    conditions.push(eq(changeJournal.tableName, filters.table))
  }

  if (filters.action) {
    conditions.push(eq(changeJournal.action, filters.action))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: changeJournal.id,
      tableName: changeJournal.tableName,
      recordId: changeJournal.recordId,
      action: changeJournal.action,
      data: changeJournal.data,
      userId: changeJournal.userId,
      userName: users.name,
      synced: changeJournal.synced,
      createdAt: changeJournal.createdAt,
    })
    .from(changeJournal)
    .leftJoin(users, sql`${changeJournal.userId}::uuid = ${users.id}`)
    .where(where)
    .orderBy(desc(changeJournal.createdAt))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(changeJournal)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

// ---------------------------------------------------------------------------
// Tax report — subtotals, taxes, totals, grouped by tax rate
// ---------------------------------------------------------------------------
export async function getTaxReport(db: any, from: Date, to: Date) {
  // Global totals
  const totalsResult = await db
    .select({
      totalSubtotal: sql<string>`COALESCE(SUM(${invoices.subtotal}::numeric), 0)`,
      totalTax: sql<string>`COALESCE(SUM(${invoices.tax}::numeric), 0)`,
      totalTotal: sql<string>`COALESCE(SUM(${invoices.total}::numeric), 0)`,
    })
    .from(invoices)
    .where(
      and(
        gte(invoices.createdAt, from),
        lte(invoices.createdAt, to),
        inArray(invoices.status, SALE_STATUSES)
      )
    )

  const totalSubtotal = parseFloat(totalsResult[0]?.totalSubtotal ?? '0')
  const totalTax = parseFloat(totalsResult[0]?.totalTax ?? '0')
  const totalTotal = parseFloat(totalsResult[0]?.totalTotal ?? '0')

  // Breakdown by tax rate
  const byRateRows = await db
    .select({
      taxRate: invoiceItems.taxRate,
      taxableBase: sql<string>`COALESCE(SUM(${invoiceItems.amount}::numeric), 0)`.as('taxable_base'),
      taxAmount: sql<string>`COALESCE(SUM(${invoiceItems.amount}::numeric * ${invoiceItems.taxRate}::numeric), 0)`.as('tax_amount'),
    })
    .from(invoiceItems)
    .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
    .where(
      and(
        gte(invoices.createdAt, from),
        lte(invoices.createdAt, to),
        inArray(invoices.status, SALE_STATUSES)
      )
    )
    .groupBy(invoiceItems.taxRate)
    .orderBy(invoiceItems.taxRate)

  const byRate = byRateRows.map((row: any) => ({
    taxRate: parseFloat(row.taxRate),
    taxableBase: parseFloat(row.taxableBase),
    taxAmount: parseFloat(row.taxAmount),
  }))

  return {
    totalSubtotal,
    totalTax,
    totalTotal,
    byRate,
  }
}

// ---------------------------------------------------------------------------
// Cashier performance report
// ---------------------------------------------------------------------------
export async function getCashierPerformance(db: any, from: Date, to: Date, userId?: string, registerId?: string) {
  const conditions = [
    sql`cs.status = 'closed'`,
    sql`cs.closed_at >= ${from.toISOString()}::timestamptz`,
    sql`cs.closed_at <= ${to.toISOString()}::timestamptz`,
  ]
  if (userId) conditions.push(sql`cs.user_id = ${userId}::uuid`)
  if (registerId) conditions.push(sql`cs.register_id = ${registerId}::uuid`)

  const whereClause = sql.join(conditions, sql` AND `)

  const result = await db.execute(
    sql`SELECT
          cs.user_id,
          u.name as user_name,
          count(*)::int as shifts_count,
          coalesce(sum(cs.total_sales::numeric), 0)::numeric as total_sales,
          coalesce(sum(cs.total_cash_sales::numeric), 0)::numeric as total_cash,
          coalesce(sum(cs.total_card_sales::numeric), 0)::numeric as total_card,
          coalesce(sum(cs.total_transfer_sales::numeric), 0)::numeric as total_transfer,
          coalesce(sum(cs.transactions_count), 0)::int as total_transactions,
          coalesce(sum(cs.difference::numeric), 0)::numeric as total_difference,
          round(coalesce(avg(cs.total_sales::numeric), 0), 2)::numeric as avg_sales_per_shift,
          CASE WHEN sum(cs.transactions_count) > 0
            THEN round(sum(cs.total_sales::numeric) / sum(cs.transactions_count), 2)
            ELSE 0
          END::numeric as avg_ticket
        FROM cash_shifts cs
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE ${whereClause}
        GROUP BY cs.user_id, u.name
        ORDER BY sum(cs.total_sales::numeric) DESC`
  )

  const rows = result.rows ?? result
  return rows.map((r: any) => ({
    userId: r.user_id,
    userName: r.user_name ?? 'Sin nombre',
    shiftsCount: r.shifts_count,
    totalSales: parseFloat(r.total_sales),
    totalCash: parseFloat(r.total_cash),
    totalCard: parseFloat(r.total_card),
    totalTransfer: parseFloat(r.total_transfer),
    totalTransactions: r.total_transactions,
    totalDifference: parseFloat(r.total_difference),
    avgSalesPerShift: parseFloat(r.avg_sales_per_shift),
    avgTicket: parseFloat(r.avg_ticket),
  }))
}

// ---------------------------------------------------------------------------
// Register comparison report
// ---------------------------------------------------------------------------
export async function getRegisterComparison(db: any, from: Date, to: Date) {
  const result = await db.execute(
    sql`SELECT
          cs.register_id,
          r.name as register_name,
          count(*)::int as shifts_count,
          coalesce(sum(cs.total_sales::numeric), 0)::numeric as total_sales,
          coalesce(sum(cs.total_cash_sales::numeric), 0)::numeric as total_cash,
          coalesce(sum(cs.total_card_sales::numeric), 0)::numeric as total_card,
          coalesce(sum(cs.total_transfer_sales::numeric), 0)::numeric as total_transfer,
          coalesce(sum(cs.transactions_count), 0)::int as total_transactions,
          coalesce(sum(cs.total_deposits::numeric), 0)::numeric as total_deposits,
          coalesce(sum(cs.total_withdrawals::numeric), 0)::numeric as total_withdrawals,
          coalesce(sum(cs.difference::numeric), 0)::numeric as total_difference,
          CASE WHEN sum(cs.transactions_count) > 0
            THEN round(sum(cs.total_sales::numeric) / sum(cs.transactions_count), 2)
            ELSE 0
          END::numeric as avg_ticket
        FROM cash_shifts cs
        LEFT JOIN pos_registers r ON r.id = cs.register_id
        WHERE cs.status = 'closed'
          AND cs.closed_at >= ${from.toISOString()}::timestamptz
          AND cs.closed_at <= ${to.toISOString()}::timestamptz
          AND cs.register_id IS NOT NULL
        GROUP BY cs.register_id, r.name
        ORDER BY sum(cs.total_sales::numeric) DESC`
  )

  const rows = result.rows ?? result
  return rows.map((r: any) => ({
    registerId: r.register_id,
    registerName: r.register_name ?? 'Sin nombre',
    shiftsCount: r.shifts_count,
    totalSales: parseFloat(r.total_sales),
    totalCash: parseFloat(r.total_cash),
    totalCard: parseFloat(r.total_card),
    totalTransfer: parseFloat(r.total_transfer),
    totalTransactions: r.total_transactions,
    totalDeposits: parseFloat(r.total_deposits),
    totalWithdrawals: parseFloat(r.total_withdrawals),
    totalDifference: parseFloat(r.total_difference),
    avgTicket: parseFloat(r.avg_ticket),
  }))
}

// ---------------------------------------------------------------------------
// Cash movements report (analytics summary)
// ---------------------------------------------------------------------------
export async function getCashMovementsReport(db: any, from: Date, to: Date, registerId?: string) {
  const conditions = [
    sql`cm.created_at >= ${from.toISOString()}::timestamptz`,
    sql`cm.created_at <= ${to.toISOString()}::timestamptz`,
  ]
  if (registerId) conditions.push(sql`cm.register_id = ${registerId}::uuid`)

  const whereClause = sql.join(conditions, sql` AND `)

  const result = await db.execute(
    sql`SELECT
          cm.type,
          cm.reason,
          count(*)::int as count,
          coalesce(sum(cm.amount::numeric), 0)::numeric as total
        FROM cash_movements cm
        WHERE ${whereClause}
        GROUP BY cm.type, cm.reason
        ORDER BY cm.type, sum(cm.amount::numeric) DESC`
  )

  const rows = result.rows ?? result
  let totalDeposits = 0
  let totalWithdrawals = 0
  const breakdown = rows.map((r: any) => {
    const amount = parseFloat(r.total)
    if (r.type === 'deposit') totalDeposits += amount
    else totalWithdrawals += amount
    return {
      type: r.type,
      reason: r.reason,
      count: r.count,
      total: amount,
    }
  })

  return { breakdown, totalDeposits, totalWithdrawals, netMovement: totalDeposits - totalWithdrawals }
}

// ---------------------------------------------------------------------------
// Hourly sales report
// ---------------------------------------------------------------------------
export async function getHourlySalesReport(db: any, from: Date, to: Date, registerId?: string) {
  const conditions: any[] = [
    gte(invoices.createdAt, from),
    lte(invoices.createdAt, to),
    inArray(invoices.status, SALE_STATUSES),
  ]
  if (registerId) conditions.push(eq(invoices.registerId, registerId))

  const rows = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${invoices.createdAt})::int`.as('hour'),
      total: sql<string>`coalesce(sum(${invoices.total}::numeric), 0)`.as('total'),
      count: sql<number>`count(*)::int`.as('count'),
    })
    .from(invoices)
    .where(and(...conditions))
    .groupBy(sql`EXTRACT(HOUR FROM ${invoices.createdAt})`)
    .orderBy(sql`EXTRACT(HOUR FROM ${invoices.createdAt})`)

  return rows.map((r: any) => ({
    hour: r.hour,
    total: parseFloat(r.total),
    count: r.count,
  }))
}

// ---------------------------------------------------------------------------
// Low stock report — products where current_stock <= min_stock
// ---------------------------------------------------------------------------
export async function getLowStockReport(db: any, filters?: { categoryId?: string }) {
  const conditions: any[] = [
    eq(products.active, true),
    sql`${products.minStock}::numeric > 0`,
    sql`${products.currentStock}::numeric <= ${products.minStock}::numeric`,
  ]

  if (filters?.categoryId) {
    conditions.push(eq(products.categoryId, filters.categoryId))
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      categoryName: categories.name,
      currentStock: products.currentStock,
      minStock: products.minStock,
      price: products.price,
      cost: products.cost,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions))
    .orderBy(asc(sql`${products.currentStock}::numeric - ${products.minStock}::numeric`))

  return rows.map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku || '',
    category: row.categoryName || 'Sin categoria',
    currentStock: parseFloat(row.currentStock ?? '0'),
    minStock: parseFloat(row.minStock ?? '0'),
    deficit: parseFloat(row.minStock ?? '0') - parseFloat(row.currentStock ?? '0'),
    price: parseFloat(row.price ?? '0'),
    cost: parseFloat(row.cost ?? '0'),
  }))
}
