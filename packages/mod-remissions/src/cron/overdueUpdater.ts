import { sql } from 'drizzle-orm'

export async function updateOverdueReceivables(db: any): Promise<void> {
  try {
    // 1. Mark overdue receivables
    await db.execute(sql`
      UPDATE receivables
      SET status = 'overdue',
          days_overdue = EXTRACT(DAY FROM now() - due_date)::int,
          updated_at = now()
      WHERE due_date < now()
        AND status = 'current'
    `)

    // 2. Update related tickets
    await db.execute(sql`
      UPDATE invoices
      SET status = 'overdue', updated_at = now()
      WHERE id IN (
        SELECT ticket_id FROM receivables WHERE status = 'overdue'
      )
      AND status NOT IN ('paid', 'cancelled')
    `)

    // 3. Update customer credit status
    // Only act on customers with credit_status IN ('active', 'warning')
    // Do NOT touch 'pending', 'rejected', or manually 'suspended'

    // Suspended: overdue > 60 days (only from 'active' or 'warning')
    await db.execute(sql`
      UPDATE customers
      SET credit_status = 'suspended', updated_at = now()
      WHERE id IN (
        SELECT DISTINCT customer_id FROM receivables
        WHERE status = 'overdue' AND days_overdue > 60
      )
      AND credit_status IN ('active', 'warning')
    `)

    // Warning: overdue <= 60 days (only from 'active')
    await db.execute(sql`
      UPDATE customers
      SET credit_status = 'warning', updated_at = now()
      WHERE id IN (
        SELECT DISTINCT customer_id FROM receivables
        WHERE status = 'overdue' AND days_overdue <= 60 AND days_overdue > 0
      )
      AND id NOT IN (
        SELECT DISTINCT customer_id FROM receivables
        WHERE status = 'overdue' AND days_overdue > 60
      )
      AND credit_status = 'active'
    `)

    // Active: no overdue (restore from 'warning' only)
    await db.execute(sql`
      UPDATE customers
      SET credit_status = 'active', updated_at = now()
      WHERE credit_enabled = true
        AND credit_status = 'warning'
        AND id NOT IN (
          SELECT DISTINCT customer_id FROM receivables WHERE status = 'overdue'
        )
    `)
  } catch (err: any) {
    console.error('[mod-remissions] Error updating overdue receivables:', err.message)
  }
}
