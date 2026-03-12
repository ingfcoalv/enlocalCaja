import { payables, suppliers } from '@enlocal/core-db'
import { eq, and, gte, lte, inArray } from 'drizzle-orm'

export async function getUpcomingPayments(db: any): Promise<any[]> {
  try {
    const now = new Date()
    const threeDaysFromNow = new Date()
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)

    const rows = await db
      .select({
        payable: payables,
        supplierName: suppliers.name,
        supplierPhone: suppliers.phone,
      })
      .from(payables)
      .innerJoin(suppliers, eq(payables.supplierId, suppliers.id))
      .where(
        and(
          eq(payables.status, 'current'),
          gte(payables.dueDate, now),
          lte(payables.dueDate, threeDaysFromNow),
        )
      )

    return rows
  } catch (err: any) {
    console.error('[mod-payables] Error fetching upcoming payments:', err.message)
    return []
  }
}
