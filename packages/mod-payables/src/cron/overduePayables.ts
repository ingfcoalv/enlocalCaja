import { sql } from 'drizzle-orm'

export async function updateOverduePayables(db: any): Promise<void> {
  try {
    // Mark overdue payables
    await db.execute(sql`
      UPDATE payables
      SET status = 'overdue',
          days_overdue = EXTRACT(DAY FROM now() - due_date)::int,
          updated_at = now()
      WHERE due_date < now()
        AND status = 'current'
    `)
  } catch (err: any) {
    console.error('[mod-payables] Error updating overdue payables:', err.message)
  }
}
