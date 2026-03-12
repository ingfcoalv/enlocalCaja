import { changeJournal } from '@enlocal/core-db'
import { sql } from 'drizzle-orm'
import { ensureTable as ensureMovementsTable, createMovement } from './movements.service'

interface CountFilters {
  page?: number
  limit?: number
}

interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pages: number
}

interface CountItemData {
  ingredient_id: string
  expected_qty: number
  counted_qty: number
  difference: number
  notes?: string
}

interface CreateCountData {
  notes?: string
  items: CountItemData[]
}

/**
 * Ensures the inventory_counts and inventory_count_items tables exist. Called before operations.
 */
export async function ensureCountsTable(db: any): Promise<void> {
  await ensureMovementsTable(db)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory_counts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      count_date date NOT NULL DEFAULT CURRENT_DATE,
      status text NOT NULL DEFAULT 'completed',
      notes text,
      created_by uuid,
      created_at timestamptz DEFAULT now()
    )
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS inventory_count_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      count_id uuid NOT NULL REFERENCES inventory_counts(id),
      ingredient_id uuid NOT NULL,
      expected_qty numeric(12,4) NOT NULL DEFAULT 0,
      counted_qty numeric(12,4) NOT NULL DEFAULT 0,
      difference numeric(12,4) NOT NULL DEFAULT 0,
      notes text
    )
  `)
}

export async function createCount(
  db: any,
  data: CreateCountData,
  userId: string
): Promise<any> {
  await ensureCountsTable(db)

  const notes = data.notes ?? null

  // Insert the count header
  const countResult = await db.execute(
    sql`INSERT INTO inventory_counts (count_date, status, notes, created_by, created_at)
        VALUES (CURRENT_DATE, 'completed', ${notes}, ${userId}, now())
        RETURNING *`
  )
  const countRows = countResult.rows ?? countResult
  const count = countRows[0]

  // Insert all count items
  const items: any[] = []
  for (const item of data.items) {
    const itemNotes = item.notes ?? null
    const itemResult = await db.execute(
      sql`INSERT INTO inventory_count_items (count_id, ingredient_id, expected_qty, counted_qty, difference, notes)
          VALUES (${count.id}, ${item.ingredient_id}, ${item.expected_qty}, ${item.counted_qty}, ${item.difference}, ${itemNotes})
          RETURNING *`
    )
    const itemRows = itemResult.rows ?? itemResult
    items.push(itemRows[0])

    // For items with a difference, create an adjustment movement
    if (item.difference !== 0) {
      await createMovement(db, {
        ingredientId: item.ingredient_id,
        type: 'adjustment',
        quantity: item.counted_qty,
        reference: 'Conteo de inventario',
        notes: item.notes,
      }, userId)
    }
  }

  // Log to change journal
  await db.insert(changeJournal).values({
    tableName: 'inventory_counts',
    recordId: count.id,
    action: 'insert',
    data: { ...count, items },
    userId,
    synced: false,
  })

  return { ...count, items }
}

export async function listCounts(
  db: any,
  filters: CountFilters
): Promise<PaginatedResult<any>> {
  await ensureCountsTable(db)

  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const result = await db.execute(
    sql`SELECT ic.*, count(ici.id)::int as item_count
        FROM inventory_counts ic
        LEFT JOIN inventory_count_items ici ON ic.id = ici.count_id
        GROUP BY ic.id
        ORDER BY ic.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`
  )
  const rows = result.rows ?? result

  const countResult = await db.execute(
    sql`SELECT count(*)::int as count FROM inventory_counts`
  )
  const countRows = countResult.rows ?? countResult
  const total = countRows[0]?.count ?? 0

  return { data: rows, total, page, pages: Math.ceil(total / limit) }
}

export async function getCountById(
  db: any,
  id: string
): Promise<any> {
  await ensureCountsTable(db)

  // Get the count row
  const countResult = await db.execute(
    sql`SELECT * FROM inventory_counts WHERE id = ${id}`
  )
  const countRows = countResult.rows ?? countResult
  if (!countRows.length) return null

  const count = countRows[0]

  // Get all count items joined with products
  const itemsResult = await db.execute(
    sql`SELECT ici.*, p.name as ingredient_name
        FROM inventory_count_items ici
        LEFT JOIN products p ON ici.ingredient_id = p.id
        WHERE ici.count_id = ${id}`
  )
  const items = itemsResult.rows ?? itemsResult

  return { ...count, items }
}
