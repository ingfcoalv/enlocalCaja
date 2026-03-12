import { customers, changeJournal, invoices } from '@enlocal/core-db'
import { eq, and, or, ilike, sql, asc } from 'drizzle-orm'

interface CustomerFilters {
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

export async function listCustomers(
  db: any,
  filters: CustomerFilters
): Promise<PaginatedResult<any>> {
  const page = filters.page || 1
  const limit = filters.limit || 50
  const offset = (page - 1) * limit

  const conditions: any[] = []

  if (filters.active !== undefined) {
    conditions.push(eq(customers.active, filters.active))
  }

  if (filters.q) {
    const search = `%${filters.q}%`
    conditions.push(
      or(
        ilike(customers.name, search),
        ilike(customers.phone, search),
        ilike(customers.cellphone, search),
        ilike(customers.email, search),
        ilike(customers.rfc, search),
        ilike(customers.razonSocial, search),
        ilike(customers.contactName, search)
      )
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(asc(customers.name))
    .limit(limit)
    .offset(offset)

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(where)

  const total = countResult[0]?.count ?? 0

  return {
    data: rows,
    total,
    page,
    pages: Math.ceil(total / limit),
  }
}

export async function getCustomerById(db: any, id: string): Promise<any> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id))
  return row || null
}

export async function createCustomer(
  db: any,
  data: any,
  requestUserId: string
): Promise<any> {
  const [row] = await db.insert(customers).values(data).returning()

  await db.insert(changeJournal).values({
    tableName: 'customers',
    recordId: row.id,
    action: 'insert',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function updateCustomer(
  db: any,
  id: string,
  data: any,
  requestUserId: string
): Promise<any> {
  // Auto-set creditStatus to 'pending' when enabling credit for the first time
  if (data.creditEnabled === true) {
    const [existing] = await db.select({ creditEnabled: customers.creditEnabled }).from(customers).where(eq(customers.id, id))
    if (existing && !existing.creditEnabled) {
      data.creditStatus = 'pending'
    }
  }

  const [row] = await db
    .update(customers)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(customers.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'customers',
    recordId: id,
    action: 'update',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function deleteCustomer(
  db: any,
  id: string,
  requestUserId: string
): Promise<any> {
  const [row] = await db
    .update(customers)
    .set({ active: false, updatedAt: sql`now()` })
    .where(eq(customers.id, id))
    .returning()

  if (!row) return null

  await db.insert(changeJournal).values({
    tableName: 'customers',
    recordId: id,
    action: 'soft_delete',
    data: row,
    userId: requestUserId,
    synced: false,
  })

  return row
}

export async function getCustomerBirthdays(
  db: any,
  days: number
): Promise<any[]> {
  const rows = await db
    .select()
    .from(customers)
    .where(
      and(
        eq(customers.active, true),
        sql`${customers.birthday} IS NOT NULL`,
        sql`(
          (EXTRACT(MONTH FROM ${customers.birthday}) * 100 + EXTRACT(DAY FROM ${customers.birthday}))
          BETWEEN
          (EXTRACT(MONTH FROM CURRENT_DATE) * 100 + EXTRACT(DAY FROM CURRENT_DATE))
          AND
          (EXTRACT(MONTH FROM (CURRENT_DATE + ${days}::int * INTERVAL '1 day')) * 100 + EXTRACT(DAY FROM (CURRENT_DATE + ${days}::int * INTERVAL '1 day')))
        )`
      )
    )
    .orderBy(sql`EXTRACT(MONTH FROM ${customers.birthday}), EXTRACT(DAY FROM ${customers.birthday})`)

  return rows
}

export async function getCustomerStats(
  db: any,
  customerId: string
): Promise<{ totalOrders: number; totalSpent: string; avgTicket: string }> {
  const result = await db
    .select({
      totalOrders: sql<number>`count(*)::int`,
      totalSpent: sql<string>`coalesce(sum(${invoices.total}), 0)::numeric(12,2)`,
      avgTicket: sql<string>`coalesce(avg(${invoices.total}), 0)::numeric(12,2)`,
    })
    .from(invoices)
    .where(eq(invoices.customerId, customerId))

  return {
    totalOrders: result[0]?.totalOrders ?? 0,
    totalSpent: result[0]?.totalSpent ?? '0.00',
    avgTicket: result[0]?.avgTicket ?? '0.00',
  }
}
