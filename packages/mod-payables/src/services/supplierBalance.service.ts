import { payables, suppliers } from '@enlocal/core-db'
import { eq, and, inArray, sql } from 'drizzle-orm'

export async function recalculateSupplierBalance(db: any, supplierId: string): Promise<void> {
  const result = await db
    .select({ totalBalance: sql<number>`coalesce(sum(${payables.balance}::numeric), 0)` })
    .from(payables)
    .where(
      and(
        eq(payables.supplierId, supplierId),
        inArray(payables.status, ['current', 'overdue', 'partial'])
      )
    )

  const totalBalance = result[0]?.totalBalance ?? 0

  await db.update(suppliers).set({
    balance: String(Number(totalBalance).toFixed(2)),
    updatedAt: sql`now()`,
  }).where(eq(suppliers.id, supplierId))
}
