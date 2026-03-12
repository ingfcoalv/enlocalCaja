import { quotes } from '@enlocal/core-db'
import { sql, and, eq, lte } from 'drizzle-orm'

export async function expireQuotes(db: any): Promise<void> {
  try {
    const result = await db.update(quotes).set({
      status: 'expired',
      updatedAt: sql`now()`,
    }).where(
      and(
        lte(quotes.validUntil, sql`now()`),
        eq(quotes.status, 'sent')
      )
    ).returning()

    if (result.length > 0) {
      console.log(`[quotes-cron] Expired ${result.length} quote(s)`)
    }
  } catch (err: any) {
    console.error('[quotes-cron] Error expiring quotes:', err.message)
  }
}
