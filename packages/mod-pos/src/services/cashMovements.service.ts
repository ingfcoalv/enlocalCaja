import { sql } from 'drizzle-orm'

export interface CashMovement {
  id: string
  shiftId: string
  registerId: string
  userId: string
  userName: string | null
  type: 'deposit' | 'withdrawal'
  amount: string
  reason: string
  notes: string | null
  authorizedBy: string | null
  authorizedByName: string | null
  relatedMovementId: string | null
  createdAt: string
}

interface MovementFilters {
  shiftId?: string
  registerId?: string
  from?: string
  to?: string
  type?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface MovementsSummary {
  totalDeposits: number
  totalWithdrawals: number
  net: number
  count: number
}

async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cash_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      shift_id uuid NOT NULL,
      register_id uuid NOT NULL,
      user_id uuid NOT NULL,
      type text NOT NULL,
      amount numeric(12,2) NOT NULL,
      reason text NOT NULL,
      notes text,
      authorized_by uuid,
      related_movement_id uuid,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function mapRow(row: any): CashMovement {
  return {
    id: row.id,
    shiftId: row.shift_id,
    registerId: row.register_id,
    userId: row.user_id,
    userName: row.user_name ?? null,
    type: row.type,
    amount: row.amount,
    reason: row.reason,
    notes: row.notes,
    authorizedBy: row.authorized_by,
    authorizedByName: row.authorized_by_name ?? null,
    relatedMovementId: row.related_movement_id,
    createdAt: row.created_at,
  }
}

export async function createMovement(
  db: any,
  data: {
    shiftId: string
    registerId: string
    userId: string
    type: 'deposit' | 'withdrawal'
    amount: number
    reason: string
    notes?: string | null
    authorizedBy?: string | null
  }
): Promise<CashMovement> {
  await ensureTable(db)

  // 2.3 — Validate positive amount
  if (!data.amount || data.amount <= 0) {
    throw new Error('El monto debe ser mayor a 0')
  }

  const result = await db.execute(
    sql`INSERT INTO cash_movements (shift_id, register_id, user_id, type, amount, reason, notes, authorized_by)
        VALUES (${data.shiftId}, ${data.registerId}, ${data.userId}, ${data.type}, ${data.amount}, ${data.reason}, ${data.notes ?? null}, ${data.authorizedBy ?? null})
        RETURNING *`
  )
  const rows = result.rows ?? result

  // Re-fetch with user names
  const full = await db.execute(
    sql`SELECT cm.*, u.name as user_name, a.name as authorized_by_name
        FROM cash_movements cm
        LEFT JOIN users u ON u.id = cm.user_id
        LEFT JOIN users a ON a.id = cm.authorized_by
        WHERE cm.id = ${rows[0].id}`
  )
  const fullRows = full.rows ?? full
  return mapRow(fullRows[0])
}

export async function createTransfer(
  db: any,
  data: {
    fromShiftId: string
    fromRegisterId: string
    toShiftId: string
    toRegisterId: string
    userId: string
    amount: number
    notes?: string | null
  }
): Promise<{ withdrawal: CashMovement; deposit: CashMovement }> {
  await ensureTable(db)

  // 2.3 — Validate positive amount
  if (!data.amount || data.amount <= 0) {
    throw new Error('El monto de transferencia debe ser mayor a 0')
  }

  // 2.4 — Validate source shift has enough cash
  const shiftResult = await db.execute(
    sql`SELECT opening_amount FROM cash_shifts WHERE id = ${data.fromShiftId} AND status = 'open'`
  )
  const shiftRows = shiftResult.rows ?? shiftResult
  if (!shiftRows.length) {
    throw new Error('El turno origen no existe o ya está cerrado')
  }
  const openingAmount = parseFloat(shiftRows[0].opening_amount)

  // Calculate available cash in source shift
  let cashInShift = openingAmount
  try {
    const paymentsResult = await db.execute(
      sql`SELECT coalesce(sum(amount), 0)::numeric as total
          FROM payments WHERE shift_id = ${data.fromShiftId} AND method = 'cash' AND amount > 0`
    )
    const pRows = paymentsResult.rows ?? paymentsResult
    cashInShift += parseFloat(pRows[0]?.total ?? '0')

    const movResult = await db.execute(
      sql`SELECT
            coalesce(sum(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)::numeric as deposits,
            coalesce(sum(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0)::numeric as withdrawals
          FROM cash_movements WHERE shift_id = ${data.fromShiftId}`
    )
    const mRows = movResult.rows ?? movResult
    cashInShift += parseFloat(mRows[0]?.deposits ?? '0') - parseFloat(mRows[0]?.withdrawals ?? '0')
  } catch { /* tables may not exist */ }

  if (data.amount > cashInShift + 0.01) {
    throw new Error(`Fondos insuficientes. Disponible en caja: $${cashInShift.toFixed(2)}`)
  }

  // Create withdrawal from source
  const withdrawalResult = await db.execute(
    sql`INSERT INTO cash_movements (shift_id, register_id, user_id, type, amount, reason, notes)
        VALUES (${data.fromShiftId}, ${data.fromRegisterId}, ${data.userId}, 'withdrawal', ${data.amount}, 'transfer_out', ${data.notes ?? null})
        RETURNING *`
  )
  const wRows = withdrawalResult.rows ?? withdrawalResult
  const withdrawalId = wRows[0].id

  // Create deposit to destination
  const depositResult = await db.execute(
    sql`INSERT INTO cash_movements (shift_id, register_id, user_id, type, amount, reason, notes, related_movement_id)
        VALUES (${data.toShiftId}, ${data.toRegisterId}, ${data.userId}, 'deposit', ${data.amount}, 'transfer_in', ${data.notes ?? null}, ${withdrawalId})
        RETURNING *`
  )
  const dRows = depositResult.rows ?? depositResult
  const depositId = dRows[0].id

  // Link withdrawal back to deposit
  await db.execute(
    sql`UPDATE cash_movements SET related_movement_id = ${depositId} WHERE id = ${withdrawalId}`
  )

  // Re-fetch both with user names
  const full = await db.execute(
    sql`SELECT cm.*, u.name as user_name, a.name as authorized_by_name
        FROM cash_movements cm
        LEFT JOIN users u ON u.id = cm.user_id
        LEFT JOIN users a ON a.id = cm.authorized_by
        WHERE cm.id IN (${withdrawalId}, ${depositId})
        ORDER BY cm.type ASC`
  )
  const fullRows = full.rows ?? full
  const deposit = fullRows.find((r: any) => r.type === 'deposit')
  const withdrawal = fullRows.find((r: any) => r.type === 'withdrawal')

  return {
    withdrawal: mapRow(withdrawal),
    deposit: mapRow(deposit),
  }
}

export async function getMovementsByShift(
  db: any,
  shiftId: string
): Promise<CashMovement[]> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT cm.*, u.name as user_name, a.name as authorized_by_name
        FROM cash_movements cm
        LEFT JOIN users u ON u.id = cm.user_id
        LEFT JOIN users a ON a.id = cm.authorized_by
        WHERE cm.shift_id = ${shiftId}
        ORDER BY cm.created_at ASC`
  )
  const rows = result.rows ?? result
  return rows.map(mapRow)
}

export async function getMovements(
  db: any,
  filters: MovementFilters
): Promise<PaginatedResult<CashMovement>> {
  await ensureTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  // Build WHERE conditions
  const conditions: string[] = ['1=1']
  const params: any[] = []
  let paramIdx = 1

  if (filters.shiftId) {
    conditions.push(`cm.shift_id = $${paramIdx++}`)
    params.push(filters.shiftId)
  }
  if (filters.registerId) {
    conditions.push(`cm.register_id = $${paramIdx++}`)
    params.push(filters.registerId)
  }
  if (filters.type) {
    conditions.push(`cm.type = $${paramIdx++}`)
    params.push(filters.type)
  }
  if (filters.from) {
    conditions.push(`cm.created_at >= $${paramIdx++}`)
    params.push(new Date(filters.from + 'T00:00:00'))
  }
  if (filters.to) {
    conditions.push(`cm.created_at <= $${paramIdx++}`)
    params.push(new Date(filters.to + 'T23:59:59.999'))
  }

  const whereClause = conditions.join(' AND ')

  // Use raw pool query for dynamic WHERE
  const pool = db
  const dataResult = await pool.query(
    `SELECT cm.*, u.name as user_name, a.name as authorized_by_name
     FROM cash_movements cm
     LEFT JOIN users u ON u.id = cm.user_id
     LEFT JOIN users a ON a.id = cm.authorized_by
     WHERE ${whereClause}
     ORDER BY cm.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  )

  const countResult = await pool.query(
    `SELECT count(*)::int as count FROM cash_movements cm WHERE ${whereClause}`,
    params
  )

  const total = countResult.rows[0]?.count ?? 0

  return {
    data: (dataResult.rows ?? []).map(mapRow),
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getMovementsSummary(
  db: any,
  shiftId: string
): Promise<MovementsSummary> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT
          coalesce(sum(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0)::numeric as total_deposits,
          coalesce(sum(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0)::numeric as total_withdrawals,
          count(*)::int as count
        FROM cash_movements
        WHERE shift_id = ${shiftId}`
  )
  const rows = result.rows ?? result
  const totalDeposits = parseFloat(rows[0]?.total_deposits ?? '0')
  const totalWithdrawals = parseFloat(rows[0]?.total_withdrawals ?? '0')

  return {
    totalDeposits,
    totalWithdrawals,
    net: totalDeposits - totalWithdrawals,
    count: rows[0]?.count ?? 0,
  }
}
