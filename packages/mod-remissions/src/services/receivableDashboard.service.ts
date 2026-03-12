import { sql } from 'drizzle-orm'

interface DashboardFilters {
  credit_status?: string
  q?: string
  has_balance?: boolean
  overdue_only?: boolean
}

interface DashboardRow {
  customerId: string
  customerName: string
  phone: string
  creditEnabled: boolean
  creditLimit: number
  creditDays: number
  creditStatus: string
  totalBalance: number
  currentBalance: number
  overdueBalance: number
  overdueCount: number
  maxDaysOverdue: number
  availableCredit: number
  lastPaymentDate: string | null
}

interface DashboardResult {
  data: DashboardRow[]
  totals: {
    totalBalance: number
    currentBalance: number
    overdueBalance: number
    customerCount: number
  }
}

export async function getCreditDashboard(
  db: any,
  filters: DashboardFilters
): Promise<DashboardResult> {
  const conditions = [sql`c.active = true`, sql`c.credit_enabled = true`]

  if (filters.credit_status) {
    conditions.push(sql`c.credit_status = ${filters.credit_status}`)
  }

  if (filters.q) {
    const search = `%${filters.q}%`
    conditions.push(sql`(c.name ILIKE ${search} OR c.phone ILIKE ${search} OR c.cellphone ILIKE ${search})`)
  }

  if (filters.has_balance) {
    conditions.push(sql`COALESCE(r.total_balance, 0) > 0`)
  }

  if (filters.overdue_only) {
    conditions.push(sql`COALESCE(r.overdue_balance, 0) > 0`)
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`

  const result = await db.execute(sql`
    SELECT
      c.id AS customer_id,
      c.name AS customer_name,
      COALESCE(c.phone, c.cellphone, '') AS phone,
      c.credit_enabled,
      COALESCE(c.credit_limit, 0)::numeric AS credit_limit,
      COALESCE(c.credit_days, 0) AS credit_days,
      COALESCE(c.credit_status, 'pending') AS credit_status,
      COALESCE(r.total_balance, 0)::numeric AS total_balance,
      COALESCE(r.current_balance, 0)::numeric AS current_balance,
      COALESCE(r.overdue_balance, 0)::numeric AS overdue_balance,
      COALESCE(r.overdue_count, 0)::int AS overdue_count,
      COALESCE(r.max_days_overdue, 0)::int AS max_days_overdue,
      GREATEST(COALESCE(c.credit_limit, 0) - COALESCE(r.total_balance, 0), 0)::numeric AS available_credit,
      r.last_payment_date
    FROM customers c
    LEFT JOIN (
      SELECT
        customer_id,
        SUM(balance)::numeric AS total_balance,
        SUM(CASE WHEN status != 'overdue' THEN balance ELSE 0 END)::numeric AS current_balance,
        SUM(CASE WHEN status = 'overdue' THEN balance ELSE 0 END)::numeric AS overdue_balance,
        COUNT(CASE WHEN status = 'overdue' THEN 1 END)::int AS overdue_count,
        MAX(days_overdue)::int AS max_days_overdue,
        MAX(last_payment_date) AS last_payment_date
      FROM receivables
      WHERE status != 'paid'
      GROUP BY customer_id
    ) r ON r.customer_id = c.id
    ${whereClause}
    ORDER BY COALESCE(r.overdue_balance, 0) DESC, COALESCE(r.total_balance, 0) DESC, c.name ASC
  `)

  const rows: DashboardRow[] = (result.rows || result).map((row: any) => ({
    customerId: row.customer_id,
    customerName: row.customer_name,
    phone: row.phone,
    creditEnabled: row.credit_enabled,
    creditLimit: Number(row.credit_limit) || 0,
    creditDays: Number(row.credit_days) || 0,
    creditStatus: row.credit_status,
    totalBalance: Number(row.total_balance) || 0,
    currentBalance: Number(row.current_balance) || 0,
    overdueBalance: Number(row.overdue_balance) || 0,
    overdueCount: Number(row.overdue_count) || 0,
    maxDaysOverdue: Number(row.max_days_overdue) || 0,
    availableCredit: Number(row.available_credit) || 0,
    lastPaymentDate: row.last_payment_date || null,
  }))

  const totals = rows.reduce(
    (acc, row) => ({
      totalBalance: acc.totalBalance + row.totalBalance,
      currentBalance: acc.currentBalance + row.currentBalance,
      overdueBalance: acc.overdueBalance + row.overdueBalance,
      customerCount: acc.customerCount + 1,
    }),
    { totalBalance: 0, currentBalance: 0, overdueBalance: 0, customerCount: 0 }
  )

  return { data: rows, totals }
}
