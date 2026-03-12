import { sql } from 'drizzle-orm'

interface ShiftFilters {
  page?: number
  limit?: number
  registerId?: string
  userId?: string
  from?: string
  to?: string
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface CashShift {
  id: string
  userId: string
  userName: string | null
  registerId: string | null
  registerName: string | null
  openingAmount: string
  closingAmount: string | null
  expectedAmount: string | null
  difference: string | null
  status: string
  openedAt: string
  closedAt: string | null
  notes: string | null
  totalSales: string | null
  totalCashSales: string | null
  totalCardSales: string | null
  totalTransferSales: string | null
  totalDeposits: string | null
  totalWithdrawals: string | null
  transactionsCount: number | null
}

interface ShiftPreview {
  shiftId: string
  registerId: string | null
  registerName: string | null
  openingAmount: number
  totalCashPayments: number
  totalCardPayments: number
  totalTransferPayments: number
  totalDeposits: number
  totalWithdrawals: number
  expectedAmount: number
  transactionsCount: number
  totalSales: number
}

/**
 * Ensures the cash_shifts table exists. Called before operations.
 */
async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      opening_amount numeric(12,2) NOT NULL DEFAULT 0,
      closing_amount numeric(12,2),
      expected_amount numeric(12,2),
      difference numeric(12,2),
      status text NOT NULL DEFAULT 'open',
      opened_at timestamptz NOT NULL DEFAULT now(),
      closed_at timestamptz,
      notes text,
      register_id uuid
    )
  `)
  // Add columns for existing installations
  await db.execute(sql`
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS register_id uuid
  `)
  await db.execute(sql`
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_sales numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_cash_sales numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_card_sales numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_transfer_sales numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_deposits numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS total_withdrawals numeric(12,2) DEFAULT 0;
    ALTER TABLE cash_shifts ADD COLUMN IF NOT EXISTS transactions_count integer DEFAULT 0;
  `)
}

function mapRow(row: any): CashShift {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name ?? null,
    registerId: row.register_id ?? null,
    registerName: row.register_name ?? null,
    openingAmount: row.opening_amount,
    closingAmount: row.closing_amount,
    expectedAmount: row.expected_amount,
    difference: row.difference,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    notes: row.notes,
    totalSales: row.total_sales ?? null,
    totalCashSales: row.total_cash_sales ?? null,
    totalCardSales: row.total_card_sales ?? null,
    totalTransferSales: row.total_transfer_sales ?? null,
    totalDeposits: row.total_deposits ?? null,
    totalWithdrawals: row.total_withdrawals ?? null,
    transactionsCount: row.transactions_count ?? null,
  }
}

export async function getCurrentShift(
  db: any,
  userId: string
): Promise<CashShift | null> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT cs.*, r.name as register_name, u.name as user_name
        FROM cash_shifts cs
        LEFT JOIN pos_registers r ON r.id = cs.register_id
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE cs.user_id = ${userId} AND cs.status = 'open'
        ORDER BY cs.opened_at DESC LIMIT 1`
  )

  const rows = result.rows ?? result
  if (!rows.length) return null

  return mapRow(rows[0])
}

export async function openShift(
  db: any,
  userId: string,
  openingAmount: number,
  registerId?: string | null
): Promise<CashShift> {
  await ensureTable(db)

  // Check if there is already an open shift for this user
  const existing = await getCurrentShift(db, userId)
  if (existing) {
    throw new Error('User already has an open shift. Close the current shift before opening a new one.')
  }

  // If registerId provided, check no other open shift on that register
  if (registerId) {
    const registerShift = await db.execute(
      sql`SELECT id, user_id FROM cash_shifts WHERE register_id = ${registerId} AND status = 'open' LIMIT 1`
    )
    const rRows = registerShift.rows ?? registerShift
    if (rRows.length) {
      throw new Error('Esta caja ya tiene un turno abierto por otro usuario')
    }
  }

  const result = await db.execute(
    sql`INSERT INTO cash_shifts (user_id, opening_amount, status, opened_at, register_id)
        VALUES (${userId}, ${openingAmount}, 'open', now(), ${registerId ?? null})
        RETURNING *`
  )

  const rows = result.rows ?? result
  // Re-fetch with JOIN to include register_name
  if (registerId) {
    const full = await db.execute(
      sql`SELECT cs.*, r.name as register_name
          FROM cash_shifts cs
          LEFT JOIN pos_registers r ON r.id = cs.register_id
          WHERE cs.id = ${rows[0].id}`
    )
    const fullRows = full.rows ?? full
    return mapRow(fullRows[0])
  }
  return mapRow(rows[0])
}

/**
 * Calculate shift summary data (payments + movements) for a given shift.
 * Shared between closeShift and getShiftPreview.
 */
async function calculateShiftSummary(db: any, shiftId: string, openingAmount: number) {
  // Ensure the payments table exists before querying it
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid,
      method text NOT NULL DEFAULT 'cash',
      amount numeric(12,2) NOT NULL DEFAULT 0,
      reference text,
      tip numeric(12,2) NOT NULL DEFAULT 0,
      shift_id uuid,
      user_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  // Payment totals by method
  const paymentsResult = await db.execute(
    sql`SELECT method, coalesce(sum(amount), 0)::numeric as total
        FROM payments
        WHERE shift_id = ${shiftId} AND amount > 0
        GROUP BY method`
  )
  const paymentRows = paymentsResult.rows ?? paymentsResult

  let totalCashPayments = 0
  let totalCardPayments = 0
  let totalTransferPayments = 0
  let totalSales = 0
  for (const row of paymentRows) {
    const amount = parseFloat(row.total)
    totalSales += amount
    if (row.method === 'cash') totalCashPayments += amount
    else if (row.method === 'card') totalCardPayments += amount
    else if (row.method === 'transfer') totalTransferPayments += amount
  }

  // Transactions count (distinct invoices)
  const txResult = await db.execute(
    sql`SELECT count(DISTINCT invoice_id)::int as count
        FROM payments
        WHERE shift_id = ${shiftId} AND amount > 0`
  )
  const txRows = txResult.rows ?? txResult
  const transactionsCount = txRows[0]?.count ?? 0

  // Cash movements (deposits/withdrawals)
  let totalDeposits = 0
  let totalWithdrawals = 0
  try {
    const movResult = await db.execute(
      sql`SELECT
            coalesce(sum(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)::numeric as deposits,
            coalesce(sum(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0)::numeric as withdrawals
          FROM cash_movements
          WHERE shift_id = ${shiftId}`
    )
    const movRows = movResult.rows ?? movResult
    totalDeposits = parseFloat(movRows[0]?.deposits ?? '0')
    totalWithdrawals = parseFloat(movRows[0]?.withdrawals ?? '0')
  } catch {
    // cash_movements table may not exist yet — non-critical
  }

  const expectedAmount = openingAmount + totalCashPayments + totalDeposits - totalWithdrawals

  return {
    totalCashPayments,
    totalCardPayments,
    totalTransferPayments,
    totalSales,
    totalDeposits,
    totalWithdrawals,
    expectedAmount,
    transactionsCount,
  }
}

export async function closeShift(
  db: any,
  shiftId: string,
  closingAmount: number,
  notes: string | null
): Promise<CashShift> {
  await ensureTable(db)

  // Verify shift exists and is open
  const shiftResult = await db.execute(
    sql`SELECT * FROM cash_shifts WHERE id = ${shiftId} AND status = 'open'`
  )
  const shiftRows = shiftResult.rows ?? shiftResult
  if (!shiftRows.length) {
    throw new Error('Shift not found or already closed')
  }

  const shift = shiftRows[0]
  const openingAmount = parseFloat(shift.opening_amount)

  const summary = await calculateShiftSummary(db, shiftId, openingAmount)
  const difference = closingAmount - summary.expectedAmount

  const updateResult = await db.execute(
    sql`UPDATE cash_shifts
        SET closing_amount = ${closingAmount},
            expected_amount = ${summary.expectedAmount},
            difference = ${difference},
            status = 'closed',
            closed_at = now(),
            notes = ${notes},
            total_sales = ${summary.totalSales},
            total_cash_sales = ${summary.totalCashPayments},
            total_card_sales = ${summary.totalCardPayments},
            total_transfer_sales = ${summary.totalTransferPayments},
            total_deposits = ${summary.totalDeposits},
            total_withdrawals = ${summary.totalWithdrawals},
            transactions_count = ${summary.transactionsCount}
        WHERE id = ${shiftId}
        RETURNING *`
  )

  const updateRows = updateResult.rows ?? updateResult
  return mapRow(updateRows[0])
}

/**
 * Get a preview of shift close calculations without actually closing (Corte X).
 */
export async function getShiftPreview(
  db: any,
  shiftId: string
): Promise<ShiftPreview> {
  await ensureTable(db)

  const shiftResult = await db.execute(
    sql`SELECT cs.*, r.name as register_name
        FROM cash_shifts cs
        LEFT JOIN pos_registers r ON r.id = cs.register_id
        WHERE cs.id = ${shiftId} AND cs.status = 'open'`
  )
  const shiftRows = shiftResult.rows ?? shiftResult
  if (!shiftRows.length) {
    throw new Error('Shift not found or already closed')
  }

  const shift = shiftRows[0]
  const openingAmount = parseFloat(shift.opening_amount)

  const summary = await calculateShiftSummary(db, shiftId, openingAmount)

  return {
    shiftId,
    registerId: shift.register_id ?? null,
    registerName: shift.register_name ?? null,
    openingAmount,
    totalCashPayments: summary.totalCashPayments,
    totalCardPayments: summary.totalCardPayments,
    totalTransferPayments: summary.totalTransferPayments,
    totalDeposits: summary.totalDeposits,
    totalWithdrawals: summary.totalWithdrawals,
    expectedAmount: summary.expectedAmount,
    transactionsCount: summary.transactionsCount,
    totalSales: summary.totalSales,
  }
}

export async function getShiftHistory(
  db: any,
  filters: ShiftFilters
): Promise<PaginatedResult<CashShift>> {
  await ensureTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  // Build dynamic WHERE conditions
  const conditions = [sql`cs.status = 'closed'`]
  if (filters.registerId) conditions.push(sql`cs.register_id = ${filters.registerId}`)
  if (filters.userId) conditions.push(sql`cs.user_id = ${filters.userId}`)
  if (filters.from) conditions.push(sql`cs.closed_at >= ${filters.from}::timestamptz`)
  if (filters.to) conditions.push(sql`cs.closed_at <= (${filters.to}::date + interval '1 day')`)

  const whereClause = sql.join(conditions, sql` AND `)

  const result = await db.execute(
    sql`SELECT cs.*, r.name as register_name, u.name as user_name
        FROM cash_shifts cs
        LEFT JOIN pos_registers r ON r.id = cs.register_id
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE ${whereClause}
        ORDER BY cs.closed_at DESC
        LIMIT ${limit} OFFSET ${offset}`
  )
  const countResult = await db.execute(
    sql`SELECT count(*)::int as count FROM cash_shifts cs WHERE ${whereClause}`
  )

  const rows = result.rows ?? result
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return {
    data: rows.map(mapRow),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}
