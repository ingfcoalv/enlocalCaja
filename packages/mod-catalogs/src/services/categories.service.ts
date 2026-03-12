import { categories, changeJournal } from '@enlocal/core-db'
import { eq, and, sql, asc } from 'drizzle-orm'

interface CategoryFilters {
  active?: boolean
  parentId?: string | null
}

export async function listCategories(
  db: any,
  filters: CategoryFilters
): Promise<any[]> {
  const conditions: any[] = []

  if (filters.active !== undefined) {
    conditions.push(eq(categories.active, filters.active))
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      conditions.push(sql`${categories.parentId} IS NULL`)
    } else {
      conditions.push(eq(categories.parentId, filters.parentId))
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(categories)
    .where(where)
    .orderBy(asc(categories.sortOrder))

  return rows
}

export async function createCategory(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db.insert(categories).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'categories',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateCategory(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(categories)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(categories.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'categories',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteCategory(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(categories)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(categories.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'categories',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}
