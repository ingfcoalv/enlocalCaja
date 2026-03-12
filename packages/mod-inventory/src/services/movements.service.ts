import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'
import { ensureTable as ensureIngredientsTable } from './ingredients.service'

interface MovementFilters {
  ingredientId?: string
  type?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface CreateMovementData {
  ingredientId: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  reference?: string
  notes?: string
}

/**
 * Ensures the stock_movements table exists. Called before operations.
 */
export async function ensureTable(db: any): Promise<void> {
  await ensureIngredientsTable(db)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ingredient_id uuid NOT NULL,
      type text NOT NULL,
      quantity numeric(12,4) NOT NULL,
      reference text,
      notes text,
      user_id uuid,
      created_at timestamptz DEFAULT now()
    )
  `)
}

export async function createMovement(
  db: any,
  data: CreateMovementData,
  userId: string
): Promise<any> {
  await ensureTable(db)

  // Verify product exists
  const ingredientResult = await db.execute(
    sql`SELECT * FROM products WHERE id = ${data.ingredientId}`
  )
  const ingredientRows = ingredientResult.rows ?? ingredientResult
  if (!ingredientRows.length) {
    throw new Error('Articulo no encontrado')
  }

  // Insert the movement
  const ref = data.reference ?? null
  const notes = data.notes ?? null
  const movementResult = await db.execute(
    sql`INSERT INTO stock_movements (ingredient_id, type, quantity, reference, notes, user_id, created_at)
        VALUES (${data.ingredientId}, ${data.type}, ${data.quantity}, ${ref}, ${notes}, ${userId}, now())
        RETURNING *`
  )
  const movementRows = movementResult.rows ?? movementResult
  const movement = movementRows[0]

  // Update product current_stock based on movement type
  if (data.type === 'in') {
    await db.execute(
      sql`UPDATE products
          SET current_stock = current_stock + ${data.quantity}, updated_at = now()
          WHERE id = ${data.ingredientId}`
    )
  } else if (data.type === 'out') {
    // 2.6 — Prevent stock from going negative
    const stockCheck = await db.execute(
      sql`SELECT current_stock::numeric as current_stock FROM products WHERE id = ${data.ingredientId}`
    )
    const stockRows = stockCheck.rows ?? stockCheck
    const currentStock = parseFloat(stockRows[0]?.current_stock ?? '0')
    if (currentStock < data.quantity) {
      throw new Error(`Stock insuficiente. Disponible: ${currentStock}, Solicitado: ${data.quantity}`)
    }
    await db.execute(
      sql`UPDATE products
          SET current_stock = current_stock - ${data.quantity}, updated_at = now()
          WHERE id = ${data.ingredientId}`
    )
  } else if (data.type === 'adjustment') {
    await db.execute(
      sql`UPDATE products
          SET current_stock = ${data.quantity}, updated_at = now()
          WHERE id = ${data.ingredientId}`
    )
  }

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'stock_movements',
    recordId: movement.id,
    action: 'insert',
    data: movement,
    userId,
    synced: false,
  })

  return movement
}

export async function getKardex(
  db: any,
  ingredientId: string,
  from?: string,
  to?: string
): Promise<any[]> {
  await ensureTable(db)

  // Build WHERE conditions, only add date filters when provided
  const conditions = [sql`sm.ingredient_id = ${ingredientId}`]
  if (from) {
    const fromDate = new Date(from)
    fromDate.setHours(0, 0, 0, 0)
    conditions.push(sql`sm.created_at >= ${fromDate}`)
  }
  if (to) {
    const toDate = new Date(to)
    toDate.setHours(23, 59, 59, 999)
    conditions.push(sql`sm.created_at <= ${toDate}`)
  }
  const whereClause = sql.join(conditions, sql` AND `)

  // Get all movements for this product sorted by date
  const result = await db.execute(
    sql`SELECT sm.*, p.name as ingredient_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.ingredient_id = p.id
        WHERE ${whereClause}
        ORDER BY sm.created_at ASC`
  )

  const rows = result.rows ?? result

  // Compute running balance in application code because 'adjustment' sets absolute stock
  let balance = 0
  return rows.map((row: any) => {
    const qty = parseFloat(row.quantity)
    if (row.type === 'in') {
      balance += qty
    } else if (row.type === 'out') {
      balance -= qty
    } else if (row.type === 'adjustment') {
      balance = qty
    }
    return { ...row, running_balance: balance }
  })
}

export async function listMovements(
  db: any,
  filters: MovementFilters
): Promise<PaginatedResult<any>> {
  await ensureTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const hasIngredientId = !!filters.ingredientId
  const hasType = !!filters.type
  const hasFrom = !!filters.from
  const hasTo = !!filters.to

  if (!hasIngredientId && !hasType && !hasFrom && !hasTo) {
    const result = await db.execute(
      sql`SELECT sm.*, p.name as ingredient_name
          FROM stock_movements sm
          LEFT JOIN products p ON sm.ingredient_id = p.id
          ORDER BY sm.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    )
    const rows = result.rows ?? result

    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM stock_movements`
    )
    const countRows = countResult.rows ?? countResult
    const total = countRows[0]?.count ?? 0

    return { data: rows, total, page, pages: Math.ceil(total / limit) }
  }

  if (!hasType && !hasFrom && !hasTo && hasIngredientId) {
    const result = await db.execute(
      sql`SELECT sm.*, p.name as ingredient_name
          FROM stock_movements sm
          LEFT JOIN products p ON sm.ingredient_id = p.id
          WHERE sm.ingredient_id = ${filters.ingredientId}
          ORDER BY sm.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    )
    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM stock_movements WHERE ingredient_id = ${filters.ingredientId}`
    )
    const rows = result.rows ?? result
    const countRows = countResult.rows ?? countResult
    return { data: rows, total: countRows[0]?.count ?? 0, page, pages: Math.ceil((countRows[0]?.count ?? 0) / limit) }
  }

  if (!hasIngredientId && !hasFrom && !hasTo && hasType) {
    const result = await db.execute(
      sql`SELECT sm.*, p.name as ingredient_name
          FROM stock_movements sm
          LEFT JOIN products p ON sm.ingredient_id = p.id
          WHERE sm.type = ${filters.type}
          ORDER BY sm.created_at DESC
          LIMIT ${limit} OFFSET ${offset}`
    )
    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM stock_movements WHERE type = ${filters.type}`
    )
    const rows = result.rows ?? result
    const countRows = countResult.rows ?? countResult
    return { data: rows, total: countRows[0]?.count ?? 0, page, pages: Math.ceil((countRows[0]?.count ?? 0) / limit) }
  }

  // General query with all possible conditions
  const fromDate = filters.from ? new Date(filters.from) : null
  const toDate = filters.to ? new Date(filters.to) : null

  const result = await db.execute(
    sql`SELECT sm.*, p.name as ingredient_name
        FROM stock_movements sm
        LEFT JOIN products p ON sm.ingredient_id = p.id
        WHERE (${filters.ingredientId ?? null} IS NULL OR sm.ingredient_id = ${filters.ingredientId ?? null})
          AND (${filters.type ?? null} IS NULL OR sm.type = ${filters.type ?? null})
          AND (${fromDate} IS NULL OR sm.created_at >= ${fromDate})
          AND (${toDate} IS NULL OR sm.created_at <= ${toDate})
        ORDER BY sm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`
  )
  const rows = result.rows ?? result

  const countResult = await db.execute(
    sql`SELECT count(*)::int as count
        FROM stock_movements sm
        WHERE (${filters.ingredientId ?? null} IS NULL OR sm.ingredient_id = ${filters.ingredientId ?? null})
          AND (${filters.type ?? null} IS NULL OR sm.type = ${filters.type ?? null})
          AND (${fromDate} IS NULL OR sm.created_at >= ${fromDate})
          AND (${toDate} IS NULL OR sm.created_at <= ${toDate})`
  )
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return { data: rows, total, page, pages: Math.ceil(total / limit) }
}
