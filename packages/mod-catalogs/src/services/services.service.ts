import { services, changeJournal } from '@enlocal/core-db'
import { eq, and, ilike, sql, asc } from 'drizzle-orm'

interface ServiceFilters {
  categoryId?: string
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

export async function listServices(
  db: any,
  filters: ServiceFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  if (filters.categoryId) {
    conditions.push(eq(services.categoryId, filters.categoryId))
  }

  if (filters.active !== undefined) {
    conditions.push(eq(services.active, filters.active))
  }

  if (filters.q) {
    conditions.push(ilike(services.name, `%${filters.q}%`))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(services)
    .where(where)
    .orderBy(asc(services.name))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(services)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function createService(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db.insert(services).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'services',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateService(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(services)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(services.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'services',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteService(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(services)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(services.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'services',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}
