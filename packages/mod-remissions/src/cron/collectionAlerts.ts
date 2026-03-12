import { receivables, customers } from '@enlocal/core-db'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

export async function getUpcomingCollections(db: any): Promise<any[]> {
  try {
    const now = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const rows = await db
      .select({
        receivable: receivables,
        customerName: customers.name,
        customerPhone: customers.phone,
      })
      .from(receivables)
      .innerJoin(customers, eq(receivables.customerId, customers.id))
      .where(
        and(
          eq(receivables.status, 'current'),
          gte(receivables.dueDate, now),
          lte(receivables.dueDate, threeDaysFromNow),
        )
      )

    return rows
  } catch (err: any) {
    console.error('[mod-remissions] Error fetching upcoming collections:', err.message)
    return []
  }
}
