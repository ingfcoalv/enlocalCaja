import { customers, receivables } from '@enlocal/core-db'
import { eq, and, inArray, sql } from 'drizzle-orm'

export interface CreditCheckResult {
  creditEnabled: boolean
  creditLimit: number
  creditBalance: number
  availableCredit: number
  creditDays: number
  overdueAmount: number
  overdueCount: number
  status: 'approved' | 'warning' | 'blocked'
  warnings: string[]
}

export async function checkCredit(
  db: any,
  customerId: string,
  amount: number
): Promise<CreditCheckResult> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))

  if (!customer) {
    return {
      creditEnabled: false, creditLimit: 0, creditBalance: 0,
      availableCredit: 0, creditDays: 0, overdueAmount: 0, overdueCount: 0,
      status: 'blocked', warnings: ['Cliente no encontrado'],
    }
  }

  const warnings: string[] = []

  if (!customer.creditEnabled) {
    return {
      creditEnabled: false,
      creditLimit: Number(customer.creditLimit),
      creditBalance: 0, availableCredit: 0,
      creditDays: Number(customer.creditDays),
      overdueAmount: 0, overdueCount: 0,
      status: 'blocked',
      warnings: ['Cliente sin credito autorizado'],
    }
  }

  // Calculate current balance from receivables
  const balanceResult = await db
    .select({ total: sql<string>`coalesce(sum(${receivables.balance}), '0')` })
    .from(receivables)
    .where(
      and(
        eq(receivables.customerId, customerId),
        inArray(receivables.status, ['current', 'overdue', 'partial'])
      )
    )
  const creditBalance = Number(balanceResult[0]?.total ?? 0)
  const creditLimit = Number(customer.creditLimit)
  const availableCredit = creditLimit - creditBalance

  if (creditBalance + amount > creditLimit) {
    warnings.push(`Excede limite de credito. Disponible: $${availableCredit.toFixed(2)}`)
  }

  // Check overdue receivables
  const overdueResult = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${receivables.balance}), '0')`,
      maxDays: sql<number>`coalesce(max(${receivables.daysOverdue}), 0)`,
    })
    .from(receivables)
    .where(
      and(
        eq(receivables.customerId, customerId),
        eq(receivables.status, 'overdue')
      )
    )

  const overdueCount = overdueResult[0]?.count ?? 0
  const overdueAmount = Number(overdueResult[0]?.total ?? 0)
  const maxDaysOverdue = overdueResult[0]?.maxDays ?? 0

  let status: 'approved' | 'warning' | 'blocked' = 'approved'

  if (creditBalance + amount > creditLimit) {
    status = 'blocked'
  } else if (maxDaysOverdue > 60) {
    status = 'blocked'
    warnings.push(`Tiene facturas vencidas por mas de 60 dias`)
  } else if (overdueCount > 0) {
    status = 'warning'
    warnings.push(`Tiene ${overdueCount} factura(s) vencida(s) por $${overdueAmount.toFixed(2)}`)
  }

  return {
    creditEnabled: true,
    creditLimit,
    creditBalance,
    availableCredit,
    creditDays: Number(customer.creditDays),
    overdueAmount,
    overdueCount,
    status,
    warnings,
  }
}

export async function updateCreditProfile(
  db: any,
  customerId: string,
  data: { credit_enabled: boolean; credit_limit: number; credit_days: number; payment_terms?: string }
): Promise<any> {
  const [row] = await db
    .update(customers)
    .set({
      creditEnabled: data.credit_enabled,
      creditLimit: String(data.credit_limit),
      creditDays: data.credit_days,
      paymentTerms: data.payment_terms ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(customers.id, customerId))
    .returning()
  return row
}

export async function recalculateCreditBalance(db: any, customerId: string): Promise<void> {
  const result = await db
    .select({ total: sql<string>`coalesce(sum(${receivables.balance}), '0')` })
    .from(receivables)
    .where(
      and(
        eq(receivables.customerId, customerId),
        inArray(receivables.status, ['current', 'overdue', 'partial'])
      )
    )

  const balance = result[0]?.total ?? '0'

  await db
    .update(customers)
    .set({ creditBalance: balance, updatedAt: sql`now()` })
    .where(eq(customers.id, customerId))
}
