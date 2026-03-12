import { suppliers, changeJournal } from '@enlocal/core-db'
import { eq, and, ilike, sql, asc } from 'drizzle-orm'

interface SupplierFilters {
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

export async function listSuppliers(
  db: any,
  filters: SupplierFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  if (filters.active !== undefined) {
    conditions.push(eq(suppliers.active, filters.active))
  }

  if (filters.q) {
    conditions.push(ilike(suppliers.name, `%${filters.q}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(suppliers)
    .where(where)
    .orderBy(asc(suppliers.name))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suppliers)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function createSupplier(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db.insert(suppliers).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'suppliers',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateSupplier(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(suppliers)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(suppliers.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'suppliers',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteSupplier(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(suppliers)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(suppliers.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'suppliers',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}
