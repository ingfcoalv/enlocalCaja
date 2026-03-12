import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'

interface IngredientFilters {
  active?: boolean
  q?: string
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

/**
 * Ensures the products table has the inventory columns (current_stock, min_stock).
 * Called before operations.
 */
export async function ensureTable(db: any): Promise<void> {
  await db.execute(sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS current_stock numeric(12,4) DEFAULT 0
  `)
  await db.execute(sql`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock numeric(12,4) DEFAULT 0
  `)
}

export async function listIngredients(
  db: any,
  filters: IngredientFilters
): Promise<PaginatedResult<any>> {
  await ensureTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  if (filters.active !== undefined && filters.q) {
    const pattern = `%${filters.q}%`
    const result = await db.execute(
      sql`SELECT id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at
          FROM products
          WHERE active = ${filters.active} AND name ILIKE ${pattern}
          ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`
    )
    const rows = result.rows ?? result

    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM products WHERE active = ${filters.active} AND name ILIKE ${pattern}`
    )
    const countRows = countResult.rows ?? countResult
    const total = countRows[0]?.count ?? 0

    return { data: rows, total, page, pages: Math.ceil(total / limit) }
  }

  if (filters.active !== undefined) {
    const result = await db.execute(
      sql`SELECT id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at
          FROM products
          WHERE active = ${filters.active}
          ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`
    )
    const rows = result.rows ?? result

    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM products WHERE active = ${filters.active}`
    )
    const countRows = countResult.rows ?? countResult
    const total = countRows[0]?.count ?? 0

    return { data: rows, total, page, pages: Math.ceil(total / limit) }
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`
    const result = await db.execute(
      sql`SELECT id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at
          FROM products
          WHERE name ILIKE ${pattern}
          ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`
    )
    const rows = result.rows ?? result

    const countResult = await db.execute(
      sql`SELECT count(*)::int as count FROM products WHERE name ILIKE ${pattern}`
    )
    const countRows = countResult.rows ?? countResult
    const total = countRows[0]?.count ?? 0

    return { data: rows, total, page, pages: Math.ceil(total / limit) }
  }

  // No filters
  const result = await db.execute(
    sql`SELECT id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at
        FROM products
        ORDER BY name ASC LIMIT ${limit} OFFSET ${offset}`
  )
  const rows = result.rows ?? result

  const countResult = await db.execute(
    sql`SELECT count(*)::int as count FROM products`
  )
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return { data: rows, total, page, pages: Math.ceil(total / limit) }
}

export async function createIngredient(
  db: any,
  data: {
    name: string
    unit?: string
    current_stock?: number
    min_stock?: number
    cost?: number
    supplier_id?: string | null
  },
  userId: string
): Promise<any> {
  await ensureTable(db)

  const name = data.name
  const currentStock = data.current_stock ?? 0
  const minStock = data.min_stock ?? 0
  const cost = data.cost ?? 0

  const result = await db.execute(
    sql`INSERT INTO products (name, current_stock, min_stock, cost, active, created_at, updated_at)
        VALUES (${name}, ${currentStock}, ${minStock}, ${cost}, true, now(), now())
        RETURNING id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at`
  )

  const rows = result.rows ?? result
  const row = rows[0]

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId,
    synced: false,
  })

  return row
}

export async function updateIngredient(
  db: any,
  id: string,
  data: {
    name?: string
    unit?: string
    current_stock?: number
    min_stock?: number
    cost?: number
    supplier_id?: string | null
    active?: boolean
  },
  userId: string
): Promise<any> {
  await ensureTable(db)

  const result = await db.execute(
    sql`UPDATE products
        SET name = COALESCE(${data.name ?? null}, name),
            current_stock = COALESCE(${data.current_stock ?? null}, current_stock),
            min_stock = COALESCE(${data.min_stock ?? null}, min_stock),
            cost = COALESCE(${data.cost ?? null}, cost),
            active = COALESCE(${data.active ?? null}, active),
            updated_at = now()
        WHERE id = ${id}
        RETURNING id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at`
  )

  const rows = result.rows ?? result
  if (!rows.length) return null

  const row = rows[0]

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: id,
    action: 'update',
    data: row,
    userId,
    synced: false,
  })

  return row
}

export async function deleteIngredient(
  db: any,
  id: string,
  userId: string
): Promise<any> {
  await ensureTable(db)

  const result = await db.execute(
    sql`UPDATE products
        SET active = false, updated_at = now()
        WHERE id = ${id}
        RETURNING id, name, 'pza' as unit, current_stock, min_stock, cost, active, created_at, updated_at`
  )

  const rows = result.rows ?? result
  if (!rows.length) return null

  const row = rows[0]

  await db.insert(changeJournal).values({
    tableName: 'products',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId,
    synced: false,
  })

  return row
}

export async function getAlerts(db: any): Promise<any[]> {
  await ensureTable(db)

  const result = await db.execute(
    sql`SELECT id, name, 'pza' as unit, current_stock, min_stock, cost, active
        FROM products
        WHERE active = true AND min_stock > 0 AND current_stock <= min_stock
        ORDER BY (current_stock - min_stock) ASC`
  )

  return result.rows ?? result
}

export async function getValuation(db: any): Promise<{ total: number; items: any[] }> {
  await ensureTable(db)

  const totalResult = await db.execute(
    sql`SELECT COALESCE(SUM(current_stock * cost), 0)::numeric AS total
        FROM products
        WHERE active = true`
  )
  const totalRows = totalResult.rows ?? totalResult
  const total = parseFloat(totalRows[0]?.total ?? '0')

  const itemsResult = await db.execute(
    sql`SELECT id, name, 'pza' as unit, current_stock, cost, (current_stock * cost)::numeric AS value
        FROM products
        WHERE active = true
        ORDER BY (current_stock * cost) DESC`
  )
  const items = (itemsResult.rows ?? itemsResult).map((r: any) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    current_stock: r.current_stock,
    cost: r.cost,
    value: parseFloat(r.value),
  }))

  return { total, items }
}
