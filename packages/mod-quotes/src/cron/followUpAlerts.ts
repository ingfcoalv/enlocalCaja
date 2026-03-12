import { quotes } from '@enlocal/core-db'
import { sql, and, lte, inArray, eq } from 'drizzle-orm'

export async function checkFollowUpAlerts(db: any): Promise<void> {
  try {
    const pendingFollowUps = await db.select().from(quotes)
      .where(
        and(
          lte(quotes.followUpDate, sql`now()`),
          inArray(quotes.status, ['draft', 'sent']),
          eq(quotes.isTemplate, false)
        )
      )

    if (pendingFollowUps.length > 0) {
      console.log(`[quotes-cron] ${pendingFollowUps.length} quote(s) need follow-up`)
    }
  } catch (err: any) {
    console.error('[quotes-cron] Error checking follow-up alerts:', err.message)
  }
}
